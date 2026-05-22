import { HttpService, RunService } from "@rbxts/services";
import { NetworkRequest, NetworkResponse, INetworkService } from "../core/types";
import { Service, Injectable } from "../core/di";

type Connection = {
    Disconnect: () => void;
};

class Signal<T extends unknown[] = []> {
    private handlers: ((...args: T) => void)[] = [];

    Connect(fn: (...args: T) => void): Connection {
        this.handlers.push(fn);
        return {
            Disconnect: () => {
                const index = this.handlers.indexOf(fn);
                if (index !== -1) {
                    const newHandlers: ((...args: T) => void)[] = [];
                    for (let i = 0; i < this.handlers.size(); i++) {
                        if (i !== index) newHandlers.push(this.handlers[i]);
                    }
                    this.handlers = newHandlers;
                }
            }
        };
    }

    Fire(...args: T): void {
        this.handlers.forEach(handler => handler(...args));
    }
}

@Service()
@Injectable
export class NetworkService implements INetworkService {
    private network: RemoteEvent = new Instance("RemoteEvent");
    private networkFolder: Folder = new Instance("Folder");
    private channels = new Map<string, Signal<[unknown]>>();
    private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason: string) => void; timeout: number }>();
    private rateLimitMap = new Map<string, number>();
    private networkStats = { sent: 0, received: 0, errors: 0 };
    private registeredFunctions = new Map<string, Callback>();
    
    private readonly RATE_LIMIT = 10;
    private readonly RATE_WINDOW = 1000;
    private readonly NETWORK_TIMEOUT = 5000;

    constructor() {
        this.setupNetwork();
    }

    private setupNetwork(): void {
        if (RunService.IsServer()) {
            this.networkFolder.Name = "NetworkFolder";
            this.networkFolder.Parent = script;
            this.network.Name = "NetworkEvent";
            this.network.Parent = this.networkFolder;
        } else {
            const serverFolder = script.WaitForChild("NetworkFolder", 10) as Folder;
            if (serverFolder) {
                this.networkFolder = serverFolder;
                const networkEvent = serverFolder.WaitForChild("NetworkEvent", 10) as RemoteEvent;
                if (networkEvent) {
                    this.network = networkEvent;
                }
            }
        }

        if (RunService.IsClient()) {
            this.network.OnClientEvent.Connect((payload: string) => {
                this.handleNetworkMessage(payload);
            });
        } else {
            this.network.OnServerEvent.Connect((player: Player, ...args: unknown[]) => {
                this.handleNetworkMessage(args[0] as string, player);
            });
        }
    }

    private handleNetworkMessage(payload: string, player?: Player): void {
        try {
            const decoded = HttpService.JSONDecode(payload) as NetworkResponse;
            this.networkStats.received++;
            
            if (decoded.id && this.pendingRequests.has(decoded.id)) {
                const request = this.pendingRequests.get(decoded.id)!;
                this.pendingRequests.delete(decoded.id);
                
                if (decoded.success) {
                    request.resolve(decoded.data);
                } else {
                    request.reject(decoded.error || "Unknown error");
                }
            } else {
                const signal = this.channels.get(decoded.id);
                if (signal) signal.Fire(decoded.data);
            }
        } catch (error) {
            this.networkStats.errors++;
            print(`[NetworkService] Network decode error: ${error}`);
        }
    }

    request<T = unknown, R = unknown>(channel: string, data: T, timeout = this.NETWORK_TIMEOUT, target?: Player): Promise<R> {
        return new Promise((resolve, reject) => {
            const id = HttpService.GenerateGUID(false);
            const request: NetworkRequest<T> = {
                id,
                channel,
                data,
                timestamp: tick()
            };

            this.pendingRequests.set(id, { 
                resolve: resolve as (value: unknown) => void, 
                reject, 
                timeout: tick() + timeout / 1000 
            });

            try {
                const payload = HttpService.JSONEncode(request);
                
                if (RunService.IsServer()) {
                    if (target) {
                        this.network.FireClient(target, payload);
                    } else {
                        this.network.FireAllClients(payload);
                    }
                } else {
                    this.network.FireServer(payload);
                }
                
                this.networkStats.sent++;
                
                task.wait(timeout / 1000);
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject("Request timeout");
                }
            } catch (error) {
                this.networkStats.errors++;
                this.pendingRequests.delete(id);
                reject(`Network error: ${error}`);
            }
        });
    }

    fire(channel: string, data: unknown, target?: Player): boolean {
        const now = tick();
        const lastCall = this.rateLimitMap.get(channel) ?? 0;
        if (now - lastCall < this.RATE_WINDOW / this.RATE_LIMIT) {
            return false;
        }
        this.rateLimitMap.set(channel, now);

        try {
            const payload = HttpService.JSONEncode({ Channel: channel, data });
            
            if (RunService.IsServer()) {
                if (target) {
                    this.network.FireClient(target, payload);
                } else {
                    this.network.FireAllClients(payload);
                }
            } else {
                this.network.FireServer(payload);
            }
            
            this.networkStats.sent++;
            return true;
        } catch (error) {
            print(`[NetworkService] Network fire failed: ${error}`);
            this.networkStats.errors++;
            return false;
        }
    }

    connect<T = unknown>(channel: string, callback: (data: T) => void): Connection {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Signal<[unknown]>());
        }
        return this.channels.get(channel)!.Connect(callback as (data: unknown) => void);
    }

    sendToServer<T>(event: string, data: T): void {
        if (!RunService.IsClient()) {
            print("[NetworkService] SendToServer can only be called on client");
            return;
        }
        this.fire(event, data);
    }

    sendToClient<T>(player: Player, event: string, data: T): void {
        if (!RunService.IsServer()) {
            print("[NetworkService] SendToClient can only be called on server");
            return;
        }
        this.fire(event, data, player);
    }

    sendToAllClients<T>(event: string, data: T): void {
        if (!RunService.IsServer()) {
            print("[NetworkService] SendToAllClients can only be called on server");
            return;
        }
        this.fire(event, data);
    }

    registerMethod(id: string, callback: Callback, isClient?: boolean): void {
        if (RunService.IsServer()) {
            if (this.networkFolder.FindFirstChild(id)) {
                print(`[NetworkService] Method with id: ${id} is already registered`);
                return;
            }
            this.registeredFunctions.set(id, callback);
            
            if (isClient) {
                const remoteFunction = new Instance("RemoteFunction");
                remoteFunction.Name = id;
                remoteFunction.OnServerInvoke = (player: Player, ...args: unknown[]) => {
                    return callback(player, ...args);
                };
                remoteFunction.Parent = this.networkFolder;
            }
        }
    }

    getRegisteredMethod<R = unknown>(id: string, args: unknown, target?: Player): Promise<R> | undefined {
        if (RunService.IsClient()) {
            const remote = this.networkFolder.WaitForChild(id, 10) as RemoteFunction;
            if (!remote) {
                print(`[NetworkService] Method with id: ${id} is not registered`);
                return Promise.reject(`Method with id: ${id} is not registered`) as Promise<R>;
            }
            return new Promise<R>((resolve, reject) => {
                try {
                    const result = remote.InvokeServer(args) as R;
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        } else if (RunService.IsServer() && target) {
            const remote = this.networkFolder.FindFirstChild(id) as RemoteFunction;
            if (remote) {
                return new Promise<R>((resolve, reject) => {
                    try {
                        const result = remote.InvokeClient(target, args) as R;
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            }
        }
        return undefined;
    }

    getStats() {
        return { ...this.networkStats };
    }
}
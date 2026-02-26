import { HttpService, RunService } from "@rbxts/services";

let freeRunnerThread: thread | undefined;

function acquireRunnerThreadAndCallEventHandler<T extends unknown[]>(fn: (...args: T) => void, ...args: T) {
    const acquiredRunnerThread = freeRunnerThread;
    freeRunnerThread = undefined;
    fn(...args);
    freeRunnerThread = acquiredRunnerThread;
}

function runEventHandlerInFreeThread() {
    while (true) {
        acquireRunnerThreadAndCallEventHandler(coroutine.yield() as never);
    }
}

class Connection<T extends unknown[] = []> {
    private _connected = true;
    private _signal: Signal<T>;
    private _fn: (...args: T) => void;
    private _next?: Connection<T>;

    constructor(signal: Signal<T>, fn: (...args: T) => void) {
        this._signal = signal;
        this._fn = fn;
    }

    Disconnect() {
        this._connected = false;
        if (this._signal["_handlerListHead"] === this) {
            this._signal["_handlerListHead"] = this._next;
        } else {
            let prev = this._signal["_handlerListHead"];
            while (prev && prev._next !== this) {
                prev = prev._next;
            }
            if (prev) prev._next = this._next;
        }
    }
}

class Signal<T extends unknown[] = []> {
    private _handlerListHead?: Connection<T>;

    Connect(fn: (...args: T) => void): Connection<T> {
        const connection = new Connection(this, fn);
        if (this._handlerListHead) {
            connection["_next"] = this._handlerListHead;
        }
        this._handlerListHead = connection;
        return connection;
    }

    DisconnectAll() {
        this._handlerListHead = undefined;
    }

    Fire(...args: T) {
        let item = this._handlerListHead;
        while (item) {
            if (item["_connected"]) {
                if (!freeRunnerThread) {
                    freeRunnerThread = coroutine.create(runEventHandlerInFreeThread);
                    coroutine.resume(freeRunnerThread);
                }
                task.spawn(freeRunnerThread, item["_fn"], ...args);
            }
            item = item["_next"];
        }
    }

    Wait(): LuaTuple<T> {
        const waitingCoroutine = coroutine.running();
        let cn: Connection<T>;
        cn = this.Connect((...args: T) => {
            cn.Disconnect();
            task.spawn(waitingCoroutine, ...args);
        });
        return coroutine.yield() as never;
    }

    Once(fn: (...args: T) => void): Connection<T> {
        let cn: Connection<T>;
        cn = this.Connect((...args: T) => {
            if (cn["_connected"]) cn.Disconnect();
            fn(...args);
        });
        return cn;
    }
}

interface IModule {
    Init?: () => void;
    OnStart?: () => void;
    OnShutdown?: () => void;
    Dependencies?: string[];
    Inject?: Record<string, string>;
    [key: string]: unknown;
}

interface ModuleError {
    moduleName: string;
    error: string;
}

/**
 * Chain class provides a comprehensive module management system with networking capabilities.
 * Handles module loading, dependency injection, lifecycle management, and client-server communication.
 */
export class Chain {
    /** Map storing all loaded modules by name */
    private Modules = new Map<string, IModule>();
    /** Cache for frequently accessed modules to improve performance */
    private ModuleCache = new Map<string, IModule>();
    /** Queue for network messages that failed to send immediately */
    private NetworkQueue: Array<{ channel: string; data: unknown }> = [];
    /** Rate limiting tracker for network channels */
    private RateLimitMap = new Map<string, number>();
    /** RemoteEvent instance for client-server communication */
    private Network: RemoteEvent = new Instance("RemoteEvent");
    /** Folder containing all network-related RemoteFunctions */
    private NetworkFolder: Folder = new Instance("Folder")
    /** Map of communication channels to their respective signals */
    private Channels = new Map<string, Signal<[unknown]>>();
    /** Maximum number of network calls allowed per rate window */
    private readonly RATE_LIMIT = 10;
    /** Time window in milliseconds for rate limiting */
    private readonly RATE_WINDOW = 1000;
    /** Flag indicating if modules have been loaded */
    private Loaded: boolean = false;
    /** Flag indicating if the Chain has been started */
    private Started: boolean = false;
    /** Cache for dependency injections by module name */
    private InjectionCache = new Map<string, Map<string, unknown>>();
    /** Map of registered function IDs to their callback implementations */
    private RegisteredFunctions = new Map <string, Callback>();
    
    /**
     * Initializes the Chain and sets up network event handling
     */
    constructor() {
        this.Network.OnClientEvent.Connect((payload: string) => {
            const decoded = HttpService.JSONDecode(payload) as { Channel: string; data: unknown };
            const signal = this.Channels.get(decoded.Channel);
            if (signal) signal.Fire(decoded.data);
        });
    }
    
    /**
     * Registers a public-facing method that can be accessed through RemoteFunctions
     * @param Id - Unique identifier for the method
     * @param Callback - Function to execute when method is called
     * @param IsClient - Whether this method should be accessible from client (server-side only)
     * @returns The registered callback, RemoteFunction, or undefined
     */
    public RegisterMethod(Id : string, Callback : Callback, IsClient? : boolean) : Callback | RemoteFunction | undefined {
        if (RunService.IsServer()) {
            if (!this.NetworkFolder.FindFirstChild(Id)) {
                this.RegisteredFunctions.set(Id, Callback)
            }
            else {
                warn(`method with id: ${Id} is already registered`)
                return this.RegisteredFunctions.get(Id)!
            }
            if (IsClient) {
                const RemoteFunction : RemoteFunction  = new Instance("RemoteFunction")
                RemoteFunction.Name = Id
                RemoteFunction.OnServerInvoke = (player : Player, ...args : unknown[]) => {
                    return Callback(player, ...args)
                }
                RemoteFunction.Parent = this.NetworkFolder
            }
        }
        if (RunService.IsClient()) {
            const Remote = this.NetworkFolder.FindFirstChild(Id) as RemoteFunction
            if (Remote) {
                return Remote
            }
            else {
                this.RegisteredFunctions.set(Id, Callback)
            }
        }
    }
    
    /**
     * Retrieves and invokes a registered method
     * @param Id - Unique identifier of the method to call
     * @param args - Arguments to pass to the method
     * @returns Promise resolving to method result (client-side) or the callback function (server-side)
     */
    public GetRegisteredMethod(Id : string, args : unknown) : Promise<unknown> | Callback | undefined {
        if (RunService.IsClient()) {
            if (!this.NetworkFolder.FindFirstChild(Id)) {
                warn(`method with id: ${Id} is not registered`)
                return Promise.reject(`method with id: ${Id} is not registered`)
            }
            const Remote = this.NetworkFolder.FindFirstChild(Id) as RemoteFunction
            return new Promise((resolve, reject) => {
                try {
                    const result = Remote.InvokeServer(args)
                    resolve(result)
                } catch (error) {
                    reject(error)
                }
            })
        }
        else {
            if (this.RegisteredFunctions.has(Id)) {
                return this.RegisteredFunctions.get(Id)
            }
        }
    }
    
    /**
     * Connects a callback to a communication channel
     * @param channel - Name of the channel to listen to
     * @param callback - Function to execute when data is received on the channel
     * @returns Connection object that can be used to disconnect the listener
     */
    public ConnectToChannel<T = unknown>(channel: string, callback: (data: T) => void): Connection<[T]> {
        if (!this.Channels.has(channel)) {
            this.Channels.set(channel, new Signal<[unknown]>());
        }
        return this.Channels.get(channel)!.Connect(callback as (data: unknown) => void) as Connection<[T]>;
    }

    /**
     * Retrieves a loaded module by name with optional type casting
     * @param name - Name of the module to retrieve
     * @returns The module instance or undefined if not found
     */
    public GetModule<T extends IModule = IModule>(name: string): T | undefined {
        if (this.ModuleCache.has(name)) return this.ModuleCache.get(name) as T;
        const module = this.Modules.get(name) as T | undefined;
        if (!module) warn(`Module "${name}" not found`);
        else this.ModuleCache.set(name, module);
        return module;
    }

    /**
     * Loads all ModuleScript instances from the specified path recursively
     * @param path - Instance to search for ModuleScripts (searches children recursively)
     * @returns Array of errors encountered during loading
     */
    public LoadModules(path: Instance): ModuleError[] {
        const errors: ModuleError[] = [];
        const loadModule = (instance: Instance) => {
            for (const child of instance.GetChildren()) {
                if (child.IsA("ModuleScript")) {
                    if (this.Modules.has(child.Name)) {
                        errors.push({ moduleName: child.Name, error: "Module already exists" });
                        continue;
                    }
                    try {
                        const module = require(child) as IModule;
                        if (typeOf(module) !== "table") throw "Invalid module";
                        this.Modules.set(child.Name, module);
                    } catch (e) {
                        errors.push({ moduleName: child.Name, error: tostring(e) });
                    }
                } else if (child.IsA("Folder")) {
                    loadModule(child);
                }
            }
        };
        loadModule(path);
        this.Loaded = true;
        return errors;
    }

    /**
     * Sends data over the network with rate limiting
     * @param channel - Channel name to send data on
     * @param data - Data to send (must be JSON serializable)
     * @returns True if sent successfully, false if rate limited or failed
     */
    public FireNetwork(channel: string, data: unknown): boolean {
        const now = tick();
        const lastCall = this.RateLimitMap.get(channel) ?? 0;
        if (now - lastCall < this.RATE_WINDOW / this.RATE_LIMIT) return false;
        this.RateLimitMap.set(channel, now);
        try {
            const payload = HttpService.JSONEncode({ Channel: channel, data });
            this.Network.FireServer(payload);
            return true;
        } catch (e) {
            warn(`Network fire failed: ${e}`);
            this.NetworkQueue.push({ channel, data });
            return false;
        }
    }

    /**
     * Injects dependencies into a module based on its Inject configuration
     * @param name - Name of the module receiving injections
     * @param module - Module instance to inject dependencies into
     * @returns ModuleError if injection fails, undefined on success
     */
    private InjectDependencies(name: string, module: IModule): ModuleError | undefined {
        if (!module.Inject) return;
        const injections = new Map<string, unknown>();
        for (const [key, depName] of pairs(module.Inject)) {
            const depModule = this.Modules.get(depName);
            if (!depModule) return { moduleName: name, error: `Injection failed: ${depName} not found` };
            module[key] = depModule;
            injections.set(key, depModule);
        }
        this.InjectionCache.set(name, injections);
    }

    /**
     * Initializes all loaded modules, handling dependencies and injections
     * Modules are initialized in dependency order to ensure proper setup
     * @returns Promise resolving to array of initialization errors
     */
    public Init(): Promise<ModuleError[]> {
        if (!this.Loaded) warn("Load modules before initting!");
        return new Promise((resolve) => {
            const errors: ModuleError[] = [];
            const initialized = new Set<string>();
            this.NetworkFolder.Parent = script
            const initModule = (name: string, module: IModule): boolean => {
                if (initialized.has(name)) return true;
                if (module.Dependencies) {
                    for (const dep of module.Dependencies) {
                        const depModule = this.Modules.get(dep);
                        if (!depModule) {
                            errors.push({ moduleName: name, error: `Missing dependency: ${dep}` });
                            return false;
                        }
                        if (!initModule(dep, depModule)) return false;
                    }
                }
                const injectionError = this.InjectDependencies(name, module);
                if (injectionError) {
                    errors.push(injectionError);
                    return false;
                }
                try {
                    if (module.Init) module.Init();
                    initialized.add(name);
                    return true;
                } catch (e) {
                    errors.push({ moduleName: name, error: tostring(e) });
                    return false;
                }
            };
            this.Modules.forEach((module, name) => initModule(name, module));
            resolve(errors);
        });
    }

    /**
     * Starts all initialized modules by calling their OnStart methods
     * @returns Promise resolving to array of startup errors
     */
    public Start(): Promise<ModuleError[]> {
        if (this.Started) return Promise.resolve([]);
        return new Promise((resolve) => {
            const errors: ModuleError[] = [];
            this.Modules.forEach((module, name) => {
                try {
                    if (module.OnStart) module.OnStart();
                } catch (e) {
                    errors.push({ moduleName: name, error: tostring(e) });
                }
            });
            this.Started = true;
            resolve(errors);
        });
    }

    /**
     * Shuts down all modules by calling their OnShutdown methods
     * @returns Promise resolving to array of shutdown errors
     */
    public Shutdown(): Promise<ModuleError[]> {
        return new Promise((resolve) => {
            const errors: ModuleError[] = [];
            this.Modules.forEach((module, name) => {
                try {
                    if (module.OnShutdown) module.OnShutdown();
                } catch (e) {
                    errors.push({ moduleName: name, error: tostring(e) });
                }
            });
            this.Started = false;
            resolve(errors);
        });
    }
    /**
     * Launches the Chain with the specified modules folder
     * Combines LoadModules, Init, and Start into a single call
     * @param Modules - Folder containing ModuleScripts to load
     * @returns Promise resolving to array of initialization errors
     *
     */

public Rise(Modules: Folder) {
        this.LoadModules(Modules)
        this.Init()
        this.Start()
    }
}

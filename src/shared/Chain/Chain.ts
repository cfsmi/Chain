import { DIContainer, Injectable, Inject } from "./core/di";
import { IChain, IStateService, INetworkService, ILoggerService, IEventService, IModule, LogLevel } from "./core/types";
import { StateService } from "./Modules/StateService";
import { NetworkService } from "./Modules/NetworkService";
import { LoggerService } from "./Modules/LoggerService";
import { EventService } from "./Modules/EventService";
import { RunService } from "@rbxts/services";

@Injectable
export class ModularChain implements IChain {
    private container: DIContainer;
    private modules = new Map<string, IModule>();
    private loaded = false;
    private started = false;

    constructor(
        @Inject('IStateService') private stateService: IStateService,
        @Inject('INetworkService') private networkService: INetworkService,
        @Inject('ILoggerService') private loggerService: ILoggerService,
        @Inject('IEventService') private eventService: IEventService
    ) {
        this.container = createChainContainer();
    }

    // Module loading functionality
    LoadModules(path: Instance): void {
        const loadModule = (instance: Instance) => {
            for (const child of instance.GetChildren()) {
                if (child.IsA("ModuleScript")) {
                    if (this.modules.has(child.Name)) {
                        this.Log(`Module ${child.Name} already exists`, 'warn');
                        continue;
                    }
                    try {
                        const required = require(child) as unknown;
                        const hasDefault = (required as Record<string, unknown>).default !== undefined;
                        const ModuleClass = (hasDefault ? (required as Record<string, unknown>).default : required) as new (framework: ModularChain, moduleName: string) => IModule;
                        
                        const moduleInstance = new ModuleClass(this, child.Name);
                        this.modules.set(child.Name, moduleInstance);
                        this.Log(`Loaded module: ${child.Name}`, 'info');
                    } catch (e) {
                        this.Log(`Failed to load module: ${child.Name} - ${e}`, 'error');
                    }
                } else if (child.IsA("Folder")) {
                    loadModule(child);
                }
            }
        };
        loadModule(path);
        this.loaded = true;
    }

    // Log level functionality
    SetLogLevel(level: number): void {
        // Implementation depends on LoggerService
        this.Log(`Log level set to: ${level}`, 'info');
    }

    // Server state functionality
    SetServerState<T>(key: string, value: T): void {
        if (!RunService.IsServer()) {
            this.Log("SetServerState can only be called on server", 'warn');
            return;
        }
        this.SetState(key, value);
    }

    GetServerState<T>(key: string): T | undefined {
        return this.GetState<T>(key);
    }

    // State Management
    SetState<T>(key: string, value: T): void {
        this.stateService.setState(key, value);
    }

    GetState<T>(key: string): T | undefined {
        return this.stateService.getState<T>(key);
    }

    SubscribeToState<T>(key: string, callback: (change: any) => void): () => void {
        return this.stateService.subscribeToState(key, callback);
    }

    SubscribeToServerState<T>(key: string, callback: (change: any) => void): () => void {
        return this.stateService.subscribeToServerState(key, callback);
    }

    EnableStateSync(keys: string[]): void {
        this.stateService.enableStateSync(keys);
    }

    RequestServerState<T>(key: string): Promise<T> {
        return this.networkService.requestServerState<T>(key);
    }

    // Event System
    Emit<T>(event: string, data: T): void {
        this.eventService.emit(event, data);
    }

    On<T>(event: string, callback: (data: T) => void): () => void {
        return this.eventService.on(event, callback);
    }

    // Networking
    SendToServer<T>(event: string, data: T): void {
        this.networkService.sendToServer(event, data);
    }

    SendToClient<T>(player: any, event: string, data: T): void {
        this.networkService.sendToClient(player, event, data);
    }

    // Logging
    Log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        this.loggerService.log(message, level);
    }
    

    // Framework lifecycle
    Init(): void {
        if (!this.loaded && this.modules.size() > 0) {
            this.Log("Load modules before initializing!", 'warn');
        }
        
        // Initialize loaded modules
        this.modules.forEach((module, name) => {
            try {
                if (module.Init) module.Init();
                this.Log(`Initialized module: ${name}`, 'info');
            } catch (e) {
                this.Log(`Failed to initialize module: ${name} - ${e}`, 'error');
            }
        });
        
        this.loggerService.log("Modular Chain framework initialized", 'info');
        this.eventService.emit('framework:init', {});
    }

    Enchain(): void {
        if (this.started) return;
        
        // Start loaded modules
        this.modules.forEach((module, name) => {
            try {
                if (module.OnStart) module.OnStart();
                this.Log(`Started module: ${name}`, 'info');
            } catch (e) {
                this.Log(`Failed to start module: ${name} - ${e}`, 'error');
            }
        });
        
        this.started = true;
        this.loggerService.log("Chain framework enchained", 'info');
        this.eventService.emit('framework:enchained', {});
    }

    Shutdown(): void {
        this.modules.forEach((module, name) => {
            try {
                if (module.OnShutdown) module.OnShutdown();
                this.Log(`Shutdown module: ${name}`, 'info');
            } catch (e) {
                this.Log(`Failed to shutdown module: ${name} - ${e}`, 'error');
            }
        });
        this.started = false;
    }

    // Static link class for module inheritance
    static link = class Link implements IModule {
        protected Framework: ModularChain;
        protected ModuleName: string;
        protected IsServer: boolean;
        protected IsClient: boolean;

        constructor(framework: ModularChain, moduleName: string) {
            this.Framework = framework;
            this.ModuleName = moduleName;
            this.IsServer = RunService.IsServer();
            this.IsClient = RunService.IsClient();
        }

        protected Log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
            this.Framework.Log(`[${this.ModuleName}] ${message}`, level);
        }

        protected SetState<T>(key: string, value: T) {
            this.Framework.SetState(key, value);
        }

        protected GetState<T>(key: string): T | undefined {
            return this.Framework.GetState<T>(key);
        }

        protected SendToServer<T>(event: string, data: T): void {
            this.Framework.SendToServer(event, data);
        }

        protected SendToClient<T>(player: any, event: string, data: T): void {
            this.Framework.SendToClient(player, event, data);
        }

        protected Emit<T>(event: string, data: T): void {
            this.Framework.Emit(event, data);
        }

        protected On<T>(event: string, callback: (data: T) => void): () => void {
            return this.Framework.On(event, callback);
        }

        Init?(): void;
        OnStart?(): void;
        OnShutdown?(): void;
    };
}

// Factory function to create configured container
export function createChainContainer(): DIContainer {
    const container = new DIContainer();
    
    // Register services
    container.register('IStateService', () => new StateService());
    container.register('INetworkService', () => new NetworkService());
    container.register('ILoggerService', () => new LoggerService());
    container.register('IEventService', () => new EventService());
    container.register('IChain', () => new ModularChain(
        container.resolve('IStateService'),
        container.resolve('INetworkService'),
        container.resolve('ILoggerService'),
        container.resolve('IEventService')
    ));
    
    return container;
}

// Main Chain class export
export class Chain extends ModularChain {
    constructor() {
        const container = createChainContainer();
        super(
            container.resolve('IStateService'),
            container.resolve('INetworkService'),
            container.resolve('ILoggerService'),
            container.resolve('IEventService')
        );
    }
}

// Convenience function to create chain instance
export function createChain(): IChain {
    return new Chain();
}
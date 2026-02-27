import { DIContainer, Injectable, Inject } from "./core/di";
import { IChain, IStateService, INetworkService, ILoggerService, IEventService } from "./core/types";
import { StateService } from "./Modules/StateService";
import { NetworkService } from "./Modules/NetworkService";
import { LoggerService } from "./Modules/LoggerService";
import { EventService } from "./Modules/EventService";

@Injectable
export class ModularChain implements IChain {
    constructor(
        @Inject('IStateService') private stateService: IStateService,
        @Inject('INetworkService') private networkService: INetworkService,
        @Inject('ILoggerService') private loggerService: ILoggerService,
        @Inject('IEventService') private eventService: IEventService
    ) {}

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
        this.loggerService.log("Modular Chain framework initialized", 'info');
        this.eventService.emit('framework:init', {});
    }

    Enchain(): void {
        this.loggerService.log("Chain framework enchained", 'info');
        this.eventService.emit('framework:enchained', {});
    }
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

// Convenience function to create chain instance
export function createChain(): IChain {
    const container = createChainContainer();
    return container.resolve<IChain>('IChain');
}
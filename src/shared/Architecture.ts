import { RunService } from "@rbxts/services";
import { Chain } from "./Chainv2";

export interface IService {
    Init?(): void;
    OnStart?(): void;
    OnShutdown?(): void;
    Dependencies?: string[];
    Inject?: Record<string, string>;
    [key: string]: unknown;
}

export interface IController {
    Init?(): void;
    OnStart?(): void;
    OnShutdown?(): void;
    Dependencies?: string[];
    Inject?: Record<string, string>;
    [key: string]: unknown;
}

export interface ErrorBoundary {
    moduleName: string;
    error: string;
    timestamp: number;
    recovered: boolean;
}

/**
 * Base Service class for server-side modules
 */
export abstract class BaseService implements IService {
    protected Framework: Chain;
    protected ModuleName: string;
    [key: string]: unknown;

    constructor(framework: Chain, moduleName: string) {
        this.Framework = framework;
        this.ModuleName = moduleName;
    }

    protected Log(level: number, message: string, metadata?: Record<string, unknown>) {
        this.Framework.Log(level, message, this.ModuleName, metadata);
    }

    protected Publish(topic: string, data: unknown) {
        this.Framework.Publish(topic, data, this.ModuleName);
    }

    protected Subscribe(topic: string, callback: (message: any) => void) {
        return this.Framework.Subscribe(topic, callback);
    }

    protected SetState<T>(key: string, value: T) {
        this.Framework.SetState(key, value);
    }

    protected GetState<T>(key: string): T | undefined {
        return this.Framework.GetState<T>(key);
    }
}

/**
 * Base Controller class for client-side modules
 */
export abstract class BaseController implements IController {
    protected Framework: Chain;
    protected ModuleName: string;
    [key: string]: unknown;

    constructor(framework: Chain, moduleName: string) {
        this.Framework = framework;
        this.ModuleName = moduleName;
    }

    protected Log(level: number, message: string, metadata?: Record<string, unknown>) {
        this.Framework.Log(level, message, this.ModuleName, metadata);
    }

    protected Publish(topic: string, data: unknown) {
        this.Framework.Publish(topic, data, this.ModuleName);
    }

    protected Subscribe(topic: string, callback: (message: any) => void) {
        return this.Framework.Subscribe(topic, callback);
    }

    protected SetState<T>(key: string, value: T) {
        this.Framework.SetState(key, value);
    }

    protected GetState<T>(key: string): T | undefined {
        return this.Framework.GetState<T>(key);
    }

    protected NetworkRequest<T, R>(channel: string, data: T): Promise<R> {
        return this.Framework.NetworkRequest<T, R>(channel, data);
    }
}

/**
 * Shared module that works on both client and server
 */
export abstract class SharedModule {
    protected Framework: Chain;
    protected ModuleName: string;
    protected IsServer: boolean;
    protected IsClient: boolean;

    constructor(framework: Chain, moduleName: string) {
        this.Framework = framework;
        this.ModuleName = moduleName;
        this.IsServer = RunService.IsServer();
        this.IsClient = RunService.IsClient();
    }

    protected Log(level: number, message: string, metadata?: Record<string, unknown>) {
        this.Framework.Log(level, message, this.ModuleName, metadata);
    }

    protected Publish(topic: string, data: unknown) {
        this.Framework.Publish(topic, data, this.ModuleName);
    }

    protected Subscribe(topic: string, callback: (message: any) => void) {
        return this.Framework.Subscribe(topic, callback);
    }

    protected SetState<T>(key: string, value: T) {
        this.Framework.SetState(key, value);
    }

    protected GetState<T>(key: string): T | undefined {
        return this.Framework.GetState<T>(key);
    }

    // Server-only methods
    protected ServerOnly<T>(fn: () => T): T | undefined {
        if (this.IsServer) {
            return fn();
        }
        return undefined;
    }

    // Client-only methods
    protected ClientOnly<T>(fn: () => T): T | undefined {
        if (this.IsClient) {
            return fn();
        }
        return undefined;
    }
}

/**
 * Error boundary decorator for module isolation
 */
export function ErrorBoundary(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(this: any, ...args: unknown[]) {
        try {
            return originalMethod(this, ...args);
        } catch (error) {
            const moduleName = this.ModuleName || this.constructor.name;
            const errorBoundary: ErrorBoundary = {
                moduleName,
                error: tostring(error),
                timestamp: tick(),
                recovered: false
            };
            
            if (this.Framework && this.Framework.Log) {
                this.Framework.Log(3, `Error in ${moduleName}.${propertyKey}: ${error}`, moduleName, { errorBoundary });
            } else {
                warn(`Error in ${moduleName}.${propertyKey}: ${error}`);
            }
            
            // Attempt graceful degradation
            if (this.OnError && typeIs(this.OnError, "function")) {
                try {
                    this.OnError(errorBoundary);
                    errorBoundary.recovered = true;
                } catch (recoveryError) {
                    if (this.Framework && this.Framework.Log) {
                        this.Framework.Log(3, `Recovery failed for ${moduleName}: ${recoveryError}`, moduleName);
                    }
                }
            }
            
            return undefined;
        }
    };
    
    return descriptor;
}

/**
 * Rate limit decorator for network methods
 */
export function RateLimit(maxCalls: number, windowMs: number) {
    const callCounts = new Map<string, { count: number; resetTime: number }>();
    
    return function(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
        const originalMethod = descriptor.value;
        
        descriptor.value = function(this: any, ...args: unknown[]) {
            const key = `${this.ModuleName || this.constructor.name}.${propertyKey}`;
            const now = tick() * 1000;
            
            if (!callCounts.has(key)) {
                callCounts.set(key, { count: 0, resetTime: now + windowMs });
            }
            
            const callData = callCounts.get(key)!;
            
            if (now > callData.resetTime) {
                callData.count = 0;
                callData.resetTime = now + windowMs;
            }
            
            if (callData.count >= maxCalls) {
                if (this.Framework && this.Framework.Log) {
                    this.Framework.Log(2, `Rate limit exceeded for ${key}`, this.ModuleName);
                }
                throw `Rate limit exceeded for ${key}`;
            }
            
            callData.count++;
            return originalMethod(this, ...args);
        };
        
        return descriptor;
    };
}
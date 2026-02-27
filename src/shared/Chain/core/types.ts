// Core type definitions and interfaces
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    module?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface NetworkRequest<T = unknown> {
    id: string;
    channel: string;
    data: T;
    timestamp: number;
}

export interface NetworkResponse<T = unknown> {
    id: string;
    success: boolean;
    data?: T;
    error?: string;
}

export interface StateChange<T = unknown> {
    key: string;
    oldValue: T;
    newValue: T;
    timestamp: number;
}

export interface EventBusMessage {
    topic: string;
    data: unknown;
    timestamp: number;
    sender?: string;
}

export interface Config {
    environment: "dev" | "staging" | "prod";
    [key: string]: unknown;
}

// Type-safe dependency injection
export type Constructor<T = {}> = new (...args: any[]) => T;
export type ServiceToken<T = any> = Constructor<T> | string | symbol;

export interface IModule {
    Init?(): void;
    OnStart?(): void;
    OnShutdown?(): void;
}

// Decorator metadata
export const INJECTABLE_METADATA = "injectable";
export const DEPENDENCIES_METADATA = "dependencies";
export const SERVICE_METADATA = "service";

export interface ServiceOptions {
    token?: ServiceToken;
    singleton?: boolean;
}

export interface InjectableMetadata {
    dependencies: ServiceToken[];
}

// Service interfaces
export type StateChangeCallback<T = unknown> = (change: StateChange<T>) => void;

export interface IStateService {
    setState<T>(key: string, value: T): void;
    getState<T>(key: string): T | undefined;
    subscribeToState<T>(key: string, callback: StateChangeCallback<T>): () => void;
    subscribeToServerState<T>(key: string, callback: StateChangeCallback<T>): () => void;
    enableStateSync(keys: string[]): void;
    updateServerState<T>(key: string, value: T): void;
    getServerState<T>(key: string): T | undefined;
    getSyncedKeys(): string[];
}

export interface INetworkService {
    sendToServer<T>(event: string, data: T): void;
    sendToClient<T>(player: any, event: string, data: T): void;
    requestServerState<T>(key: string): Promise<T>;
}

export interface ILoggerService {
    log(message: string, level: 'info' | 'warn' | 'error'): void;
}

export interface IEventService {
    emit<T>(event: string, data: T): void;
    on<T>(event: string, callback: (data: T) => void): () => void;
}

export interface IChain {
    SetState<T>(key: string, value: T): void;
    GetState<T>(key: string): T | undefined;
    SubscribeToState<T>(key: string, callback: (change: any) => void): () => void;
    SubscribeToServerState<T>(key: string, callback: (change: any) => void): () => void;
    EnableStateSync(keys: string[]): void;
    RequestServerState<T>(key: string): Promise<T>;
    Emit<T>(event: string, data: T): void;
    On<T>(event: string, callback: (data: T) => void): () => void;
    SendToServer<T>(event: string, data: T): void;
    SendToClient<T>(player: any, event: string, data: T): void;
    Log(message: string, level?: 'info' | 'warn' | 'error'): void;
    Init(): void;
    Enchain(): void;
}
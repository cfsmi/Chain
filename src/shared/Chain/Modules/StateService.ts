import { Injectable } from "../core/di";
import { IStateService, StateChangeCallback, StateChange } from "../core/types";

@Injectable()
export class StateService implements IStateService {
    private localState = new Map<string, unknown>();
    private serverState = new Map<string, unknown>();
    private stateSubscriptions = new Map<string, Set<StateChangeCallback<any>>>();
    private serverStateSubscriptions = new Map<string, Set<StateChangeCallback<any>>>();
    private syncedKeys = new Set<string>();
    private stateHistory: StateChange[] = [];

    setState<T>(key: string, value: T): void {
        const oldValue = this.localState.get(key);
        this.localState.set(key, value);
        
        const change: StateChange<T> = { 
            key, 
            oldValue: oldValue as T, 
            newValue: value,
            timestamp: tick()
        };
        
        this.stateHistory.push(change);
        
        const callbacks = this.stateSubscriptions.get(key);
        if (callbacks) {
            callbacks.forEach(callback => callback(change));
        }
    }

    getState<T>(key: string): T | undefined {
        return this.localState.get(key) as T;
    }

    subscribeToState<T>(key: string, callback: StateChangeCallback<T>): () => void {
        let callbacks = this.stateSubscriptions.get(key);
        if (!callbacks) {
            callbacks = new Set();
            this.stateSubscriptions.set(key, callbacks);
        }
        callbacks.add(callback);
        
        return () => callbacks!.delete(callback);
    }

    subscribeToServerState<T>(key: string, callback: StateChangeCallback<T>): () => void {
        let callbacks = this.serverStateSubscriptions.get(key);
        if (!callbacks) {
            callbacks = new Set();
            this.serverStateSubscriptions.set(key, callbacks);
        }
        callbacks.add(callback);
        
        return () => callbacks!.delete(callback);
    }

    enableStateSync(keys: string[]): void {
        keys.forEach(key => this.syncedKeys.add(key));
    }

    updateServerState<T>(key: string, value: T): void {
        const oldValue = this.serverState.get(key);
        this.serverState.set(key, value);
        
        const change: StateChange<T> = { 
            key, 
            oldValue: oldValue as T, 
            newValue: value,
            timestamp: tick()
        };
        
        const callbacks = this.serverStateSubscriptions.get(key);
        if (callbacks) {
            callbacks.forEach(callback => callback(change));
        }
    }

    getServerState<T>(key: string): T | undefined {
        return this.serverState.get(key) as T;
    }

    getSyncedKeys(): string[] {
        const keys: string[] = [];
        for (const key of this.syncedKeys) {
            keys.push(key);
        }
        return keys;
    }

    getStateHistory(): StateChange[] {
        return [...this.stateHistory];
    }

    clearStateHistory(): void {
        this.stateHistory = [];
    }
}
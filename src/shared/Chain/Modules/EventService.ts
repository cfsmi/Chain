import { Injectable } from "../core/di";
import { IEventService } from "../core/types";

type EventCallback<T = any> = (data: T) => void;

@Injectable
export class EventService implements IEventService {
    private eventListeners = new Map<string, Set<EventCallback<any>>>();

    emit<T>(event: string, data: T): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }

    on<T>(event: string, callback: EventCallback<T>): () => void {
        let listeners = this.eventListeners.get(event);
        if (!listeners) {
            listeners = new Set();
            this.eventListeners.set(event, listeners);
        }
        listeners.add(callback);
        
        return () => listeners!.delete(callback);
    }

    off(event: string, callback?: EventCallback<any>): void {
        if (!callback) {
            this.eventListeners.delete(event);
            return;
        }
        
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size() === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    once<T>(event: string, callback: EventCallback<T>): () => void {
        const onceCallback = (data: T) => {
            callback(data);
            this.off(event, onceCallback);
        };
        return this.on(event, onceCallback);
    }
}
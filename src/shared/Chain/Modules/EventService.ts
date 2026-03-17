import { Injectable } from "../core/di";
import { IEventService, EventBusMessage } from "../core/types";

type EventCallback<T = any> = (data: T) => void;
type Connection = { Disconnect(): void };

@Injectable
export class EventService implements IEventService {
    private eventListeners = new Map<string, Set<EventCallback<any>>>();
    private eventBus = new Map<string, Set<(message: EventBusMessage) => void>>();
    private eventFilters = new Map<string, (data: unknown) => boolean>();

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

    publish(topic: string, data: unknown, sender?: string): void {
        const message: EventBusMessage = {
            topic,
            data,
            timestamp: tick(),
            sender
        };

        if (!this.eventBus.has(topic)) {
            this.eventBus.set(topic, new Set());
        }

        const subscribers = this.eventBus.get(topic)!;
        subscribers.forEach(callback => {
            const filter = this.eventFilters.get(topic);
            if (!filter || filter(data)) {
                callback(message);
            }
        });
    }

    subscribe(topic: string, callback: (message: EventBusMessage) => void, filter?: (data: unknown) => boolean): Connection {
        if (!this.eventBus.has(topic)) {
            this.eventBus.set(topic, new Set());
        }

        if (filter) {
            this.eventFilters.set(topic, filter);
        }

        const subscribers = this.eventBus.get(topic)!;
        subscribers.add(callback);

        return {
            Disconnect: () => {
                subscribers.delete(callback);
                if (subscribers.size() === 0) {
                    this.eventBus.delete(topic);
                    this.eventFilters.delete(topic);
                }
            }
        };
    }
}
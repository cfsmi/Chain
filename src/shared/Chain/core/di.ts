import { Constructor, ServiceToken, INJECTABLE_METADATA, DEPENDENCIES_METADATA, SERVICE_METADATA, ServiceOptions, InjectableMetadata } from "./types";

// Type-safe dependency injection container
export class DIContainer {
    private services = new Map<ServiceToken, any>();
    private singletons = new Map<ServiceToken, any>();
    private factories = new Map<ServiceToken, () => any>();

    register<T>(token: ServiceToken<T>, factory: () => T, options: ServiceOptions = {}): void {
        if (options.singleton) {
            this.factories.set(token, factory);
        } else {
            this.services.set(token, factory);
        }
    }

    registerInstance<T>(token: ServiceToken<T>, instance: T): void {
        this.singletons.set(token, instance);
    }

    resolve<T>(token: ServiceToken<T>): T {
        // Check singletons first
        if (this.singletons.has(token)) {
            return this.singletons.get(token);
        }

        // Check singleton factories
        if (this.factories.has(token)) {
            const instance = this.factories.get(token)!();
            this.singletons.set(token, instance);
            return instance;
        }

        // Check regular services
        if (this.services.has(token)) {
            return this.services.get(token)();
        }

        // Auto-resolve constructors
        if (typeof token === "function") {
            const dependencies = this.getDependencies(token);
            const resolvedDeps = dependencies.map(dep => this.resolve(dep));
            return new (token as Constructor<T>)(...resolvedDeps);
        }

        throw `Service not found: ${tostring(token)}`;
    }

    private getDependencies(target: Constructor): ServiceToken[] {
        const metadata = (target as any)[DEPENDENCIES_METADATA] as ServiceToken[] | undefined;
        return metadata || [];
    }
}

// Decorators
export function Injectable<T extends Constructor>(target: T): T {
    (target as any)[INJECTABLE_METADATA] = true;
    return target;
}

export function Inject<T>(token: ServiceToken<T>) {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) {
        if (parameterIndex !== undefined) {
            // Parameter decorator
            const existingTokens = (target[DEPENDENCIES_METADATA] as ServiceToken[]) || [];
            existingTokens[parameterIndex] = token;
            target[DEPENDENCIES_METADATA] = existingTokens;
        } else {
            // Property decorator
            Object.defineProperty(target, propertyKey!, {
                get: function() {
                    const container = (this as any).__container as DIContainer;
                    return container?.resolve(token);
                },
                enumerable: true,
                configurable: true
            });
        }
    };
}

export function Service(options: ServiceOptions = { singleton: true }) {
    return function <T extends Constructor>(target: T): T {
        (target as any)[SERVICE_METADATA] = options;
        (target as any)[INJECTABLE_METADATA] = true;
        return target;
    };
}
import { Constructor, ServiceToken, INJECTABLE_METADATA, DEPENDENCIES_METADATA, SERVICE_METADATA, ServiceOptions, InjectableMetadata } from "./types";

// Type-safe dependency injection container
export class DIContainer {
    private services = new Map<ServiceToken, () => unknown>();
    private singletons = new Map<ServiceToken, unknown>();
    private factories = new Map<ServiceToken, () => unknown>();

    register<T>(token: ServiceToken<T>, factory: () => T, options: ServiceOptions = {}): void {
        if (options.singleton) {
            this.factories.set(token, factory as () => unknown);
        } else {
            this.services.set(token, factory as () => unknown);
        }
    }

    registerInstance<T>(token: ServiceToken<T>, instance: T): void {
        this.singletons.set(token, instance as unknown);
    }

    resolve<T>(token: ServiceToken<T>): T {
        // Check singletons first
        if (this.singletons.has(token)) {
            return this.singletons.get(token) as T;
        }

        // Check singleton factories
        if (this.factories.has(token)) {
            const instance = this.factories.get(token)!();
            this.singletons.set(token, instance);
            return instance as T;
        }

        // Check regular services
        if (this.services.has(token)) {
            return this.services.get(token)!() as T;
        }

        // Auto-resolve constructors
        if (typeOf(token) === "function") {
            const dependencies = this.getDependencies(token as Constructor);
            const resolvedDeps = dependencies.map(dep => this.resolve(dep)) as unknown[];
            return new (token as Constructor<T>)(...resolvedDeps);
        }

        throw `Service not found: ${tostring(token)}`;
    }

    private getDependencies(target: Constructor): ServiceToken[] {
        const metadata = (target as unknown as Record<string, unknown>)[DEPENDENCIES_METADATA] as ServiceToken[] | undefined;
        return metadata || [];
    }
}

// Decorators
export function Injectable<T>(target: T): void;
export function Injectable(): <T>(target: T) => void;
export function Injectable(target?: unknown) {
    if (target) {
        (target as any)[INJECTABLE_METADATA] = true;
        return target;
    }

    return function (target: unknown) {
        (target as any)[INJECTABLE_METADATA] = true;
        return target;
    };
}

export function Inject<T>(token: ServiceToken<T>) {
    return function (target: unknown, propertyKey: string | symbol | undefined, parameterIndex?: number) {
        if (parameterIndex !== undefined) {
            const existingTokens = (target as unknown as Record<string, unknown>)[DEPENDENCIES_METADATA] as ServiceToken[] || [];
            existingTokens[parameterIndex] = token;
            (target as unknown as Record<string, unknown>)[DEPENDENCIES_METADATA] = existingTokens;
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
export interface ErrorBoundary {
    moduleName: string;
    error: string;
    timestamp: number;
    recovered: boolean;
}

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
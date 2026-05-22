import { LogLevel, LogEntry, ILoggerService } from "../core/types";
import { Service, Injectable } from "../core/di";

@Service()
@Injectable
export class LoggerService implements ILoggerService {
    private logLevel: LogLevel = LogLevel.INFO;
    private moduleFilters = new Set<string>();
    private logBuffer = new Map<string, LogEntry[]>();
    private bufferSize = 1000;

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    addModuleFilter(module: string): void {
        this.moduleFilters.add(module);
    }

    log(message: string, level: 'info' | 'warn' | 'error' = 'info', module?: string): void {
        const logLevelMap = {
            'info': LogLevel.INFO,
            'warn': LogLevel.WARN,
            'error': LogLevel.ERROR
        };
        this.logWithLevel(logLevelMap[level], message, module);
    }

    private logWithLevel(level: LogLevel, message: string, module?: string, metadata?: Record<string, unknown>): void {
        if (level < this.logLevel) return;
        if (module && this.moduleFilters.size() > 0 && !this.moduleFilters.has(module)) return;

        const entry: LogEntry = {
            level,
            message,
            module,
            timestamp: tick(),
            metadata
        };

        this.addToBuffer(entry);
        this.printLog(entry);
    }

    debug(message: string, module?: string, metadata?: Record<string, unknown>): void {
        this.logWithLevel(LogLevel.DEBUG, message, module, metadata);
    }

    info(message: string, module?: string, metadata?: Record<string, unknown>): void {
        this.logWithLevel(LogLevel.INFO, message, module, metadata);
    }

    warn(message: string, module?: string, metadata?: Record<string, unknown>): void {
        this.logWithLevel(LogLevel.WARN, message, module, metadata);
    }

    error(message: string, module?: string, metadata?: Record<string, unknown>): void {
        this.logWithLevel(LogLevel.ERROR, message, module, metadata);
    }

    getLogs(module?: string): LogEntry[] {
        if (module) {
            return this.logBuffer.get(module) || [];
        }
        
        const allLogs: LogEntry[] = [];
        for (const [, logs] of this.logBuffer) {
            for (let i = 0; i < logs.size(); i++) {
                allLogs.push(logs[i]);
            }
        }
        
        // Manual sort for roblox-ts compatibility
        for (let i = 0; i < allLogs.size() - 1; i++) {
            for (let j = i + 1; j < allLogs.size(); j++) {
                if (allLogs[i].timestamp > allLogs[j].timestamp) {
                    const temp = allLogs[i];
                    allLogs[i] = allLogs[j];
                    allLogs[j] = temp;
                }
            }
        }
        return allLogs;
    }

    clearLogs(module?: string): void {
        if (module) {
            this.logBuffer.delete(module);
        } else {
            this.logBuffer.clear();
        }
    }

    private addToBuffer(entry: LogEntry): void {
        const moduleKey = entry.module || "Chain";
        
        if (!this.logBuffer.has(moduleKey)) {
            this.logBuffer.set(moduleKey, []);
        }
        
        const buffer = this.logBuffer.get(moduleKey)!;
        buffer.push(entry);
        
        // Maintain buffer size
        if (buffer.size() > this.bufferSize) {
            buffer.shift();
        }
    }

    private printLog(entry: LogEntry): void {
        const levelName = LogLevel[entry.level];
        const prefix = entry.module ? `[${entry.module}]` : "[Chain]";
        print(`${levelName} ${prefix}: ${entry.message}`);
    }
}
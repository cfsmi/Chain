import { HttpService, RunService } from "@rbxts/services";

let freeRunnerThread: thread | undefined;

function acquireRunnerThreadAndCallEventHandler<T extends unknown[]>(fn: (...args: T) => void, ...args: T) {
    const acquiredRunnerThread = freeRunnerThread;
    freeRunnerThread = undefined;
    fn(...args);
    freeRunnerThread = acquiredRunnerThread;
}

function runEventHandlerInFreeThread() {
    while (true) {
        acquireRunnerThreadAndCallEventHandler(coroutine.yield() as never);
    }
}

class Connection<T extends unknown[] = []> {
    private _connected = true;
    private _signal: Signal<T>;
    private _fn: (...args: T) => void;
    private _next?: Connection<T>;

    constructor(signal: Signal<T>, fn: (...args: T) => void) {
        this._signal = signal;
        this._fn = fn;
    }

    Disconnect() {
        this._connected = false;
        if (this._signal["_handlerListHead"] === this) {
            this._signal["_handlerListHead"] = this._next;
        } else {
            let prev = this._signal["_handlerListHead"];
            while (prev && prev._next !== this) {
                prev = prev._next;
            }
            if (prev) prev._next = this._next;
        }
    }
}

class Signal<T extends unknown[] = []> {
    private _handlerListHead?: Connection<T>;

    Connect(fn: (...args: T) => void): Connection<T> {
        const connection = new Connection(this, fn);
        if (this._handlerListHead) {
            connection["_next"] = this._handlerListHead;
        }
        this._handlerListHead = connection;
        return connection;
    }

    DisconnectAll() {
        this._handlerListHead = undefined;
    }

    Fire(...args: T) {
        let item = this._handlerListHead;
        while (item) {
            if (item["_connected"]) {
                if (!freeRunnerThread) {
                    freeRunnerThread = coroutine.create(runEventHandlerInFreeThread);
                    coroutine.resume(freeRunnerThread);
                }
                task.spawn(freeRunnerThread, item["_fn"], ...args);
            }
            item = item["_next"];
        }
    }

    Wait(): LuaTuple<T> {
        const waitingCoroutine = coroutine.running();
        let cn: Connection<T>;
        cn = this.Connect((...args: T) => {
            cn.Disconnect();
            task.spawn(waitingCoroutine, ...args);
        });
        return coroutine.yield() as never;
    }

    Once(fn: (...args: T) => void): Connection<T> {
        let cn: Connection<T>;
        cn = this.Connect((...args: T) => {
            if (cn["_connected"]) cn.Disconnect();
            fn(...args);
        });
        return cn;
    }
}

interface IModule {
    Init?: () => void;
    OnStart?: () => void;
    OnShutdown?: () => void;
    Dependencies?: string[];
    Inject?: Record<string, string>;
    [key: string]: unknown;
}

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

interface LogEntry {
    level: LogLevel;
    message: string;
    module?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

interface NetworkRequest<T = unknown> {
    id: string;
    channel: string;
    data: T;
    timestamp: number;
}

interface NetworkResponse<T = unknown> {
    id: string;
    success: boolean;
    data?: T;
    error?: string;
}

interface StateChange<T = unknown> {
    key: string;
    oldValue: T;
    newValue: T;
    timestamp: number;
}

interface EventBusMessage {
    topic: string;
    data: unknown;
    timestamp: number;
    sender?: string;
}

interface Config {
    environment: "dev" | "staging" | "prod";
    [key: string]: unknown;
}

/**
 * TestChain extends the base Chain with testing capabilities and enhanced features
 */
export class Chain {
    private Modules = new Map<string, IModule>();
    private ModuleCache = new Map<string, IModule>();
    private NetworkQueue: Array<{ channel: string; data: unknown }> = [];
    private RateLimitMap = new Map<string, number>();
    private Network: RemoteEvent = new Instance("RemoteEvent");
    private NetworkFolder: Folder = new Instance("Folder");
    private Channels = new Map<string, Signal<[unknown]>>();
    private RegisteredFunctions = new Map<string, Callback>();
    private InjectionCache = new Map<string, Map<string, unknown>>();
    
    // Enhanced features
    private Logger = new Map<string, LogEntry[]>();
    private LogLevel: LogLevel = LogLevel.INFO;
    private ModuleFilters = new Set<string>();
    private PendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (reason: string) => void; timeout: number }>();
    private NetworkStats = { sent: 0, received: 0, errors: 0 };
    private ModulePerformance = new Map<string, { initTime: number; startTime: number }>();
    private MockedModules = new Map<string, IModule>();
    private TestMode = false;
    
    // Event Bus
    private EventBus = new Map<string, Signal<[EventBusMessage]>>();
    private EventFilters = new Map<string, (data: unknown) => boolean>();
    
    // State Management
    private State = new Map<string, unknown>();
    private StateHistory: StateChange[] = [];
    private StateSubscriptions = new Map<string, Signal<[StateChange]>>();
    
    // Client-Server State Sync
    private ServerState = new Map<string, unknown>();
    private ServerStateSubscriptions = new Map<string, Signal<[StateChange]>>();
    private StateSyncEnabled = false;
    private SyncedKeys = new Set<string>();
    
    // Configuration
    private Config: Config = { environment: "dev" };
    private ConfigWatchers = new Map<string, Signal<[unknown]>>();
    
    private readonly RATE_LIMIT = 10;
    private readonly RATE_WINDOW = 1000;
    private readonly NETWORK_TIMEOUT = 5000;
    private Loaded = false;
    private Started = false;

    constructor() {
        this.Network.OnClientEvent.Connect((payload: string) => {
            try {
                const decoded = HttpService.JSONDecode(payload) as NetworkResponse;
                this.NetworkStats.received++;
                
                if (decoded.id && this.PendingRequests.has(decoded.id)) {
                    const request = this.PendingRequests.get(decoded.id)!;
                    this.PendingRequests.delete(decoded.id);
                    
                    if (decoded.success) {
                        request.resolve(decoded.data);
                    } else {
                        request.reject(decoded.error || "Unknown error");
                    }
                } else {
                    const signal = this.Channels.get(decoded.id);
                    if (signal) signal.Fire(decoded.data);
                }
            } catch (error) {
                this.NetworkStats.errors++;
                this.Log(LogLevel.ERROR, `Network decode error: ${error}`, "TestChain");
            }
        });
    }

    /**
     * Enhanced logging system with levels and filtering
     */
    public Log(level: LogLevel, message: string, module?: string, metadata?: Record<string, unknown>) {
        if (level < this.LogLevel) return;
        if (module && !this.ModuleFilters.isEmpty() && !this.ModuleFilters.has(module)) return;

        const entry: LogEntry = {
            level,
            message,
            module,
            timestamp: tick(),
            metadata
        };

        const moduleKey = module || "Chain";
        if (!this.Logger.has(moduleKey)) {
            this.Logger.set(moduleKey, []);
        }
        this.Logger.get(moduleKey)!.push(entry);

        const levelName = LogLevel[level];
        const prefix = module ? `[${module}]` : "[Chain]";
        print(`${levelName} ${prefix}: ${message}`);
    }

    /**
     * Set log level filter
     */
    public SetLogLevel(level: LogLevel) {
        this.LogLevel = level;
    }

    /**
     * Add module to log filter (only these modules will log)
     */
    public AddModuleFilter(module: string) {
        this.ModuleFilters.add(module);
    }

    /**
     * Type-safe network request with timeout
     */
    public NetworkRequest<T = unknown, R = unknown>(channel: string, data: T, timeout = this.NETWORK_TIMEOUT): Promise<R> {
        return new Promise((resolve, reject) => {
            const id = HttpService.GenerateGUID(false);
            const request: NetworkRequest<T> = {
                id,
                channel,
                data,
                timestamp: tick()
            };

            this.PendingRequests.set(id, { 
                resolve: resolve as (value: unknown) => void, 
                reject, 
                timeout: tick() + timeout / 1000 
            });

            try {
                const payload = HttpService.JSONEncode(request);
                this.Network.FireServer(payload);
                this.NetworkStats.sent++;
                
                task.wait(timeout / 1000);
                if (this.PendingRequests.has(id)) {
                    this.PendingRequests.delete(id);
                    reject("Request timeout");
                }
            } catch (error) {
                this.NetworkStats.errors++;
                this.PendingRequests.delete(id);
                reject(`Network error: ${error}`);
            }
        });
    }

    /**
     * Enable test mode with module mocking
     */
    public EnableTestMode() {
        this.TestMode = true;
        this.Log(LogLevel.INFO, "Test mode enabled", "TestChain");
    }

    /**
     * Mock a module for testing
     */
    public MockModule<T extends IModule>(name: string, mockModule: T) {
        if (!this.TestMode) {
            this.Log(LogLevel.WARN, "Mocking modules outside test mode", "TestChain");
        }
        this.MockedModules.set(name, mockModule);
        this.Log(LogLevel.DEBUG, `Mocked module: ${name}`, "TestChain");
    }

    /**
     * Get module with mock support
     */
    public GetModule<T extends IModule = IModule>(name: string): T | undefined {
        if (this.TestMode && this.MockedModules.has(name)) {
            return this.MockedModules.get(name) as T;
        }

        if (this.ModuleCache.has(name)) return this.ModuleCache.get(name) as T;
        const module = this.Modules.get(name) as T | undefined;
        if (!module) {
            this.Log(LogLevel.WARN, `Module "${name}" not found`, "TestChain");
        } else {
            this.ModuleCache.set(name, module);
        }
        return module;
    }

    /**
     * Get network statistics
     */
    public GetNetworkStats() {
        return { ...this.NetworkStats };
    }

    /**
     * Get module performance data
     */
    public GetModulePerformance(module?: string) {
        if (module) {
            return this.ModulePerformance.get(module);
        }
        return this.ModulePerformance;
    }

    /**
     * Get logs for a specific module or all logs
     */
    public GetLogs(module?: string): LogEntry[] {
        if (module) {
            return this.Logger.get(module) || [];
        }
        const allLogs: LogEntry[] = [];
        for (const [, logs] of this.Logger) {
            for (const log of logs) {
                allLogs.push(log);
            }
        }
        // Sort manually since roblox-ts sort expects a predicate function
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

    /**
     * Clear logs
     */
    public ClearLogs(module?: string) {
        if (module) {
            this.Logger.delete(module);
        } else {
            this.Logger.clear();
        }
    }

    /**
     * Global Event Bus - Publish message to topic
     */
    public Publish(topic: string, data: unknown, sender?: string) {
        const message: EventBusMessage = {
            topic,
            data,
            timestamp: tick(),
            sender
        };

        if (!this.EventBus.has(topic)) {
            this.EventBus.set(topic, new Signal<[EventBusMessage]>());
        }

        const signal = this.EventBus.get(topic)!;
        signal.Fire(message);
        this.Log(LogLevel.DEBUG, `Published to topic: ${topic}`, sender || "EventBus");
    }

    /**
     * Subscribe to event bus topic
     */
    public Subscribe(topic: string, callback: (message: EventBusMessage) => void, filter?: (data: unknown) => boolean): Connection<[EventBusMessage]> {
        if (!this.EventBus.has(topic)) {
            this.EventBus.set(topic, new Signal<[EventBusMessage]>());
        }

        if (filter) {
            this.EventFilters.set(topic, filter);
        }

        return this.EventBus.get(topic)!.Connect((message) => {
            const topicFilter = this.EventFilters.get(topic);
            if (!topicFilter || topicFilter(message.data)) {
                callback(message);
            }
        });
    }

    /**
     * Set local client state value with history tracking
     */
    public SetState<T>(key: string, value: T) {
        const oldValue = this.State.get(key) as T;
        this.State.set(key, value);

        const change: StateChange<T> = {
            key,
            oldValue,
            newValue: value,
            timestamp: tick()
        };

        this.StateHistory.push(change);
        
        if (!this.StateSubscriptions.has(key)) {
            this.StateSubscriptions.set(key, new Signal<[StateChange]>());
        }

        this.StateSubscriptions.get(key)!.Fire(change);
        this.Log(LogLevel.DEBUG, `Local state changed: ${key}`, "StateManager");
    }

    /**
     * Set server state value (server-side only)
     */
    public SetServerState<T>(key: string, value: T) {
        if (!RunService.IsServer()) {
            this.Log(LogLevel.WARN, "SetServerState can only be called on server", "StateManager");
            return;
        }

        const oldValue = this.ServerState.get(key) as T;
        this.ServerState.set(key, value);

        const change: StateChange<T> = {
            key,
            oldValue,
            newValue: value,
            timestamp: tick()
        };

        // Broadcast to all clients if syncing is enabled
        if (this.StateSyncEnabled && this.SyncedKeys.has(key)) {
            this.BroadcastServerState(key, value);
        }

        this.Log(LogLevel.DEBUG, `Server state changed: ${key}`, "StateManager");
    }

    /**
     * Get server state value
     */
    public GetServerState<T>(key: string): T | undefined {
        return this.ServerState.get(key) as T;
    }

    /**
     * Request server state from client
     */
    public async RequestServerState<T>(key: string): Promise<T | undefined> {
        if (RunService.IsServer()) {
            return this.GetServerState<T>(key);
        }

        try {
            const response = await this.NetworkRequest<{ key: string }, { value: T }>("__getServerState", { key });
            return response.value;
        } catch (error) {
            this.Log(LogLevel.ERROR, `Failed to request server state: ${error}`, "StateManager");
            return undefined;
        }
    }

    /**
     * Subscribe to server state changes
     */
    public SubscribeToServerState<T>(key: string, callback: (change: StateChange<T>) => void): Connection<[StateChange]> {
        if (!this.ServerStateSubscriptions.has(key)) {
            this.ServerStateSubscriptions.set(key, new Signal<[StateChange]>());
        }
        return this.ServerStateSubscriptions.get(key)!.Connect(callback as (change: StateChange) => void) as Connection<[StateChange]>;
    }

    /**
     * Enable state synchronization for specific keys
     */
    public EnableStateSync(keys: string[]) {
        this.StateSyncEnabled = true;
        for (const key of keys) {
            this.SyncedKeys.add(key);
        }
        
        // Register server state handler
        if (RunService.IsServer()) {
            this.RegisterMethod("__getServerState", (player: Player, data: { key: string }) => {
                const value = this.GetServerState(data.key);
                return { value };
            }, true);
        } else {
            // Subscribe to server state updates
            this.ConnectToChannel<{ key: string; value: unknown }>("__serverStateUpdate", (data) => {
                const oldValue = this.ServerState.get(data.key);
                this.ServerState.set(data.key, data.value);
                
                const change: StateChange = {
                    key: data.key,
                    oldValue,
                    newValue: data.value,
                    timestamp: tick()
                };
                
                if (this.ServerStateSubscriptions.has(data.key)) {
                    this.ServerStateSubscriptions.get(data.key)!.Fire(change);
                }
            });
        }
        
        this.Log(LogLevel.INFO, `State sync enabled for keys: ${keys.join(", ")}`, "StateManager");
    }

    /**
     * Broadcast server state to all clients
     */
    private BroadcastServerState(key: string, value: unknown) {
        if (!RunService.IsServer()) return;
        
        this.FireNetwork("__serverStateUpdate", { key, value });
    }

    /**
     * Get state value
     */
    public GetState<T>(key: string): T | undefined {
        return this.State.get(key) as T;
    }

    /**
     * Subscribe to state changes
     */
    public SubscribeToState<T>(key: string, callback: (change: StateChange<T>) => void): Connection<[StateChange]> {
        if (!this.StateSubscriptions.has(key)) {
            this.StateSubscriptions.set(key, new Signal<[StateChange]>());
        }
        return this.StateSubscriptions.get(key)!.Connect(callback as (change: StateChange) => void) as Connection<[StateChange]>;
    }

    /**
     * Get state history for time-travel debugging
     */
    public GetStateHistory(): StateChange[] {
        return [...this.StateHistory];
    }
    public ClearStateHistory() {
        this.StateHistory.clear()
    }
    /**
     * Restore state to a previous point in time
     */
    public RestoreState(timestamp: number) {
        if (!this.TestMode) {
            this.Log(LogLevel.WARN, "State restoration only available in test mode", "StateManager");
            return;
        }

        const targetHistory = this.StateHistory.filter(change => change.timestamp <= timestamp);
        this.State.clear();
        
        for (const change of targetHistory) {
            this.State.set(change.key, change.newValue);
        }
        
        this.Log(LogLevel.INFO, `State restored to timestamp: ${timestamp}`, "StateManager");
    }

    /**
     * Set configuration value
     */
    public SetConfig<T>(key: string, value: T) {
        const oldValue = this.Config[key];
        this.Config[key] = value;

        if (!this.ConfigWatchers.has(key)) {
            this.ConfigWatchers.set(key, new Signal<[unknown]>());
        }

        this.ConfigWatchers.get(key)!.Fire(value);
        this.Log(LogLevel.DEBUG, `Config changed: ${key}`, "ConfigManager");
    }

    /**
     * Get configuration value
     */
    public GetConfig<T>(key: string): T | undefined {
        return this.Config[key] as T;
    }

    /**
     * Watch configuration changes
     */
    public WatchConfig<T>(key: string, callback: (value: T) => void): Connection<[T]> {
        if (!this.ConfigWatchers.has(key)) {
            this.ConfigWatchers.set(key, new Signal<[unknown]>());
        }
        return this.ConfigWatchers.get(key)!.Connect(callback as (value: unknown) => void) as Connection<[T]>;
    }

    /**
     * Load configuration from object
     */
    public LoadConfig(config: Partial<Config>) {
        for (const [key, value] of pairs(config)) {
            this.SetConfig(key as string, value);
        }
        this.Log(LogLevel.INFO, "Configuration loaded", "ConfigManager");
    }

    public ConnectToChannel<T = unknown>(channel: string, callback: (data: T) => void): Connection<[T]> {
        if (!this.Channels.has(channel)) {
            this.Channels.set(channel, new Signal<[unknown]>());
        }
        return this.Channels.get(channel)!.Connect(callback as (data: unknown) => void) as Connection<[T]>;
    }

    public RegisterMethod(Id: string, Callback: Callback, IsClient?: boolean): Callback | RemoteFunction | undefined {
        if (RunService.IsServer()) {
            if (!this.NetworkFolder.FindFirstChild(Id)) {
                this.RegisteredFunctions.set(Id, Callback);
            } else {
                this.Log(LogLevel.WARN, `Method with id: ${Id} is already registered`, "TestChain");
                return this.RegisteredFunctions.get(Id)!;
            }
            if (IsClient) {
                const RemoteFunction: RemoteFunction = new Instance("RemoteFunction");
                RemoteFunction.Name = Id;
                RemoteFunction.OnServerInvoke = (player: Player, ...args: unknown[]) => {
                    return Callback(player, ...args);
                };
                RemoteFunction.Parent = this.NetworkFolder;
            }
        }
        if (RunService.IsClient()) {
            const Remote = this.NetworkFolder.FindFirstChild(Id) as RemoteFunction;
            if (Remote) {
                return Remote;
            } else {
                this.RegisteredFunctions.set(Id, Callback);
            }
        }
    }

    public GetRegisteredMethod(Id: string, args: unknown): Promise<unknown> | Callback | undefined {
        if (RunService.IsClient()) {
            if (!this.NetworkFolder.FindFirstChild(Id)) {
                this.Log(LogLevel.WARN, `Method with id: ${Id} is not registered`, "TestChain");
                return Promise.reject(`Method with id: ${Id} is not registered`);
            }
            const Remote = this.NetworkFolder.FindFirstChild(Id) as RemoteFunction;
            return new Promise((resolve, reject) => {
                try {
                    const result = Remote.InvokeServer(args);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        } else {
            if (this.RegisteredFunctions.has(Id)) {
                return this.RegisteredFunctions.get(Id);
            }
        }
    }

    /**
     * Load modules with performance tracking
     */
    public LoadModules(path: Instance): Array<{ moduleName: string; error: string }> {
        const errors: Array<{ moduleName: string; error: string }> = [];
        const loadModule = (instance: Instance) => {
            for (const child of instance.GetChildren()) {
                if (child.IsA("ModuleScript")) {
                    if (this.Modules.has(child.Name)) {
                        errors.push({ moduleName: child.Name, error: "Module already exists" });
                        continue;
                    }
                    const startTime = tick();
                    try {
                        const module = require(child) as IModule;
                        if (typeOf(module) !== "table") throw "Invalid module";
                        this.Modules.set(child.Name, module);
                        const loadTime = tick() - startTime;
                        this.ModulePerformance.set(child.Name, { initTime: 0, startTime: loadTime });
                        this.Log(LogLevel.DEBUG, `Loaded module: ${child.Name} (${math.floor(loadTime * 1000)}ms)`, "TestChain");
                    } catch (e) {
                        errors.push({ moduleName: child.Name, error: tostring(e) });
                        this.Log(LogLevel.ERROR, `Failed to load module: ${child.Name} - ${e}`, "TestChain");
                    }
                } else if (child.IsA("Folder")) {
                    loadModule(child);
                }
            }
        };
        loadModule(path);
        this.Loaded = true;
        return errors;
    }

    /**
     * Initialize modules with dependency injection and performance tracking
     */
    public Init(): Promise<Array<{ moduleName: string; error: string }>> {
        if (!this.Loaded) this.Log(LogLevel.WARN, "Load modules before initializing!", "TestChain");
        return new Promise((resolve) => {
            const errors: Array<{ moduleName: string; error: string }> = [];
            const initialized = new Set<string>();
            this.NetworkFolder.Parent = script;

            const initModule = (name: string, module: IModule): boolean => {
                if (initialized.has(name)) return true;
                
                if (module.Dependencies) {
                    for (const dep of module.Dependencies) {
                        const depModule = this.Modules.get(dep);
                        if (!depModule) {
                            errors.push({ moduleName: name, error: `Missing dependency: ${dep}` });
                            return false;
                        }
                        if (!initModule(dep, depModule)) return false;
                    }
                }

                const injectionError = this.InjectDependencies(name, module);
                if (injectionError) {
                    errors.push(injectionError);
                    return false;
                }

                const startTime = tick();
                try {
                    if (module.Init) module.Init();
                    const initTime = tick() - startTime;
                    const perf = this.ModulePerformance.get(name);
                    if (perf) perf.initTime = initTime;
                    initialized.add(name);
                    this.Log(LogLevel.DEBUG, `Initialized module: ${name} (${math.floor(initTime * 1000)}ms)`, "TestChain");
                    return true;
                } catch (e) {
                    errors.push({ moduleName: name, error: tostring(e) });
                    this.Log(LogLevel.ERROR, `Failed to initialize module: ${name} - ${e}`, "TestChain");
                    return false;
                }
            };

            this.Modules.forEach((module, name) => initModule(name, module));
            resolve(errors);
        });
    }

    /**
     * Start all modules
     */
    public Enchain(): Promise<Array<{ moduleName: string; error: string }>> {
        if (this.Started) return Promise.resolve([]);
        return new Promise((resolve) => {
            const errors: Array<{ moduleName: string; error: string }> = [];
            this.Modules.forEach((module, name) => {
                const startTime = tick();
                try {
                    if (module.OnStart) module.OnStart();
                    const execTime = tick() - startTime;
                    const perf = this.ModulePerformance.get(name);
                    if (perf) perf.startTime = execTime;
                    this.Log(LogLevel.DEBUG, `Started module: ${name} (${math.floor(execTime * 1000)}ms)`, "TestChain");
                } catch (e) {
                    errors.push({ moduleName: name, error: tostring(e) });
                    this.Log(LogLevel.ERROR, `Failed to start module: ${name} - ${e}`, "TestChain");
                }
            });
            this.Started = true;
            resolve(errors);
        });
    }

    /**
     * Shutdown all modules
     */
    public Shutdown(): Promise<Array<{ moduleName: string; error: string }>> {
        return new Promise((resolve) => {
            const errors: Array<{ moduleName: string; error: string }> = [];
            this.Modules.forEach((module, name) => {
                try {
                    if (module.OnShutdown) module.OnShutdown();
                    this.Log(LogLevel.DEBUG, `Shutdown module: ${name}`, "TestChain");
                } catch (e) {
                    errors.push({ moduleName: name, error: tostring(e) });
                    this.Log(LogLevel.ERROR, `Failed to shutdown module: ${name} - ${e}`, "TestChain");
                }
            });
            this.Started = false;
            resolve(errors);
        });
    }

    /**
     * Inject dependencies into a module
     */
    private InjectDependencies(name: string, module: IModule): { moduleName: string; error: string } | undefined {
        if (!module.Inject) return;
        const injections = new Map<string, unknown>();
        for (const [key, depName] of pairs(module.Inject)) {
            const depModule = this.TestMode && this.MockedModules.has(depName) 
                ? this.MockedModules.get(depName)
                : this.Modules.get(depName);
            if (!depModule) return { moduleName: name, error: `Injection failed: ${depName} not found` };
            module[key] = depModule;
            injections.set(key, depModule);
        }
        this.InjectionCache.set(name, injections);
    }

    /**
     * Fire network event with rate limiting
     */
    public FireNetwork(channel: string, data: unknown): boolean {
        const now = tick();
        const lastCall = this.RateLimitMap.get(channel) ?? 0;
        if (now - lastCall < this.RATE_WINDOW / this.RATE_LIMIT) {
            this.Log(LogLevel.DEBUG, `Rate limited: ${channel}`, "TestChain");
            return false;
        }
        this.RateLimitMap.set(channel, now);
        try {
            const payload = HttpService.JSONEncode({ Channel: channel, data });
            this.Network.FireServer(payload);
            this.NetworkStats.sent++;
            return true;
        } catch (e) {
            this.Log(LogLevel.ERROR, `Network fire failed: ${e}`, "TestChain");
            this.NetworkQueue.push({ channel, data });
            this.NetworkStats.errors++;
            return false;
        }
    }

    /**
     * Test helper: Wait for condition with timeout
     */
    public async WaitForCondition(condition: () => boolean, timeout = 5000, interval = 100): Promise<boolean> {
        const startTime = tick();
        while (tick() - startTime < timeout / 1000) {
            if (condition()) return true;
            await new Promise(resolve => task.wait(interval / 1000));
        }
        return false;
    }

    /**
     * Create test suite for organized testing
     */
    public CreateTestSuite(name: string): TestSuite {
        return new TestSuite(name, this);
    }

    /**
     * Mock network response for testing
     */
    public MockNetworkResponse<T>(channel: string, response: T, delay = 0) {
        if (!this.TestMode) {
            this.Log(LogLevel.WARN, "Network mocking only available in test mode", "TestChain");
            return;
        }
        
        task.spawn(() => {
            if (delay > 0) task.wait(delay / 1000);
            const signal = this.Channels.get(channel);
            if (signal) signal.Fire(response);
        });
    }

    /**
     * Simulate network failure for testing
     */
    public SimulateNetworkFailure(channel: string, errorMessage: string) {
        if (!this.TestMode) {
            this.Log(LogLevel.WARN, "Network failure simulation only available in test mode", "TestChain");
            return;
        }
        
        const signal = this.Channels.get(channel);
        if (signal) {
            task.spawn(() => {
                throw errorMessage;
            });
        }
    }

    /**
     * Reset all mocks for clean testing
     */
    public ResetMocks() {
        this.MockedModules.clear();
        this.Log(LogLevel.DEBUG, "All mocks reset", "TestChain");
    }
}

/**
 * Test Suite class for organizing tests
 */
class TestSuite {
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
    private chain: Chain;
    public name: string;

    constructor(name: string, chain: Chain) {
        this.name = name;
        this.chain = chain;
    }

    test(name: string, fn: () => void | Promise<void>): TestSuite {
        this.tests.push({ name, fn });
        return this;
    }

    async run(): Promise<{ passed: number; failed: number; total: number; results: Array<{ name: string; passed: boolean; error?: string }> }> {
        const results: Array<{ name: string; passed: boolean; error?: string }> = [];
        let passed = 0;
        let failed = 0;

        this.chain.Log(LogLevel.INFO, `Running test suite: ${this.name}`, "TestSuite");

        for (const test of this.tests) {
            try {
                await test.fn();
                results.push({ name: test.name, passed: true });
                passed++;
                this.chain.Log(LogLevel.DEBUG, `✓ ${test.name}`, "TestSuite");
            } catch (error) {
                results.push({ name: test.name, passed: false, error: tostring(error) });
                failed++;
                this.chain.Log(LogLevel.ERROR, `✗ ${test.name}: ${error}`, "TestSuite");
            }
        }

        const total = this.tests.size();
        this.chain.Log(LogLevel.INFO, `Test suite completed: ${passed}/${total} passed`, "TestSuite");
        
        return { passed, failed, total, results };
    }
}
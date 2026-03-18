# Chain Framework

A powerful, modular framework for Roblox TypeScript development with advanced module management, dependency injection, state synchronization, and comprehensive debugging tools.

## Features

- **Modular Architecture** - Clean separation of concerns with dependency injection
- **Module Management** - Automatic loading, lifecycle management, and performance tracking
- **Network Layer** - Type-safe bidirectional networking with rate limiting and timeout handling
- **State Management** - Reactive local and server state with automatic synchronization
- **Event Bus** - Global publish/subscribe system with filtering
- **RPC System** - Remote procedure calls with RegisterMethod/GetRegisteredMethod
- **Logging** - Multi-level logging system with filtering and metadata
- **Testing Suite** - Built-in testing framework with mocking capabilities (ChainBundle)
- **Debugging** - Performance monitoring, state history, and comprehensive error tracking

## Installation

Download this project, as long as you have roblox typescript setup, it should work out of the box

## Quick Start

```typescript
import { Chain } from "./Chain";
import { ReplicatedStorage } from "@rbxts/services";

// Server-side setup
const chain = new Chain();

// Enable state sync BEFORE loading modules
chain.EnableStateSync(["playerCount", "gameMode"]);

// Load and initialize modules
const loadErrors = chain.LoadModules(ReplicatedStorage.FindFirstChild("Modules")!);
chain.SetLogLevel(1);

// Set initial server state
chain.SetServerState("playerCount", 0);
chain.SetServerState("gameMode", "lobby");

const initErrors = await chain.Init();
const startErrors = await chain.Enchain();
```

```typescript
import { Chain } from "./Chain";

// Client-side setup
const chain = new Chain();

// Enable state sync for specific keys
chain.EnableStateSync(["playerCount", "gameMode"]);

chain.Init();

// Request server state
const gameMode = await chain.RequestServerState<string>("gameMode");
print(`Current game mode: ${gameMode}`);

// Subscribe to server state changes
chain.SubscribeToServerState<number>("playerCount", (change) => {
    print(`Player count: ${change.newValue}`);
});
```

## Automatic Module Loading

The Chain framework automatically loads all modules and provides the necessary dependencies (framework instance and module name) to each module's constructor.

### How It Works

1. **Automatic Instantiation**: When you call `Chain.LoadModules()`, the framework automatically:
   - Requires each ModuleScript
   - Instantiates the module class with `new ModuleClass(framework, moduleName)`
   - Provides the framework instance and module name automatically

2. **Default Export Required**: Modules MUST use `export default class` instead of named exports or `export =`

3. **Constructor**: The framework automatically calls the module's constructor with `(framework, moduleName)` parameters

### Module Template

**IMPORTANT**: Modules must use `export default class` (not `export =` or named exports) for automatic loading.

```typescript
import { Chain } from "../Chain";
import OtherModule from "./OtherModule";

export default class MyModule extends Chain.link {
    Inject = {
        otherModule: OtherModule,
    };

    private otherModule!: OtherModule;

    Init() {
        this.Log("Module initialized");
    }

    OnStart() {
        this.Log("Module started");
    }

    OnShutdown() {
        this.Log("Module shutting down");
    }
}
```
## Chain.link - Universal Module Template

Chain.link is a unified module template that combines the functionality of services, controllers, and shared modules into a single, powerful base class. It automatically detects whether it's running on the server or client and provides appropriate functionality for both environments.

### Basic Usage

```typescript
import { Chain } from "../Chain";
import OtherModule from "./OtherModule";

export default class MyModule extends Chain.link {
    Inject = {
        otherModule: OtherModule,
    };

    private otherModule!: OtherModule;

    Init() {
        this.Log("Module initialized");
        
        // Server-only initialization
        this.ServerOnly(() => {
            this.Log("Server-side initialization");
            this.SetupServerLogic();
        });

        // Client-only initialization
        this.ClientOnly(() => {
            this.Log("Client-side initialization");
            this.SetupClientUI();
        });
    }

    OnStart() {
        this.Log("Module started");
    }

    OnShutdown() {
        this.Log("Module shutting down");
    }

    private SetupServerLogic() {
        // Server-specific code
    }

    private SetupClientUI() {
        // Client-specific code
    }
}
```

### Available Properties

- `Framework: Chain` - Reference to the Chain framework instance
- `ModuleName: string` - Name of the current module
- `IsServer: boolean` - True if running on server
- `IsClient: boolean` - True if running on client
- `Inject?: Record<string, ModuleConstructor>` - Dependency injection map (constructor references)

### Protected Methods

#### Logging
```typescript
protected Log(message: string, level?: 'info' | 'warn' | 'error')
```
Log messages with the module name automatically included.

#### Event Bus
```typescript
protected Publish(topic: string, data: unknown)
protected Subscribe(topic: string, callback: (message: any) => void)
```
Publish and subscribe to global events.

#### State Management
```typescript
protected SetState<T>(key: string, value: T)
protected GetState<T>(key: string): T | undefined
```
Manage local module state.

#### Network Communication
```typescript
protected NetworkRequest<T, R>(channel: string, data: T, target?: Player): Promise<R>
protected SendToServer(channel: string, data: unknown): boolean
protected SendToClient(player: Player, channel: string, data: unknown): boolean
protected SendToAllClients(channel: string, data: unknown): boolean
protected ConnectToChannel<T>(channel: string, callback: (data: T) => void)
```
Bidirectional network communication methods.

#### Environment Helpers
```typescript
protected ServerOnly<T>(fn: () => T): T | undefined
protected ClientOnly<T>(fn: () => T): T | undefined
```
Execute code only on server or client respectively.

### Lifecycle Methods

```typescript
Init?(): void        // Called during module initialization
OnStart?(): void     // Called when module starts
OnShutdown?(): void  // Called during module shutdown
```

### Example: Chat System

```typescript
export default class ChatSystem extends Chain.link {
    private messages: string[] = [];

    Init() {
        this.ServerOnly(() => {
            // Server: Set up message handling
            this.ConnectToChannel<{message: string, player: string}>("chat_message", (data) => {
                this.BroadcastMessage(data.message, data.player);
            });
        });

        this.ClientOnly(() => {
            // Client: Set up UI
            this.ConnectToChannel<{message: string, player: string}>("chat_broadcast", (data) => {
                this.DisplayMessage(data.message, data.player);
            });
        });
    }

    // Server method
    private BroadcastMessage(message: string, playerName: string) {
        this.Log(`Broadcasting message from ${playerName}`);
        this.SendToAllClients("chat_broadcast", { message, player: playerName });
    }

    // Client method
    public SendMessage(message: string) {
        this.SendToServer("chat_message", { 
            message, 
            player: "LocalPlayer"
        });
    }

    // Client method
    private DisplayMessage(message: string, playerName: string) {
        this.messages.push(`${playerName}: ${message}`);
        // Update UI here
    }
}
```




### Module Lifecycle

1. **Load** - Modules are loaded from ModuleScript instances
2. **Init** - Dependencies are resolved and Init() is called
3. **Start** - OnStart() is called after all modules are initialized
4. **Shutdown** - OnShutdown() is called during cleanup

## Network Layer

### Type-Safe Requests

```typescript
// Send network request with timeout
const response = await chain.NetworkRequest<RequestData, ResponseData>(
    "getUserData", 
    { userId: 123 },
    5000 // timeout in ms
);

// Register server methods (RPC)
chain.RegisterMethod("getUserData", (player: Player, data: any) => {
    return { id: data.userId, name: "Player" };
}, true);

// Call registered method from client
const userData = await chain.GetRegisteredMethod<UserData>("getUserData", { userId: 123 });
```

### Channel Communication

```typescript
// Connect to channel
const connection = chain.ConnectToChannel<MessageData>("chat", (data) => {
    print(`Received: ${data.message}`);
});

// Fire network event
chain.FireNetwork("chat", { message: "Hello World!" });

// Send to specific client (server-side)
chain.SendToClient(player, "notification", { text: "Welcome!" });

// Send to all clients (server-side)
chain.SendToAllClients("announcement", { text: "Server restart in 5 minutes" });

// Send to server (client-side)
chain.SendToServer("playerAction", { action: "jump" });
```

### Network Statistics

```typescript
const stats = chain.GetNetworkStats();
print(`Sent: ${stats.sent}, Received: ${stats.received}, Errors: ${stats.errors}`);
```

## Testing Framework

### Test Suites

```typescript
// Create test suite
const suite = chain.CreateTestSuite("User Management");

suite
    .test("should create user", async () => {
        const user = await createUser("testUser");
        if (!user) throw "User creation failed";
    })
    .test("should validate user data", () => {
        const isValid = validateUser({ name: "test", level: 1 });
        if (!isValid) throw "Validation failed";
    });

// Run tests
const results = await suite.run();
print(`Tests: ${results.passed}/${results.total} passed`);
```

### Module Mocking

```typescript
// Enable test mode
chain.EnableTestMode();

// Mock a module by passing its constructor
const mockDataService = {
    Init: () => {},
    GetUserData: (id: number) => ({ id, name: `MockUser${id}` }),
    SaveUserData: (data: any) => true
};

chain.MockModule(DataService, mockDataService);

// Reset mocks
chain.ResetMocks();
```

### Network Testing

```typescript
// Mock network responses
chain.MockNetworkResponse("getUserData", { id: 1, name: "TestUser" }, 100);

// Simulate network failures
chain.SimulateNetworkFailure("failingEndpoint", "Connection refused");

// Wait for conditions
const success = await chain.WaitForCondition(() => {
    return someCondition === true;
}, 5000); // 5 second timeout
```

## State Management

### Local Client State

```typescript
// Set local client state
chain.SetState("localScore", 100);
chain.SetState("playerName", "TestPlayer");

// Get local state
const localScore = chain.GetState<number>("localScore");
const playerName = chain.GetState<string>("playerName");
```

### Server State Management

```typescript
// Server-side: Set server state
chain.SetServerState("playerCount", 42);
chain.SetServerState("gameMode", "battle");

// Get server state (server-side)
const playerCount = chain.GetServerState<number>("playerCount");
```

### Client-Server State Synchronization

```typescript
// Enable state sync for specific keys
chain.EnableStateSync(["playerCount", "gameMode", "serverStatus"]);

// Client: Request server state
const gameMode = await chain.RequestServerState<string>("gameMode");
print(`Current game mode: ${gameMode}`);

// Subscribe to server state changes (client-side)
chain.SubscribeToServerState<number>("playerCount", (change) => {
    print(`Player count updated: ${change.oldValue} → ${change.newValue}`);
});
```

### State Subscriptions

```typescript
// Subscribe to local state changes
const connection = chain.SubscribeToState<number>("localScore", (change) => {
    print(`Score changed from ${change.oldValue} to ${change.newValue}`);
});

// Subscribe to server state changes
const serverConnection = chain.SubscribeToServerState<string>("gameMode", (change) => {
    print(`Game mode changed to: ${change.newValue}`);
});

// Disconnect when done
connection.Disconnect();
serverConnection.Disconnect();
```

### Time-Travel Debugging

```typescript
// Get state history
const history = chain.GetStateHistory();
history.forEach(change => {
    print(`${change.key}: ${change.oldValue} → ${change.newValue} at ${change.timestamp}`);
});

// Clear state history
chain.ClearStateHistory();
```

## Event Bus

### Publishing and Subscribing

```typescript
// Subscribe to events
const connection = chain.Subscribe("player-joined", (message) => {
    print(`Player ${message.data.name} joined the game`);
});

// Publish events
chain.Publish("player-joined", { name: "TestPlayer" }, "PlayerService");

// Subscribe with filter
const filteredConnection = chain.Subscribe("notifications", (message) => {
    print(`Important: ${message.data.text}`);
}, (data: any) => data.priority === "high");
```

## Configuration Management

### Setting Configuration

```typescript
// Set individual config values
chain.SetConfig("maxPlayers", 50);
chain.SetConfig("gameMode", "competitive");

// Load configuration object
chain.LoadConfig({
    environment: "production",
    maxPlayers: 100,
    enableDebug: false
});
```

### Configuration Watchers

```typescript
// Watch for config changes
const connection = chain.WatchConfig<number>("maxPlayers", (newValue) => {
    print(`Max players changed to: ${newValue}`);
});
```

## Logging System

### Log Levels

```typescript
enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// Set log level
chain.SetLogLevel(LogLevel.INFO);

// Log messages (from framework instance)
chain.Log("Application started", 'info');
chain.Log("Connection failed", 'error');
```

### Log Filtering

```typescript
// Filter logs by module
chain.AddModuleFilter("PlayerService");
chain.AddModuleFilter("DataService");

// Get logs
const allLogs = chain.GetLogs();
const playerLogs = chain.GetLogs("PlayerService");

// Clear logs
chain.ClearLogs("PlayerService"); // Clear specific module
chain.ClearLogs(); // Clear all logs
```

## Performance Monitoring

### Module Performance

```typescript
// Get performance data for all modules
const allPerformance = chain.GetModulePerformance();

// Get performance for specific module
const playerServicePerf = chain.GetModulePerformance("PlayerService");
print(`Init time: ${playerServicePerf?.initTime}ms`);
print(`Start time: ${playerServicePerf?.startTime}ms`);
```

### Network Statistics

```typescript
const stats = chain.GetNetworkStats();
print(`Sent: ${stats.sent}, Received: ${stats.received}, Errors: ${stats.errors}`);
```



## API Reference

### Chain Class

#### Core Methods
- `LoadModules(path: Instance)` - Load modules from instance hierarchy
- `Init()` - Initialize all loaded modules with dependency injection
- `Enchain(moduleName?: string)` - Start all modules or a specific module (spawns in task.spawn)
- `Shutdown(moduleName?: string)` - Shutdown all modules or a specific module (cancels task)

#### Testing Methods
- `EnableTestMode()` - Enable testing features and mocking
- `CreateTestSuite(name: string)` - Create a new test suite
- `MockModule<T>(name: string, mockModule: T)` - Mock a module for testing
- `ResetMocks()` - Clear all module mocks
- `WaitForCondition(condition: () => boolean, timeout?: number)` - Wait for condition with timeout

#### Network Methods
- `NetworkRequest<T, R>(channel: string, data: T, timeout?: number)` - Send network request
- `RegisterMethod(id: string, callback: Callback, isClient?: boolean)` - Register network method
- `FireNetwork(channel: string, data: unknown)` - Fire network event with rate limiting
- `MockNetworkResponse<T>(channel: string, response: T, delay?: number)` - Mock network response
- `SimulateNetworkFailure(channel: string, error: string)` - Simulate network failure

#### State Methods
- `SetState<T>(key: string, value: T)` - Set local client state value with history tracking
- `GetState<T>(key: string)` - Get local client state value
- `SetServerState<T>(key: string, value: T)` - Set server state value (server-side only)
- `GetServerState<T>(key: string)` - Get server state value
- `RequestServerState<T>(key: string)` - Request server state from client (returns Promise)
- `SubscribeToState<T>(key: string, callback: (change: StateChange<T>) => void)` - Subscribe to local state changes
- `SubscribeToServerState<T>(key: string, callback: (change: StateChange<T>) => void)` - Subscribe to server state changes
- `EnableStateSync(keys: string[])` - Enable state synchronization for specific keys
- `GetStateHistory()` - Get complete state change history
- `RestoreState(timestamp: number)` - Restore state to previous point in time

#### Event Bus Methods
- `Publish(topic: string, data: unknown, sender?: string)` - Publish message to topic
- `Subscribe(topic: string, callback: (message: EventBusMessage) => void, filter?: (data: unknown) => boolean)` - Subscribe to topic

#### Configuration Methods
- `SetConfig<T>(key: string, value: T)` - Set configuration value
- `GetConfig<T>(key: string)` - Get configuration value
- `LoadConfig(config: Partial<Config>)` - Load configuration object
- `WatchConfig<T>(key: string, callback: (value: T) => void)` - Watch configuration changes

#### Logging Methods
- `Log(level: LogLevel, message: string, module?: string, metadata?: Record<string, unknown>)` - Log message
- `SetLogLevel(level: LogLevel)` - Set minimum log level
- `AddModuleFilter(module: string)` - Add module to log filter
- `GetLogs(module?: string)` - Get logs for module or all logs
- `ClearLogs(module?: string)` - Clear logs for module or all logs

#### Utility Methods
- `GetModule<T>(ctorOrName: Constructor | string)` - Get loaded module instance by constructor (preferred) or name
- `GetNetworkStats()` - Get network usage statistics
- `GetModulePerformance(module?: string)` - Get module performance data

## License


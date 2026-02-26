# Chain Framework

A powerful, feature-rich framework for Roblox TypeScript development with advanced module management, testing capabilities, and comprehensive debugging tools.

## Features

- **Module Management** - Dependency injection, lifecycle management, and performance tracking
- **Network Layer** - Type-safe networking with rate limiting and timeout handling
- **Testing Suite** - Built-in testing framework with mocking capabilities
- **State Management** - Reactive state with history tracking and time-travel debugging
- **Event Bus** - Global publish/subscribe system with filtering
- **Configuration** - Dynamic configuration management with watchers
- **Logging** - Multi-level logging system with filtering and metadata
- **Debugging** - Performance monitoring and comprehensive error tracking

## Installation

Download this project, as long as you have roblox typescript setup, it should work out of the box

## Quick Start

```typescript
import { Chain, LogLevel } from "./Chainv2";

// Initialize Chain
const chain = new Chain();

// Enable test mode for development
chain.EnableTestMode();
chain.SetLogLevel(LogLevel.DEBUG);

// Load configuration
chain.LoadConfig({
    environment: "dev",
});

// Load and initialize modules
const loadErrors = chain.LoadModules(game.ReplicatedStorage.Modules);
const initErrors = await chain.Init();
const startErrors = await chain.Enchain();
```

## Automatic Module Loading

The Chain framework automatically loads all modules and provides the necessary dependencies (framework instance and module name) to each module's constructor.

### How It Works

1. **Automatic Instantiation**: When you call `ChainFramework.LoadModules()`, the framework automatically:
   - Requires each ModuleScript
   - Instantiates the module class with `new ModuleClass(framework, moduleName)`
   - Provides the framework instance and module name automatically

2. **Default Export Required**: Modules must use `export default class` instead of named exports or `export =`

### Module Template

```typescript
import { BaseService } from "../Architecture";
import { Chain } from "../Chainv2";

export default class YourService extends BaseService {
    Dependencies = ["OtherService"]; // Optional: List dependencies
    Inject = {
        OtherService: "OtherService"  // Optional: Inject dependencies
    };

    private OtherService?: BaseService; // Optional: Type the injected dependency

    constructor(framework: Chain, moduleName: string) {
        super(framework, moduleName); // Required: Call parent constructor
    }

    Init() {
        this.Log(1, "Service initialized");
        // Initialization logic here
    }

    OnStart() {
        this.Log(1, "Service started");
        // Startup logic here
    }

    OnShutdown() {
        this.Log(1, "Service shutting down");
        // Cleanup logic here
    }
}
```

### Benefits

- **No Manual Instantiation**: Framework handles all module creation
- **Automatic Dependencies**: Framework and module name are provided automatically
- **Consistent Pattern**: All modules follow the same structure
- **Type Safety**: Full TypeScript support with proper typing
- **Dependency Injection**: Automatic injection of other modules as dependencies

### Migration from Old System

If you have existing modules using the old pattern:

**Old Pattern:**
```typescript
class MyModule extends BaseService {
    Init() { /* ... */ }
}
export = MyModule;
```

**New Pattern:**
```typescript
export default class MyModule extends BaseService {
    constructor(framework: Chain, moduleName: string) {
        super(framework, moduleName);
    }
    
    Init() { /* ... */ }
}
```

## Module System

### Creating Modules

```typescript
interface IModule {
    Init?: () => void;
    OnStart?: () => void;
    OnShutdown?: () => void;
    Dependencies?: string[];
    Inject?: Record<string, string>;
}

// Example module
export const PlayerService: IModule = {
    Dependencies: ["DataService"],
    Inject: {
        dataService: "DataService"
    },
    
    Init() {
        print("PlayerService initialized");
    },
    
    OnStart() {
        print("PlayerService started");
    }
};
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

// Register server methods
chain.RegisterMethod("getUserData", (player: Player, data: any) => {
    return { id: data.userId, name: "Player" };
}, true);
```

### Channel Communication

```typescript
// Connect to channel
const connection = chain.ConnectToChannel<MessageData>("chat", (data) => {
    print(`Received: ${data.message}`);
});

// Fire network event
chain.FireNetwork("chat", { message: "Hello World!" });
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

// Mock a module
const mockDataService = {
    Init: () => {},
    GetUserData: (id: number) => ({ id, name: `MockUser${id}` }),
    SaveUserData: (data: any) => true
};

chain.MockModule("DataService", mockDataService);

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

// Restore state to previous point (test mode only)
const previousTime = tick() - 10;
chain.RestoreState(previousTime);
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

// Log messages
chain.Log(LogLevel.INFO, "Application started", "Main");
chain.Log(LogLevel.ERROR, "Connection failed", "NetworkService", { 
    endpoint: "api.example.com",
    timeout: 5000 
});
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

## Example Usage

See [ExampleTestModule.ts](src/shared/ExampleTestModule.ts) for comprehensive usage examples including:

- Network operation testing
- State management testing  
- Event bus testing
- Module mocking
- Async operation testing

## API Reference

### Chain Class

#### Core Methods
- `LoadModules(path: Instance)` - Load modules from instance hierarchy
- `Init()` - Initialize all loaded modules with dependency injection
- `Enchain()` - Start all initialized modules
- `Shutdown()` - Shutdown all modules

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
- `GetModule<T>(name: string)` - Get loaded module instance
- `GetNetworkStats()` - Get network usage statistics
- `GetModulePerformance(module?: string)` - Get module performance data

## License


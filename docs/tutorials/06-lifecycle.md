# Lifecycle Management

Understanding the module lifecycle is crucial for building reliable Chain applications. This guide covers the three lifecycle hooks and when to use each.

## The Three Lifecycle Hooks

| Hook | Purpose | Execution | Use For |
|------|---------|-----------|---------|
| `Init()` | Setup and dependency resolution | Synchronous, sequential | Initializing state, connecting to dependencies |
| `OnStart()` | Main module logic | Async, concurrent (task.spawn) | Starting loops, listening to events |
| `OnShutdown()` | Cleanup | Synchronous, sequential | Disconnecting events, saving data |

## Init()

Called during framework initialization, after all modules are loaded but before any start.

### Characteristics
- Runs **synchronously** in dependency order
- Blocks until complete
- All dependencies are guaranteed to be initialized
- Perfect for setup that must complete before the module starts

### Example

```typescript
export default class DataService extends Chain.link {
    private dataStore?: DataStore;
    private cache = new Map<Player, PlayerData>();

    Init() {
        // Setup that must complete before OnStart
        this.dataStore = DataStoreService.GetDataStore("PlayerData");
        this.Log("DataStore initialized");
        
        // Initialize cache
        this.cache.clear();
        
        // Set initial state
        this.SetState("dataServiceReady", true);
    }
}
```

### When to Use Init()
- Setting up data stores
- Initializing caches or data structures
- Connecting to injected dependencies
- Setting initial state values
- Validating configuration

### When NOT to Use Init()
- Long-running operations (use OnStart instead)
- Event listeners (use OnStart instead)
- Loops or recurring tasks (use OnStart instead)

## OnStart()

Called after all modules are initialized. Each module's OnStart runs in its own task.spawn.

### Characteristics
- Runs **asynchronously** and **concurrently**
- Does not block other modules
- All modules' Init() have completed
- Perfect for main module logic

### Example

```typescript
import DataService from "./DataService";

export default class PlayerService extends Chain.link {
    Inject = { dataService: DataService };

    private dataService!: DataService;
    private connections: RBXScriptConnection[] = [];

    OnStart() {
        // Event listeners
        const conn1 = Players.PlayerAdded.Connect((player) => {
            this.handlePlayerJoin(player);
        });
        
        const conn2 = Players.PlayerRemoving.Connect((player) => {
            this.handlePlayerLeave(player);
        });
        
        this.connections.push(conn1, conn2);
        
        // Start a recurring task
        task.spawn(() => {
            while (true) {
                this.updatePlayerStats();
                task.wait(5);
            }
        });
        
        this.Log("PlayerService started");
    }

    private handlePlayerJoin(player: Player) {
        const data = this.dataService.LoadPlayerData(player);
        this.Log(`Player ${player.Name} joined`);
    }

    private handlePlayerLeave(player: Player) {
        this.dataService.SavePlayerData(player);
        this.Log(`Player ${player.Name} left`);
    }

    private updatePlayerStats() {
        // Update logic
    }
}
```

### When to Use OnStart()
- Connecting to Roblox events (PlayerAdded, Touched, etc.)
- Starting loops or recurring tasks
- Beginning network listeners
- Spawning threads
- Starting timers

### When NOT to Use OnStart()
- Critical setup that other modules depend on (use Init instead)
- Synchronous initialization (use Init instead)

## OnShutdown()

Called when the framework shuts down or when a specific module is stopped.

### Characteristics
- Runs **synchronously**
- Called in reverse dependency order
- Perfect for cleanup and saving data

### Example

```typescript
export default class DataService extends Chain.link {
    private connections: RBXScriptConnection[] = [];
    private activeTasks: thread[] = [];

    OnShutdown() {
        // Disconnect all event connections
        this.connections.forEach(conn => conn.Disconnect());
        this.connections = [];
        
        // Cancel all active tasks
        this.activeTasks.forEach(task => task.cancel());
        this.activeTasks = [];
        
        // Save all player data
        this.saveAllPlayers();
        
        // Clear caches
        this.cache.clear();
        
        this.Log("DataService shutdown complete");
    }

    private saveAllPlayers() {
        Players.GetPlayers().forEach(player => {
            this.SavePlayerData(player);
        });
    }
}
```

### When to Use OnShutdown()
- Disconnecting event connections
- Canceling active tasks/threads
- Saving data
- Clearing caches
- Releasing resources
- Cleanup operations

## Complete Lifecycle Example

```typescript
import DataService from "./DataService";
import PlayerService from "./PlayerService";

export default class GameManager extends Chain.link {
    Inject = {
        dataService: DataService,
        playerService: PlayerService,
    };

    private dataService!: DataService;
    private playerService!: PlayerService;
    private gameLoop?: thread;
    private connections: RBXScriptConnection[] = [];

    // 1. INIT - Setup phase
    Init() {
        this.Log("Initializing GameManager");
        
        // Set initial game state
        this.SetState("gameState", "lobby");
        this.SetState("roundNumber", 0);
        
        this.Log("GameManager initialized");
    }

    // 2. START - Main logic phase
    OnStart() {
        this.Log("Starting GameManager");
        
        // Start game loop
        this.gameLoop = task.spawn(() => {
            while (true) {
                this.runGameLoop();
                task.wait(1);
            }
        });
        
        // Listen to events
        const conn = this.Subscribe("player:ready", (message) => {
            this.handlePlayerReady(message.data);
        });
        this.connections.push(conn);
        
        this.Log("GameManager started");
    }

    // 3. SHUTDOWN - Cleanup phase
    OnShutdown() {
        this.Log("Shutting down GameManager");
        
        // Stop game loop
        if (this.gameLoop) {
            task.cancel(this.gameLoop);
            this.gameLoop = undefined;
        }
        
        // Disconnect events
        this.connections.forEach(conn => conn.Disconnect());
        this.connections = [];
        
        // Save final state
        this.dataService.SaveGameState();
        
        this.Log("GameManager shutdown complete");
    }

    private runGameLoop() {
        // Game logic
    }

    private handlePlayerReady(data: unknown) {
        // Handle player ready
    }
}
```

## Execution Timeline

```
Time →

LoadModules()
    ├─ Require all ModuleScripts
    └─ Instantiate module classes

Init()
    ├─ Module A.Init()  ← Dependency of B
    ├─ Module B.Init()  ← Dependency of C
    └─ Module C.Init()

Enchain()
    ├─ task.spawn(Module A.OnStart())  ← All run concurrently
    ├─ task.spawn(Module B.OnStart())
    └─ task.spawn(Module C.OnStart())

[Modules running...]

Shutdown()
    ├─ Module C.OnShutdown()  ← Reverse order
    ├─ Module B.OnShutdown()
    └─ Module A.OnShutdown()
```

## Selective Module Control

You can control individual modules:

```typescript
// Start only one module
await chain.Enchain("GameManager");

// Shutdown only one module
await chain.Shutdown("GameManager");

// Restart a module
await chain.Shutdown("GameManager");
await chain.Enchain("GameManager");
```

## Error Handling

If a module throws an error during any lifecycle phase:

```typescript
Init() {
    throw "Something went wrong";
}
```

Chain will:
1. Log the error
2. Skip that module
3. Continue with other modules
4. Return the error in the result array

```typescript
const initErrors = await chain.Init();
initErrors.forEach(err => {
    warn(`Module ${err.moduleName} failed: ${err.error}`);
});
```

## Best Practices

1. **Keep Init() fast** - Don't do heavy work that blocks other modules
2. **Use OnStart() for async work** - Loops, listeners, and long operations
3. **Always clean up in OnShutdown()** - Prevent memory leaks
4. **Store connections** - Keep references to disconnect later
5. **Handle errors gracefully** - Don't let one module crash others

## Common Patterns

### Pattern 1: Event Connection Management

```typescript
private connections: RBXScriptConnection[] = [];

OnStart() {
    this.connections.push(
        Players.PlayerAdded.Connect((p) => this.onPlayerAdded(p)),
        Players.PlayerRemoving.Connect((p) => this.onPlayerRemoving(p))
    );
}

OnShutdown() {
    this.connections.forEach(c => c.Disconnect());
    this.connections = [];
}
```

### Pattern 2: Task Management

```typescript
private tasks: thread[] = [];

OnStart() {
    this.tasks.push(
        task.spawn(() => this.gameLoop()),
        task.spawn(() => this.updateLoop())
    );
}

OnShutdown() {
    this.tasks.forEach(t => task.cancel(t));
    this.tasks = [];
}
```

### Pattern 3: Resource Initialization

```typescript
private resource?: SomeResource;

Init() {
    this.resource = this.initializeResource();
}

OnShutdown() {
    if (this.resource) {
        this.resource.cleanup();
        this.resource = undefined;
    }
}
```

## Next Steps

- [State Management](./07-state-management.md) - Managing application state
- [Networking](./08-networking.md) - Client-server communication
- [Event System](./09-event-system.md) - Pub/sub messaging

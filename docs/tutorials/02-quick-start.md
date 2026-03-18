# Quick Start Guide

This guide will help you create your first Chain Framework application in under 10 minutes.

## Overview

We'll build a simple player greeting system that:
- Tracks when players join
- Stores player data in state
- Synchronizes data between server and client
- Logs all activities

## Step 1: Server Setup

Create your main server file:

**src/server/main.server.ts**
```typescript
import { Chain } from "shared/Chain";
import { Players, ReplicatedStorage } from "@rbxts/services";

// Initialize the framework
const chain = new Chain();

// Enable state synchronization for specific keys
chain.EnableStateSync(["playerCount", "serverStatus"]);

// Load modules from ReplicatedStorage
const modulesFolder = ReplicatedStorage.FindFirstChild("TS")?.FindFirstChild("Modules");
if (modulesFolder) {
    chain.LoadModules(modulesFolder);
}

// Set log level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
chain.SetLogLevel(1);

// Set initial server state
chain.SetServerState("playerCount", 0);
chain.SetServerState("serverStatus", "running");

// Initialize and start all modules
chain.Init();
chain.Enchain();

// Track player count
Players.PlayerAdded.Connect((player) => {
    const currentCount = chain.GetServerState<number>("playerCount") || 0;
    chain.SetServerState("playerCount", currentCount + 1);
    chain.Log(`Player ${player.Name} joined. Total players: ${currentCount + 1}`, 'info');
});

Players.PlayerRemoving.Connect((player) => {
    const currentCount = chain.GetServerState<number>("playerCount") || 0;
    chain.SetServerState("playerCount", math.max(0, currentCount - 1));
    chain.Log(`Player ${player.Name} left. Total players: ${currentCount - 1}`, 'info');
});

print("Server initialized successfully!");
```

## Step 2: Client Setup

Create your main client file:

**src/client/main.client.ts**
```typescript
import { Chain } from "shared/Chain";
import { Players } from "@rbxts/services";

// Initialize the framework
const chain = new Chain();

// Enable state sync for the same keys as server
chain.EnableStateSync(["playerCount", "serverStatus"]);

// Initialize the framework
chain.Init();

// Subscribe to server state changes
chain.SubscribeToServerState<number>("playerCount", (change) => {
    print(`Player count updated: ${change.oldValue} → ${change.newValue}`);
    
    // Update UI here
    const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
    // ... update your UI elements
});

chain.SubscribeToServerState<string>("serverStatus", (change) => {
    print(`Server status: ${change.newValue}`);
});

// Request initial server state
task.spawn(async () => {
    const playerCount = await chain.RequestServerState<number>("playerCount");
    const serverStatus = await chain.RequestServerState<string>("serverStatus");
    
    print(`Initial player count: ${playerCount}`);
    print(`Server status: ${serverStatus}`);
});

print("Client initialized successfully!");
```

## Step 3: Create Your First Module

Create a simple greeting module:

**src/shared/Modules/GreetingService.ts**
```typescript
import { Chain } from "../Chain";
import { Players } from "@rbxts/services";

export default class GreetingService extends Chain.link {
    private greetings = [
        "Welcome to the game!",
        "Glad to have you here!",
        "Hello there!",
        "Nice to see you!"
    ];

    Init() {
        this.Log("GreetingService initialized");
    }

    OnStart() {
        this.ServerOnly(() => {
            this.setupServerGreetings();
        });

        this.ClientOnly(() => {
            this.setupClientGreetings();
        });
    }

    private setupServerGreetings() {
        Players.PlayerAdded.Connect((player) => {
            const greeting = this.getRandomGreeting();
            
            // Send greeting to the specific player
            this.SendToClient(player, "greeting", {
                message: greeting,
                playerName: player.Name
            });

            this.Log(`Sent greeting to ${player.Name}`);
        });
    }

    private setupClientGreetings() {
        // Listen for greeting from server
        this.ConnectToChannel<{ message: string; playerName: string }>("greeting", (data) => {
            print(`🎉 ${data.message}`);
            
            // You could show this in a GUI
            // this.showGreetingUI(data.message);
        });
    }

    private getRandomGreeting(): string {
        const index = math.random(0, this.greetings.size() - 1);
        return this.greetings[index];
    }

    OnShutdown() {
        this.Log("GreetingService shutting down");
    }
}
```

## Step 4: Test Your Application

1. **Compile your TypeScript:**
   ```bash
   npm run build
   ```

2. **Sync to Roblox Studio** (using Rojo or your preferred method)

3. **Run the game** in Roblox Studio

4. **Check the Output** - You should see:
   ```
   Server initialized successfully!
   INFO [Chain]: Loaded module: GreetingService
   INFO [Chain]: Initialized module: GreetingService
   INFO [Chain]: Started module: GreetingService
   INFO [Chain]: Modular Chain framework initialized
   INFO [Chain]: Chain framework enchained
   ```

5. **Test with multiple players** - Use the "Test" tab in Studio to simulate multiple players

## What's Happening?

1. **Server Side:**
   - Chain framework initializes
   - Modules are loaded from ReplicatedStorage
   - State synchronization is enabled
   - Player count is tracked and synced to clients

2. **Client Side:**
   - Chain framework initializes
   - Subscribes to server state changes
   - Receives real-time updates when player count changes
   - Displays greetings when they join

3. **Module (GreetingService):**
   - Runs on both server and client
   - Server sends personalized greetings
   - Client receives and displays greetings

## Next Steps

Now that you have a working Chain application:

1. **Add More Modules** - Create modules for different game systems
2. **Learn State Management** - [State Management Tutorial](./07-state-management.md)
3. **Explore Networking** - [Networking Tutorial](./08-networking.md)
4. **Build Complex Systems** - Check out the [Examples](../examples/)

## Common Patterns

### Pattern 1: Server-Only Logic
```typescript
this.ServerOnly(() => {
    // This code only runs on the server
    this.setupDataStore();
});
```

### Pattern 2: Client-Only Logic
```typescript
this.ClientOnly(() => {
    // This code only runs on the client
    this.setupUI();
});
```

### Pattern 3: State Synchronization
```typescript
// Server sets state
chain.SetServerState("gameMode", "battle");

// Client automatically receives update
chain.SubscribeToServerState<string>("gameMode", (change) => {
    print(`Game mode changed to: ${change.newValue}`);
});
```

## Troubleshooting

**Issue: Modules not loading**
- Ensure modules are in `ReplicatedStorage/TS/Modules`
- Check that modules use `export default class`
- Verify the module extends `Chain.link`

**Issue: State not syncing**
- Call `EnableStateSync()` with the same keys on both server and client
- Make sure to call it BEFORE `Init()`

**Issue: Network events not working**
- Check that HttpService is enabled
- Verify channel names match on both ends
- Check the Output for error messages

## Resources

- [Module System Deep Dive](./04-module-system.md)
- [Complete Examples](../examples/)
- [API Reference](../api/chain.md)

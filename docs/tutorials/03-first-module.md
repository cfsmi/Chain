# Your First Module

Modules are the building blocks of every Chain application. This tutorial walks through creating a module from scratch using the `Chain.link` base class.

## What is a Module?

A module is a class that extends `Chain.link` and implements up to three lifecycle hooks:

| Hook | When it runs |
|------|-------------|
| `Init()` | After all modules are loaded, before any start |
| `OnStart()` | After all modules are initialized — runs concurrently |
| `OnShutdown()` | When the framework shuts down |

## Creating a Module

**src/shared/Modules/GreetingService.ts**
```typescript
import { Chain } from "../Chain";
import { Players } from "@rbxts/services";

export default class GreetingService extends Chain.link {
    Init() {
        this.Log("GreetingService initialized");
    }

    OnStart() {
        this.ServerOnly(() => {
            Players.PlayerAdded.Connect((player) => {
                this.SendToClient(player, "greeting", {
                    message: `Welcome, ${player.Name}!`
                });
                this.Log(`Greeted ${player.Name}`);
            });
        });

        this.ClientOnly(() => {
            this.ConnectToChannel<{ message: string }>("greeting", (data) => {
                print(data.message);
            });
        });
    }

    OnShutdown() {
        this.Log("GreetingService shutting down");
    }
}
```

## Key Points

- `export default class` — Chain requires a default export
- Extends `Chain.link` — gives you access to all protected helpers
- `this.Log(message, level?)` — logs with the module name prefixed; level is `'info'` (default), `'warn'`, or `'error'`
- `this.ServerOnly(() => {...})` — code inside only runs on the server
- `this.ClientOnly(() => {...})` — code inside only runs on the client

## Loading the Module

In your server and client entry points, load modules before calling `Init()`:

```typescript
import { Chain } from "shared/Chain";
import { ReplicatedStorage } from "@rbxts/services";

const chain = new Chain();

const modulesFolder = ReplicatedStorage.FindFirstChild("Modules") as Folder;
chain.LoadModules(modulesFolder);

chain.Init().then(() => {
    chain.Enchain();
});
```

## Module Helpers Reference

All of these are available inside any module that extends `Chain.link`:

```typescript
// Logging
this.Log(message: string, level?: 'info' | 'warn' | 'error')

// State
this.SetState("key", value)
this.GetState<T>("key")

// Networking
this.SendToServer("channel", data)
this.SendToClient(player, "channel", data)
this.SendToAllClients("channel", data)
this.ConnectToChannel<T>("channel", callback)

// Event Bus
this.Publish("topic", data)
this.Subscribe("topic", callback)

// Environment guards
this.ServerOnly(() => { /* server code */ })
this.ClientOnly(() => { /* client code */ })
```

## Next Steps

- [Module System Deep Dive](./04-module-system.md) — dependencies, injection, performance tracking
- [State Management](./07-state-management.md) — local and server state
- [Networking](./08-networking.md) — channels, requests, rate limiting

# Server-Client Communication

Chain modules run on both the server and client from the same class. This guide covers the patterns for writing full-stack modules cleanly.

## The Same Module, Two Contexts

When `LoadModules` runs on the server, it instantiates your module on the server. When it runs on the client, it instantiates the same class on the client. Use `ServerOnly` and `ClientOnly` to branch:

```typescript
export default class ChatService extends Chain.link {
    OnStart() {
        this.ServerOnly(() => this.setupServer());
        this.ClientOnly(() => this.setupClient());
    }

    private setupServer() {
        // Runs only on the server
        this.ConnectToChannel<{ text: string }>("chat:send", (data) => {
            this.SendToAllClients("chat:receive", { text: data.text });
        });
    }

    private setupClient() {
        // Runs only on the client
        this.ConnectToChannel<{ text: string }>("chat:receive", (data) => {
            print(`Chat: ${data.text}`);
        });
    }

    // Public API — call from client
    SendMessage(text: string) {
        this.ClientOnly(() => {
            this.SendToServer("chat:send", { text });
        });
    }
}
```

## Fire-and-Forget Patterns

| Direction | Method |
|-----------|--------|
| Client → Server | `this.SendToServer(channel, data)` |
| Server → one client | `this.SendToClient(player, channel, data)` |
| Server → all clients | `this.SendToAllClients(channel, data)` |

All three are rate-limited to 10 calls per second per channel.

## Request / Response

Use `NetworkRequest` when you need a reply:

```typescript
// Client requests data from server
export default class ShopService extends Chain.link {
    async GetCatalog(): Promise<Item[]> {
        return this.NetworkRequest<{}, Item[]>("shop:getCatalog", {});
    }
}

// Server registers the handler
export default class ShopService extends Chain.link {
    OnStart() {
        this.ServerOnly(() => {
            this.Framework.RegisterMethod("shop:getCatalog", (_player) => {
                return this.catalog;
            }, true); // true = expose to clients
        });
    }
}
```

## RPC with RegisterMethod / GetRegisteredMethod

For structured server-side handlers:

**Server:**
```typescript
chain.RegisterMethod("getPlayerData", (player: Player, data: { key: string }) => {
    return dataStore.get(player.UserId, data.key);
}, true);
```

**Client:**
```typescript
const value = await chain.GetRegisteredMethod<string>("getPlayerData", { key: "coins" });
```

## Checking Context

Inside a module you have two boolean properties:

```typescript
this.IsServer // true when running on the server
this.IsClient // true when running on the client
```

These are set in the constructor and never change.

## Pattern: Shared Logic, Split I/O

Keep business logic in shared methods and only branch at the I/O boundary:

```typescript
export default class ScoreService extends Chain.link {
    // Shared logic
    private calculateBonus(score: number): number {
        return math.floor(score * 1.1);
    }

    OnStart() {
        this.ServerOnly(() => {
            // I/O: receive score from client, apply bonus, broadcast result
            this.ConnectToChannel<{ score: number }>("score:submit", (data) => {
                const final = this.calculateBonus(data.score);
                this.SendToAllClients("score:update", { score: final });
            });
        });

        this.ClientOnly(() => {
            // I/O: display incoming score updates
            this.ConnectToChannel<{ score: number }>("score:update", (data) => {
                this.SetState("displayScore", data.score);
            });
        });
    }
}
```

## Best Practices

- **Never trust client data** — validate all inputs on the server before acting on them
- **Keep payloads small** — all data is JSON-encoded over RemoteEvents
- **Disconnect listeners in `OnShutdown`** — store connections and call `Disconnect()`
- **Use `RegisterMethod` for request-response** — it's cleaner than manual channel pairing

## Next Steps

- [State Synchronization](./12-state-sync.md) - Automatic server-to-client state sync
- [Networking](./08-networking.md) - Full networking API reference

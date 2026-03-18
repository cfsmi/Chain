# State Synchronization

Chain can automatically push server state changes to all connected clients. This page covers the sync system in depth.

## How It Works

1. Call `EnableStateSync(keys)` with the same key list on **both** server and client, **before** `Init()`
2. On the server, `EnableStateSync` registers a `__getServerState` RemoteFunction so clients can pull the current value on demand
3. On the client, it connects a `__serverStateUpdate` channel listener
4. Every `SetServerState` call for a synced key automatically fires `__serverStateUpdate` to all clients

## Setup

**Server:**
```typescript
const chain = new Chain();
chain.EnableStateSync(["playerCount", "gamePhase", "timeRemaining"]);

chain.SetServerState("playerCount", 0);
chain.SetServerState("gamePhase", "lobby");
chain.SetServerState("timeRemaining", 300);

await chain.Init();
await chain.Enchain();
```

**Client:**
```typescript
const chain = new Chain();
chain.EnableStateSync(["playerCount", "gamePhase", "timeRemaining"]);
chain.Init();

// Pull current values on join
const phase = await chain.RequestServerState<string>("gamePhase");
const time  = await chain.RequestServerState<number>("timeRemaining");

// React to future changes
chain.SubscribeToServerState<number>("playerCount", (change) => {
    updatePlayerCountUI(change.newValue);
});
```

## RequestServerState

Fetches the current value of a synced key from the server. Returns a Promise:

```typescript
const count = await chain.RequestServerState<number>("playerCount");
```

This calls the `__getServerState` RemoteFunction registered by `EnableStateSync`. If the key is not synced, the server returns `undefined`.

## SubscribeToServerState

Registers a callback that fires whenever the server pushes an update for that key:

```typescript
const conn = chain.SubscribeToServerState<string>("gamePhase", (change) => {
    print(`Phase: ${change.oldValue} → ${change.newValue}`);
});

// Disconnect when done
conn.Disconnect();
```

The `StateChange` object:

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | The state key |
| `oldValue` | `T` | Previous value (as seen by the client) |
| `newValue` | `T` | New value pushed from server |
| `timestamp` | `number` | `tick()` at time of change |

## Inside Modules

Use `this.Framework` to access sync methods from within a module:

```typescript
export default class GameManager extends Chain.link {
    OnStart() {
        this.ServerOnly(() => {
            // Push phase changes to all clients automatically
            this.Framework.SetServerState("gamePhase", "countdown");
        });

        this.ClientOnly(() => {
            this.Framework.SubscribeToServerState<string>("gamePhase", (change) => {
                this.Log(1, `Phase changed to ${change.newValue}`);
            });
        });
    }
}
```

## Keeping Synced Keys Minimal

Each `SetServerState` call for a synced key fires a RemoteEvent to every client. Keep the list short and only sync values that clients actually need to display or react to.

| Good candidates | Poor candidates |
|-----------------|-----------------|
| `playerCount` | Per-player inventory |
| `gamePhase` | Server-internal counters |
| `timeRemaining` | Debug flags |

## Best Practices

- Call `EnableStateSync` **before** `Init()` on both sides
- Use `RequestServerState` on join to get the current snapshot
- Use `SubscribeToServerState` for live updates
- Disconnect subscriptions in `OnShutdown`
- Prefer server state for authoritative data; use local state for UI-only values

## Next Steps

- [Performance Optimization](./13-performance.md) - Profiling and monitoring
- [State Management](./07-state-management.md) - Local state and state history

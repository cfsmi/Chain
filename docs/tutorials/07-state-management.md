# State Management

Chain provides two state systems: local state (per-context) and server state (server-authoritative, optionally synced to clients).

## Local State

Local state is scoped to the current runtime context (server or client). It is reactive — subscribers are notified on every change.

```typescript
// Set and get
chain.SetState("score", 100);
const score = chain.GetState<number>("score"); // 100

// Subscribe to changes
const unsub = chain.SubscribeToState<number>("score", (change) => {
    print(`score: ${change.oldValue} → ${change.newValue}`);
});

// Unsubscribe
unsub();
```

The `StateChange` object passed to callbacks contains:

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | The state key that changed |
| `oldValue` | `T` | Previous value |
| `newValue` | `T` | New value |
| `timestamp` | `number` | `tick()` at time of change |

## Server State

Server state lives on the server and can be pushed to clients automatically.

```typescript
// Server-side only
chain.SetServerState("playerCount", 42);
const count = chain.GetServerState<number>("playerCount");
```

Calling `SetServerState` on the client logs a warning and does nothing.

## State Synchronization

Enable sync before calling `Init()`, using the same keys on both server and client.

**Server:**
```typescript
chain.EnableStateSync(["playerCount", "gameMode"]);
chain.SetServerState("playerCount", 0);
chain.SetServerState("gameMode", "lobby");
await chain.Init();
await chain.Enchain();
```

**Client:**
```typescript
chain.EnableStateSync(["playerCount", "gameMode"]);
chain.Init();

// Pull current value
const mode = await chain.RequestServerState<string>("gameMode");

// React to future changes
chain.SubscribeToServerState<number>("playerCount", (change) => {
    print(`Players: ${change.newValue}`);
});
```

`EnableStateSync` registers a `__getServerState` RemoteFunction on the server and a `__serverStateUpdate` channel listener on the client. Any `SetServerState` call for a synced key automatically broadcasts to all clients.

## State History

Every `SetState` call is appended to an in-memory history log, useful for debugging.

```typescript
const history = chain.GetStateHistory();
history.forEach((change) => {
    print(`[${change.timestamp}] ${change.key}: ${change.oldValue} → ${change.newValue}`);
});

chain.ClearStateHistory();
```

## Restoring State (Test Mode Only)

In test mode you can roll state back to any point in time:

```typescript
chain.EnableTestMode();

chain.SetState("level", 1);
const t = tick();
chain.SetState("level", 2);

chain.RestoreState(t); // level is back to 1
```

## Using State Inside Modules

`Chain.link` exposes `SetState` and `GetState` as protected helpers:

```typescript
export default class ScoreService extends Chain.link {
    Init() {
        this.SetState("score", 0);
    }

    AddPoints(amount: number) {
        const current = this.GetState<number>("score") ?? 0;
        this.SetState("score", current + amount);
    }
}
```

## Best Practices

- Call `EnableStateSync` **before** `Init()` on both sides
- Keep synced keys to a minimum — each change fires a network event
- Use local state for UI or per-client data; use server state for authoritative game data
- Subscribe and unsubscribe in `OnStart` / `OnShutdown` to avoid leaks

## Next Steps

- [Networking](./08-networking.md) - Client-server communication
- [Event System](./09-event-system.md) - Pub/sub messaging

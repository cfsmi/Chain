# Event System

Chain's event bus provides in-process publish/subscribe messaging, letting modules communicate without direct references to each other.

## Two Event APIs

Chain exposes two related but distinct APIs:

| API | Method | Use case |
|-----|--------|----------|
| Simple events | `Emit` / `On` | Fire-and-forget, no envelope |
| Event bus | `Publish` / `Subscribe` | Structured messages with topic, sender, and timestamp |

Inside a module that extends `Chain.link`, use `Publish` / `Subscribe` (the event bus).

## Publish / Subscribe

```typescript
// Publisher (any module)
export default class PlayerService extends Chain.link {
    OnStart() {
        Players.PlayerAdded.Connect((player) => {
            this.Publish("player:joined", { name: player.Name, userId: player.UserId });
        });
    }
}

// Subscriber (any other module)
export default class LeaderboardService extends Chain.link {
    private connection?: { Disconnect(): void };

    OnStart() {
        this.connection = this.Subscribe("player:joined", (message) => {
            const data = message.data as { name: string; userId: number };
            this.Log(1, `New player: ${data.name}`);
        });
    }

    OnShutdown() {
        this.connection?.Disconnect();
    }
}
```

## The EventBusMessage Envelope

Every subscriber callback receives an `EventBusMessage`:

| Field | Type | Description |
|-------|------|-------------|
| `topic` | `string` | The topic that was published to |
| `data` | `unknown` | The payload passed to `Publish` |
| `timestamp` | `number` | `tick()` at time of publish |
| `sender` | `string?` | Module name of the publisher (set automatically by `Chain.link`) |

## Filtering Subscriptions

Pass a filter function as the third argument to `Subscribe` to only receive messages that match a condition:

```typescript
this.Subscribe(
    "notifications",
    (message) => {
        const data = message.data as { priority: string; text: string };
        this.Log(1, `URGENT: ${data.text}`);
    },
    (data) => (data as { priority: string }).priority === "high"
);
```

## Emit / On (Simple Events)

For lightweight internal signalling where the envelope isn't needed:

```typescript
// Emit
chain.Emit("framework:ready", {});

// Listen
const unsub = chain.On("framework:ready", (data) => {
    print("Framework is ready");
});

// Stop listening
unsub();
```

`Emit` / `On` are available on the `chain` instance directly. Inside modules, prefer `Publish` / `Subscribe`.

## Once (Single-Fire Listener)

The underlying `EventService` supports a `once` pattern via `On` — unsubscribe inside the callback:

```typescript
const unsub = chain.On("game:started", (data) => {
    unsub(); // remove after first fire
    this.Log(1, "Game started!");
});
```

## Best Practices

- **Always disconnect** in `OnShutdown` to prevent memory leaks
- **Use descriptive topic names** — prefer `"player:joined"` over `"pj"`
- **Keep payloads serializable** — avoid passing Roblox Instances through the event bus
- **Prefer the event bus over direct module references** for loose coupling

## Next Steps

- [Logging](./10-logging.md) - Log levels, filtering, and structured metadata
- [Server-Client Communication](./11-server-client.md) - Patterns for full-stack modules

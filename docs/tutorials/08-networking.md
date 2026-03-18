# Networking

Chain's network layer wraps Roblox RemoteEvents and RemoteFunctions into a single, type-safe API with rate limiting, request/response promises, and RPC support.

## How It Works

On the server, Chain creates a `NetworkFolder` containing a `NetworkEvent` RemoteEvent. The client waits for this folder to replicate, then connects to the same event. All messages are JSON-encoded and routed by channel name.

## Fire-and-Forget

Use these when you don't need a response.

```typescript
// Server → specific client
chain.SendToClient(player, "notification", { text: "Welcome!" });

// Server → all clients
chain.SendToAllClients("announcement", { text: "Round starting in 10s" });

// Client → server
chain.SendToServer("playerAction", { action: "jump" });
```

All three methods are rate-limited (10 calls per second per channel). If the limit is exceeded, the call returns `false` and is dropped.

## Listening to Channels

```typescript
const conn = chain.ConnectToChannel<{ text: string }>("notification", (data) => {
    print(data.text);
});

// Disconnect when done
conn.Disconnect();
```

Inside a module, use the protected helper:

```typescript
export default class UIModule extends Chain.link {
    OnStart() {
        this.ClientOnly(() => {
            this.ConnectToChannel<{ text: string }>("notification", (data) => {
                print(data.text);
            });
        });
    }
}
```

## Request / Response

`NetworkRequest` sends a message and returns a Promise that resolves when the other side replies, or rejects on timeout (default 5 000 ms).

```typescript
// Client requesting data from server
const data = await chain.NetworkRequest<{ userId: number }, UserData>(
    "getUserData",
    { userId: 123 },
    5000
);
```

```typescript
// Server requesting data from a specific client
const result = await chain.RequestFromClient<{}, ClientInfo>(
    player,
    "getClientInfo",
    {}
);
```

## RPC — RegisterMethod / GetRegisteredMethod

For structured server-side handlers callable from the client:

**Server:**
```typescript
chain.RegisterMethod("getUserData", (player: Player, data: { userId: number }) => {
    return { id: data.userId, name: player.Name };
}, true); // true = expose to clients via RemoteFunction
```

**Client:**
```typescript
const user = await chain.GetRegisteredMethod<UserData>("getUserData", { userId: 123 });
```

The server creates a `RemoteFunction` named after the `id` inside `NetworkFolder`. The client waits up to 10 seconds for it to replicate before rejecting.

## FireNetwork

Low-level fire with rate limiting. Returns `false` if rate-limited.

```typescript
const sent = chain.FireNetwork("chat", { message: "Hello" });
if (!sent) warn("Rate limited");
```

## Network Statistics

```typescript
const stats = chain.GetNetworkStats();
print(`Sent: ${stats.sent}, Received: ${stats.received}, Errors: ${stats.errors}`);
```

## Testing — Mocking Network

```typescript
chain.EnableTestMode();

// Resolve a channel with fake data after an optional delay
chain.MockNetworkResponse("getUserData", { id: 1, name: "MockUser" }, 50);

// Simulate a failure
chain.SimulateNetworkFailure("badChannel", "Connection refused");
```

## Rate Limiting Details

| Constant | Value |
|----------|-------|
| Max calls per window | 10 |
| Window size | 1 000 ms |

Each channel has its own rate limit bucket. Calls that exceed the limit are silently dropped and return `false`.

## Best Practices

- Prefer `SendToClient` / `SendToServer` for one-way messages
- Use `NetworkRequest` / `RegisterMethod` for request-response patterns
- Always disconnect channel listeners in `OnShutdown`
- Check the return value of `FireNetwork` if delivery matters
- Keep payloads small — all data is JSON-encoded

## Next Steps

- [Event System](./09-event-system.md) - In-process pub/sub
- [Server-Client Communication](./11-server-client.md) - Patterns for full-stack modules

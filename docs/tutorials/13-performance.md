# Performance Optimization

Chain records timing data for every module and exposes network statistics so you can find bottlenecks without external tools.

## Module Performance

Chain measures two timings per module:

| Field | What it measures |
|-------|-----------------|
| `initTime` | How long `Init()` took (seconds) |
| `startTime` | How long `OnStart()` took before it yielded (seconds) |

```typescript
// After Init() and Enchain() complete
const perf = chain.GetModulePerformance("DataService");
print(`Init:  ${math.floor(perf!.initTime  * 1000)}ms`);
print(`Start: ${math.floor(perf!.startTime * 1000)}ms`);

// All modules at once — returns the Map directly
const all = chain.GetModulePerformance() as Map<string, { initTime: number; startTime: number }>;
all.forEach((data, name) => {
    print(`${name} — init: ${math.floor(data.initTime * 1000)}ms`);
});
```

Slow `Init()` times delay the entire startup sequence because `Init()` runs sequentially. Slow `OnStart()` times are less critical because each module starts in its own `task.spawn`.

## Network Statistics

```typescript
const stats = chain.GetNetworkStats();
print(`Sent:     ${stats.sent}`);
print(`Received: ${stats.received}`);
print(`Errors:   ${stats.errors}`);
```

A rising `errors` count usually means JSON encoding failures or rate-limit drops. Check `FireNetwork`'s return value if delivery matters:

```typescript
const sent = chain.FireNetwork("leaderboard:update", payload);
if (!sent) warn("Rate limited — update dropped");
```

## Rate Limiting

Every channel is limited to **10 calls per second**. Calls that exceed this are silently dropped and return `false`. Keep high-frequency updates on dedicated channels so one busy channel doesn't starve others.

## Reducing Init() Time

- Move DataStore calls and `WaitForChild` into `OnStart()`, not `Init()`
- Only set initial state values and wire up injected references in `Init()`
- Avoid `task.wait` inside `Init()`

## Reducing Network Traffic

- Call `EnableStateSync` with the smallest key list that clients actually need
- Batch multiple small changes into one payload rather than firing separate events
- Use `RegisterMethod` / `GetRegisteredMethod` for request-response instead of two separate channels

## Log Level in Production

Set the log level to `1` (INFO) or higher in production to skip the DEBUG prints that fire on every state change and network message:

```typescript
chain.SetLogLevel(1); // suppress DEBUG
```

## State History Memory

`GetStateHistory()` keeps every `SetState` call in memory for the lifetime of the session. In long-running servers, clear it periodically:

```typescript
task.spawn(() => {
    while (true) {
        task.wait(300); // every 5 minutes
        chain.ClearStateHistory();
    }
});
```

## Log Buffer Memory

Each module's log buffer holds up to 1 000 entries. Clear logs for modules that log at high frequency:

```typescript
task.spawn(() => {
    while (true) {
        task.wait(60);
        chain.ClearLogs("HighFrequencyService");
    }
});
```

## Best Practices

- Keep `Init()` under ~10 ms per module
- Prefer `SubscribeToServerState` over polling `RequestServerState` in a loop
- Disconnect subscriptions in `OnShutdown` to prevent accumulating dead callbacks
- Use `AddModuleFilter` during debugging to reduce log noise, then remove it before shipping

## Next Steps

- [State Synchronization](./12-state-sync.md) - Keeping synced keys minimal
- [Networking](./08-networking.md) - Rate limiting details

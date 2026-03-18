# Logging

Chain includes a structured logging system with level filtering, per-module log buffers, and metadata support.

## Log Levels

| Level | Value | When to use |
|-------|-------|-------------|
| `DEBUG` | 0 | Verbose tracing, development only |
| `INFO` | 1 | Normal operational messages |
| `WARN` | 2 | Unexpected but recoverable situations |
| `ERROR` | 3 | Failures that need attention |

## Logging Inside a Module

Use `this.Log(level, message)` inside any class that extends `Chain.link`. The module name is prepended automatically:

```typescript
export default class DataService extends Chain.link {
    Init() {
        this.Log(1, "DataService initialized");           // INFO
        this.Log(0, "Cache size: 0");                     // DEBUG
    }

    LoadData(key: string) {
        this.Log(0, `Loading key: ${key}`);
        // ...
        this.Log(2, `Key not found: ${key}`);             // WARN
    }
}
```

Output format: `INFO [DataService]: DataService initialized`

## Setting the Log Level

Only messages at or above the configured level are printed:

```typescript
chain.SetLogLevel(1); // suppress DEBUG, show INFO and above
chain.SetLogLevel(0); // show everything
chain.SetLogLevel(3); // errors only
```

## Logging with Metadata

Pass a metadata object as the third argument for structured context:

```typescript
this.Log(3, "Save failed", {
    player: player.Name,
    dataKey: "inventory",
    retryCount: 3
});
```

## Module Filters

Restrict output to specific modules (useful when debugging one system):

```typescript
chain.AddModuleFilter("DataService");
chain.AddModuleFilter("ShopService");
// Only DataService and ShopService logs will print
```

## Reading Logs Programmatically

Logs are buffered in memory (up to 1 000 entries per module):

```typescript
// All logs, sorted by timestamp
const all = chain.GetLogs();

// Logs for one module only
const dataLogs = chain.GetLogs("DataService");

dataLogs.forEach((entry) => {
    print(`[${entry.timestamp}] ${entry.message}`);
});
```

Each `LogEntry` contains:

| Field | Type | Description |
|-------|------|-------------|
| `level` | `LogLevel` | Numeric level (0–3) |
| `message` | `string` | Log message |
| `module` | `string?` | Module that logged it |
| `timestamp` | `number` | `tick()` at log time |
| `metadata` | `Record<string, unknown>?` | Optional structured data |

## Clearing Logs

```typescript
chain.ClearLogs("DataService"); // clear one module
chain.ClearLogs();              // clear all
```

## Best Practices

- Set log level to `1` (INFO) in production and `0` (DEBUG) during development
- Use `DEBUG` for per-frame or high-frequency messages
- Include relevant context in metadata rather than string-interpolating everything
- Clear logs periodically in long-running sessions to avoid memory growth

## Next Steps

- [Server-Client Communication](./11-server-client.md) - Patterns for full-stack modules
- [Performance Optimization](./13-performance.md) - Profiling and monitoring

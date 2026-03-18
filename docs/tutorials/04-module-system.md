# Module System

The module system is the core of Chain. It handles loading, dependency resolution, lifecycle management, and performance tracking.

## Module Anatomy

Every module must:
1. `export default` a class
2. Extend `Chain.link`
3. Optionally implement `Init`, `OnStart`, and/or `OnShutdown`

```typescript
import { Chain } from "../Chain";

export default class MyService extends Chain.link {
    Init() {}      // setup, runs synchronously before any OnStart
    OnStart() {}   // main logic, runs in its own task.spawn
    OnShutdown() {} // cleanup
}
```

## Lifecycle Order

```
LoadModules()
    └─ requires each ModuleScript, instantiates the class

Init()  (async, resolves when all modules finish Init)
    └─ calls module.Init() in dependency order
    └─ injects declared dependencies

Enchain()  (async)
    └─ calls module.OnStart() in a task.spawn per module
    └─ modules run concurrently from this point

Shutdown()
    └─ calls module.OnShutdown() and cancels tasks
```

## Dependency Injection

Use `Inject` to declare dependencies. Values are class constructors — Chain injects the live instance and ensures each dependency is initialized before your module:

```typescript
import DataService from "./DataService";

export default class ShopService extends Chain.link {
    Inject = { dataService: DataService };

    private dataService!: DataService;

    OnStart() {
        const data = this.dataService.GetPlayerData(player);
    }
}
```

The `Inject` map format is `{ propertyName: ConstructorClass }`. Init order is derived automatically from the injection graph — no separate `Dependencies` array needed. Chain resolves mocked constructors in test mode automatically.

## Loading Modules

`LoadModules` recursively walks a folder and requires every `ModuleScript` it finds:

```typescript
const errors = chain.LoadModules(modulesFolder);
// errors: Array<{ moduleName: string; error: string }>

if (errors.size() > 0) {
    errors.forEach(e => warn(`Failed to load ${e.moduleName}: ${e.error}`));
}
```

Subfolders are traversed automatically, so you can organize modules however you like:

```
Modules/
├── Economy/
│   ├── CurrencyService.ts
│   └── ShopService.ts
└── Players/
    ├── DataService.ts
    └── GreetingService.ts
```

## Getting a Module at Runtime

Pass the constructor for a type-safe lookup:

```typescript
import DataService from "./DataService";

const dataService = chain.GetModule(DataService);
if (dataService) {
    dataService.SavePlayer(player);
}
```

The string form still works but is not recommended:

```typescript
const dataService = chain.GetModule<DataService>("DataService");
```

In test mode, `GetModule` returns the mocked version if one exists.

## Performance Tracking

Chain records how long each module takes to load and initialize:

```typescript
// After Init() and Enchain() complete
const perf = chain.GetModulePerformance("DataService");
// { initTime: number, startTime: number }  (in seconds)

// Get all modules
const allPerf = chain.GetModulePerformance();
```

## Selective Start

You can start a single module instead of all of them:

```typescript
await chain.Enchain("GreetingService"); // starts only GreetingService
```

And shut down a single module:

```typescript
await chain.Shutdown("GreetingService"); // stops only GreetingService
```

## Error Handling

Both `Init()` and `Enchain()` return a Promise that resolves with an error array:

```typescript
const initErrors = await chain.Init();
const startErrors = await chain.Enchain();

[...initErrors, ...startErrors].forEach(e => {
    warn(`[${e.moduleName}] ${e.error}`);
});
```

## Next Steps

- [Dependency Injection](./05-dependency-injection.md) — DI container details
- [Lifecycle Management](./06-lifecycle.md) — timing and ordering guarantees
- [State Management](./07-state-management.md)

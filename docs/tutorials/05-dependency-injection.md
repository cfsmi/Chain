# Dependency Injection

Chain's dependency injection system ensures modules are initialized in the correct order and can reference each other safely.

## How It Works

When you declare `Inject`, Chain:
1. Walks the injection graph to determine initialization order
2. Initializes each dependency before the module that needs it
3. Assigns the live instance to the declared property

## Injecting Module References

Use the `Inject` property with constructor references as values:

```typescript
import DataService from "./DataService";
import CurrencyService from "./CurrencyService";

export default class ShopService extends Chain.link {
    Inject = {
        dataService: DataService,
        currencyService: CurrencyService,
    };

    private dataService!: DataService;
    private currencyService!: CurrencyService;

    OnStart() {
        const playerData = this.dataService.GetPlayerData(player);
        const balance = this.currencyService.GetBalance(player);
    }
}
```

## Injection Format

```typescript
Inject = {
    propertyName: ConstructorClass
}
```

- `propertyName` — the property on your class that will hold the instance
- `ConstructorClass` — the actual class (not a string). If you rename the class, TypeScript will error here immediately

There is no separate `Dependencies` array. Init order is derived automatically from the injection graph.

## Circular Dependencies

Chain detects circular dependencies and will log an error during initialization:

```typescript
// ❌ This will fail
export default class ModuleA extends Chain.link {
    Inject = { b: ModuleB };
}
export default class ModuleB extends Chain.link {
    Inject = { a: ModuleA };
}
```

**Solution**: Refactor to remove the circular dependency by:
- Using the event bus for communication between the two modules
- Creating a third module that both depend on
- Restructuring your architecture

## Getting Modules at Runtime

Pass the constructor to `GetModule` for a type-safe lookup:

```typescript
import DataService from "./DataService";

export default class GameManager extends Chain.link {
    OnStart() {
        const dataService = this.Framework.GetModule(DataService);
        if (dataService) {
            dataService.SaveAllPlayers();
        }
    }
}
```

## Dependency Injection in Tests

In test mode, pass the constructor as the mock key so the same injection graph resolves to your mock:

```typescript
import DataService from "./DataService";

chain.EnableTestMode();
chain.MockModule(DataService, {
    GetPlayerData: () => ({ coins: 100 })
});

// ShopService.Inject = { dataService: DataService } will receive the mock
```

## Best Practices

1. **Keep dependencies minimal** — only depend on what you actually need
2. **Avoid deep dependency chains** — if A → B → C → D, consider refactoring
3. **Use the event bus for loose coupling** — not everything needs to be a dependency
4. **Never use string keys** — always pass the constructor so renames are caught at compile time

## Example: E-commerce System

```typescript
// DataService.ts - no dependencies
export default class DataService extends Chain.link {
    private playerData = new Map<Player, PlayerData>();

    GetPlayerData(player: Player): PlayerData | undefined {
        return this.playerData.get(player);
    }

    SavePlayerData(player: Player, data: PlayerData): void {
        this.playerData.set(player, data);
    }
}

// CurrencyService.ts - depends on DataService
import DataService from "./DataService";

export default class CurrencyService extends Chain.link {
    Inject = { dataService: DataService };
    private dataService!: DataService;

    GetBalance(player: Player): number {
        return this.dataService.GetPlayerData(player)?.coins ?? 0;
    }

    AddCoins(player: Player, amount: number): void {
        const data = this.dataService.GetPlayerData(player);
        if (data) {
            data.coins += amount;
            this.dataService.SavePlayerData(player, data);
        }
    }
}

// ShopService.ts - depends on both
import DataService from "./DataService";
import CurrencyService from "./CurrencyService";

export default class ShopService extends Chain.link {
    Inject = {
        dataService: DataService,
        currencyService: CurrencyService,
    };

    private dataService!: DataService;
    private currencyService!: CurrencyService;

    PurchaseItem(player: Player, itemId: string, price: number): boolean {
        const balance = this.currencyService.GetBalance(player);
        if (balance >= price) {
            this.currencyService.AddCoins(player, -price);
            const data = this.dataService.GetPlayerData(player);
            if (data) {
                data.inventory.push(itemId);
                this.dataService.SavePlayerData(player, data);
            }
            return true;
        }
        return false;
    }
}
```

## Initialization Order

Given the example above, Chain resolves the injection graph and initializes in this order:
1. `DataService` (no injections)
2. `CurrencyService` (injects `DataService`)
3. `ShopService` (injects both)

## Next Steps

- [Lifecycle Management](./06-lifecycle.md) - Understanding Init, OnStart, and OnShutdown
- [State Management](./07-state-management.md) - Managing application state

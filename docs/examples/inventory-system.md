# Example: Inventory System

Demonstrates multi-module dependency injection, RPC request/response, and event bus integration for a player inventory.

## Modules

```typescript
// src/shared/Modules/InventoryService.ts
import { Chain } from "../Chain";
import DataService from "./DataService";

export default class InventoryService extends Chain.link {
    Inject = { dataService: DataService };
    private dataService!: DataService;

    Init() {
        this.ServerOnly(() => {
            // Expose inventory lookup to clients via RPC
            this.Framework.RegisterMethod("inventory:get", (player: Player) => {
                return this.GetInventory(player);
            }, true);
        });
    }

    GetInventory(player: Player): string[] {
        return this.dataService.GetData(player).inventory;
    }

    AddItem(player: Player, itemId: string): boolean {
        const data = this.dataService.GetData(player);
        if (data.inventory.includes(itemId)) return false;

        data.inventory.push(itemId);
        this.dataService.SetData(player, data);
        this.Publish("inventory:changed", { player: player.Name, itemId, action: "add" });
        this.Log(`Added ${itemId} to ${player.Name}'s inventory`);
        return true;
    }

    RemoveItem(player: Player, itemId: string): boolean {
        const data = this.dataService.GetData(player);
        const index = data.inventory.indexOf(itemId);
        if (index === -1) return false;

        data.inventory.remove(index);
        this.dataService.SetData(player, data);
        this.Publish("inventory:changed", { player: player.Name, itemId, action: "remove" });
        return true;
    }
}
```

```typescript
// src/shared/Modules/ShopService.ts
import { Chain } from "../Chain";
import DataService from "./DataService";
import CurrencyService from "./CurrencyService";
import InventoryService from "./InventoryService";

interface PurchaseResult {
    success: boolean;
    reason?: string;
}

export default class ShopService extends Chain.link {
    Inject = {
        dataService: DataService,
        currencyService: CurrencyService,
        inventoryService: InventoryService,
    };
    private dataService!: DataService;
    private currencyService!: CurrencyService;
    private inventoryService!: InventoryService;

    Init() {
        this.ServerOnly(() => {
            this.Framework.RegisterMethod(
                "shop:purchase",
                (player: Player, data: { itemId: string; price: number }) => {
                    return this.Purchase(player, data.itemId, data.price);
                },
                true
            );
        });
    }

    Purchase(player: Player, itemId: string, price: number): PurchaseResult {
        const balance = this.currencyService.GetCoins(player);

        if (balance < price) {
            return { success: false, reason: "insufficient_funds" };
        }

        if (!this.inventoryService.AddItem(player, itemId)) {
            return { success: false, reason: "already_owned" };
        }

        this.currencyService.AddCoins(player, -price);
        this.Publish("shop:purchased", { player: player.Name, itemId, price });
        this.Log(`${player.Name} purchased ${itemId} for ${price} coins`);
        return { success: true };
    }
}
```

## Client Usage

```typescript
// Inside a client module
import ShopService from "shared/Modules/ShopService";

export default class ShopUI extends Chain.link {
    async BuyItem(itemId: string, price: number) {
        const result = await this.Framework.GetRegisteredMethod<{ success: boolean; reason?: string }>(
            "shop:purchase",
            { itemId, price }
        );

        if (result?.success) {
            print(`Purchased ${itemId}!`);
        } else {
            warn(`Purchase failed: ${result?.reason}`);
        }
    }

    async LoadInventory() {
        const items = await this.Framework.GetRegisteredMethod<string[]>("inventory:get", {});
        print(`You have ${items?.size()} items`);
    }
}
```

## Initialization Order

1. `DataService`
2. `CurrencyService` → `DataService`
3. `InventoryService` → `DataService`
4. `ShopService` → `DataService`, `CurrencyService`, `InventoryService`

## Key Patterns

- `ShopService.Purchase` is the single authority for all purchase logic — it validates funds, adds the item, and deducts coins atomically
- `RegisterMethod` exposes server logic to clients without manual RemoteFunction wiring
- The `"shop:purchased"` event lets other modules (analytics, achievements) react without coupling to `ShopService`

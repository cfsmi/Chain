# Example: Player Data Manager

Demonstrates DataStore integration, dependency injection, and server state synchronization for managing persistent player data.

## Modules

```typescript
// src/shared/Modules/DataService.ts
import { Chain } from "../Chain";
import { DataStoreService, Players } from "@rbxts/services";

interface PlayerData {
    coins: number;
    level: number;
    inventory: string[];
}

const DEFAULT_DATA: PlayerData = { coins: 0, level: 1, inventory: [] };

export default class DataService extends Chain.link {
    private store!: DataStore;
    private cache = new Map<number, PlayerData>();

    Init() {
        this.ServerOnly(() => {
            this.store = DataStoreService.GetDataStore("PlayerData");
        });
    }

    OnStart() {
        this.ServerOnly(() => {
            Players.PlayerAdded.Connect((p) => this.load(p));
            Players.PlayerRemoving.Connect((p) => this.save(p));
        });
    }

    GetData(player: Player): PlayerData {
        return this.cache.get(player.UserId) ?? { ...DEFAULT_DATA };
    }

    SetData(player: Player, data: PlayerData) {
        this.cache.set(player.UserId, data);
    }

    private load(player: Player) {
        const [ok, result] = pcall(() => this.store.GetAsync(`player_${player.UserId}`));
        const data = ok && result ? (result as PlayerData) : { ...DEFAULT_DATA };
        this.cache.set(player.UserId, data);
        this.Log(`Loaded data for ${player.Name}`);
    }

    private save(player: Player) {
        const data = this.cache.get(player.UserId);
        if (!data) return;
        pcall(() => this.store.SetAsync(`player_${player.UserId}`, data));
        this.cache.delete(player.UserId);
        this.Log(`Saved data for ${player.Name}`);
    }

    OnShutdown() {
        this.ServerOnly(() => {
            Players.GetPlayers().forEach((p) => this.save(p));
        });
    }
}
```

```typescript
// src/shared/Modules/CurrencyService.ts
import { Chain } from "../Chain";
import DataService from "./DataService";

export default class CurrencyService extends Chain.link {
    Inject = { dataService: DataService };
    private dataService!: DataService;

    GetCoins(player: Player): number {
        return this.dataService.GetData(player).coins;
    }

    AddCoins(player: Player, amount: number) {
        const data = this.dataService.GetData(player);
        data.coins = math.max(0, data.coins + amount);
        this.dataService.SetData(player, data);
        this.Publish("currency:changed", { player: player.Name, coins: data.coins });
    }
}
```

```typescript
// src/shared/Modules/PlayerService.ts
import { Chain } from "../Chain";
import { Players } from "@rbxts/services";
import DataService from "./DataService";
import CurrencyService from "./CurrencyService";

export default class PlayerService extends Chain.link {
    Inject = { dataService: DataService, currencyService: CurrencyService };
    private dataService!: DataService;
    private currencyService!: CurrencyService;

    OnStart() {
        this.ServerOnly(() => {
            Players.PlayerAdded.Connect((player) => {
                // Grant login bonus
                this.currencyService.AddCoins(player, 10);
                this.Log(`${player.Name} joined — granted 10 login coins`);

                // Sync coin count to client
                this.Framework.EnableStateSync([`coins:${player.UserId}`]);
                this.Framework.SetServerState(
                    `coins:${player.UserId}`,
                    this.currencyService.GetCoins(player)
                );
            });
        });
    }
}
```

## Initialization Order

Chain resolves the injection graph and initializes in this order:

1. `DataService` — no dependencies
2. `CurrencyService` — depends on `DataService`
3. `PlayerService` — depends on both

## Key Patterns

- `DataService` owns all DataStore I/O and the in-memory cache
- `CurrencyService` reads and writes through `DataService`, never touching the store directly
- `PlayerService` orchestrates the join flow and publishes state changes
- `OnShutdown` in `DataService` flushes all cached data before the server closes

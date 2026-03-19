# Example: Game Manager

A round-based game loop demonstrating lifecycle management, state synchronization, event bus coordination, and multi-module orchestration.

## Modules

```typescript
// src/shared/Modules/GameManager.ts
import { Chain } from "../Chain";
import { Players } from "@rbxts/services";
import PlayerService from "./PlayerService";
import DataService from "./DataService";

type GameState = "lobby" | "starting" | "active" | "ending";

export default class GameManager extends Chain.link {
    Inject = { playerService: PlayerService, dataService: DataService };
    private playerService!: PlayerService;
    private dataService!: DataService;

    private roundNumber = 0;
    private gameLoop?: thread;
    private connections: { Disconnect(): void }[] = [];

    Init() {
        this.ServerOnly(() => {
            this.SetState("gameState", "lobby" as GameState);
            this.SetState("roundNumber", 0);
            this.Framework.EnableStateSync(["gameState", "roundNumber"]);
        });
    }

    OnStart() {
        this.ServerOnly(() => {
            this.gameLoop = task.spawn(() => this.runLoop());

            this.connections.push(
                this.Subscribe("player:joined", () => this.checkStartConditions())
            );
        });

        this.ClientOnly(() => {
            this.Framework.SubscribeToServerState<GameState>("gameState", (change) => {
                this.Log(`Game state: ${change.newValue}`);
                // Drive UI updates here
            });
        });
    }

    private runLoop() {
        while (true) {
            this.waitForPlayers();
            this.startRound();
            this.runRound(60); // 60-second rounds
            this.endRound();
            task.wait(10); // intermission
        }
    }

    private waitForPlayers() {
        this.setGameState("lobby");
        while (Players.GetPlayers().size() < 2) {
            task.wait(1);
        }
    }

    private startRound() {
        this.roundNumber++;
        this.SetState("roundNumber", this.roundNumber);
        this.Framework.SetServerState("roundNumber", this.roundNumber);
        this.setGameState("starting");
        this.Publish("game:roundStarting", { round: this.roundNumber });
        task.wait(3);
        this.setGameState("active");
        this.Publish("game:roundStarted", { round: this.roundNumber });
        this.Log(`Round ${this.roundNumber} started`);
    }

    private runRound(duration: number) {
        task.wait(duration);
    }

    private endRound() {
        this.setGameState("ending");
        this.Publish("game:roundEnded", { round: this.roundNumber });
        this.Log(`Round ${this.roundNumber} ended`);
    }

    private setGameState(state: GameState) {
        this.Framework.SetServerState("gameState", state);
    }

    private checkStartConditions() {
        // Could trigger early start logic here
    }

    OnShutdown() {
        if (this.gameLoop) {
            task.cancel(this.gameLoop);
            this.gameLoop = undefined;
        }
        this.connections.forEach((c) => c.Disconnect());
        this.connections = [];
    }
}
```

```typescript
// src/shared/Modules/RoundRewardsService.ts
// Reacts to game events without depending on GameManager directly
import { Chain } from "../Chain";
import CurrencyService from "./CurrencyService";
import { Players } from "@rbxts/services";

export default class RoundRewardsService extends Chain.link {
    Inject = { currencyService: CurrencyService };
    private currencyService!: CurrencyService;

    private connections: { Disconnect(): void }[] = [];

    OnStart() {
        this.ServerOnly(() => {
            this.connections.push(
                this.Subscribe("game:roundEnded", () => {
                    Players.GetPlayers().forEach((player) => {
                        this.currencyService.AddCoins(player, 25);
                    });
                    this.Log("Distributed round rewards");
                })
            );
        });
    }

    OnShutdown() {
        this.connections.forEach((c) => c.Disconnect());
        this.connections = [];
    }
}
```

## Server Entry Point

```typescript
// src/server/main.server.ts
import { Chain } from "shared/Chain";
import { ReplicatedStorage } from "@rbxts/services";

const chain = new Chain();
chain.EnableStateSync(["gameState", "roundNumber"]);
chain.LoadModules(ReplicatedStorage.FindFirstChild("Modules") as Folder);
chain.SetLogLevel(1);
chain.Init();
chain.Enchain();
```

## How It Works

1. `GameManager.Init` registers `gameState` and `roundNumber` for state sync
2. `GameManager.OnStart` spawns the game loop in its own thread via `task.spawn`
3. The loop transitions through `lobby → starting → active → ending` and publishes events at each transition
4. `RoundRewardsService` subscribes to `"game:roundEnded"` and grants coins — it never imports `GameManager`, keeping the coupling loose
5. Clients subscribe to `gameState` server state changes to update their UI in real time

## Key Patterns

- The game loop lives in `OnStart`, not `Init`, so it doesn't block other modules from initializing
- `task.cancel` in `OnShutdown` cleanly stops the loop when the server shuts down
- Event bus decouples reward logic from game flow — adding new reactions (achievements, analytics) requires no changes to `GameManager`

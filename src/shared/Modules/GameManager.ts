import { Chain } from "../Chain";

export default class GameManager extends Chain.link {
    Dependencies = ["ExamplePlayerService"];
    Inject = {
        PlayerService: "ExamplePlayerService"
    };

    public Init() {
        this.Log(1, "GameManager init");
        
        // Subscribe to player count changes from PlayerService
        this.Subscribe("player-count-changed", (message) => {
            this.Log(1, `GameManager received player count: ${(message.data as { count: number }).count}`);
        });
        
        // Subscribe to player joined events
        this.Subscribe("player-joined", (message) => {
            this.Log(1, `GameManager notified: ${message.data as string} joined`);
        });
    }

    public OnStart() {
        this.Log(1, "GameManager started");
        
        // Get PlayerService from framework
        const playerService = this.Framework.GetModule("ExamplePlayerService") as unknown as {
            getPlayerCount: (this: void) => number;
            addPlayer: (this: void, name: string) => void;
        };
        if (playerService) {
            // Call methods using Framework.GetModule to ensure proper context
            const ps = this.Framework.GetModule("ExamplePlayerService");
            if (ps && ps.getPlayerCount) {
                const count = (ps.getPlayerCount as unknown as (self: unknown) => number)(ps);
                this.Log(1, `Current player count from PlayerService: ${count}`);
                
                // Test adding a player after 5 seconds
                task.spawn(() => {
                    task.wait(5);
                    if (ps && ps.addPlayer) {
                        (ps.addPlayer as unknown as (self: unknown, name: string) => void)(ps, "TestPlayer123");
                    }
                });
            }
        }
    }

    public OnShutdown() {
        this.Log(1, "GameManager shutting down");
    }
}

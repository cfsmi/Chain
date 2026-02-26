import { Chain } from "../Chain";

export default class PlayerService extends Chain.link {
    Dependencies = ["Sample"];
    Inject = {
        SampleService: "Sample"
    };

    private SampleService?: typeof Chain.link
    private playerCount = 0;

    public Init() {
        this.Log(1, "PlayerService initialized");
        this.SetState("playerCount", this.playerCount);
    }

    public OnStart() {
        this.Log(1, "PlayerService started");
        this.startPlayerCountUpdater();
    }

    public OnShutdown() {
        this.Log(1, "PlayerService shutting down");
    }

    private startPlayerCountUpdater() {
        task.spawn(() => {
            while (true) {
                task.wait(3);
                this.playerCount = math.random(1, 20);
                this.SetState("playerCount", this.playerCount);
                this.Log(1, `Player count updated to: ${this.playerCount}`);
            }
        });
    }

    public getPlayerCount(): number {
        return this.playerCount;
    }
}
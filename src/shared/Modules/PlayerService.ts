import { BaseService } from "../Architecture";
import { Chain } from "../Chainv2";

export default class PlayerService extends BaseService {
    Dependencies = ["Sample"];
    Inject = {
        SampleService: "Sample"
    };

    private SampleService?: BaseService;
    private playerCount = 0;

    constructor(framework: Chain, moduleName: string) {
        super(framework, moduleName);
    }

    Init() {
        this.Log(1, "PlayerService initialized");
        this.SetState("playerCount", this.playerCount);
    }

    OnStart() {
        this.Log(1, "PlayerService started");
        this.startPlayerCountUpdater();
    }

    OnShutdown() {
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
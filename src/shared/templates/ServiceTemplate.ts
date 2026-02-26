import { BaseService } from "../Architecture";
import { Chain } from "../Chain";

export default class ExampleService extends BaseService {
    Dependencies = ["OtherService"];
    Inject = {
        OtherService: "OtherService"
    };

    private OtherService!: BaseService;

    public Init() {
        this.Log(1, "Service initialized");
    }
    
    public OnStart() {
        this.Log(1, "Service started");
    }

    public OnShutdown() {
        this.Log(1, "Service shutting down");
    }
}

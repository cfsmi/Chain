import { BaseController } from "../Architecture";
import { Chain } from "../Chainv2";

export default class ExampleController extends BaseController {
    Dependencies = ["OtherController"];
    Inject = {
        OtherController: "OtherController"
    };


    private OtherController?: BaseController;

    constructor(framework: Chain, moduleName: string) {
        super(framework, moduleName);
        this.framework = framework;
    }

    public Init() {
        this.Log(1, "Controller initialized");
    }

    public OnStart() {
        this.Log(1, "Controller started");
    }

    public OnShutdown() {
        this.Log(1, "Controller shutting down");
    }
}

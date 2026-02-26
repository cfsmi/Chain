import { BaseController } from "../Architecture";
import { Chain } from "../Chain";

export default class ExampleController extends BaseController {
    Dependencies = ["OtherController"];
    Inject = {
        OtherController: "OtherController"
    };


    private OtherController?: BaseController;


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

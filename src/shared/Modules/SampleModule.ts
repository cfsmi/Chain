//Basic module with init
import { BaseService } from "../Architecture"
import { Chain } from "../Chainv2"

export default class Sample extends BaseService {
    public Init() {
        this.Log(1, "Sample Module Initialized");
    }
}
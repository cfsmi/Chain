//Basic module with init
import { BaseService } from "../Architecture"
import { Chain } from "../Chain"

export default class Sample extends BaseService {
    public Init() {
        this.Log(1, "Sample Module Initialized");
    }
}
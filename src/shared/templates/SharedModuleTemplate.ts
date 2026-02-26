import { SharedModule } from "../Architecture";
import { Chain } from "../Chain";

export default class ExampleSharedModule extends SharedModule {
    Dependencies = ["OtherModule"];
    Inject = {
        OtherModule: "OtherModule"
    };

    protected framework!: Chain;
    private OtherModule?: SharedModule;

    constructor(framework: Chain, moduleName: string) {
        super(framework, moduleName);
        this.framework = framework;
    }

    Init() {
        this.Log(1, "Shared module initialized");
        
        this.ServerOnly(() => {
            this.Log(1, "Server-side initialization");
        });

        this.ClientOnly(() => {
            this.Log(1, "Client-side initialization");
        });
    }

    OnStart() {
        this.Log(1, "Shared module started");
    }

    OnShutdown() {
        this.Log(1, "Shared module shutting down");
    }
}

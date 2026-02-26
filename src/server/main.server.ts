import { Chain } from "shared/Chainv2";
import { ReplicatedStorage } from "@rbxts/services";

const ChainFramework = new Chain();
ChainFramework.LoadModules(ReplicatedStorage.FindFirstChild("Modules")!);
ChainFramework.Init();  // Injects dependencies & calls Init()
ChainFramework.Enchain(); // Calls OnStart() on all modules

// Enable state sync for specific keys
ChainFramework.EnableStateSync(["playerCount", "gameMode", "serverStatus"]);

// Set initial server state
ChainFramework.SetServerState("playerCount", 0);
ChainFramework.SetServerState("gameMode", "lobby");
ChainFramework.SetServerState("serverStatus", "running");

// Example: Update server state periodically
let playerCount = 0;
task.spawn(() => {
    while (true) {
        task.wait(5);
        playerCount = math.random(1, 10);
        ChainFramework.SetServerState("playerCount", playerCount);
    }
});


// Example: Change game mode after some time
wait(10);
ChainFramework.SetServerState("gameMode", "battle");

wait(5);
// Later...
ChainFramework.Shutdown(); // Cleanup




import { Chain } from "shared/Chain";
import { ReplicatedStorage } from "@rbxts/services";
print("Server is running")
const ChainFramework = new Chain();


ChainFramework.EnableStateSync(["playerCount", "gameMode", "serverStatus"]);

ChainFramework.LoadModules(ReplicatedStorage.FindFirstChild("TS")?.FindFirstChild("Modules")!);
ChainFramework.SetLogLevel(1)

// Set initial server state
ChainFramework.SetServerState("playerCount", 0);
ChainFramework.SetServerState("gameMode", "lobby");
ChainFramework.SetServerState("serverStatus", "running");

ChainFramework.Init();  // Injects dependencies & calls Init()
ChainFramework.Enchain(); // Calls OnStart() on all modules

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




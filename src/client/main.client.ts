import { Chain } from "shared/Chain";
print("Client is running")
const framework = new Chain();

// Enable state sync for specific keys
framework.EnableStateSync(["playerCount", "gameMode"]);

framework.Init();
framework.Enchain()
// Set local client state
framework.SetState("localScore", 100);
framework.SetState("playerName", "TestPlayer");

// Subscribe to local state changes
framework.SubscribeToState("localScore", (change) => {
    print(`Local score changed from ${change.oldValue} to ${change.newValue}`);
});

// Subscribe to server state changes
framework.SubscribeToServerState("playerCount", (change) => {
    print(`Player count updated: ${change.newValue}`, "on server");
});

// Request server state
framework.RequestServerState("gameMode").then((gameMode) => {
    print(`Current game mode: ${gameMode}`);
});

// Example of getting both local and server state
const localScore = framework.GetState<number>("localScore");
print(`Local score: ${localScore}`);

framework.RequestServerState<string>("gameMode").then((serverGameMode) => {
    print(`Server game mode: ${serverGameMode}`);
});

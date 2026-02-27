import { createChain } from "shared/Chain";

print("Client is running");

// Create the framework instance with dependency injection
const framework = createChain();

// Enable state sync for specific keys
framework.EnableStateSync(["playerCount", "gameMode"]);

framework.Init();
framework.Enchain();

// Set local client state
framework.SetState<number>("localScore", 100);
framework.SetState<string>("playerName", "TestPlayer");

// Subscribe to local state changes
const unsubscribeScore = framework.SubscribeToState("localScore", (change) => {
    print(`Local score changed from ${change.oldValue} to ${change.newValue}`);
});

// Subscribe to server state changes
const unsubscribePlayerCount = framework.SubscribeToServerState("playerCount", (change) => {
    print(`Player count updated: ${change.newValue}`, "on server");
});

// Request server state
framework.RequestServerState<string>("gameMode").then((gameMode) => {
    print(`Current game mode: ${gameMode}`);
});

// Example of getting both local and server state
const localScore = framework.GetState<number>("localScore");
print(`Local score: ${localScore}`);

// Use events
framework.On<{ score: number }>("scoreUpdate", (data) => {
    print(`Score updated: ${data.score}`);
});

framework.Emit("scoreUpdate", { score: 150 });

// Cleanup subscriptions when needed
// unsubscribeScore();
// unsubscribePlayerCount();
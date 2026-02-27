import { Chain } from "../Chain";

export default class PlayerService extends Chain.link {
    Dependencies = [];
    Inject = {};

    private playerCount = 0;
    private updateTask?: thread;
    
    public Init() {
        this.Log(1, "PlayerService init");
        this.SetState("playerCount", this.playerCount);
        // Subscribe to event bus
        this.Subscribe("player-joined", (message) => {
            const playerName = message.data as string;
            this.Log(1, `Player joined event received: ${playerName}`);
            this.playerCount++;
            this.SetState("playerCount", this.playerCount);
        });
    }

    public OnStart() {
        this.Log(1, "PlayerService started");
        this.startPlayerCountUpdater();
        
        // Server-only: Set up network handler
        this.ServerOnly(() => {
            this.ConnectToChannel<{ action: string }>("player-action", (data) => {
                this.Log(1, `Received player action: ${data.action}`);
            });
        });
        
        // Client-only: Send test action
        this.ClientOnly(() => {
            task.wait(2);
            this.SendToServer("player-action", { action: "test-action" });
        });
    }

    public OnShutdown() {
        this.Log(1, "PlayerService shutting down");
        if (this.updateTask) {
            task.cancel(this.updateTask);
        }
    }

    private startPlayerCountUpdater() {
        this.updateTask = task.spawn(() => {
            while (true) {
                task.wait(3);
                this.playerCount = math.random(1, 20);
                this.SetState("playerCount", this.playerCount);
                this.Log(1, `Player count updated to: ${this.playerCount}`);
                
                // Publish event every update
                this.Publish("player-count-changed", { count: this.playerCount });
            }
        });
    }

    public getPlayerCount(): number {
        return this.playerCount;
    }
    
    public addPlayer(playerName: string): void {
        this.playerCount++;
        this.Log(1, `Added player: ${playerName}, new count: ${this.playerCount}`);
        this.Publish("player-joined", playerName);
    }
}
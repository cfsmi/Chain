# Example: Chat System

A simple global chat system demonstrating server-client communication, channel messaging, and the event bus.

## Module

```typescript
// src/shared/Modules/ChatService.ts
import { Chain } from "../Chain";
import { Players } from "@rbxts/services";

interface ChatMessage {
    playerName: string;
    text: string;
    timestamp: number;
}

export default class ChatService extends Chain.link {
    private history: ChatMessage[] = [];
    private connection?: { Disconnect(): void };

    OnStart() {
        this.ServerOnly(() => this.setupServer());
        this.ClientOnly(() => this.setupClient());
    }

    // Called from client UI
    SendMessage(text: string) {
        this.ClientOnly(() => {
            this.SendToServer("chat:send", { text });
        });
    }

    private setupServer() {
        this.ConnectToChannel<{ text: string }>("chat:send", (data) => {
            // In a real game, identify the sender via a server-side player map
            const msg: ChatMessage = {
                playerName: "Player",
                text: data.text,
                timestamp: tick(),
            };

            this.history.push(msg);
            this.SendToAllClients("chat:receive", msg);
            this.Publish("chat:message", msg);
            this.Log(`Chat: ${msg.playerName}: ${msg.text}`);
        });
    }

    private setupClient() {
        this.connection = this.ConnectToChannel<ChatMessage>("chat:receive", (msg) => {
            print(`[Chat] ${msg.playerName}: ${msg.text}`);
        });
    }

    OnShutdown() {
        this.connection?.Disconnect();
    }
}
```

## Server Entry Point

```typescript
// src/server/main.server.ts
import { Chain } from "shared/Chain";
import { ReplicatedStorage } from "@rbxts/services";

const chain = new Chain();
chain.LoadModules(ReplicatedStorage.FindFirstChild("Modules") as Folder);
chain.Init();
chain.Enchain();
```

## Client Entry Point

```typescript
// src/client/main.client.ts
import { Chain } from "shared/Chain";
import { ReplicatedStorage } from "@rbxts/services";
import ChatService from "shared/Modules/ChatService";

const chain = new Chain();
chain.LoadModules(ReplicatedStorage.FindFirstChild("Modules") as Folder);
chain.Init();
chain.Enchain();

// Send a message from a UI button
const chatService = chain.GetModule(ChatService);
chatService?.SendMessage("Hello everyone!");
```

## How It Works

1. The client calls `SendMessage`, which fires `chat:send` to the server
2. The server receives it, appends to history, broadcasts `chat:receive` to all clients, and publishes to the event bus
3. Any module subscribed to `"chat:message"` (e.g. a logging or moderation module) receives it without coupling to `ChatService` directly

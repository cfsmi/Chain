import { Chain, LogLevel } from "./Chainv2";

/**
 * Example module demonstrating Chain usage
 */
export class ExampleTestModule {
    private Chain: Chain;

    constructor() {
        this.Chain = new Chain();
        this.setupChain();
    }

    private setupChain() {
        // Enable test mode
        this.Chain.EnableTestMode();
        this.Chain.SetLogLevel(LogLevel.DEBUG);

        // Load configuration
        this.Chain.LoadConfig({
            environment: "dev",
        });

        // Set up some initial state
        this.Chain.SetState("userCount", 0);
        this.Chain.SetState("gameMode", "lobby");
    }

    /**
     * Example of testing network operations
     */
    public async testNetworkOperations() {
        const suite = this.Chain.CreateTestSuite("Network Operations");

        suite
            .test("should send network request successfully", async () => {
                // Mock a successful response
                this.Chain.MockNetworkResponse("getUserData", { id: 1, name: "TestUser" }, 100);
                
                const response = await this.Chain.NetworkRequest("getUserData", { userId: 1 });
                if (!response || (response as any).name !== "TestUser") {
                    throw "Invalid response received";
                }
            })
            .test("should handle network timeout", async () => {
                // Mock a delayed response that will timeout
                this.Chain.MockNetworkResponse("slowEndpoint", { data: "slow" }, 6000);
                
                try {
                    await this.Chain.NetworkRequest("slowEndpoint", {}, 1000);
                    throw "Should have timed out";
                } catch (error) {
                    if (!tostring(error).find("timeout")) {
                        throw "Expected timeout error";
                    }
                }
            })
            .test("should handle network failure", async () => {
                this.Chain.SimulateNetworkFailure("failingEndpoint", "Connection refused");
                
                try {
                    await this.Chain.NetworkRequest("failingEndpoint", {});
                    throw "Should have failed";
                } catch (error) {
                    if (!tostring(error).find("Connection refused")) {
                        throw "Expected connection error";
                    }
                }
            });

        return await suite.run();
    }

    /**
     * Example of testing state management
     */
    public async testStateManagement() {
        const suite = this.Chain.CreateTestSuite("State Management");

        suite
            .test("should set and get state", () => {
                this.Chain.SetState("testValue", 42);
                const value = this.Chain.GetState<number>("testValue");
                if (value !== 42) {
                    throw `Expected 42, got ${value}`;
                }
            })
            .test("should track state history", () => {
                this.Chain.SetState("counter", 0);
                this.Chain.SetState("counter", 1);
                this.Chain.SetState("counter", 2);
                
                const history = this.Chain.GetStateHistory();
                const counterChanges = history.filter(change => change.key === "counter");
                if (counterChanges.size() !== 3) {
                    throw `Expected 3 state changes, got ${counterChanges.size()}`;
                }
            })
            .test("should restore state from history", () => {
                const initialTime = tick();
                this.Chain.SetState("restoreTest", "initial");
                task.wait(0.1);
                this.Chain.SetState("restoreTest", "modified");
                
                this.Chain.RestoreState(initialTime + 0.05);
                const value = this.Chain.GetState<string>("restoreTest");
                if (value !== "initial") {
                    throw `Expected 'initial', got ${value}`;
                }
            });

        return await suite.run();
    }

    /**
     * Example of testing event bus
     */
    public async testEventBus() {
        const suite = this.Chain.CreateTestSuite("Event Bus");

        suite
            .test("should publish and receive messages", async () => {
                let receivedMessage: any = undefined;
                
                const connection = this.Chain.Subscribe("test-topic", (message) => {
                    receivedMessage = message;
                });

                this.Chain.Publish("test-topic", { test: "data" }, "TestSender");
                
                // Wait for message to be processed
                const received = await this.Chain.WaitForCondition(() => receivedMessage !== undefined, 1000);
                if (!received) {
                    throw "Message was not received";
                }
                
                if (receivedMessage.data.test !== "data") {
                    throw "Incorrect message data";
                }
                
                connection.Disconnect();
            })
            .test("should filter messages", async () => {
                let messageCount = 0;
                
                const connection = this.Chain.Subscribe("filtered-topic", () => {
                    messageCount++;
                }, (data: any) => data.important === true);

                this.Chain.Publish("filtered-topic", { important: false });
                this.Chain.Publish("filtered-topic", { important: true });
                this.Chain.Publish("filtered-topic", { important: false });
                
                await task.wait(0.1);
                
                if (messageCount !== 1) {
                    throw `Expected 1 message, got ${messageCount}`;
                }
                
                connection.Disconnect();
            });

        return await suite.run();
    }

    /**
     * Example of testing module mocking
     */
    public async testModuleMocking() {
        const suite = this.Chain.CreateTestSuite("Module Mocking");

        // Create a mock module
        const mockDataService = {
            Init: () => {},
            GetUserData: (id: number) => ({ id, name: `MockUser${id}`, level: 1 }),
            SaveUserData: (data: any) => true
        };

        suite
            .test("should use mocked module", () => {
                this.Chain.MockModule("DataService", mockDataService);
                
                const dataService = this.Chain.GetModule("DataService") as any;
                if (!dataService) {
                    throw "DataService not found";
                }
                
                const userData = dataService.GetUserData(123);
                if (userData.name !== "MockUser123") {
                    throw "Mock module not working correctly";
                }
            })
            .test("should reset mocks", () => {
                this.Chain.ResetMocks();
                
                // After reset, should not find the mocked module
                const dataService = this.Chain.GetModule("DataService");
                if (dataService === mockDataService) {
                    throw "Mock was not reset";
                }
            });

        return await suite.run();
    }

    /**
     * Example of testing async operations
     */
    public async testAsyncOperations() {
        const suite = this.Chain.CreateTestSuite("Async Operations");

        suite
            .test("should wait for condition", async () => {
                let conditionMet = false;
                
                // Set condition to true after 500ms
                task.spawn(() => {
                    task.wait(0.5);
                    conditionMet = true;
                });
                
                const result = await this.Chain.WaitForCondition(() => conditionMet, 1000);
                if (!result) {
                    throw "Condition was not met in time";
                }
            })
            .test("should timeout when condition not met", async () => {
                const result = await this.Chain.WaitForCondition(() => false, 100);
                if (result) {
                    throw "Should have timed out";
                }
            });

        return await suite.run();
    }

    /**
     * Run all tests
     */
    public async runAllTests() {
        this.Chain.Log(LogLevel.INFO, "Starting comprehensive test suite", "ExampleTestModule");
        
        const results = await Promise.all([
            this.testNetworkOperations(),
            this.testStateManagement(),
            this.testEventBus(),
            this.testModuleMocking(),
            this.testAsyncOperations()
        ]);

        let totalPassed = 0;
        let totalFailed = 0;
        let totalTests = 0;

        for (const result of results) {
            totalPassed += result.passed;
            totalFailed += result.failed;
            totalTests += result.total;
        }

        this.Chain.Log(LogLevel.INFO, 
            `All tests completed: ${totalPassed}/${totalTests} passed, ${totalFailed} failed`, 
            "ExampleTestModule"
        );

        // Show performance stats
        const networkStats = this.Chain.GetNetworkStats();
        this.Chain.Log(LogLevel.INFO, 
            `Network stats - Sent: ${networkStats.sent}, Received: ${networkStats.received}, Errors: ${networkStats.errors}`, 
            "ExampleTestModule"
        );

        return {
            passed: totalPassed,
            failed: totalFailed,
            total: totalTests,
            success: totalFailed === 0
        };
    }

    /**
     * Demonstrate configuration watching
     */
    public setupConfigWatching() {
        this.Chain.WatchConfig<string>("apiUrl", (newUrl) => {
            this.Chain.Log(LogLevel.INFO, `API URL changed to: ${newUrl}`, "ExampleTestModule");
        });

        this.Chain.WatchConfig<number>("timeout", (newTimeout) => {
            this.Chain.Log(LogLevel.INFO, `Timeout changed to: ${newTimeout}ms`, "ExampleTestModule");
        });
    }

    /**
     * Demonstrate state subscriptions
     */
    public setupStateSubscriptions() {
        this.Chain.SubscribeToState<number>("userCount", (change) => {
            this.Chain.Log(LogLevel.INFO, 
                `User count changed from ${change.oldValue} to ${change.newValue}`, 
                "ExampleTestModule"
            );
        });

        this.Chain.SubscribeToState<string>("gameMode", (change) => {
            this.Chain.Log(LogLevel.INFO, 
                `Game mode changed from ${change.oldValue} to ${change.newValue}`, 
                "ExampleTestModule"
            );
        });
    }

    /**
     * Get the Chain instance for external use
     */
    public getChain(): Chain {
        return this.Chain;
    }
}

// Export a singleton instance for easy use
export const ExampleTest = new ExampleTestModule();
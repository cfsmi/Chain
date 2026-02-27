import { Chain } from "shared/Chain/ChainBundle";
import { createChain } from "shared/Chain";

// Performance comparison between original and modular framework
function performanceTest() {
    print("=== Performance Comparison ===");
    
    // Test original framework
    const originalStart = tick();
    const original = new Chain();
    original.Init();
    
    // Simulate heavy usage
    for (let i = 0; i < 1000; i++) {
        original.SetState(`key${i}`, i);
        original.SubscribeToState(`key${i}`, () => {});
    }
    const originalTime = tick() - originalStart;
    
    // Test modular framework
    const modularStart = tick();
    const modular = createChain();
    modular.Init();
    
    // Simulate same heavy usage
    for (let i = 0; i < 1000; i++) {
        modular.SetState(`key${i}`, i);
        modular.SubscribeToState(`key${i}`, () => {});
    }
    const modularTime = tick() - modularStart;
    
    print(`Original Framework: ${string.format("%.4f", originalTime)}s`);
    print(`Modular Framework: ${string.format("%.4f", modularTime)}s`);
    print(`Performance Improvement: ${string.format("%.2f", (originalTime - modularTime) / originalTime * 100)}%`);
}

// Run the test
performanceTest();
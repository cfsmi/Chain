# Framework TODO

## High Priority

### Networking
- [x] Type-safe network layer with interfaces
- [x] Request-response pattern with promises
- [x] Network timeout support
- [x] Automatic serialization/deserialization with type checking
- [ ] Network compression for large payloads
- [ ] Batch network operations
- [ ] Network middleware (validation, logging, transformation)

### Architecture
- [x] Service/Controller pattern (separate server/client)
- [x] Automatic client/server context detection
- [x] Shared modules that work on both sides
- [x] Error boundaries for module isolation
- [x] Graceful degradation on module failure

### Developer Experience
- [x] Built-in logging system (debug, info, warn, error levels)
- [x] Per-module log filtering
- [x] Structured logging with metadata
- [x] Profiling & performance monitoring
- [x] Track module initialization times
- [x] Network call statistics
- [ ] Memory usage per module

## Medium Priority

### State Management
- [x] Built-in reactive state system
- [x] State replication between server/client
- [x] Time-travel debugging in dev mode

### Event System
- [x] Global event bus/message broker
- [x] Topic-based pub/sub
- [x] Event filtering and transformation

### Configuration
- [x] Per-environment configs (dev, staging, prod)
- [x] Type-safe configuration schemas
- [x] Hot-reload configs without restart

### Testing
- [x] Mock module system for unit tests
- [x] Network simulation/mocking
- [x] Test helpers for async operations

## Low Priority

### Advanced Features
- [ ] Hot reloading/module refresh in dev mode
- [ ] State preservation during hot reload
- [ ] Plugin/extension system
- [ ] Plugin marketplace/registry concept
- [ ] Automatic API generation from server modules
- [ ] Decorators (@Service, @Controller, @NetworkEvent, @RateLimit)

### Tooling
- [ ] CLI tools for code generation
- [ ] Module scaffolding
- [ ] Build optimization
- [ ] Documentation generator
- [ ] Auto-generate API docs from code

### Player Lifecycle (Roblox-specific)
- [ ] OnPlayerAdded hook
- [ ] OnPlayerRemoving hook
- [ ] Per-player module instances
- [ ] Player data management integration

## Completed
- [x] Lifecycle hooks (Init, OnStart, OnShutdown)
- [x] Dependency injection with Inject property
- [x] Basic signal implementation
- [x] Module loading system
- [x] Basic networking with rate limiting
- [x] Dependency resolution
- [x] Bidirectional network communication
- [x] Chain.link universal module template
- [x] State synchronization system
- [x] Event bus with filtering
- [x] Configuration management with watchers
- [x] Comprehensive testing framework
- [x] Performance monitoring
- [x] Error boundaries and graceful degradation

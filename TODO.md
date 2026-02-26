# Framework TODO

## High Priority

### Networking
- [ ] Type-safe network layer with interfaces
- [ ] Request-response pattern with promises
- [ ] Network timeout support
- [ ] Automatic serialization/deserialization with type checking
- [ ] Network compression for large payloads
- [ ] Batch network operations
- [ ] Network middleware (validation, logging, transformation)

### Architecture
- [ ] Service/Controller pattern (separate server/client)
- [ ] Automatic client/server context detection
- [ ] Shared modules that work on both sides
- [ ] Error boundaries for module isolation
- [ ] Graceful degradation on module failure

### Developer Experience
- [ ] Built-in logging system (debug, info, warn, error levels)
- [ ] Per-module log filtering
- [ ] Structured logging with metadata
- [ ] Profiling & performance monitoring
- [ ] Track module initialization times
- [ ] Network call statistics
- [ ] Memory usage per module

## Medium Priority

### State Management
- [ ] Built-in reactive state system
- [ ] State replication between server/client
- [ ] Time-travel debugging in dev mode

### Event System
- [ ] Global event bus/message broker
- [ ] Topic-based pub/sub
- [ ] Event filtering and transformation

### Configuration
- [ ] Per-environment configs (dev, staging, prod)
- [ ] Type-safe configuration schemas
- [ ] Hot-reload configs without restart

### Testing
- [ ] Mock module system for unit tests
- [ ] Network simulation/mocking
- [ ] Test helpers for async operations

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

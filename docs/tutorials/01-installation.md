# Installation & Setup

This guide will walk you through setting up the Chain Framework in your Roblox TypeScript project.

## Prerequisites

Before you begin, make sure you have:
- [Node.js](https://nodejs.org/) (v14 or higher)
- [roblox-ts](https://roblox-ts.com/) installed globally
- A Roblox TypeScript project initialized

## Installation Steps

### 1. Clone or Download the Framework

```bash
# Clone the repository
git clone https://github.com/yourusername/chain-framework.git

# Or download and extract the ZIP file
```

### 2. Copy to Your Project

Copy the `src/shared/Chain` folder into your project's `src/shared` directory:

```
your-project/
├── src/
│   ├── client/
│   ├── server/
│   └── shared/
│       └── Chain/          # Copy this folder here
│           ├── core/
│           ├── Modules/
│           ├── Chain.ts
│           └── index.ts
```

### 3. Install Dependencies

The Chain Framework uses `@rbxts/services` which should already be in your project. If not:

```bash
npm install @rbxts/services
```

### 4. Verify Installation

Create a simple test file to verify the installation:

**src/server/test.server.ts**
```typescript
import { Chain } from "shared/Chain";

const chain = new Chain();
print("Chain Framework loaded successfully!");
```

### 5. Project Structure

Organize your project like this:

```
your-project/
├── src/
│   ├── client/
│   │   └── main.client.ts
│   ├── server/
│   │   └── main.server.ts
│   └── shared/
│       ├── Chain/
│       └── Modules/          # Your game modules go here
│           ├── PlayerService.ts
│           ├── DataService.ts
│           └── ...
├── package.json
└── tsconfig.json
```

## Configuration

### TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Roblox Studio Setup

1. Enable **HttpService** in your game settings (for JSON encoding/decoding)
2. Create a folder in `ReplicatedStorage` called `Modules` for your game modules
3. Ensure your compiled code is synced to Roblox Studio (using Rojo or similar)

## Next Steps

Now that you have Chain Framework installed, proceed to:
- [Quick Start Guide](./02-quick-start.md) - Build your first Chain application
- [Your First Module](./03-first-module.md) - Create a custom module

## Troubleshooting

### Common Issues

**Issue: "Cannot find module 'shared/Chain'"**
- Solution: Make sure the Chain folder is in `src/shared/Chain`
- Check your import path matches your project structure

**Issue: "Decorator errors"**
- Solution: Enable `experimentalDecorators` in tsconfig.json

**Issue: "HttpService is not enabled"**
- Solution: Enable HttpService in Game Settings → Security

## Getting Help

If you encounter issues:
1. Check the [FAQ](../faq.md)
2. Review the [troubleshooting guide](../troubleshooting.md)
3. Ask in our [Discord community](https://discord.gg/yourserver)

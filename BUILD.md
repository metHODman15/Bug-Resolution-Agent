Build and test instructions for the VS Code extension

Prerequisites
- Node.js (>=16) and npm installed
- Python 3.8+ if you plan to run the bundled Python microservice

Quick local build
1. Open a terminal in the repository root (the folder containing this file).
2. Install dependencies:

```bash
npm install
```

3. Compile TypeScript into `out/`:

```bash
npm run compile
```

Run the extension in VS Code
1. Open this workspace in VS Code.
2. Press F5 (or use the Debug view) to launch the Extension Development Host.

Run tests
1. Make sure the extension is compiled (`npm run compile`).
2. Run:

```bash
npm test
```

Notes about Python code
- The Python sources live in the `service_python/` directory and are real `.py` files.
- TypeScript files under `extension/src/services`, such as `pythonBridge.ts`, spawn and communicate with that Python process — they are not Python code saved as `.ts`.

If `npm` is not available on your machine, install Node.js (https://nodejs.org/) or use a Node version manager such as `nvm`.

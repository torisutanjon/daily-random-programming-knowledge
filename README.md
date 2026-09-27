# drpk — Daily Random Programming Knowledge

A desktop app that surfaces a random piece of programming knowledge every day.

## Develop (WSL)

```
yarn install
yarn dev
```

Then open http://localhost:3000.

Checks:

```
yarn type-check
yarn lint
yarn test
```

## Build the Windows installer

Prerequisites: Node 24 LTS installed on Windows, and `corepack enable` run once in a Windows terminal.

Run from PowerShell:

```
powershell -ExecutionPolicy Bypass -File \\wsl.localhost\Ubuntu\home\clarisfanhere\Practices\personal-projects\drpk\scripts\build-win.ps1
```

It copies the repo to `%LOCALAPPDATA%\drpk-build`, installs dependencies, and runs `yarn dist`. The installer is written to `%LOCALAPPDATA%\drpk-build\dist\drpk Setup <version>.exe`.

## How it runs

Electron starts Next's standalone `server.js` on a free localhost port (via `utilityProcess`), then opens the app window pointed at that server.

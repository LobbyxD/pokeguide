# PokeGuide

A desktop companion app for Pokemon games. Track your walkthrough progress, explore maps, browse the Pokédex, and reference type charts.

Built with Electron + React + Vite.

## Features

- **Walkthrough** — Step-by-step game guides with progress tracking
- **Map** — Interactive region maps with area highlights and current step overlay
- **Pokédex** — Browse Pokemon with stats, types, and location data per game
- **Type Chart** — Full 18×18 type effectiveness chart with attacker/defender filter modes

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts Vite dev server and Electron simultaneously.

### Build

```bash
npm run dist
```

Produces a Windows NSIS installer in `dist/`.

## Data

All user data is stored in `%AppData%\PokeGuide`:

- Game progress and settings
- Custom map editor data
- Pokédex JSON cache (fetched from PokeAPI)

To fetch Pokédex data for a game, open **Options → Pokédex** and click **Generate**.

## Stack

- [Electron](https://www.electronjs.org/) v28
- [React](https://react.dev/) 18
- [Vite](https://vitejs.dev/) 5
- [electron-builder](https://www.electron.build/) — packaging & auto-updates
- [electron-updater](https://www.electron.build/auto-update) — GitHub Releases auto-update

## Author

R2D2 Games

# PokeGuide

A desktop companion app for Pokemon games. Track your walkthrough progress, explore interactive maps, browse the Pokédex, and reference type charts — all in one place.

Built with Electron + React + Vite.

## Features

### Walkthrough
- Step-by-step game guides with progress tracking
- Click any step to jump to it instantly
- Reset progress with one click
- Location tag per step shown on the map

### Map
- Interactive region maps with zoom, pan, rotate, and mirror
- Color-coded area types (Town, City, Route, Cave, Sea, Forest, and more)
- Current step location highlighted automatically
- Click any area to see its Pokemon and connections
- Search areas by name
- Toggle legend and area labels
- HD map support (where available)
- Navigate to a Pokemon's Pokédex entry directly from the map

### Map Editor
- Draw custom map areas over any image
- Rectangle drawing tool with undo/redo (up to 20 steps)
- Multi-shape support per area
- Assign Pokemon and directional connections per area
- Upload a custom map image
- Export and import map data as JSON

### Pokédex
- Browse Pokemon with base stats, types, and abilities
- Location data per game (where caught)
- Data auto-fetched from [PokeAPI](https://pokeapi.co/) and cached locally

### Type Chart
- Full 18×18 type effectiveness chart
- Filter by attacker or defender

### Game Management
- Manage multiple games simultaneously
- Create games from scratch or from presets
- Auto-detects generation and Pokédex count from version slug
- Export/import individual game components: map, steps, Pokédex, or full preset

### AI Step Generation
- Generate walkthrough steps automatically using AI
- Powered by DuckDuckGo AI Chat (no API key required)

### Official Presets
- Browse and load community-made game presets directly from the app
- **Manage → Add Game → Browse Official Presets**

### Appearance
- Four built-in themes: Dark, Midnight, Forest, Crimson
- Customizable map highlight and marker colors

### Auto-Updates
- Automatic updates via GitHub Releases
- Notifies on launch when a new version is available

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

| Folder / Key | Contents |
|---|---|
| `pokemon-data/` | Pokédex JSON files fetched from PokeAPI |
| `presets/` | Saved `.pgpreset` files |
| localStorage | Game list, step progress, map data, settings |

To fetch Pokédex data for a game, open **Manage → your game → Generate Pokédex**.

## Official Presets

Community presets are stored in the [`presets/`](presets/) directory. Each preset is a `.pgpreset` file (JSON) registered in [`presets/index.json`](presets/index.json).

Users can browse and load official presets directly from the app: **Manage → Add Game → Browse Official Presets**.

### Contributing a preset

1. Export your game from the app: **Manage → your game → Export → Full**
2. Rename the file to a URL-safe name, e.g. `fire-red-full.pgpreset`
3. Place it in the `presets/` folder
4. Add an entry to `presets/index.json`:

```json
{
  "filename": "fire-red-full",
  "name": "Pokemon Fire Red",
  "type": "full",
  "description": "Complete walkthrough with Kanto map and steps",
  "author": "YourName"
}
```

5. Open a pull request

## Stack

- [Electron](https://www.electronjs.org/) v28
- [React](https://react.dev/) 18
- [Vite](https://vitejs.dev/) 5
- [electron-builder](https://www.electron.build/) — packaging & auto-updates
- [electron-updater](https://www.electron.build/auto-update) — GitHub Releases auto-update

## Author

R2D2 Games

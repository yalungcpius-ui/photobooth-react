# PhotoBooth React Starter

A Windows-first photobooth starter built with **React + TypeScript + Vite + Tauri v2**.

## Included in this version

- Live webcam preview
- Camera device selector
- Countdown capture sequence
- Multi-shot session flow
- Photo strip composition on canvas
- Download raw shots
- Download full strip
- Basic print-ready strip popup
- Custom template background image upload
- User-adjustable strip layout controls
- User-adjustable colors, spacing, frame style, and header/footer visibility
- Reusable template preset library stored in local browser/app storage
- Preset export and import via JSON files
- Drag-and-drop editor for text, image/logo elements, title, subtitle, footer, and photo slots
- Resize handles for custom elements and photo slots
- Layer controls for custom elements
- Rotation, lock, hide, and ordering controls
- Snap guides, align tools, and distribute tools
- Multi-select and group move
- Marquee selection
- Group/ungroup custom elements
- Copy, paste, duplicate, and keyboard nudge support

## Run locally

### 1) Install dependencies

```bash
npm install
```

### 2) Start the web app

```bash
npm run dev
```

### 3) Start the desktop app with Tauri

```bash
npm run tauri:dev
```

## Build desktop app

```bash
npm run tauri:build
```

## Template customization supported

Users can now:

- upload their own background image
- choose how the background fits the strip
- change strip width, frame height, padding, and gaps
- toggle header/footer on or off
- switch between rounded and square frame styles
- change strip and text colors
- adjust background image opacity
- save full template/session presets locally
- load saved presets later
- export presets as JSON
- import presets from JSON

## How presets work

- Presets save the current booth design and session settings
- Presets are stored in local storage for the current device
- Exported preset JSON can be shared with other users or machines
- Imported presets are added to the local preset library

## Current editor shortcuts

- **Shift/Cmd/Ctrl-click**: add or remove items from the selection
- **Drag on empty canvas**: marquee select
- **Cmd/Ctrl + A**: select all visible custom elements
- **Cmd/Ctrl + C**: copy selected elements
- **Cmd/Ctrl + V**: paste copied elements
- **Cmd/Ctrl + D**: duplicate selected elements
- **Delete / Backspace**: delete selected elements
- **Arrow keys**: nudge selected elements
- **Shift + Arrow keys**: larger nudge step

## Suggested next steps

- Add QR code sharing
- Add gallery/history screen
- Add printer profiles and silent printing flow
- Add DSLR integration
- Add admin settings persistence to file system or database
- Add cloud sync for preset libraries

## Save to GitHub

```bash
git add .
git commit -m "Add template preset save/load import/export"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/photobooth-react.git
git push -u origin main
```

Or with GitHub CLI:

```bash
gh repo create photobooth-react --public --source=. --remote=origin --push
```

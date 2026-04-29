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


## Live web demo with GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

After pushing to GitHub:

1. Open the GitHub repo.
2. Go to **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main`, or manually run the **Deploy web demo** workflow.

The demo URL will be:

```text
https://yalungcpius-ui.github.io/photobooth-react/
```

You can also test the same web build locally:

```bash
npm run build:web
npm run preview
```

## Build Windows installer with Tauri

### Local Windows build

Run this on your Windows machine:

```bash
npm install
npm run tauri:build
```

The installer output will be under:

```text
src-tauri/target/release/bundle/
```

### GitHub Actions Windows build

This repo includes `.github/workflows/windows-installer.yml`.

You can run it manually from GitHub:

1. Open the repo on GitHub.
2. Go to **Actions**.
3. Choose **Build Windows installer**.
4. Click **Run workflow**.

Or create a release build by pushing a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a draft GitHub release with the Windows installer files.

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
git commit -m "Add GitHub Pages demo and Windows installer workflow"
git branch -M main
git remote set-url origin https://github.com/yalungcpius-ui/photobooth-react.git
git push -u origin main
```

Or with GitHub CLI:

```bash
gh repo create photobooth-react --public --source=. --remote=origin --push
```

## Kiosk mode and phone/tablet support

This version adds a practical event/kiosk flow:

- **Enter kiosk mode** from the Session & Template panel
- Kiosk mode hides the editing controls and shows guest-friendly capture buttons
- **Admin PIN** is required to leave kiosk mode
- Optional guest retake button
- Optional idle auto-reset after a review screen
- Fullscreen request on supported desktop/mobile browsers
- Touch-friendly controls and larger resize handles
- Responsive layouts for phones, iPads, Android tablets, and small laptop screens
- Front/rear camera selector for mobile devices

### iPad, iPhone, Android phone and Android tablet usage

For mobile and tablet devices, the easiest route is the **web/PWA version**:

1. Publish the GitHub Pages demo.
2. Open it on the device browser.
3. Allow camera access.
4. Add it to the home screen for a more app-like kiosk experience.
5. Open the installed icon and use **Enter kiosk mode**.

Notes:

- iOS/iPadOS camera access requires HTTPS, so the GitHub Pages URL is suitable.
- iPad Safari may not allow every fullscreen behavior unless the app is launched from the home screen.
- Tauri v2 supports Android and iOS targets from the same web frontend, but native mobile builds still require platform SDK setup such as Android Studio or Xcode.

### Native mobile direction later

The current project is ready for:

- Windows desktop with Tauri
- Web demo / PWA for iPad, iPhone, Android tablets and phones

A later native mobile pass can add:

```bash
npm run tauri android init
npm run tauri ios init
```

That requires local Android/iOS tooling and should be done after the web/PWA version is stable.

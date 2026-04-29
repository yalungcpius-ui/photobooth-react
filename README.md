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

## Saved prints and post-capture editing

This version adds a separate printed-picture editor after a strip is generated.

New workflow:

1. Capture photos as usual.
2. Review the generated strip.
3. Click **Save printed picture** to store the strip locally, or **Edit printed picture** to open the editor.
4. In the editor you can add:
   - speech/bubble text
   - plain text
   - emojis
   - icon-style emoji badges
   - filters such as warm, cool, black-and-white, vintage, and pop colour
5. Save, download, or print the edited result.

Saved prints are stored in browser `localStorage` and capped at the latest 30 prints. This is good for the MVP and kiosk testing. For production events, move saved prints to the Tauri filesystem, SQLite, or cloud storage so large image data is not limited by browser storage quotas.


## Advanced event features added

This version adds the production-facing foundations for:

- QR code sharing from the saved prints gallery
- A dedicated gallery/history screen for saved strips and edited pictures
- Printer profiles with paper size, copies, auto-save, and silent-print intent
- A Tauri command surface for Windows silent printing adapters
- DSLR integration settings for watch-folder, gPhoto2, Canon EDSDK, or Sony SDK adapter workflows
- Admin settings persistence to the Tauri app data folder with browser localStorage fallback
- Cloud sync settings for preset libraries and optional print upload links

### QR sharing

The gallery/history screen can create a share link for each saved print. If a cloud endpoint is configured and `Upload prints for QR sharing` is enabled, the app will POST the print to:

```text
POST {endpointUrl}/prints
```

Expected response:

```json
{ "url": "https://your-gallery.example.com/print/abc123" }
```

If no cloud endpoint is configured, it falls back to a local hash URL and generates a QR code for that URL.

### Cloud preset sync API contract

The preset library sync buttons use:

```text
PUT {endpointUrl}/presets
GET {endpointUrl}/presets?deviceId={deviceId}
```

Upload body:

```json
{
  "deviceId": "booth-local",
  "presets": []
}
```

Download response:

```json
{
  "presets": []
}
```

If an API key is entered, the app sends it as:

```text
Authorization: Bearer {apiKey}
```

### Printer profiles and silent printing

Browser/PWA mode always falls back to the normal print dialog. Silent printing requires the Windows Tauri app and a real adapter implementation in `src-tauri/src/lib.rs`.

The current Tauri command is intentionally a safe stub:

```rust
silent_print_image(image_data_url, profile)
```

For production, wire this command to one of these approaches:

- Windows print spooler / PowerShell print pipeline
- vendor printer SDK
- a small local print service
- a kiosk environment with a trusted printer bridge

### DSLR integration

The app now includes DSLR admin settings and Tauri command stubs:

```rust
connect_dslr(settings)
trigger_dslr_capture(settings)
```

Recommended production paths:

- **Watch folder import**: easiest and most reliable; use the camera vendor app to drop images into a folder, then import newest file.
- **gPhoto2 adapter**: good for supported cameras but needs native install/testing.
- **Canon EDSDK / Sony SDK**: strongest vendor-specific approach but requires SDK setup and licensing review.

### Admin settings persistence

The admin panel has **Save admin file** and **Load admin file** buttons.

- In Tauri/Windows, settings are saved under the app data directory.
- In browser/PWA mode, it falls back to localStorage.

This keeps the current app usable on iPad/tablet while still preparing for native Windows persistence.

## Mobile-friendly camera start flow

The camera now waits for a deliberate **Tap to Start Camera** action instead of starting automatically on page load. This is important for iPad, iPhone and Android browsers because camera playback is more reliable after a user gesture.

The live preview also shows a loading overlay while `getUserMedia()` is resolving, then switches to the camera feed once `video.play()` succeeds. This avoids repeated camera restarts and reduces the browser warning: `The play() request was interrupted by a new load request`.

## Production-readiness hooks

The app includes admin settings and service hooks for:

- Tauri silent printing profile flow
- DSLR adapter settings and Tauri command stubs
- Persistent admin settings through Tauri app data, with localStorage fallback
- Cloud preset sync endpoint configuration
- QR/event sharing backend contract in `server/README.md`

Hardware-specific items still need real Windows printer and DSLR SDK testing on the target machine.

## Updated workflow: configuration → designer → photobooth

The app now separates the operator workflow into three screens:

1. **Configuration** — load/import presets, set title/subtitle, shot count, countdown, kiosk settings, printer profiles and print behaviour.
2. **Designer** — change the actual template layout, branding, background, photo slot sizing and reusable preset design.
3. **Photobooth mode** — run the booth and test the capture flow. Layout editing is intentionally disabled here.

After a photo session completes, the app opens the post-capture decoration editor. This screen locks the template layout and only allows finishing touches such as bubble text, plain text, emojis, icons and filters.

### Print behaviour

In Configuration, set **After decoration** to either:

- **Ask to print** — the operator/guest manually chooses when to print.
- **Auto print after save** — saving the decorated print triggers the selected printer profile automatically. In the browser/PWA this falls back to the normal print dialog; inside Tauri, the silent printing hook can be wired to a Windows printer.

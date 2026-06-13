# Milk Shop Manager — Desktop (Electron + SQLite)

Offline Windows POS app for milk / dairy shops. No internet required.

## Quick start (development)

```bash
# 1. Install web deps (already done in Lovable)
npm install

# 2. Install Electron deps (native, must be on your Windows machine)
npm install --save-dev electron @electron/packager
npm install better-sqlite3 bcryptjs

# 3. Run the React dev server
npm run dev

# 4. In a second terminal, launch Electron pointed at the dev server
set ELECTRON_DEV_URL=http://localhost:8080 && npx electron electron/main.cjs
#   (use the port the Vite dev server logs)
```

## Build a Windows installer

```bash
# 1. Build the web bundle to /dist
npm run build

# 2. Package as a portable Windows .exe folder
npx @electron/packager . "MilkShopManager" ^
  --platform=win32 --arch=x64 --out=release --overwrite ^
  --ignore="^/src" --ignore="^/public" --ignore="^/release"

# 3. Optional — wrap with electron-builder for an NSIS installer / signing
npm install --save-dev electron-builder
# add an electron-builder config and run: npx electron-builder
```

The output folder `release/MilkShopManager-win32-x64/` contains `MilkShopManager.exe`. Double-click to launch.

## Login

Default credentials on first launch:

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

Change them from **Settings → Security**.

## Where is my data?

Stored in a local SQLite file at:

`%APPDATA%/MilkShopManager/milkshop.db`

Use **Settings → Data Management → Backup Database** to copy it to a flash drive.

## Browser preview (Lovable)

The Lovable web preview shows the UI but cannot run SQLite, silent printing, or backup/restore. Those features only work in the packaged Windows build. Data in the preview is kept in browser `localStorage` for UI testing only.

## Architecture

- **Renderer**: React 19 + TanStack Router + Tailwind
- **Main process**: `electron/main.cjs` (SQLite via `better-sqlite3`, password hashing via `bcryptjs`, silent printing via `BrowserWindow.webContents.print({ silent: true })`)
- **Bridge**: `electron/preload.cjs` exposes a typed `window.api` to the renderer
- **DB layer**: `src/lib/db.ts` — Electron in production, localStorage stub in browser preview

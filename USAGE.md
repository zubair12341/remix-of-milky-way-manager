# Milk Shop Manager — Install & Usage

Offline Windows desktop POS for milk / dairy shops. Data lives in a local
SQLite file — no internet required.

---

## 1. Fresh install on a Windows PC (the ONLY setup path)

Prerequisites (once per PC):
- **Node.js 20 LTS or newer** — https://nodejs.org (LTS installer, default options)
- **Git** — https://git-scm.com (only if you want to `git clone`; otherwise download the ZIP)

That's all. **No** Visual Studio, **no** Python, **no** node-gyp, **no** C++ build tools.

Open a Command Prompt in the project folder and run:

```
npm install
npm run dist
```

That's it. The installer will be created at:

```
release\MilkShopManager-Setup-1.0.0.exe
```

Double-click the installer. It will:
- ask where to install,
- create a **Desktop shortcut**,
- create a **Start Menu shortcut**,
- register a proper **Uninstaller** (Windows → Apps & features).

Launch from the desktop shortcut. First run creates the database and opens the setup wizard.

### Why no build tools are needed
`better-sqlite3` ships prebuilt binaries. `postinstall` runs
`electron-builder install-app-deps`, which downloads the exact prebuilt
binary that matches this app's Electron version. Nothing is compiled from
source on your machine.

---

## 2. Development (optional — for editing code)

```
npm install          # installs everything, including Electron
npm run dev          # terminal 1: Vite dev server on http://localhost:8080
npm run electron:dev # terminal 2: Electron window pointed at the dev server
```

Hot reload works for React code. Restart `electron:dev` after editing
`electron/main.cjs` or `electron/preload.cjs`.

---

## 3. Build outputs

| Command             | Result                                             |
|---------------------|----------------------------------------------------|
| `npm run build`     | Web bundle only, in `dist/`                        |
| `npm run pack`      | Unpacked Electron app in `release/win-unpacked/`   |
| `npm run dist`      | Installer for the current OS (Windows: NSIS `.exe`) |
| `npm run dist:win`  | Windows NSIS installer                             |
| `npm run dist:mac`  | macOS `.dmg` + `.zip` (must run on macOS)          |
| `npm run dist:linux`| Linux `AppImage` + `.deb` (must run on Linux)      |

---

## 4. Where is my data?

Windows: `%APPDATA%\MilkShopManager\milkshop.db`
macOS:   `~/Library/Application Support/MilkShopManager/milkshop.db`
Linux:   `~/.config/MilkShopManager/milkshop.db`

Automatic pre-launch backups (last 10) live in the same folder under `backups/`.
Manual backup / restore is in **Settings → Data Management**.

---

## 5. First-launch defaults

- The database and all tables are created automatically the first time you
  launch the app.
- Setup wizard walks you through admin username/password, shop name, logo,
  and default printer.
- Default seed data (purchase categories, settings rows) is inserted on first launch.

---

## 6. Daily use — quick reference

- **Cash Counter**: type amount → **Enter** → receipt prints instantly (no popup).
- **Udhar**: add customer → **Add Credit** or **Add Payment**.
- **Monthly**: add client → **Daily Deliveries** page every day.
- **Purchases / Suppliers**: track supplier balances & expenses.
- **Reports → Summary**: pick date range → see profit / loss.
- **Backup weekly**: Settings → Data Management → Backup Database → save to USB.

---

## 7. Troubleshooting

| Problem                                    | Fix                                                                |
|--------------------------------------------|--------------------------------------------------------------------|
| `npm install` slow on first run            | Normal — Electron (~150 MB) and prebuilt sqlite are being fetched. |
| `electron-builder` says "cannot find app"  | Run `npm run build` first, or use `npm run dist` (does both).      |
| App opens to setup screen after reinstall  | Data is in `%APPDATA%\MilkShopManager\`. Restore from `backups/`.  |
| Antivirus blocks the installer             | The `.exe` is unsigned. Add an exception, or sign with a code cert.|
| Want a portable EXE (no installer)         | `npm run pack` — output in `release/win-unpacked/`.                |

If `npm install` ever complains about `node-gyp` or `MSBuild`, delete
`node_modules` and `package-lock.json` and run `npm install` again — the
`postinstall` step must fetch prebuilt binaries, not compile from source.

# market-pwa

A small app (**Tally**, a counter) that shows how to give your address **two different pages**:

| Where | What people see |
|---|---|
| `https://tally.<root>/` | A **store page** that asks the visitor to install. It has an *Install Tally* button and a *Use it in the browser* link. |
| `https://tally.<root>/app` | **The app itself**, in its own folder. |
| The installed app | Always starts at `/app` (`start_url`), so installed users **never see the store page**. |

The marketplace has no opinion about any of this: it serves your files at your address. Whether the app can be installed, works offline, or shows a page that asks for the install is all your own code.

## How it works

- `site/manifest.webmanifest`: `start_url: "/app"`, `scope: "/"`, `display: "standalone"`, icons (192, 512, maskable). Both pages link it, so the browser can offer the install from the store page.
- `site/market.js`: keeps the browser's `beforeinstallprompt` event and calls `prompt()` when the visitor presses the button. Where there is no prompt (iPhone/iPad Safari, Firefox desktop) it shows how to install by hand. Once installed (`appinstalled`, or `getInstalledRelatedApps()`) it replaces the button with a message. If the page is opened in the installed window (`display-mode: standalone`) it goes straight to `/app`.
- `site/app/*`: the app. In a normal tab it shows a slim bar linking back to the store page; installed, the bar is hidden.
- `site/sw.js`: one service worker for the whole site (scope `/`). Pages: network first, saved copy when offline. Files: saved copy, refreshed in the background. It never touches `/_dg/` (the platform's backend API). `{{BUILD}}` is replaced by a hash on every build so a new version replaces the old cache.

## Try it locally

```bash
npm install                  # once, in the repo root
npm run dev                  # the marketplace, http://localhost:3000
cd examples/market-pwa
npm run pack                 # -> market-pwa.zip (a prebuilt one is already included)
```

1. Log in at `/login` (code `55555`) → **My apps** → submit subdomain `market-pwa` with `market-pwa.zip`.
2. As an admin, open `/admin/projects`, **Test** the version and approve it.
3. Open **http://market-pwa.localhost:3000/** in Chrome or Edge and press **Install Tally**. The installed window opens `/app`.
4. Open `/` again from a normal tab: you see the store page. Open the installed app: you see the app.

For your real address build with `ORIGIN=https://your-name.example.app npm run pack` (canonical link, sitemap, `related_applications`).

## Good to know

- Install prompts need HTTPS (or `localhost`), a manifest with `start_url` inside `scope`, and 192 and 512 px icons. Chrome DevTools → Application → Manifest lists anything missing.
- Browsers decide whether to fire `beforeinstallprompt`; never rely on it. The button always works: with a prompt it installs, without one it explains.
- `python3 scripts/icons.py` redraws the icons (or replace the PNGs with your own).
- A service worker that caches pages must never cache `sw.js`, and should leave `/_dg/` alone if you use the dg SDK.

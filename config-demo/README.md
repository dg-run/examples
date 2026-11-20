# config-demo

A tiny app (plain HTML and TypeScript, no framework) that shows **remote config** with **`dg.config`**: settings your app declares in its web manifest, which you change from the dashboard without uploading a new build.

```jsonc
// site/manifest.webmanifest
"config": {
  "banner":      { "default": "Welcome to the config demo", "label": "Banner text", "maxLength": 80 },
  "maintenance": { "default": false, "label": "Maintenance mode" },
  "theme":       { "default": "light", "options": ["light", "dark", "sepia"] },
  "cards":       { "default": 6, "min": 1, "max": 24, "label": "How many cards" }
}
```

```ts
const dg = createDg()
dg.config.get('cards', 6)                 // synchronous; the 6 is a fallback until a value has ever been received
dg.config.onChange('theme', (v) => { … }) // called when the developer changes it (live, over the app's WebSocket)
await dg.config.ready                     // first fetch finished (or failed: offline)
dg.config.all()                           // every setting known on this device
await dg.config.refresh()                 // check now
```

What the page shows:

- **Four kinds of setting:** text, a switch (maintenance mode), a dropdown (`options`) and a number with limits.
- **Live changes:** save in **My apps → Config** and the page updates within a second, without reloading.
- **Offline:** the last values are kept in `localStorage`. Open the page, go offline, reload: it still uses them.
- **Checked on upload:** a mistake in `config` (a default outside its `min`/`max`, a bad name…) refuses the upload and says which setting.

Values are **public**: every visitor of your app can read them. Never put secrets there.

## Try it locally

```bash
npm install                  # once, in the repo root
npm run dev                  # the marketplace, http://localhost:3000
cd examples/config-demo
npm install                  # installs dgclient from npm
npm run pack                 # -> config-demo.zip (a prebuilt one is already included)
```

1. Log in at `/login` (code `55555`) → **My apps** → drop `config-demo.zip` into the upload box. The card says "4 remote-config settings".
2. Open the sandbox address and keep it open. In **Config** (on the app's card) change the banner, the theme or the number of cards, and click **Save changes**: the open page follows.
3. Request a review with subdomain `config-demo`, approve it as an admin in `/admin/projects`, and open **http://config-demo.localhost:3000/**. Change a setting again: the live app follows, and the sandbox values you saved were kept.

## Good to know

- Until a value has been received, `get` answers with the fallback you pass. Use the same value as the `default` in the manifest.
- A setting you remove in a new build is forgotten; one whose type or limits changed starts over from its default. Settings of a build in review apply when it is approved.
- Limits: 50 settings, text up to 1,000 characters, 16 KB for all values together.

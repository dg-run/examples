# dg.run examples

Each folder is a standalone static app you can upload to dg.run. A prebuilt `.zip` is already in each folder; `npm run pack` rebuilds it.

| Example | SDK | What it shows |
| --- | --- | --- |
| [`basic-example`](basic-example/) | `dgclient` | Sign-in, typed database, realtime, roles, and real SEO pages in English and French |
| [`pro-notes`](pro-notes/) | `dgclient` | Subscriptions (trial, monthly, yearly, lifetime), sign-in and private notes |
| [`fa-subscriptions`](fa-subscriptions/) | `dgclient` | The same billing flow in Persian/RTL, with USD and IRR plans |
| [`config-demo`](config-demo/) | `dgclient` | Remote config: settings declared in the manifest and changed live from the dashboard |
| [`logs-demo`](logs-demo/) | `dgclient` | App logs, errors and batches in the owner's dashboard |
| [`market-pwa`](market-pwa/) | — | A store page and an installed PWA at the same address, with a service worker |
| [`todo-pwa`](todo-pwa/) | — | An offline-first Vite/React todo app backed by local LokiJS |

The SDK examples import `createDg` (and friends) from the npm package `dgclient`. There are no aliases to this repo's `client/` source; the installed package is bundled into the app at build time. The two PWA examples are purely client-side and need no SDK.

## Build and try one

```bash
npm install                  # once, in the repo root: esbuild, React, TypeScript, etc.
npm run dev                  # marketplace at http://localhost:3000
cd examples/basic-example    # or another folder above
npm install                  # installs dgclient from npm (SDK examples only)
npm run pack                 # -> basic-example.zip
```

Log in at `/login` with any email (code `55555`), upload the zip under **My apps**, then approve the version as admin in `/admin/projects`. The app is served at `http://<subdomain>.localhost:3000/`. Each example folder has its own README with the exact steps and settings it needs.

See [getting started](../content/docs/en/getting-started.md), [app backend](../content/docs/en/backend-services.md) and the [examples docs page](../content/docs/en/examples.md) for the full docs.

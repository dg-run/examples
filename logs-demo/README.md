# logs-demo

A tiny app (plain HTML and TypeScript, no framework) that shows **`dg.log`**: how an app sends logs to its owner's dashboard, with or without sign-in.

```ts
const dg = createDg({ version: '1.0.0' })   // `version` is optional: a label shown on every line
dg.log.captureErrors()                       // uncaught errors + unhandled promise rejections
dg.log.info('Checkout opened', { plan: 'pro' })
dg.log.warn('Disk almost full')
dg.log.error(new Error('Payment failed'))    // an Error also sends its stack
await dg.log.flush()                         // send what is queued now (optional)
```

What the buttons show:

- **Lines:** debug, info, warning, error (with stack), and a line with extra JSON data.
- **Errors nobody caught:** an uncaught error and an unhandled promise rejection, logged by `captureErrors()`.
- **Repeats:** the same warning 5 times becomes **one row with a count of 5**.
- **Batches:** 25 different lines go out as two requests (20 + 5).
- **Sign-in:** lines sent while signed in are marked `user`; otherwise `anon`.

Lines are sent in batches (every 5 seconds, and when the page closes), kept for 14 days and shown in **My apps → Logs**. Nothing in `dg.log` ever throws or slows your app.

## Try it locally

```bash
npm install                  # once, in the repo root
npm run dev                  # the marketplace, http://localhost:3000
cd examples/logs-demo
npm install                  # installs dgclient from npm
npm run pack                 # -> logs-demo.zip (a prebuilt one is already included)
```

1. Log in at `/login` (code `55555`) → **My apps** → submit subdomain `logs-demo` with `logs-demo.zip`.
2. As an admin, open `/admin/projects`, approve the version.
3. Open **http://logs-demo.localhost:3000/**, click around, then go to **My apps → Logs** on the app's row.

## Good to know

- Anyone can open your app, so anyone can try to send lines to its log. dg.run accepts lines only from your app's own pages (the browser's `Origin` / `Sec-Fetch-Site`) and limits how many arrive: 60 lines a minute per sender, 10,000 a day per app, 20 per batch. It cannot prove a line came from your real code, so treat logs as hints, not facts.
- Don't log passwords or personal data.
- Previews (an admin testing a pending version) don't write to your logs.

# basic-example

A tiny app for dg.run: static HTML pages with **React** for the interactive parts. It shows:

- **Real pages for SEO:** `index.html` (English) and `fr/index.html` (French), each with its own title, description, canonical and `hreflang` tags, plus `robots.txt` and `sitemap.xml`.
- **React as islands:** the headings and text stay plain HTML (so search engines read them without running JavaScript); React mounts into three places, `#auth`, `#guestbook-app` and `#notes-app`.
- **App code in its own folder:** the pages load `/app/main.js` and `/app/style.css` with absolute paths, so the same files work from `/` and `/fr`.
- **Sign in with dg:** one button, no passwords, no keys.
- **Types:** `collection<Message>('guestbook', 'public')`; the SDK checks every `put`, `patch` and query against `Message`. `npm run typecheck` runs `tsc`, and `npm run pack` does it before building.
- **Realtime:** the guestbook and the notes use `collection.live(query, handler)`, so a message posted in one tab appears in another at once (the SDK opens a WebSocket on the first subscription). A small badge shows `dg.realtime.status`: *Live* while pushes arrive, *Refreshing every 15 s* while it is polling. Try it: open the app in two tabs (or two browsers) and post in one. Real sockets work under plain `npm run dev` too (a dev-only socket server on port 3001, see the marketplace README "Realtime"); if a socket can't connect the page keeps working and polls.
- **Roles (optional):** a user holding the `moderator` tag can delete anyone's guestbook message; everyone else only their own. The app only reads `dg.user.permissions` to decide whether to show the button; the rules live on the server (see "Try roles" below).
- **The database:** a public *guestbook* (everyone reads, signed-in users post, authors delete their own) and private *notes* (each user only sees their own).

```
site/
  index.html              English page, served at /
  fr/index.html           French page, served at /fr
  app/style.css
src/main.tsx              the React app, in TypeScript (built into app/main.js together with React and the SDK)
  manifest.webmanifest    name, description and tags for the marketplace listing
  robots.txt  sitemap.xml
```

## Try it locally

```bash
npm install                 # once, in the repo root (the build uses its react, esbuild and fflate)
npm run dev                 # the marketplace, http://localhost:3000
cd examples/basic-example
npm install                 # installs dgclient from npm
npm run pack                # -> basic-example.zip (a prebuilt one is already included)
```

1. Log in at `/login` (code `55555`), go to `/projects`, create an app with subdomain `basic-example`, upload `basic-example.zip`.
2. As an admin, open `/admin/projects`, **Test** it (sign-in and data work in previews, with their own separate data), then approve.
3. Open **http://basic-example.localhost:3000/** and **http://basic-example.localhost:3000/fr**.

## Try roles and the owner dashboard

Once the app is live and you have signed in to it once, open **My apps → Data and users** (as the app's owner):

1. **Access → Collection rules → Add rules**: kind *public*, name `guestbook`, and set **Delete** to `@owner, moderator` (leave the others as they are: read `*`, create `user`, update `@owner`).
2. **Users**: find the person (their email and their ID in the app are listed), edit their tags and add `moderator`. It reaches them on their next request.
3. In the app, that user now sees a *moderator* label and a Delete button on every message. Anyone else still gets Delete only on their own; if they call `guestbook.delete` on someone else's message from the console they get `forbidden`.
4. **Data**: every collection with its document count, notes (private) included. Open a document to read or edit its JSON, or delete it. **Users → View data** shows one person's documents. **Disconnect user** ends their session and erases what they stored.

## For your real address

The canonical links and the sitemap need absolute URLs, so tell the build where the app will live:

```bash
ORIGIN=https://basic-example.example.app npm run pack
```

## In your own project

Install `react`, `react-dom`, `dgclient` (from npm) and a bundler (the build here is a single esbuild call in `scripts/build.mjs`, or use Vite), import `createDg` from `dgclient`, and keep the page text in the HTML.

## Notes

- React escapes everything it renders. Never use `dangerouslySetInnerHTML` for user text: anyone can write to the public guestbook.
- The React islands render after the script loads (a "Loading…" line first). For a polished first paint, prerender them at build time; the headings and text are already in the HTML, which is what SEO needs.
- A folder page is served at its folder name: `fr/index.html` is `/fr` (`/fr/` redirects to it), so use `/fr` in links, canonical tags, `hreflang` and the sitemap. An unknown path without a file extension gets the root `index.html` (SPA fallback).
- Files in `app/` are revalidated on every load. Only an `assets/` folder is cached as immutable, so use that only for files whose names change with their content (hashed names, like a Vite build produces).

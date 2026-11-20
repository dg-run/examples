# pro-notes

A small notes app that shows **dg.run subscriptions**: a free tier, a free trial, a monthly (and yearly) subscription, and a one-time "lifetime" purchase. It also uses sign-in and the database.

- **Free:** up to 3 private notes.
- **Any active plan:** unlimited notes and an *Export* button.
- The pricing cards, the "Your plan" panel (trial days left, next renewal, lifetime, ended, failed renewal) and the *Stop auto-renew* button are all driven by the SDK. Nothing about the plans is hard-coded: whatever plans you create show up.

```ts
const plans = await dg.billing.plans()      // what you sell: key, name, price (USD), kind, interval, features…
const sub = await dg.billing.status()       // null, or { active, plan, currentPeriodEnd, autoRenew, trial, renewalError }
await dg.billing.subscribe('monthly')       // leaves for dg.run to pay (or start a trial), then comes back
await dg.billing.cancel()                   // stops auto-renew; access lasts until the paid period ends
const result = await dg.billing.checkout    // after coming back: { result: 'ok' | 'cancel', plan } (null on other loads)
```

Your page never handles money. The user confirms the price on dg.run (with their own session, which apps can't use), pays from their wallet or by card, and is sent back. `status().active` is computed by the server each time you ask, including renewing from the wallet or expiring a lapsed period.

## Try it locally

```bash
npm install                  # once, in the repo root
npm run dev                  # the marketplace, http://localhost:3000
cd examples/pro-notes
npm install                  # installs dgclient from npm
npm run pack                 # -> pro-notes.zip (a prebuilt one is already included)
```

1. Log in at `/login` (code `55555`) → **My apps** → submit subdomain `pro-notes` with `pro-notes.zip`.
2. **Plans** (button on your app's row) → create these (type · price):

   | Key | Name | Type | Price | Other |
   |---|---|---|---|---|
   | `trial` | Free trial | Free trial | free | 14 days |
   | `monthly` | Pro monthly | Subscription | $9.00 | every 1 month |
   | `yearly` | Pro yearly | Subscription | $90.00 | every 1 year |
   | `lifetime` | Lifetime | One-time purchase | $199.00 | 0 days (= lifetime) |

3. As an admin, open `/admin/projects`, **Test** the version (only free trials work in a preview) and approve it.
4. Open **http://pro-notes.localhost:3000/**, sign in, pick a plan. Without a Stripe key the card flow is **simulated** (no money moves); to pay from the wallet, first add money in **Profile** (simulated card), or as an admin credit the user in **Transactions**.

## Translated listing

`site/manifest.webmanifest` has an optional `locales` object (`fa`, `fr`). The marketplace shows that title and description on `/fa` and `/fr` pages (catalog, search, sign-in and payment pages); other languages show the manifest's own `name` and `description`.

## Notes

- **The quota here is a UX feature.** The app is static code running in the user's browser, so a determined user can edit it. `status().active` is trustworthy (the server decides), but anything your own page does with it is only as strong as your page. Gate what matters (for example data you serve) on the server side of something you control, and use this to decide what to *show*.
- Prices are fixed per plan. To change one, add a new plan in the dashboard and archive the old one; current subscribers keep what they bought.
- Subscriptions renew **from the user's wallet**. A card payment buys one period; the user keeps the wallet topped up for renewals.

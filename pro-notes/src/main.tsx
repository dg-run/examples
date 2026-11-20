// Pro Notes: the dg.run subscriptions API in one small app.
//
//   dg.billing.plans()          what you sell (anyone can read it, signed in or not)
//   dg.billing.entitlement()    gates the Pro features: a signed proof kept on the device, verified offline (up to 15 days)
//   dg.billing.status()         the details for the "Your plan" panel. `active` is decided by the server at that moment
//   dg.billing.subscribe(key)   sends the user to dg.run to pay (or start a trial), then back here
//   dg.billing.cancel()         stops auto-renewal (access lasts until the end of what was paid)
//   dg.billing.checkout         resolves when the user comes back from paying
//
// Your page never touches money or card details: the user confirms on dg.run, which is why an app can't charge anyone.
import { StrictMode, useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { createDg, type Entitlement, type DgError, type Plan, type Subscription } from 'dgclient'

const FREE_NOTES = 3
interface Note { text: string }

const dg = createDg()
const notes = dg.db.collection<Note>('notes')

const useUser = () => useSyncExternalStore((cb) => dg.onChange(cb), () => dg.user, () => null)
const errorText = (e: unknown) => {
  const { code } = e as DgError
  return code === 'unauthorized' ? 'Your session ended. Sign in again.' : `Something went wrong (${code}).`
}

/* ------------------------------------------------------------ formatting */

/** A price in the plan's own currency (USD or IRR); the SDK gives `p.currency`. */
const money = (p: Plan) => new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency, maximumFractionDigits: p.currency === 'IRR' ? 0 : 2 }).format(p.price)
const date = (ms: number) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(ms)
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
function priceText(p: Plan) {
  if (p.kind === 'trial') return `Free for ${plural(p.trialDays, 'day')}`
  if (p.kind === 'recurring') return `${money(p)} / ${p.intervalCount > 1 ? `${p.intervalCount} ` : ''}${p.interval}${p.intervalCount > 1 ? 's' : ''}`
  return p.durationDays > 0 ? `${money(p)} for ${plural(p.durationDays, 'day')}` : `${money(p)}, once`
}
const daysLeft = (end: number) => Math.max(0, Math.ceil((end - Date.now()) / 86_400_000))

/* ------------------------------------------------------------ the subscription */

/**
 * The user's subscription, kept fresh: loaded when the user changes and again when they come back from paying.
 * `undefined` = still loading, `null` = never subscribed.
 */
function useSubscription(userId: string | undefined, version: number) {
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined)
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined)
  const reload = useCallback(async () => {
    if (!userId) { setSub(null); setEnt(null); return }
    // 1. Access: the signed proof saved on this device. Instant, and it works offline (checked with dg.run's public key).
    setEnt(await dg.billing.entitlement())
    // 2. Details for the "Your plan" panel (renewal date, wallet problems): these need the server, so they may fail offline.
    try { setSub(await dg.billing.status()); setEnt(await dg.billing.entitlement()) } catch { setSub(null) }
  }, [userId])
  useEffect(() => { void reload() }, [reload, version])
  return [sub, ent] as const
}

/* A tiny store so the three islands share one subscription and refresh together. */
let version = 0
const listeners = new Set<() => void>()
const bump = () => { version++; listeners.forEach((l) => l()) }
const useVersion = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => version, () => 0)

/* ------------------------------------------------------------ components */

function AuthBar() {
  const user = useUser()
  if (!user) return <button className="primary" onClick={() => void dg.signIn()}>Sign in with dg</button>
  return <>{user.email} <button onClick={() => dg.signOut()}>Sign out</button></>
}

/** "Thanks!" / "Cancelled", once, after coming back from the pay page. */
function Banner() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    void dg.billing.checkout.then((r) => {
      if (!r) return
      setMsg(r.result === 'ok' ? 'Thanks! Your plan is active.' : 'Checkout cancelled. Nothing was charged.')
      bump() // the plan may have changed: reload it
    })
  }, [])
  return msg ? <p className="banner" role="status">{msg}</p> : null
}

function Status() {
  const user = useUser()
  const v = useVersion()
  const [sub, ent] = useSubscription(user?.id, v)
  const [error, setError] = useState('')

  if (!user) return <p>Sign in to see your plan.</p>
  if (sub === undefined && ent === undefined) return <p>Loading…</p>
  if (!sub && ent) return <p><span className="badge pro">Pro</span> {ent.plan} (checked on this device{ent.periodEnd ? `, until ${date(ent.periodEnd)}` : ''}). Connect to see renewal details.</p>
  if (!sub) return <p>You're on the <strong>Free</strong> plan: up to {FREE_NOTES} notes.</p>

  const p = sub.plan
  const name = p?.name ?? 'your plan'
  let line: string
  if (!sub.active) line = `${name} ended${sub.currentPeriodEnd ? ` on ${date(sub.currentPeriodEnd)}` : ''}. You're back on the Free plan.`
  else if (sub.currentPeriodEnd === null) line = `${name}: yours for life.`
  else if (sub.trial) line = `Free trial: ${plural(daysLeft(sub.currentPeriodEnd), 'day')} left (ends ${date(sub.currentPeriodEnd)}).`
  else if (sub.autoRenew) line = `${name}: renews on ${date(sub.currentPeriodEnd)} from your dg.run wallet.`
  else line = `${name}: active until ${date(sub.currentPeriodEnd)}. It won't renew.`

  return (
    <>
      <p><span className={`badge${sub.active ? ' pro' : ''}`}>{sub.active ? 'Pro' : 'Free'}</span> {line}</p>
      {sub.renewalError && <p className="error" role="alert">The last renewal failed because your wallet was empty. Add money at dg.run, then subscribe again.</p>}
      {sub.active && sub.autoRenew && (
        <button onClick={() => dg.billing.cancel().then(bump, (e) => setError(errorText(e)))}>Stop auto-renew</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

function Notes() {
  const user = useUser()
  const v = useVersion()
  const [sub, ent] = useSubscription(user?.id, v)
  const [items, setItems] = useState<{ key: string; text: string }[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const pro = !!ent // the signed proof, so Pro features also work offline

  const load = useCallback(async () => {
    if (!user) return setItems([])
    try { setItems((await notes.list({ orderBy: 'createdAt', desc: true })).items.map((d) => ({ key: d.key, text: d.data.text }))) } catch (e) { setError(errorText(e)) }
  }, [user])
  useEffect(() => { void load() }, [load])

  if (!user) return <p>Sign in to keep private notes.</p>
  const full = !pro && items.length >= FREE_NOTES

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try { await notes.put({ text }); setText(''); await load() } catch (err) { setError(errorText(err)) }
  }
  function exportNotes() {
    const url = URL.createObjectURL(new Blob([items.map((i) => i.text).join('\n')], { type: 'text/plain' }))
    Object.assign(document.createElement('a'), { href: url, download: 'notes.txt' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <form onSubmit={add}>
        <input className="wide" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note" maxLength={500} required disabled={full} />
        <button className="primary" disabled={full}>Add</button>
        {pro && <button type="button" onClick={exportNotes} disabled={items.length === 0}>Export (Pro)</button>}
      </form>
      {full && <p>You've used your {FREE_NOTES} free notes. <a href="#pricing">Pick a plan</a> for unlimited notes.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <ul>
        {items.map((n) => (
          <li key={n.key}>
            {/* React escapes text: never use dangerouslySetInnerHTML for anything a user wrote. */}
            <span>{n.text}</span>
            <button onClick={() => notes.delete(n.key).then(load, (e) => setError(errorText(e)))}>Delete</button>
          </li>
        ))}
      </ul>
    </>
  )
}

function Pricing() {
  const user = useUser()
  const v = useVersion()
  const [sub, ent] = useSubscription(user?.id, v)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { dg.billing.plans().then(setPlans, (e) => setError(errorText(e))) }, [])

  if (error) return <p className="error" role="alert">{error}</p>
  if (!plans) return <p>Loading…</p>
  if (plans.length === 0) return <p>No plans yet. Create some in the dg.run dashboard (My apps → Plans).</p>

  const held = ent?.plan
  const lifetime = !!ent && ent.periodEnd === null
  return (
    <>
      <div className="plans">
        {plans.map((p) => {
          const trialSpent = p.kind === 'trial' && !!(sub ?? ent) // a trial is once per user: any earlier subscription used it up
          const label = p.kind === 'trial' ? 'Start free trial' : p.kind === 'recurring' ? 'Subscribe' : 'Buy'
          return (
            <div key={p.key} className={`plan${held === p.key ? ' current' : ''}`}>
              <h3>{p.name}</h3>
              <div className="price">{priceText(p)}</div>
              {p.description && <p>{p.description}</p>}
              {p.features.length > 0 && <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>}
              <button className="primary" disabled={held === p.key || trialSpent || lifetime || (p.kind === 'trial' && !!held)}
                onClick={() => (user ? dg.billing.subscribe(p.key) : dg.signIn()).catch((e) => setError(errorText(e)))}>
                {held === p.key ? 'Current plan' : trialSpent ? 'Trial used' : user ? label : 'Sign in to continue'}
              </button>
            </div>
          )
        })}
      </div>
      <p>You pay on dg.run, from your wallet or by card. Subscriptions renew from your wallet until you stop them.</p>
    </>
  )
}

const mount = (id: string, node: React.ReactNode) => createRoot(document.getElementById(id)!).render(<StrictMode>{node}</StrictMode>)
mount('auth', <AuthBar />)
mount('banner', <Banner />)
mount('status-app', <Status />)
mount('notes-app', <Notes />)
mount('plans-app', <Pricing />)

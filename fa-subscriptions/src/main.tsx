// طرح‌های اشتراک: نمونه‌ای کوچک و فارسی (راست‌به‌چپ) برای فروش اشتراک در dg.run.
//
//   dg.billing.plans()          طرح‌هایی که ارائه می‌دهید (بدون ورود هم خوانده می‌شود)
//   dg.billing.subscribe(key)   کاربر را برای پرداخت/آزمایش به dg.run می‌برد و برمی‌گرداند
//   dg.billing.status()         جزئیات اشتراک (تمدید، پایان دوره، خطای کیف پول) از سرور
//   dg.billing.entitlement()    اثبات امضاشده روی دستگاه؛ برای باز کردن محتوای ویژه و کار آفلاین
//   dg.billing.cancel()         تمدید خودکار را متوقف می‌کند (دسترسی تا پایان دوره‌ی پرداخت‌شده می‌ماند)
//   dg.billing.checkout         پس از بازگشت از درگاه پرداخت resolve می‌شود
//
// صفحه‌ی شما هرگز کارت نمی‌بیند و پولی جابه‌جا نمی‌کند: کاربر در dg.run تأیید می‌کند.
import { StrictMode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { createDg, type DgError, type Entitlement, type Plan, type Subscription } from 'dgclient'

const dg = createDg()
const useUser = () => useSyncExternalStore((cb) => dg.onChange(cb), () => dg.user, () => null)

/** طرحی که کاربر پیش از ورود انتخاب کرده است، تا بعد از ورود خودکار باز شود. */
const PENDING = 'fa-subscriptions:plan'
const PENDING_TTL = 10 * 60_000

const errorText = (e: unknown) => {
  const code = (e as DgError)?.code
  const map: Record<string, string> = {
    unauthorized: 'نشست شما پایان یافته است. دوباره وارد شوید.',
    plan_not_found: 'این طرح دیگر در دسترس نیست.',
    not_recurring: 'فقط اشتراک‌های دوره‌ای قابل لغو هستند.',
    network_error: 'اتصال به سرور برقرار نشد. دوباره تلاش کنید.',
  }
  return map[code] ?? `خطایی رخ داد (${code ?? 'نامشخص'}).`
}

/* ------------------------------------------------------------ قالب‌بندی */

const nf = new Intl.NumberFormat('fa-IR')
const money = (p: Plan) => {
  const amount = new Intl.NumberFormat('fa-IR', p.currency === 'IRR' ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.price)
  return p.currency === 'IRR' ? `${amount} ریال` : `${amount} دلار`
}
const INTERVAL: Record<'week' | 'month' | 'year', string> = { week: 'هفته', month: 'ماه', year: 'سال' }
function priceText(p: Plan) {
  if (p.kind === 'trial') return `رایگان برای ${nf.format(p.trialDays)} روز`
  if (p.kind === 'recurring') {
    const every = p.interval ? `هر ${p.intervalCount > 1 ? `${nf.format(p.intervalCount)} ` : ''}${INTERVAL[p.interval]}` : ''
    return `${money(p)} ${every}`.trim()
  }
  return p.durationDays > 0 ? `${money(p)} برای ${nf.format(p.durationDays)} روز` : `${money(p)}، یک‌بار برای همیشه`
}
const date = (ms: number) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(ms)
const daysLeft = (end: number) => Math.max(0, Math.ceil((end - Date.now()) / 86_400_000))

/* ------------------------------------------------------------ اشتراک */

/**
 * اشتراک کاربر، همیشه تازه: با تغییر کاربر و پس از بازگشت از پرداخت دوباره خوانده می‌شود.
 * `undefined` = در حال بارگذاری، `null` = هرگز مشترک نشده.
 */
function useSubscription(userId: string | undefined, version: number) {
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined)
  const [ent, setEnt] = useState<Entitlement | null | undefined>(undefined)
  const reload = useCallback(async () => {
    if (!userId) { setSub(null); setEnt(null); return }
    // ۱) دسترسی: اثبات امضاشده‌ی روی دستگاه. فوری است و آفلاین هم کار می‌کند.
    setEnt(await dg.billing.entitlement())
    // ۲) جزئیات (تاریخ تمدید، مشکل کیف پول): به سرور نیاز دارد، پس ممکن است آفلاین شکست بخورد.
    try { setSub(await dg.billing.status()); setEnt(await dg.billing.entitlement()) } catch { setSub(null) }
  }, [userId])
  useEffect(() => { void reload() }, [reload, version])
  return [sub, ent] as const
}

/* یک انبار کوچک تا جزیره‌های صفحه یک اشتراک را شریک شوند و با هم تازه شوند. */
let version = 0
const listeners = new Set<() => void>()
const bump = () => { version++; listeners.forEach((l) => l()) }
const useVersion = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => version, () => 0)

/* ------------------------------------------------------------ اجزا */

function AuthBar() {
  const user = useUser()
  if (!user) return <button className="primary" onClick={() => void dg.signIn()}>ورود با dg.run</button>
  return (
    <span className="who">
      {user.email}
      <button onClick={() => void dg.signOut()}>خروج</button>
    </span>
  )
}

/** پیام «انجام شد» یا «لغو شد»، یک‌بار، پس از بازگشت از صفحه‌ی پرداخت. */
function Banner() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    void dg.billing.checkout.then((r) => {
      if (!r) return
      setMsg(r.result === 'ok'
        ? { ok: true, text: 'پرداخت انجام شد. اگر طرح هنوز فعال نشده، چند لحظه صبر کنید.' }
        : { ok: false, text: 'پرداخت لغو شد. مبلغی کسر نشد.' })
      bump() // ممکن است طرح عوض شده باشد: دوباره بخوان
    })
  }, [])
  return msg ? <p className={`banner${msg.ok ? '' : ' warn'}`} role="status">{msg.text}</p> : null
}

function Status() {
  const user = useUser()
  const v = useVersion()
  const [sub, ent] = useSubscription(user?.id, v)
  const [error, setError] = useState('')

  if (!user) return <p>برای دیدن وضعیت اشتراک، وارد شوید.</p>
  if (sub === undefined && ent === undefined) return <p>در حال بارگذاری…</p>

  if (!sub && ent) {
    return (
      <p>
        <span className="badge pro">فعال</span> طرح «{ent.plan}» روی این دستگاه تأیید شده
        {ent.periodEnd ? ` تا ${date(ent.periodEnd)}` : ''}. برای دیدن جزئیات تمدید به اینترنت وصل شوید.
      </p>
    )
  }
  if (!sub) return <p>شما در طرح <strong>رایگان</strong> هستید. یکی از طرح‌های زیر را انتخاب کنید.</p>

  const p = sub.plan
  const name = p?.name ?? 'طرح شما'
  let line: string
  if (!sub.active) line = `طرح «${name}»${sub.currentPeriodEnd ? ` در ${date(sub.currentPeriodEnd)}` : ''} به پایان رسید. به طرح رایگان بازگشتید.`
  else if (sub.currentPeriodEnd === null) line = `طرح «${name}»: همیشگی است.`
  else if (sub.trial) line = `آزمایش رایگان: ${nf.format(daysLeft(sub.currentPeriodEnd))} روز باقی مانده (پایان ${date(sub.currentPeriodEnd)}).`
  else if (sub.autoRenew) line = `طرح «${name}»: در ${date(sub.currentPeriodEnd)} از کیف پول dg.run تمدید می‌شود.`
  else line = `طرح «${name}»: تا ${date(sub.currentPeriodEnd)} فعال است و تمدید نمی‌شود.`

  return (
    <>
      <p>
        <span className={`badge${sub.active ? ' pro' : ''}`}>{sub.active ? 'فعال' : 'پایان‌یافته'}</span> {line}
      </p>
      {sub.renewalError && (
        <p className="error" role="alert">آخرین تمدید ناموفق بود چون کیف پول خالی بود. در dg.run کیف پول را شارژ کنید و دوباره مشترک شوید.</p>
      )}
      {sub.active && sub.autoRenew && (
        <button onClick={() => void dg.billing.cancel().then(bump, (e) => setError(errorText(e)))}>توقف تمدید خودکار</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

function Pricing() {
  const user = useUser()
  const v = useVersion()
  const [sub, ent] = useSubscription(user?.id, v)
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  const auto = useRef(false)

  useEffect(() => { dg.billing.plans().then(setPlans, (e) => setError(errorText(e))) }, [])

  // طرحی که پیش از ورود انتخاب شده بود: بعد از ورود، یک‌بار خودکار بازش کن.
  useEffect(() => {
    if (!user || auto.current) return
    auto.current = true
    let pending: { key?: string; at?: number } | null = null
    try { pending = JSON.parse(localStorage.getItem(PENDING) ?? 'null') } catch { /* نامعتبر */ }
    try { localStorage.removeItem(PENDING) } catch { /* حافظه‌ی مسدود */ }
    if (!pending?.key || Date.now() - Number(pending.at) > PENDING_TTL) return
    dg.billing.subscribe(pending.key).catch((e) => setError(errorText(e)))
  }, [user])

  async function pick(p: Plan) {
    setError('')
    if (!user) {
      try { localStorage.setItem(PENDING, JSON.stringify({ key: p.key, at: Date.now() })) } catch { /* بدون حافظه هم ادامه بده */ }
      await dg.signIn()
      return
    }
    try { await dg.billing.subscribe(p.key) } catch (e) { setError(errorText(e)) }
  }

  if (error && !plans) return <p className="error" role="alert">{error}</p>
  if (!plans) return <p>در حال بارگذاری…</p>
  if (plans.length === 0) return <p>هنوز طرحی ساخته نشده است. در پیشخوان dg.run (برنامه‌های من ← طرح‌ها) چند طرح بسازید.</p>

  const held = ent?.plan // فقط اثبات فعال؛ اشتراک تمام‌شده هم در `status()` برمی‌گردد ولی طرح فعلی نیست
  const lifetime = !!ent && ent.periodEnd === null
  return (
    <>
      <div className="plans">
        {plans.map((p) => {
          const trialSpent = p.kind === 'trial' && !!(sub ?? ent) // آزمایش برای هر کاربر فقط یک‌بار
          const current = held === p.key
          const label = p.kind === 'trial' ? 'شروع آزمایش رایگان' : p.kind === 'recurring' ? 'انتخاب این طرح' : 'خرید'
          const blocked = current || lifetime || trialSpent || (p.kind === 'trial' && !!held)
          return (
            <div key={p.key} className={`plan${current ? ' current' : ''}`}>
              <h3>{p.name}</h3>
              <div className="price">{priceText(p)}</div>
              {p.description && <p>{p.description}</p>}
              {p.features.length > 0 && <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>}
              <button className="primary" disabled={blocked} onClick={() => void pick(p)}>
                {current ? 'طرح فعلی' : trialSpent ? 'آزمایش استفاده شد' : lifetime ? 'دسترسی همیشگی' : user ? label : 'برای ادامه وارد شوید'}
              </button>
            </div>
          )
        })}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="hint">پرداخت در dg.run انجام می‌شود، از کیف پول یا با کارت. اشتراک‌ها تا وقتی متوقفشان نکنید از کیف پول تمدید می‌شوند.</p>
    </>
  )
}

/** محتوای ویژه: فقط با یک طرح فعال باز می‌شود، و از اثبات امضاشده استفاده می‌کند (آفلاین هم). */
function Premium() {
  const user = useUser()
  const v = useVersion()
  const [sub, ent] = useSubscription(user?.id, v)

  if (!user) return <p>برای دیدن محتوای ویژه وارد شوید.</p>
  if (ent === undefined) return <p>در حال بررسی…</p>
  if (!ent) {
    return (
      <div className="locked">
        <strong>این بخش قفل است.</strong>
        <p>با فعال بودن هر یک از طرح‌ها باز می‌شود. یکی از طرح‌های بالا را انتخاب کنید.</p>
      </div>
    )
  }
  return (
    <div className="unlocked">
      <p><span className="badge pro">باز شد</span> طرح «{ent.plan}»{ent.periodEnd ? ` تا ${date(ent.periodEnd)}` : ' (همیشگی)'}.</p>
      <ul>
        <li>این خط نمونه‌ای از محتوای ویژه است: فقط مشترکان آن را می‌بینند.</li>
        <li>بررسی دسترسی با اثبات امضاشده روی دستگاه انجام می‌شود، پس آفلاین هم کار می‌کند.</li>
        <li>جزئیات تمدید (اگر آنلاین باشید): {sub?.autoRenew ? 'تمدید خودکار روشن است.' : sub?.active ? 'تمدید خودکار خاموش است.' : '—'}</li>
      </ul>
    </div>
  )
}

const mount = (id: string, node: React.ReactNode) => createRoot(document.getElementById(id)!).render(<StrictMode>{node}</StrictMode>)
mount('auth', <AuthBar />)
mount('banner', <Banner />)
mount('status-app', <Status />)
mount('plans-app', <Pricing />)
mount('premium-app', <Premium />)

// A small app that shows `dg.log`: what to call, what it sends, and how it looks in the owner's dashboard.
// Everything is plain DOM (no framework). Text from the page is always put in with textContent, never as HTML.
import { createDg } from 'dgclient'

// `version` is optional: a label of this build, attached to every line so you can tell versions apart.
const dg = createDg({ version: '1.0.0' })

// Logs uncaught errors and unhandled promise rejections on their own. Call it once, early.
dg.log.captureErrors()

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T
const echo = $<HTMLOListElement>('#echo')

/** Shows on the page what we asked dg.log to send (the server keeps its own copy). */
function show(level: 'debug' | 'info' | 'warn' | 'error', text: string) {
  const li = document.createElement('li')
  const tag = document.createElement('span')
  tag.className = `lvl ${level}`
  tag.textContent = level
  li.append(tag, document.createTextNode(` ${text}`))
  echo.prepend(li)
  while (echo.children.length > 50) echo.lastElementChild?.remove()
}

let n = 0
const actions: Record<string, () => void> = {
  debug: () => { dg.log.debug('Debug line'); show('debug', 'Debug line') },
  info: () => { dg.log.info('Button clicked'); show('info', 'Button clicked') },
  warn: () => { dg.log.warn('Disk almost full'); show('warn', 'Disk almost full') },
  error: () => {
    // Pass an Error to send its stack trace as well.
    dg.log.error(new Error('Payment failed'))
    show('error', 'Payment failed (with stack)')
  },
  data: () => {
    // Extra fields: JSON only, about 2 KB. Don't put secrets or personal data here.
    dg.log.info('Checkout opened', { plan: 'pro', items: 3, coupon: null })
    show('info', 'Checkout opened { plan, items, coupon }')
  },
  uncaught: () => {
    show('error', 'Throwing an uncaught error (captureErrors logs it)')
    setTimeout(() => { throw new Error('Uncaught error from the demo') })
  },
  rejection: () => {
    show('error', 'Rejecting a promise nobody handles (captureErrors logs it)')
    void Promise.reject(new Error('Unhandled rejection from the demo'))
  },
  repeat: () => {
    // Identical lines (same level, message and stack) become ONE row with a growing count.
    for (let i = 0; i < 5; i++) dg.log.warn('Slow response from the payment API')
    show('warn', 'Slow response from the payment API ×5 (one row, count 5)')
  },
  batch: () => {
    // 25 lines go out as two batches (20 + 5). Each line is different, so each is its own row.
    for (let i = 0; i < 25; i++) dg.log.info(`Batch line ${++n}`, { i })
    show('info', 'Batch line 1…25 (two requests)')
  },
  flush: () => { void dg.log.flush(); show('info', 'Sent what was queued') },
}

document.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>('button[data-act]')?.dataset.act
  if (act) actions[act]?.()
})

/* ---- sign-in: lines sent while signed in are marked `user` in the dashboard, others `anon` */
const auth = $<HTMLDivElement>('#auth')
function renderAuth() {
  auth.replaceChildren()
  const user = dg.user
  const button = document.createElement('button')
  if (user) {
    auth.append(document.createTextNode(`${user.email} · lines are marked user `))
    button.textContent = 'Sign out'
    button.onclick = () => void dg.signOut()
  } else {
    auth.append(document.createTextNode('Not signed in · lines are marked anon '))
    button.textContent = 'Sign in with dg'
    button.onclick = () => void dg.signIn()
  }
  auth.append(button)
}
dg.onChange(renderAuth)
void dg.ready.then(renderAuth)
renderAuth()

dg.log.info('Logs demo opened')
show('info', 'Logs demo opened')

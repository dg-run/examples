// The app: React, mounted into three "islands" of the static page (#auth, #guestbook-app, #notes-app).
// The headings and text around them are plain HTML in index.html / fr/index.html, so search engines read them without running JavaScript.
import { StrictMode, useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { createDg, type Collection, type ListOptions, type DgError } from 'dgclient' // sign-in + database: no keys, no configuration

const TEXT: Record<string, Record<string, string>> = {
  en: {
    signIn: 'Sign in with dg', signOut: 'Sign out', signedInAs: 'Signed in as',
    namePh: 'Your name', msgPh: 'Write a message', notePh: 'Write a note', post: 'Post', add: 'Add', del: 'Delete',
    signInForNotes: 'Sign in to keep private notes.', signInToPost: 'Sign in to leave a message.',
    live: 'Live', polling: 'Refreshing every 15 s', connecting: 'Connecting…', liveHint: 'Open this page in two tabs: a message posted in one appears in the other at once.',
    empty: 'Nothing here yet.', loading: 'Loading…', failed: 'Something went wrong:',
    unauthorized: 'Your session ended. Sign in again.', forbidden: 'You are not allowed to do that.', quota_exceeded: 'You have reached the limit.', moderator: 'moderator',
  },
  fr: {
    signIn: 'Se connecter avec dg', signOut: 'Se déconnecter', signedInAs: 'Connecté en tant que',
    namePh: 'Votre nom', msgPh: 'Écrivez un message', notePh: 'Écrivez une note', post: 'Publier', add: 'Ajouter', del: 'Supprimer',
    signInForNotes: 'Connectez-vous pour garder des notes privées.', signInToPost: 'Connectez-vous pour laisser un message.',
    live: 'En direct', polling: 'Actualisation toutes les 15 s', connecting: 'Connexion…', liveHint: 'Ouvrez cette page dans deux onglets : un message publié dans l’un apparaît aussitôt dans l’autre.',
    empty: 'Rien pour le moment.', loading: 'Chargement…', failed: 'Une erreur est survenue :',
    unauthorized: 'Votre session a expiré. Reconnectez-vous.', forbidden: 'Vous n’avez pas le droit de faire cela.', quota_exceeded: 'Vous avez atteint la limite.', moderator: 'modérateur',
  },
}
const lang = document.documentElement.lang
const t = TEXT[lang] ?? TEXT.en
const errorText = (e: unknown) => {
  const { code, message } = e as DgError // every SDK call throws a DgError; `code` autocompletes the known ones
  return t[code] ?? `${t.failed} ${code ?? message}`
}

// The shape of what we store. Interfaces and type aliases both work; the SDK then checks every put, patch and query against them.
interface Message { name: string; text: string }
interface Note { text: string }

const dg = createDg() // sign-in lasts 30 days: a 15-min access token in memory + an httpOnly refresh cookie, all handled by the SDK
const guestbook = dg.db.collection<Message>('guestbook', 'public') // everyone can read; only the author can change or delete
const notes = dg.db.collection<Note>('notes') //                      private: each user only ever sees their own
const GUESTBOOK_QUERY: ListOptions<Message> = { orderBy: 'createdAt', desc: true, limit: 20 } // module-level, so the object is stable between renders
const NOTES_QUERY: ListOptions<Note> = { orderBy: 'createdAt', desc: true }

/* ---------------------------------------------------------------- hooks */

/** The signed-in user (or null). Re-renders on sign-in, sign-out, and when the server ends the session. */
const useUser = () => useSyncExternalStore((onChange) => dg.onChange(onChange), () => dg.user, () => null)

/**
 * Keeps a collection on screen with `collection.live`: it lists now, again after every change anyone makes (pushed over a WebSocket the
 * SDK opens by itself), and after a reconnect. Without a working socket (e.g. a blocked network) it lists every 15 s instead, so the app works
 * either way. `enabled: false` skips it (e.g. private notes while signed out); a new `userId` starts over.
 * The `reload` it returns is for your own writes: show the result at once instead of waiting for the push.
 */
interface DocsState<T extends object> { items: Awaited<ReturnType<Collection<T>['list']>>['items']; loading: boolean; error: string }
function useDocs<T extends object>(collection: Collection<T>, query: ListOptions<T>, enabled: boolean, userId?: string) {
  const [state, setState] = useState<DocsState<T>>({ items: [], loading: enabled, error: '' })
  const reload = useCallback(async () => {
    if (!enabled) return
    try { setState({ items: (await collection.list(query)).items, loading: false, error: '' }) } catch (e) { setState((s) => ({ ...s, loading: false, error: errorText(e) })) }
  }, [collection, query, enabled, userId])
  useEffect(() => {
    if (!enabled) { setState({ items: [], loading: false, error: '' }); return }
    return collection.live(
      query,
      (page) => setState({ items: page.items, loading: false, error: '' }),
      { onError: (e) => setState((s) => ({ ...s, loading: false, error: errorText(e) })) },
    ) // returns the function that stops it
  }, [collection, query, enabled, userId])
  return [state, reload] as const
}

/** The realtime connection: 'open' = changes arrive as they happen; anything else = `live` is polling. */
const useRealtimeStatus = () => useSyncExternalStore((onChange) => dg.realtime.onStatus(onChange), () => dg.realtime.status, () => 'off' as const)

/* ---------------------------------------------------------------- components */
// React escapes everything it renders. Never use dangerouslySetInnerHTML for user text: anyone can write to the guestbook.

function AuthBar() {
  const user = useUser()
  const [error, setError] = useState('')
  if (!user) {
    // Sends the browser to dg.run to log in and allow this app, then back to this page, signed in.
    return (
      <>
        <button className="primary" onClick={() => dg.signIn().catch((e) => setError(errorText(e)))}>{t.signIn}</button>
        {error && <p role="alert" className="error">{error}</p>}
      </>
    )
  }
  return <>{t.signedInAs} {user.email} <button onClick={() => dg.signOut()}>{t.signOut}</button></>
}

function Entry({ children, onDelete }: { children: ReactNode; onDelete?: () => void }) {
  return (
    <li>
      <div>{children}</div>
      {onDelete && <button onClick={onDelete}>{t.del}</button>}
    </li>
  )
}

/** A small badge: is this page receiving changes live, or polling? */
function LiveBadge() {
  const status = useRealtimeStatus()
  const open = status === 'open'
  return <small className={`live${open ? ' on' : ''}`} role="status" title={t.liveHint}>{open ? t.live : status === 'connecting' ? t.connecting : t.polling}</small>
}

function Status({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  if (error) return <p role="alert" className="error">{error}</p>
  if (loading) return <p>{t.loading}</p>
  return empty ? <p>{t.empty}</p> : null
}

function Guestbook() {
  const user = useUser()
  const [{ items, loading, error }, reload] = useDocs(guestbook, GUESTBOOK_QUERY, true, user?.id) // public: works signed out too
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [problem, setProblem] = useState('')
  // Roles: a user the owner gave the `moderator` tag (dashboard: My apps -> Data and users -> Users) may delete anyone's message, once the
  // guestbook's rules allow it (Access -> Collection rules: public guestbook, delete: @owner, moderator). The tag only decides what to
  // SHOW; the server checks the rules again on every request, so a user who edits this page still gets `forbidden`.
  const moderator = !!user?.permissions.includes('moderator')

  const run = async (action: () => Promise<unknown>) => {
    setProblem('')
    try { await action(); await reload() } catch (e) { setProblem(errorText(e)) }
  }

  return (
    <>
      {moderator && <small className="live on">{t.moderator}</small>}
      {user ? (
        <form id="gb-form" onSubmit={(e) => { e.preventDefault(); void run(async () => { await guestbook.put({ name: name.trim(), text: text.trim() }); setText('') }) }}>
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} maxLength={30} required />
          <input name="text" className="wide" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.msgPh} maxLength={500} required />
          <button type="submit" className="primary">{t.post}</button>
        </form>
      ) : (
        <p>{t.signInToPost}</p>
      )}
      {problem && <p role="alert" className="error">{problem}</p>}
      <LiveBadge />
      <Status loading={loading} error={error} empty={!items.length} />
      <ul id="gb-list">
        {items.map((d) => (
          <Entry key={d.key} onDelete={user && (d.owner === user.id /* `owner` is a per-app id, comparable with user.id */ || moderator) ? () => run(() => guestbook.delete(d.key, d.owner === user.id ? undefined : { owner: d.owner })) : undefined}>
            <strong>{d.data.name}</strong>
            <small>{new Date(d.createdAt).toLocaleString(lang)}</small>
            {d.data.text}
          </Entry>
        ))}
      </ul>
    </>
  )
}

function Notes() {
  const user = useUser()
  const [{ items, loading, error }, reload] = useDocs(notes, NOTES_QUERY, !!user, user?.id)
  const [text, setText] = useState('')
  const [problem, setProblem] = useState('')

  if (!user) return <p>{t.signInForNotes}</p>
  const run = async (action: () => Promise<unknown>) => {
    setProblem('')
    try { await action(); await reload() } catch (e) { setProblem(errorText(e)) }
  }

  return (
    <>
      <form id="notes-form" onSubmit={(e) => { e.preventDefault(); void run(async () => { await notes.put({ text: text.trim() }); setText('') }) }}>
        <input name="text" className="wide" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.notePh} maxLength={500} required />
        <button type="submit" className="primary">{t.add}</button>
      </form>
      {problem && <p role="alert" className="error">{problem}</p>}
      <Status loading={loading} error={error} empty={!items.length} />
      <ul id="notes-list">
        {items.map((d) => <Entry key={d.key} onDelete={() => run(() => notes.delete(d.key))}>{d.data.text}</Entry>)}
      </ul>
    </>
  )
}

/* ---------------------------------------------------------------- mount */

for (const [id, Component] of [['auth', AuthBar], ['guestbook-app', Guestbook], ['notes-app', Notes]] as const) {
  createRoot(document.getElementById(id)!).render(<StrictMode><Component /></StrictMode>)
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { CheckCheck, Download, Moon, Pencil, Plus, RefreshCw, Sun, Trash2, WifiOff, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTodos } from '@/lib/use-todos'

type Filter = 'all' | 'active' | 'done'
const FILTERS: Filter[] = ['all', 'active', 'done']
const UPDATE_CHECK_MS = 30 * 60 * 1000

interface InstallEvent extends Event { prompt(): Promise<void> }

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    addEventListener('online', on); addEventListener('offline', off)
    return () => { removeEventListener('online', on); removeEventListener('offline', off) }
  }, [])
  return online
}

export default function App() {
  const { todos, ready, persistent, add, toggle, toggleAll, rename, remove, clearDone } = useTodos()
  const online = useOnline()
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const input = useRef<HTMLInputElement>(null)
  const swRegistration = useRef<ServiceWorkerRegistration | null>(null)

  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) { swRegistration.current = registration ?? null },
  })

  useEffect(() => {
    let checking = false
    const check = async () => {
      const registration = swRegistration.current
      if (!registration || checking || !navigator.onLine) return
      checking = true
      try { await registration.update() } catch { /* offline or transient; the next check retries */ } finally { checking = false }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    addEventListener('online', check)
    const timer = setInterval(() => void check(), UPDATE_CHECK_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      removeEventListener('online', check)
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent) }
    addEventListener('beforeinstallprompt', h)
    return () => removeEventListener('beforeinstallprompt', h)
  }, [])
  useEffect(() => { if (new URLSearchParams(location.search).has('new')) input.current?.focus() }, []) // manifest shortcut

  const active = todos.filter((t) => !t.done).length
  const done = todos.length - active
  const visible = useMemo(() => todos.filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.done : t.done)), [todos, filter])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    add(title)
    setText('')
  }
  function commitEdit() {
    if (!editing) return
    const title = editing.text.trim()
    if (title) rename(editing.id, title)
    else remove(editing.id)
    setEditing(null)
  }
  function toggleTheme() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Todo List</h1>
        <div className="flex items-center gap-1">
          {!online && <Badge variant="secondary" className="gap-1"><WifiOff className="size-3" />Offline</Badge>}
          {install && (
            <Button size="sm" variant="outline" onClick={() => install.prompt().then(() => setInstall(null))}>
              <Download className="size-4" />Install
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Toggle theme" onClick={toggleTheme}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      {needRefresh && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg border bg-muted p-3 text-sm">
          <span>A new version is available.</span>
          <Button size="sm" onClick={() => updateServiceWorker(true)}><RefreshCw className="size-4" />Reload</Button>
        </div>
      )}
      {offlineReady && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-lg border bg-muted p-3 text-sm">
          <span>Ready to work offline.</span>
          <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={() => setOfflineReady(false)}><X className="size-4" /></Button>
        </div>
      )}
      {!persistent && (
        <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          Local storage isn't available in this browser mode, so your tasks won't be saved after you close the tab.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="sr-only">Tasks</CardTitle>
          <form onSubmit={submit} className="flex gap-2">
            <Input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="What needs doing?" aria-label="New task" maxLength={200} />
            <Button type="submit" disabled={!text.trim()}><Plus className="size-4" />Add</Button>
          </form>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <div role="tablist" aria-label="Filter" className="inline-flex w-fit rounded-md bg-muted p-1">
            {FILTERS.map((f) => (
              <button
                key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={cn('rounded px-3 py-1 text-sm capitalize transition-colors', filter === f ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {f}
              </button>
            ))}
          </div>

          {!ready ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {todos.length === 0 ? 'Nothing here yet. Add your first task above.' : `No ${filter} tasks.`}
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-md border">
              {visible.map((t) => (
                <li key={t.id} className="group flex items-center gap-3 p-3">
                  <Checkbox checked={t.done} onCheckedChange={() => toggle(t.id)} aria-label={`Mark "${t.title}" ${t.done ? 'not done' : 'done'}`} />
                  {editing?.id === t.id ? (
                    <Input
                      autoFocus value={editing.text} aria-label="Edit task" className="h-8"
                      onChange={(e) => setEditing({ id: t.id, text: e.target.value })}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
                    />
                  ) : (
                    <span
                      className={cn('min-w-0 flex-1 break-words text-sm', t.done && 'text-muted-foreground line-through')}
                      onDoubleClick={() => setEditing({ id: t.id, text: t.title })}
                    >
                      {t.title}
                    </span>
                  )}
                  <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Edit" onClick={() => setEditing({ id: t.id, text: t.title })}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8" aria-label="Delete" onClick={() => remove(t.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>

        {todos.length > 0 && (
          <CardFooter className="flex-wrap justify-between text-sm text-muted-foreground">
            <span>{active} {active === 1 ? 'task' : 'tasks'} left</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => toggleAll(active > 0)}><CheckCheck className="size-4" />{active > 0 ? 'Complete all' : 'Reopen all'}</Button>
              {done > 0 && <Button size="sm" variant="ghost" onClick={clearDone}>Clear {done} done</Button>}
            </div>
          </CardFooter>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">Stored on this device with LokiJS · works offline</p>
    </main>
  )
}

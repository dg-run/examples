import Loki from 'lokijs'
import IncrementalIndexedDBAdapter from 'lokijs/src/incremental-indexeddb-adapter'

export interface Todo {
  id: number // Loki's $loki
  title: string
  done: boolean
  createdAt: number
  completedAt: number | null
}
type Doc = Omit<Todo, 'id'> & Partial<LokiObj>

export interface TodoStore {
  persistent: boolean // false when IndexedDB is unavailable (e.g. some private modes): data lives in memory only
  all(): Todo[]
  add(title: string): void
  toggle(id: number): void
  toggleAll(done: boolean): void
  rename(id: number, title: string): void
  remove(id: number): void
  clearDone(): void
}

const toTodo = (d: Doc & LokiObj): Todo => ({ id: d.$loki, title: d.title, done: d.done, createdAt: d.createdAt, completedAt: d.completedAt })

function open(adapter: LokiPersistenceAdapter | undefined): Promise<Loki> {
  return new Promise((resolve, reject) => {
    const db: Loki = new Loki('todo-pwa.db', {
      adapter,
      autoload: true,
      autosave: true,
      autosaveInterval: 400,
      autoloadCallback: (err?: unknown) => (err ? reject(err) : resolve(db)),
    })
  })
}

/** Opens the local LokiJS database (persisted to IndexedDB) and returns a small synchronous store. */
export async function openStore(): Promise<TodoStore> {
  let db: Loki
  let persistent = true
  try {
    db = await open(new IncrementalIndexedDBAdapter())
  } catch {
    db = await open(new Loki.LokiMemoryAdapter())
    persistent = false
  }
  const col = db.getCollection<Doc>('todos') ?? db.addCollection<Doc>('todos', { indices: ['createdAt'] })

  // Don't lose the last few hundred ms of edits when the tab is hidden or closed.
  const flush = () => void db.saveDatabase()
  addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())

  return {
    persistent,
    all: () => col.chain().simplesort('createdAt', true).data().map((d) => toTodo(d as Doc & LokiObj)),
    add(title) {
      col.insert({ title, done: false, createdAt: Date.now(), completedAt: null })
    },
    toggle(id) {
      const d = col.get(id)
      if (!d) return
      d.done = !d.done
      d.completedAt = d.done ? Date.now() : null
      col.update(d)
    },
    toggleAll(done) {
      col.where((d) => d.done !== done).forEach((d) => {
        d.done = done
        d.completedAt = done ? Date.now() : null
        col.update(d)
      })
    },
    rename(id, title) {
      const d = col.get(id)
      if (d) { d.title = title; col.update(d) }
    },
    remove(id) {
      const d = col.get(id)
      if (d) col.remove(d)
    },
    clearDone() {
      col.findAndRemove({ done: true })
    },
  }
}

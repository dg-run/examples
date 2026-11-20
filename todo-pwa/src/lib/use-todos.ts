import { useCallback, useEffect, useRef, useState } from 'react'
import { openStore, type Todo, type TodoStore } from './db'

export function useTodos() {
  const store = useRef<TodoStore | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [ready, setReady] = useState(false)
  const [persistent, setPersistent] = useState(true)

  useEffect(() => {
    let alive = true
    openStore().then((s) => {
      if (!alive) return
      store.current = s
      setPersistent(s.persistent)
      setTodos(s.all())
      setReady(true)
    })
    return () => { alive = false }
  }, [])

  const mutate = useCallback((fn: (s: TodoStore) => void) => {
    if (!store.current) return
    fn(store.current)
    setTodos(store.current.all())
  }, [])

  return {
    todos, ready, persistent,
    add: (title: string) => mutate((s) => s.add(title)),
    toggle: (id: number) => mutate((s) => s.toggle(id)),
    toggleAll: (done: boolean) => mutate((s) => s.toggleAll(done)),
    rename: (id: number, title: string) => mutate((s) => s.rename(id, title)),
    remove: (id: number) => mutate((s) => s.remove(id)),
    clearDone: () => mutate((s) => s.clearDone()),
  }
}

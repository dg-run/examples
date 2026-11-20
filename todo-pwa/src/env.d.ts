/// <reference types="vite/client" />
declare module 'lokijs/src/incremental-indexeddb-adapter' {
  const Adapter: new () => LokiPersistenceAdapter
  export default Adapter
}

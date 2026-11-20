// Builds ./dist: the React app (with the dg SDK) bundled into app/main.js, plus site/ with {{ORIGIN}} filled in.
//   npm run build                                      -> origin http://fa-subscriptions.localhost:3000 (local dev)
//   ORIGIN=https://fa-subscriptions.example.app npm run build -> your real address (canonical link, sitemap)
import { build } from 'esbuild' // react, react-dom and esbuild come from the repo's root node_modules; dgclient from this example's node_modules
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const origin = (process.env.ORIGIN ?? 'http://fa-subscriptions.localhost:3000').replace(/\/+$/, '')
rmSync('dist', { recursive: true, force: true })
cpSync('site', 'dist', { recursive: true })

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
for (const f of walk('dist')) {
  if (/\.(html|txt|xml|webmanifest)$/.test(f)) writeFileSync(f, readFileSync(f, 'utf8').replaceAll('{{ORIGIN}}', origin))
}

mkdirSync('dist/app', { recursive: true })
await build({
  entryPoints: ['src/main.tsx'], bundle: true, format: 'esm', minify: true, target: 'es2020', outfile: 'dist/app/main.js', logLevel: 'warning',
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
})
console.log(`built dist/ for ${origin}`)

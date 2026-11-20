// Builds ./dist from site/ (plain files: no bundler needed).
//   npm run build                                       -> origin http://market-pwa.localhost:3000 (local dev)
//   ORIGIN=https://tally.example.app npm run build      -> your real address (canonical link, sitemap, related_applications)
// {{ORIGIN}} is replaced in text files; {{BUILD}} in sw.js becomes a hash of the other files, so every new build replaces the old offline cache.
import { cpSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const origin = (process.env.ORIGIN ?? 'http://market-pwa.localhost:3000').replace(/\/+$/, '')
rmSync('dist', { recursive: true, force: true })
cpSync('site', 'dist', { recursive: true })

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
const hash = createHash('sha256')
for (const f of walk('dist').sort()) {
  if (/\.(html|txt|xml|webmanifest)$/.test(f)) writeFileSync(f, readFileSync(f, 'utf8').replaceAll('{{ORIGIN}}', origin))
  if (!f.endsWith('sw.js')) hash.update(f).update(readFileSync(f))
}
writeFileSync('dist/sw.js', readFileSync('dist/sw.js', 'utf8').replaceAll('{{BUILD}}', hash.digest('hex').slice(0, 10)))
console.log(`built dist/ for ${origin}`)

// Zips dist/ (files at the zip root) into todo-pwa.zip, ready to submit in the marketplace.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]))
const files = {}
for (const f of walk('dist')) files[relative('dist', f).split('\\').join('/')] = readFileSync(f)
const zip = zipSync(files, { level: 9 })
writeFileSync('todo-pwa.zip', zip)
console.log(`todo-pwa.zip: ${Object.keys(files).length} files, ${(zip.length / 1024).toFixed(0)} KB`)

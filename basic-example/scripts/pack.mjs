// Zips dist/ (files at the zip root) into basic-example.zip, ready to submit in the marketplace.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate' // from the repo's root node_modules

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]))
const files = {}
for (const f of walk('dist')) files[relative('dist', f).split('\\').join('/')] = readFileSync(f)
writeFileSync('basic-example.zip', zipSync(files, { level: 9 }))
console.log(`basic-example.zip: ${Object.keys(files).length} files`)

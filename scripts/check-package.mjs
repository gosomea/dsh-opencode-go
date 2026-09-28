/** Verify every advertised entry is in the npm pack artifact and exclude development state. */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const pack = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))[0]
const files = new Set(pack.files.map(file => file.path))
const entries = [manifest.main, manifest.types, manifest.exports['./client'], manifest.dsh.bundle.patch, 'scripts/migrate.mjs', 'skills/dsh-opencode-go/SKILL.md']
for (const entry of entries) if (!files.has(entry.replace(/^\.\//, ''))) throw new Error(`Missing packed entry: ${entry}`)
for (const file of files) if (/node_modules|\.credentials|catalog-v1|session\.|\.log$|\.tgz$/.test(file)) throw new Error(`Private/development file packed: ${file}`)
console.log(JSON.stringify({ name: manifest.name, version: manifest.version, files: files.size, unpackedSize: pack.unpackedSize, entries }, null, 2))

// Tests de base de datos SIN Docker: aplica las migraciones y el seed en Postgres (PGlite,
// WASM) sobre un simulador mínimo de Supabase (roles anon/authenticated, auth.users,
// auth.uid()) y ejecuta los tests pgTAP de supabase/tests/database.
//
// Es una verificación rápida para el día a día. La de referencia sigue siendo
// `supabase test db` contra Supabase real (local con Docker o en CI).
//
// Uso: npm run test:db [-- --verbose] [-- --no-seed]
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { pgtap } from '@electric-sql/pglite-pgtap'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const root = join(here, '..', '..')
const verbose = process.argv.includes('--verbose')
const withSeed = !process.argv.includes('--no-seed')

const db = await PGlite.create({ extensions: { pgcrypto, pgtap } })
await db.exec(`set search_path = "$user", public, extensions;`)
await db.exec(readFileSync(join(here, 'supabase-stub.sql'), 'utf8'))

async function runFile(label, path) {
  try {
    return await db.exec(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`  ✗ ${label}: ${error.message}`)
    if (error.detail) console.error(`    detail: ${error.detail}`)
    if (error.where) console.error(`    where: ${error.where}`)
    await db.exec('rollback').catch(() => {})
    return null
  }
}

const sqlFiles = (dir) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

let failed = false

console.log('Migraciones')
const migrationsDir = join(root, 'supabase', 'migrations')
for (const file of sqlFiles(migrationsDir)) {
  if (!(await runFile(file, join(migrationsDir, file)))) process.exit(1)
  console.log(`  ✓ ${file}`)
}

const seedPath = join(root, 'supabase', 'seed.sql')
if (withSeed && existsSync(seedPath)) {
  if (await runFile('seed.sql', seedPath)) console.log('  ✓ seed.sql')
  else failed = true
}

console.log('\nTests pgTAP')
const testsDir = join(root, 'supabase', 'tests', 'database')
let totalOk = 0
let totalFailed = 0
for (const file of sqlFiles(testsDir)) {
  const results = await runFile(file, join(testsDir, file))
  if (!results) {
    failed = true
    continue
  }
  const lines = results.flatMap((result) =>
    result.rows.map((row) => String(Object.values(row)[0] ?? '')),
  )
  const tap = lines.filter((line) => /^(ok|not ok|1\.\.|#)/.test(line))
  const ok = tap.filter((line) => line.startsWith('ok')).length
  const notOk = tap.filter((line) => line.startsWith('not ok')).length
  const planMismatch = tap.some((line) => /Looks like you planned/.test(line))
  totalOk += ok
  totalFailed += notOk
  if (notOk || planMismatch) failed = true
  console.log(
    `  ${notOk || planMismatch ? '✗' : '✓'} ${file}: ${ok} ok${notOk ? `, ${notOk} fallidos` : ''}`,
  )
  for (const line of verbose ? tap : tap.filter((l) => !l.startsWith('ok') && !l.startsWith('1..')))
    console.log(`      ${line}`)
}

await db.close()
console.log(`\n${failed ? '✗' : '✓'} ${totalOk} tests ok, ${totalFailed} fallidos`)
process.exit(failed ? 1 : 0)

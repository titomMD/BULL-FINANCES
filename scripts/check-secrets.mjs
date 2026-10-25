// Spec §29: ninguna clave privilegiada puede llegar al frontend.
// Revisa el código fuente (src/, index.html), los .env que Vite expone (VITE_*) y el build
// (dist/). Falla si encuentra una secret key, una service_role key o similares.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const PATTERNS = [
  { name: 'Supabase secret key', regex: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'Referencia a service_role', regex: /service_role/i },
  { name: 'Variable de entorno de service key', regex: /SERVICE_(ROLE_)?KEY/ },
  { name: 'Contraseña de Postgres en URL', regex: /postgres(ql)?:\/\/[^:\s'"]+:[^@\s'"]+@/ },
]

// JWT legado cuyo payload declara role=service_role.
function hasServiceRoleJwt(text) {
  for (const [token] of text.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
      if (payload.role === 'service_role') return true
    } catch {
      // No es un JWT válido: se ignora.
    }
  }
  return false
}

function walk(path) {
  if (!existsSync(path)) return []
  if (statSync(path).isFile()) return [path]
  return readdirSync(path).flatMap((entry) => walk(join(path, entry)))
}

const targets = [
  ...walk(join(root, 'src')),
  join(root, 'index.html'),
  ...walk(join(root, 'public')),
  ...walk(join(root, 'dist')),
].filter((file) => existsSync(file) && /\.(m?[jt]sx?|html|css|json|svg|txt|map)$/.test(file))

const findings = []

for (const file of targets) {
  const text = readFileSync(file, 'utf8')
  for (const { name, regex } of PATTERNS)
    if (regex.test(text)) findings.push(`${name} → ${relative(root, file)}`)
  if (hasServiceRoleJwt(text)) findings.push(`JWT con role=service_role → ${relative(root, file)}`)
}

// Toda variable VITE_* termina en el bundle público.
for (const envFile of readdirSync(root).filter((file) => /^\.env(\..+)?$/.test(file))) {
  for (const line of readFileSync(join(root, envFile), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, value] = match
    if (/SECRET|SERVICE/.test(key) || /sb_secret_/.test(value) || hasServiceRoleJwt(value)) {
      findings.push(`Clave privilegiada expuesta como ${key} → ${envFile}`)
    }
  }
}

if (findings.length) {
  console.error('✗ Posibles secretos en el frontend:')
  for (const finding of findings) console.error(`  - ${finding}`)
  process.exit(1)
}

console.log(`✓ Sin secretos en el frontend (${targets.length} archivos revisados)`)

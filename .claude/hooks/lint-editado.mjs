// Hook PostToolUse (Edit | Write): pasa oxlint sobre el .ts/.tsx de src/ que se acaba de editar.
// Solo interrumpe si hay ERRORES (los avisos no); en ese caso el mensaje le llega a Claude para que lo corrija.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

let entrada = {}
try {
  entrada = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}

const archivo = entrada.tool_input?.file_path
if (!archivo || !/\.tsx?$/.test(archivo)) process.exit(0)

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const rel = relative(raiz, resolve(raiz, archivo))
if (!rel.startsWith(`src${sep}`)) process.exit(0)

const resultado = spawnSync('npx', ['--no-install', 'oxlint', rel], { cwd: raiz, encoding: 'utf8', shell: true })

// Si oxlint no pudo ejecutarse no se molesta a nadie; solo se avisa cuando encontró errores
if (resultado.error || resultado.status === null || resultado.status === 0) process.exit(0)

process.stderr.write(`oxlint encontró errores en ${rel}:\n${resultado.stdout}${resultado.stderr}`)
process.exit(2)

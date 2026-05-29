// Local demo launcher: serves the built frontend + API against sample-data.
// Used by .claude/launch.json for previews; not part of the shipped image.
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')

process.env.PORT ??= '8090'
process.env.HOST ??= '127.0.0.1'
process.env.DATA_DIR ??= path.join(root, 'sample-data')
process.env.STATIC_DIR ??= path.join(root, 'frontend', 'dist')
process.env.DDNS_UPDATER_URL ??= 'http://127.0.0.1:1'

await import('../dist/server.js')

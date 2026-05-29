import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConfigStore } from './lib/configStore.js'
import { COMMON_FIELDS, listProviders } from './lib/providers.js'
import recordsRoutes from './routes/records.js'
import statusRoutes from './routes/status.js'
import refreshRoutes from './routes/refresh.js'

const here = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(here, '../data')
const CONFIG_FILE = process.env.CONFIG_FILE ?? path.join(DATA_DIR, 'config.json')
const UPDATES_FILE = process.env.UPDATES_FILE ?? path.join(DATA_DIR, 'updates.json')
const DDNS_UPDATER_URL = process.env.DDNS_UPDATER_URL ?? 'http://localhost:8000'
const STATIC_DIR = process.env.STATIC_DIR ?? path.resolve(here, '../public')
const GUI_USERNAME = process.env.GUI_USERNAME
const GUI_PASSWORD = process.env.GUI_PASSWORD

function buildServer() {
  const app = Fastify({ logger: true })
  const store = new ConfigStore(CONFIG_FILE)

  // Optional HTTP basic auth — recommended when exposing the GUI, since it
  // edits credentials. Enabled only when both env vars are set. /healthz stays
  // open so container health checks work.
  if (GUI_USERNAME && GUI_PASSWORD) {
    const expected = `Basic ${Buffer.from(`${GUI_USERNAME}:${GUI_PASSWORD}`).toString('base64')}`
    app.addHook('onRequest', async (req, reply) => {
      if (req.url === '/healthz') return
      if (req.headers.authorization !== expected) {
        await reply
          .header('WWW-Authenticate', 'Basic realm="DDNS Manager"')
          .code(401)
          .send({ error: 'Unauthorized' })
      }
    })
    app.log.info('HTTP basic auth enabled')
  }

  app.get('/healthz', async () => ({ ok: true }))
  app.get('/api/providers', async () => ({ common: COMMON_FIELDS, providers: listProviders() }))

  app.register(recordsRoutes, { store })
  app.register(statusRoutes, { store, updatesPath: UPDATES_FILE })
  app.register(refreshRoutes, { ddnsUpdaterUrl: DDNS_UPDATER_URL })

  // Serve the built frontend (production). Unknown non-API GET routes fall back
  // to index.html so the single-page app can handle client-side views.
  if (existsSync(STATIC_DIR)) {
    app.register(fastifyStatic, { root: STATIC_DIR })
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.sendFile('index.html')
      }
      return reply.code(404).send({ error: 'Not found' })
    })
    app.log.info(`serving frontend from ${STATIC_DIR}`)
  }

  return app
}

const app = buildServer()
app.log.info(`config: ${CONFIG_FILE}`)
app.log.info(`updates: ${UPDATES_FILE}`)
app.log.info(`ddns-updater: ${DDNS_UPDATER_URL}`)
app.listen({ port: PORT, host: HOST }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})

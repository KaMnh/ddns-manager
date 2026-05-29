import type { FastifyPluginAsync } from 'fastify'
import { readFile } from 'node:fs/promises'
import type { ConfigStore } from '../lib/configStore.js'
import { parseUpdates, mergeStatus } from '../lib/updatesReader.js'
import { rootDomain } from '../lib/domain.js'

export interface StatusOptions {
  store: ConfigStore
  updatesPath: string
}

const statusRoutes: FastifyPluginAsync<StatusOptions> = async (app, opts) => {
  app.get('/api/status', async () => {
    const cfg = await opts.store.read()

    let updates: ReturnType<typeof parseUpdates> = []
    try {
      updates = parseUpdates(JSON.parse(await readFile(opts.updatesPath, 'utf8')))
    } catch (err) {
      // Missing or unreadable updates.json just means "no status yet".
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        app.log.warn({ err }, 'could not read updates.json')
      }
    }

    return {
      records: mergeStatus(cfg.settings, updates).map((s) => ({ ...s, rootDomain: rootDomain(s.domain) })),
    }
  })
}

export default statusRoutes

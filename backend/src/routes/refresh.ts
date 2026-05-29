import type { FastifyPluginAsync } from 'fastify'

export interface RefreshOptions {
  /** base URL of the ddns-updater HTTP server, e.g. http://ddns-updater:8000 */
  ddnsUpdaterUrl: string
}

/**
 * Triggers a force-refresh of the IPs of the records ddns-updater already
 * loaded, by proxying its `GET /update` endpoint. (Note: this does NOT load
 * config changes — those require restarting ddns-updater.)
 */
const refreshRoutes: FastifyPluginAsync<RefreshOptions> = async (app, opts) => {
  const updateUrl = `${opts.ddnsUpdaterUrl.replace(/\/+$/, '')}/update`

  app.post('/api/refresh', async (_req, reply) => {
    try {
      const res = await fetch(updateUrl, { method: 'GET' })
      const message = (await res.text()).trim()
      if (res.status >= 200 && res.status < 400) {
        return { ok: true, status: res.status, message: message || 'Update triggered' }
      }
      return reply
        .code(502)
        .send({ ok: false, status: res.status, message: message || 'ddns-updater returned an error' })
    } catch (err) {
      return reply.code(502).send({
        ok: false,
        message: `Could not reach ddns-updater at ${opts.ddnsUpdaterUrl}: ${(err as Error).message}`,
      })
    }
  })
}

export default refreshRoutes

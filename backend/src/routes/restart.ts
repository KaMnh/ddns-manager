import type { FastifyPluginAsync } from 'fastify'
import { DockerClient, DockerError } from '../lib/docker.js'

export interface RestartOptions {
  docker: DockerClient
  /** Container name/ID to restart. Empty string disables the feature. */
  container: string
  /** Grace period (seconds) Docker gives the container to stop. */
  stopTimeout?: number
}

const DISABLED = 'Container restart is disabled (DDNS_UPDATER_CONTAINER is empty)'

/**
 * Restarts the ddns-updater container so config.json changes take effect —
 * ddns-updater reads its records only at startup, so `GET /update` (see
 * refresh.ts) cannot apply added/edited/removed records, only re-check the IPs
 * of the ones already loaded.
 *
 * The container name comes from configuration only, never from the request:
 * this endpoint can restart exactly one, pre-approved container.
 */
const restartRoutes: FastifyPluginAsync<RestartOptions> = async (app, opts) => {
  const { docker, container, stopTimeout = 10 } = opts

  /** Reports whether restarting is wired up, so the UI can guide instead of failing. */
  app.get('/api/restart', async () => {
    const base = { container, target: docker.label }
    if (!container) return { ...base, available: false, reason: DISABLED }
    try {
      const state = await docker.inspect(container)
      return { ...base, available: true, state }
    } catch (err) {
      return { ...base, available: false, reason: (err as Error).message }
    }
  })

  app.post('/api/restart', async (_req, reply) => {
    if (!container) {
      return reply.code(503).send({ ok: false, message: DISABLED })
    }
    try {
      await docker.restart(container, stopTimeout)
      app.log.info(`restarted container ${container}`)
      return { ok: true, message: `Restarted ${container} — records in config.json are now applied` }
    } catch (err) {
      const message = (err as Error).message
      app.log.error({ err }, `could not restart container ${container}`)
      // 404: no such container. Anything the daemon answered is a bad gateway;
      // never reaching it at all means the feature isn't wired up here (503).
      const status = err instanceof DockerError ? (err.status === 404 ? 404 : err.status ? 502 : 503) : 502
      return reply.code(status).send({ ok: false, message })
    }
  })
}

export default restartRoutes

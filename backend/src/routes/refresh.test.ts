import { describe, test, expect, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { AddressInfo } from 'node:net'
import refreshRoutes from './refresh.js'

let app: FastifyInstance | undefined
let upstream: FastifyInstance | undefined

afterEach(async () => {
  await app?.close()
  await upstream?.close()
  app = undefined
  upstream = undefined
})

describe('POST /api/refresh', () => {
  test('proxies to ddns-updater GET /update and reports success', async () => {
    upstream = Fastify()
    let hit = false
    upstream.get('/update', async (_req, reply) => {
      hit = true
      reply.code(202)
      return 'All records updated successfully in 1ms'
    })
    await upstream.listen({ port: 0, host: '127.0.0.1' })
    const { port } = upstream.server.address() as AddressInfo

    app = Fastify()
    await app.register(refreshRoutes, { ddnsUpdaterUrl: `http://127.0.0.1:${port}` })
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/api/refresh' })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(hit).toBe(true)
  })

  test('returns 502 when ddns-updater is unreachable', async () => {
    app = Fastify()
    // port 1 is not listening -> connection refused
    await app.register(refreshRoutes, { ddnsUpdaterUrl: 'http://127.0.0.1:1' })
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/api/refresh' })
    expect(res.statusCode).toBe(502)
    expect(res.json().ok).toBe(false)
  })
})

import { describe, test, expect, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import http from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DockerClient } from '../lib/docker.js'
import restartRoutes from './restart.js'

let app: FastifyInstance | undefined
let daemon: http.Server | undefined
let dir: string | undefined

async function fakeDaemon(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<string> {
  dir = await mkdtemp(path.join(tmpdir(), 'ddns-restart-'))
  const socketPath = path.join(dir, 'docker.sock')
  daemon = http.createServer(handler)
  await new Promise<void>((resolve) => daemon!.listen(socketPath, resolve))
  return socketPath
}

async function buildApp(opts: { socketPath: string; container?: string }) {
  app = Fastify()
  await app.register(restartRoutes, {
    docker: new DockerClient({ socketPath: opts.socketPath }),
    container: opts.container ?? 'ddns-updater',
  })
  await app.ready()
  return app
}

afterEach(async () => {
  await app?.close()
  if (daemon) await new Promise((resolve) => daemon!.close(resolve))
  if (dir) await rm(dir, { recursive: true, force: true })
  app = undefined
  daemon = undefined
  dir = undefined
})

describe('POST /api/restart', () => {
  test('restarts the configured container', async () => {
    let restarted = ''
    const socketPath = await fakeDaemon((req, res) => {
      if (req.method === 'POST') restarted = req.url ?? ''
      res.writeHead(204).end()
    })

    const res = await (await buildApp({ socketPath })).inject({ method: 'POST', url: '/api/restart' })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(restarted).toBe('/containers/ddns-updater/restart?t=10')
  })

  test('restarts only the configured container, whatever the request says', async () => {
    let restarted = ''
    const socketPath = await fakeDaemon((req, res) => {
      if (req.method === 'POST') restarted = req.url ?? ''
      res.writeHead(204).end()
    })

    const res = await (
      await buildApp({ socketPath, container: 'my-updater' })
    ).inject({ method: 'POST', url: '/api/restart', payload: { container: 'other-container' } })

    expect(res.statusCode).toBe(200)
    expect(restarted).toBe('/containers/my-updater/restart?t=10')
  })

  test('returns 404 when the container does not exist', async () => {
    const socketPath = await fakeDaemon((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'No such container: ddns-updater' }))
    })

    const res = await (await buildApp({ socketPath })).inject({ method: 'POST', url: '/api/restart' })

    expect(res.statusCode).toBe(404)
    expect(res.json().ok).toBe(false)
  })

  test('returns 503 when the Docker socket is not mounted', async () => {
    const res = await (
      await buildApp({ socketPath: '/nonexistent/docker.sock' })
    ).inject({ method: 'POST', url: '/api/restart' })

    expect(res.statusCode).toBe(503)
    expect(res.json().message).toContain('docker.sock')
  })

  test('returns 503 when restarting is disabled', async () => {
    const res = await (
      await buildApp({ socketPath: '/nonexistent/docker.sock', container: '' })
    ).inject({ method: 'POST', url: '/api/restart' })

    expect(res.statusCode).toBe(503)
    expect(res.json().message).toContain('disabled')
  })
})

describe('GET /api/restart', () => {
  test('reports available with the container state', async () => {
    const socketPath = await fakeDaemon((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ State: { Status: 'running', Running: true } }))
    })

    const res = await (await buildApp({ socketPath })).inject({ method: 'GET', url: '/api/restart' })

    expect(res.json()).toMatchObject({
      available: true,
      container: 'ddns-updater',
      state: { status: 'running', running: true },
    })
  })

  test('reports unavailable with a reason instead of failing', async () => {
    const res = await (
      await buildApp({ socketPath: '/nonexistent/docker.sock' })
    ).inject({ method: 'GET', url: '/api/restart' })

    expect(res.statusCode).toBe(200)
    expect(res.json().available).toBe(false)
    expect(res.json().reason).toContain('docker.sock')
  })
})

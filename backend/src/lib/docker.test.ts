import { describe, test, expect, afterEach } from 'vitest'
import http from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DockerClient, DockerError, resolveTarget } from './docker.js'

interface Call {
  method: string
  url: string
}

let server: http.Server | undefined
let dir: string | undefined

/** Spins up a fake Docker daemon on a Unix socket in a temp dir. */
async function fakeDaemon(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{ socketPath: string; calls: Call[] }> {
  const calls: Call[] = []
  dir = await mkdtemp(path.join(tmpdir(), 'ddns-docker-'))
  const socketPath = path.join(dir, 'docker.sock')
  server = http.createServer((req, res) => {
    calls.push({ method: req.method ?? '', url: req.url ?? '' })
    handler(req, res)
  })
  await new Promise<void>((resolve) => server!.listen(socketPath, resolve))
  return { socketPath, calls }
}

afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve))
  if (dir) await rm(dir, { recursive: true, force: true })
  server = undefined
  dir = undefined
})

describe('resolveTarget', () => {
  test('defaults to the standard Unix socket', () => {
    expect(resolveTarget()).toMatchObject({ socketPath: '/var/run/docker.sock' })
  })

  test('accepts unix:// and tcp:// DOCKER_HOST values', () => {
    expect(resolveTarget({ dockerHost: 'unix:///run/docker.sock' })).toMatchObject({
      socketPath: '/run/docker.sock',
    })
    expect(resolveTarget({ dockerHost: 'tcp://docker-proxy:2375' })).toMatchObject({
      hostname: 'docker-proxy',
      port: 2375,
    })
  })

  test('rejects schemes it cannot dial', () => {
    expect(() => resolveTarget({ dockerHost: 'ssh://box' })).toThrow(DockerError)
  })
})

describe('DockerClient.restart', () => {
  test('calls POST /containers/<name>/restart with the stop timeout', async () => {
    const { socketPath, calls } = await fakeDaemon((_req, res) => {
      res.writeHead(204).end()
    })

    await new DockerClient({ socketPath }).restart('ddns-updater', 7)

    expect(calls).toEqual([{ method: 'POST', url: '/containers/ddns-updater/restart?t=7' }])
  })

  test('reports a missing container as 404', async () => {
    const { socketPath } = await fakeDaemon((_req, res) => {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'No such container: nope' }))
    })

    const err = await new DockerClient({ socketPath }).restart('nope').catch((e) => e as DockerError)
    expect(err).toBeInstanceOf(DockerError)
    expect(err.status).toBe(404)
    expect(err.message).toContain('nope')
  })

  test('surfaces the daemon error message', async () => {
    const { socketPath } = await fakeDaemon((_req, res) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'cannot restart container: boom' }))
    })

    const err = await new DockerClient({ socketPath }).restart('ddns-updater').catch((e) => e as DockerError)
    expect(err.status).toBe(500)
    expect(err.message).toBe('cannot restart container: boom')
  })

  test('explains how to fix a missing socket', async () => {
    const err = await new DockerClient({ socketPath: '/nonexistent/docker.sock' })
      .restart('ddns-updater')
      .catch((e) => e as DockerError)
    expect(err.code).toBe('ENOENT')
    expect(err.message).toContain('/var/run/docker.sock')
  })

  test('flags a socket proxy that blocks POST', async () => {
    const { socketPath } = await fakeDaemon((_req, res) => {
      res.writeHead(403).end()
    })

    const err = await new DockerClient({ socketPath }).restart('ddns-updater').catch((e) => e as DockerError)
    expect(err.status).toBe(403)
    expect(err.message).toContain('proxy')
  })
})

describe('DockerClient.inspect', () => {
  test('distills the container state', async () => {
    const { socketPath, calls } = await fakeDaemon((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({ State: { Status: 'running', Running: true, StartedAt: '2026-08-22T10:00:00Z' } }),
      )
    })

    const state = await new DockerClient({ socketPath }).inspect('ddns-updater')

    expect(calls[0]).toEqual({ method: 'GET', url: '/containers/ddns-updater/json' })
    expect(state).toEqual({ status: 'running', running: true, startedAt: '2026-08-22T10:00:00Z' })
  })
})

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConfigStore } from '../lib/configStore.js'
import statusRoutes from './status.js'

let dir: string
let configFile: string
let updatesFile: string
let app: FastifyInstance | undefined

async function build(): Promise<FastifyInstance> {
  const instance = Fastify()
  await instance.register(statusRoutes, { store: new ConfigStore(configFile), updatesPath: updatesFile })
  await instance.ready()
  return instance
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'status-'))
  configFile = path.join(dir, 'config.json')
  updatesFile = path.join(dir, 'updates.json')
})
afterEach(async () => {
  await app?.close()
  app = undefined
  await rm(dir, { recursive: true, force: true })
})

describe('GET /api/status', () => {
  test('merges config records with updates.json status', async () => {
    await writeFile(
      configFile,
      JSON.stringify({
        settings: [
          { provider: 'cloudflare', domain: 'home.example.com', zone_identifier: 'z', token: 't' },
          { provider: 'duckdns', domain: 'me.duckdns.org', token: 't' },
        ],
      }),
    )
    await writeFile(
      updatesFile,
      JSON.stringify({
        records: [{ domain: 'example.com', owner: 'home', ips: [{ ip: '9.9.9.9', time: '2026-05-29T12:00:00Z' }] }],
      }),
    )
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/status' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.records[0]).toMatchObject({ provider: 'cloudflare', currentIp: '9.9.9.9', hasData: true })
    expect(body.records[1]).toMatchObject({ provider: 'duckdns', hasData: false })
  })

  test('returns records without status when updates.json is missing', async () => {
    await writeFile(
      configFile,
      JSON.stringify({ settings: [{ provider: 'duckdns', domain: 'me.duckdns.org', token: 't' }] }),
    )
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json().records[0]).toMatchObject({ provider: 'duckdns', hasData: false })
  })
})

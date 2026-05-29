import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConfigStore } from '../lib/configStore.js'
import recordsRoutes, { SECRET_MASK } from './records.js'

let dir: string
let file: string
let app: FastifyInstance | undefined

async function build(): Promise<FastifyInstance> {
  const instance = Fastify()
  await instance.register(recordsRoutes, { store: new ConfigStore(file) })
  await instance.ready()
  return instance
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'records-'))
  file = path.join(dir, 'config.json')
})
afterEach(async () => {
  await app?.close()
  app = undefined
  await rm(dir, { recursive: true, force: true })
})

describe('GET /api/records', () => {
  test('returns records with secrets masked and an index', async () => {
    await writeFile(
      file,
      JSON.stringify({ settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 'supersecret' }] }),
    )
    app = await build()
    const res = await app.inject({ method: 'GET', url: '/api/records' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.records[0]).toMatchObject({ index: 0, provider: 'duckdns', domain: 'a.duckdns.org' })
    expect(body.records[0].token).toBe(SECRET_MASK)
    expect(body.records[0].rootDomain).toBe('duckdns.org')
  })
})

describe('POST /api/records', () => {
  test('adds a valid record, preserving existing records and top-level keys', async () => {
    await writeFile(
      file,
      JSON.stringify({
        settings: [{ provider: 'some-other', domain: 'keep.example.com', customField: 'x' }],
        topLevelKeep: 1,
      }),
    )
    app = await build()
    const res = await app.inject({
      method: 'POST',
      url: '/api/records',
      payload: { provider: 'duckdns', domain: 'a.duckdns.org', token: 't' },
    })
    expect(res.statusCode).toBe(201)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.settings).toHaveLength(2)
    expect(saved.settings[0]).toMatchObject({ provider: 'some-other', customField: 'x' })
    expect(saved.settings[1]).toMatchObject({ provider: 'duckdns', token: 't' })
    expect(saved.topLevelKeep).toBe(1)
  })

  test('rejects an invalid record with 400 and field errors', async () => {
    app = await build()
    const res = await app.inject({
      method: 'POST',
      url: '/api/records',
      payload: { provider: 'duckdns', domain: 'a.duckdns.org' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().errors.map((e: { field: string }) => e.field)).toContain('token')
  })
})

describe('PUT /api/records/:index', () => {
  test('edits an existing record', async () => {
    await writeFile(file, JSON.stringify({ settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 'old' }] }))
    app = await build()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/records/0',
      payload: { provider: 'duckdns', domain: 'b.duckdns.org', token: 'new' },
    })
    expect(res.statusCode).toBe(200)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.settings[0]).toMatchObject({ domain: 'b.duckdns.org', token: 'new' })
  })

  test('keeps the stored secret when the unchanged mask is submitted', async () => {
    await writeFile(file, JSON.stringify({ settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 'realsecret' }] }))
    app = await build()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/records/0',
      payload: { provider: 'duckdns', domain: 'a.duckdns.org', token: SECRET_MASK },
    })
    expect(res.statusCode).toBe(200)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.settings[0].token).toBe('realsecret')
  })

  test('returns 404 for an out-of-range index', async () => {
    app = await build()
    const res = await app.inject({
      method: 'PUT',
      url: '/api/records/5',
      payload: { provider: 'duckdns', domain: 'a.duckdns.org', token: 't' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/records/:index', () => {
  test('removes the record at the index', async () => {
    await writeFile(
      file,
      JSON.stringify({
        settings: [
          { provider: 'duckdns', domain: 'a.duckdns.org', token: 't' },
          { provider: 'noip', domain: 'b.com', username: 'u', password: 'p' },
        ],
      }),
    )
    app = await build()
    const res = await app.inject({ method: 'DELETE', url: '/api/records/0' })
    expect(res.statusCode).toBe(200)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.settings).toHaveLength(1)
    expect(saved.settings[0].provider).toBe('noip')
  })
})

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ConfigStore } from './configStore.js'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cfgstore-'))
  file = path.join(dir, 'config.json')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ConfigStore.read', () => {
  test('returns empty settings when the file does not exist', async () => {
    const store = new ConfigStore(file)
    const cfg = await store.read()
    expect(cfg).toEqual({ settings: [] })
  })

  test('parses an existing config file', async () => {
    await writeFile(
      file,
      JSON.stringify({ settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 't' }] }),
    )
    const cfg = await new ConfigStore(file).read()
    expect(cfg.settings).toHaveLength(1)
    expect(cfg.settings[0]).toMatchObject({ provider: 'duckdns', domain: 'a.duckdns.org', token: 't' })
  })

  test('throws a clear error on invalid JSON', async () => {
    await writeFile(file, '{ not valid json')
    await expect(new ConfigStore(file).read()).rejects.toThrow(/json|parse|invalid/i)
  })

  test('defaults settings to [] when missing but preserves other top-level keys', async () => {
    await writeFile(file, JSON.stringify({ somethingElse: 42 }))
    const cfg = await new ConfigStore(file).read()
    expect(cfg.settings).toEqual([])
    expect(cfg.somethingElse).toBe(42)
  })
})

describe('ConfigStore.write', () => {
  test('round-trips unknown top-level keys and provider-specific fields', async () => {
    const original = {
      settings: [
        {
          provider: 'cloudflare',
          domain: 'a.example.com',
          zone_identifier: 'z',
          token: 'tok',
          proxied: true,
          ttl: 600,
        },
        { provider: 'some-future-provider', domain: 'b.example.com', weirdField: ['x', 'y'] },
      ],
      unknownTopLevel: { nested: true },
    }
    await writeFile(file, JSON.stringify(original))
    const store = new ConfigStore(file)
    const read1 = await store.read()
    await store.write(read1)
    const read2 = await store.read()
    expect(read2).toEqual(original)
  })

  test('creates a .bak of the previous file before overwriting', async () => {
    const v1 = { settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 'one' }] }
    await writeFile(file, JSON.stringify(v1, null, 2))
    const store = new ConfigStore(file)
    await store.write({ settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 'two' }] })
    const bak = JSON.parse(await readFile(file + '.bak', 'utf8'))
    expect(bak).toEqual(v1)
    expect((await store.read()).settings[0]).toMatchObject({ token: 'two' })
  })

  test('writes human-readable indented JSON', async () => {
    const store = new ConfigStore(file)
    await store.write({ settings: [{ provider: 'duckdns', domain: 'a.duckdns.org', token: 't' }] })
    const raw = await readFile(file, 'utf8')
    expect(raw).toContain('\n  ')
  })
})

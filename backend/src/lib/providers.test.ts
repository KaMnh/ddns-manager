import { describe, test, expect } from 'vitest'
import { listProviders, getProviderSchema, IP_VERSIONS } from './providers.js'

describe('provider registry', () => {
  test('lists the supported providers', () => {
    const ids = listProviders().map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining(['cloudflare', 'duckdns', 'noip', 'godaddy', 'namecheap', 'porkbun']),
    )
  })

  test('cloudflare schema exposes zone_identifier and auth options', () => {
    const cf = getProviderSchema('cloudflare')
    expect(cf).toBeDefined()
    const names = cf!.fields.map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining(['zone_identifier', 'token', 'email', 'key', 'ttl', 'proxied']),
    )
    expect(cf!.authGroups?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  test('marks secret fields so they can be masked', () => {
    const token = getProviderSchema('cloudflare')!.fields.find((f) => f.name === 'token')
    expect(token?.secret).toBe(true)
  })

  test('returns undefined for an unknown provider', () => {
    expect(getProviderSchema('does-not-exist')).toBeUndefined()
  })

  test('IP_VERSIONS lists the three modes', () => {
    expect(IP_VERSIONS).toEqual(['ipv4', 'ipv6', 'ipv4 or ipv6'])
  })
})

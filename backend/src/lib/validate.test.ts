import { describe, test, expect } from 'vitest'
import { validateRecord } from './validate.js'
import { getProviderSchema } from './providers.js'

const cf = () => getProviderSchema('cloudflare')
const duck = () => getProviderSchema('duckdns')
const noip = () => getProviderSchema('noip')

describe('validateRecord — common fields', () => {
  test('requires a provider', () => {
    const errs = validateRecord({ provider: '', domain: 'a.com' })
    expect(errs.map((e) => e.field)).toContain('provider')
  })

  test('requires a domain', () => {
    const errs = validateRecord({ provider: 'duckdns', domain: '' }, duck())
    expect(errs.map((e) => e.field)).toContain('domain')
  })

  test('rejects an invalid ip_version', () => {
    const errs = validateRecord(
      { provider: 'duckdns', domain: 'a.duckdns.org', token: 't', ip_version: 'ipv9' },
      duck(),
    )
    expect(errs.map((e) => e.field)).toContain('ip_version')
  })

  test('accepts a record for an unknown provider (generic, no schema)', () => {
    expect(validateRecord({ provider: 'future', domain: 'a.com' })).toEqual([])
  })
})

describe('validateRecord — required provider fields', () => {
  test('duckdns requires a token', () => {
    expect(
      validateRecord({ provider: 'duckdns', domain: 'a.duckdns.org' }, duck()).map((e) => e.field),
    ).toContain('token')
    expect(validateRecord({ provider: 'duckdns', domain: 'a.duckdns.org', token: 't' }, duck())).toEqual([])
  })

  test('noip requires username and password', () => {
    const fields = validateRecord({ provider: 'noip', domain: 'a.com' }, noip()).map((e) => e.field)
    expect(fields).toEqual(expect.arrayContaining(['username', 'password']))
  })
})

describe('validateRecord — cloudflare auth groups', () => {
  test('zone_identifier is always required', () => {
    const errs = validateRecord({ provider: 'cloudflare', domain: 'a.com', token: 't' }, cf())
    expect(errs.map((e) => e.field)).toContain('zone_identifier')
  })

  test('accepts API-token auth', () => {
    const errs = validateRecord(
      { provider: 'cloudflare', domain: 'a.com', zone_identifier: 'z', token: 't' },
      cf(),
    )
    expect(errs).toEqual([])
  })

  test('rejects email without the global key', () => {
    const errs = validateRecord(
      { provider: 'cloudflare', domain: 'a.com', zone_identifier: 'z', email: 'e@x.com' },
      cf(),
    )
    expect(errs.map((e) => e.field)).toContain('auth')
  })

  test('accepts email + global key auth', () => {
    const errs = validateRecord(
      { provider: 'cloudflare', domain: 'a.com', zone_identifier: 'z', email: 'e@x.com', key: 'k' },
      cf(),
    )
    expect(errs).toEqual([])
  })
})

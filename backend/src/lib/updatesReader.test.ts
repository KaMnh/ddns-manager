import { describe, test, expect } from 'vitest'
import { parseUpdates, mergeStatus } from './updatesReader.js'

describe('parseUpdates', () => {
  test('returns empty for missing/invalid input', () => {
    expect(parseUpdates(null)).toEqual([])
    expect(parseUpdates({})).toEqual([])
    expect(parseUpdates({ records: 'nope' })).toEqual([])
  })

  test('extracts current IP and last-update from the latest event', () => {
    const raw = {
      records: [
        {
          domain: 'example.com',
          owner: 'home',
          ips: [
            { ip: '1.2.3.4', time: '2026-05-20T10:00:00Z' },
            { ip: '1.2.3.5', time: '2026-05-29T12:00:00Z' },
          ],
        },
      ],
    }
    const [r] = parseUpdates(raw)
    expect(r).toMatchObject({
      host: 'home.example.com',
      currentIp: '1.2.3.5',
      lastUpdate: '2026-05-29T12:00:00Z',
      count: 2,
    })
  })

  test('uses the domain as host when owner is "@" or empty', () => {
    expect(parseUpdates({ records: [{ domain: 'example.com', owner: '@', ips: [] }] })[0]!.host).toBe('example.com')
    expect(parseUpdates({ records: [{ domain: 'example.com', owner: '', ips: [] }] })[0]!.host).toBe('example.com')
  })

  test('handles records with no events', () => {
    const [r] = parseUpdates({ records: [{ domain: 'x.com', owner: '@', ips: [] }] })
    expect(r!.currentIp).toBeUndefined()
    expect(r!.count).toBe(0)
  })
})

describe('mergeStatus', () => {
  const config = [
    { provider: 'cloudflare', domain: 'home.example.com' },
    { provider: 'duckdns', domain: 'me.duckdns.org' },
  ]

  test('left-joins config records with their update status', () => {
    const updates = [
      {
        host: 'home.example.com',
        domain: 'example.com',
        owner: 'home',
        currentIp: '1.2.3.5',
        lastUpdate: '2026-05-29T12:00:00Z',
        count: 2,
      },
    ]
    const merged = mergeStatus(config, updates)
    expect(merged[0]).toMatchObject({ index: 0, provider: 'cloudflare', currentIp: '1.2.3.5', hasData: true })
    expect(merged[1]).toMatchObject({ index: 1, provider: 'duckdns', hasData: false })
  })
})

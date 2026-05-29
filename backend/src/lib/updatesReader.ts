import type { DdnsRecord } from './configStore.js'
import { splitDomains } from './domain.js'

/** Per-record status distilled from ddns-updater's updates.json. */
export interface UpdateRecordStatus {
  /** full host, reconstructed from owner + domain (best-effort match key) */
  host: string
  domain: string
  owner?: string
  currentIp?: string
  lastUpdate?: string
  count: number
}

/** A config record joined with its latest status. */
export interface MergedStatus {
  index: number
  provider: string
  domain: string
  ip_version?: string
  currentIp?: string
  lastUpdate?: string
  hasData: boolean
}

/**
 * Parses updates.json. The on-disk shape is
 *   { records: [ { domain, owner, host?, ips: [ { ip, time } ] } ] }
 * The latest event (by time) gives the current IP and last-update time.
 */
export function parseUpdates(raw: unknown): UpdateRecordStatus[] {
  const records = (raw as { records?: unknown } | null)?.records
  if (!Array.isArray(records)) return []

  return records.map((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const domain = typeof rec.domain === 'string' ? rec.domain : ''
    const owner =
      typeof rec.owner === 'string' ? rec.owner : typeof rec.host === 'string' ? rec.host : ''
    const events = Array.isArray(rec.ips) ? (rec.ips as Array<Record<string, unknown>>) : []

    let latest: Record<string, unknown> | undefined
    for (const e of events) {
      if (!latest || new Date(String(e?.time)).getTime() > new Date(String(latest.time)).getTime()) {
        latest = e
      }
    }

    return {
      host: owner && owner !== '@' ? `${owner}.${domain}` : domain,
      domain,
      owner: owner || undefined,
      currentIp: latest && typeof latest.ip === 'string' ? latest.ip : undefined,
      lastUpdate: latest && typeof latest.time === 'string' ? latest.time : undefined,
      count: events.length,
    }
  })
}

/**
 * Left-joins config records with parsed update status, matching on host/domain.
 * A config record whose `domain` is a comma-separated list is expanded into one
 * status row per domain (ddns-updater stores them as separate records), so each
 * gets its own correct status instead of one unmatchable "pending" row.
 */
export function mergeStatus(records: DdnsRecord[], updates: UpdateRecordStatus[]): MergedStatus[] {
  const out: MergedStatus[] = []
  records.forEach((r, index) => {
    const provider = String(r.provider)
    const ip_version = typeof r.ip_version === 'string' ? r.ip_version : undefined
    for (const domain of splitDomains(String(r.domain))) {
      const match = updates.find((u) => u.host === domain || u.domain === domain)
      out.push({
        index,
        provider,
        domain,
        ip_version,
        currentIp: match?.currentIp,
        lastUpdate: match?.lastUpdate,
        hasData: Boolean(match?.currentIp),
      })
    }
  })
  return out
}

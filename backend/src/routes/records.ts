import type { FastifyPluginAsync } from 'fastify'
import { ConfigStore, type DdnsRecord } from '../lib/configStore.js'
import { getProviderSchema, secretFieldNames } from '../lib/providers.js'
import { validateRecord } from '../lib/validate.js'

/** Sentinel returned in place of secret values. The frontend shows it; if it
 *  comes back unchanged on save we keep the stored secret. */
export const SECRET_MASK = '••••••••'

export interface RecordsOptions {
  store: ConfigStore
}

/** Returns a copy with non-empty secret string fields replaced by the mask. */
export function maskRecord(record: DdnsRecord, secrets: Set<string>): DdnsRecord {
  const out: DdnsRecord = { ...record }
  for (const key of Object.keys(out)) {
    if (secrets.has(key) && typeof out[key] === 'string' && out[key] !== '') {
      out[key] = SECRET_MASK
    }
  }
  return out
}

/** Replaces any secret field still holding the mask with the previously stored
 *  value — so editing without revealing a secret never clobbers it. */
function unmaskSecrets(incoming: DdnsRecord, existing: DdnsRecord, secrets: Set<string>): DdnsRecord {
  const out: DdnsRecord = { ...incoming }
  for (const key of Object.keys(out)) {
    if (secrets.has(key) && out[key] === SECRET_MASK) {
      out[key] = existing[key]
    }
  }
  return out
}

function parseIndex(raw: unknown): number {
  return Number((raw as string) ?? NaN)
}

const recordsRoutes: FastifyPluginAsync<RecordsOptions> = async (app, opts) => {
  const { store } = opts
  const secrets = secretFieldNames()

  app.get('/api/records', async () => {
    const cfg = await store.read()
    return { records: cfg.settings.map((r, index) => ({ index, ...maskRecord(r, secrets) })) }
  })

  app.post('/api/records', async (req, reply) => {
    const record = (req.body ?? {}) as DdnsRecord
    const errors = validateRecord(record, getProviderSchema(String(record.provider)))
    if (errors.length > 0) return reply.code(400).send({ errors })

    const cfg = await store.read()
    cfg.settings.push(record)
    await store.write(cfg)
    return reply.code(201).send({ index: cfg.settings.length - 1 })
  })

  app.put('/api/records/:index', async (req, reply) => {
    const index = parseIndex((req.params as { index: string }).index)
    const cfg = await store.read()
    if (!Number.isInteger(index) || index < 0 || index >= cfg.settings.length) {
      return reply.code(404).send({ error: 'Record not found' })
    }

    const existing = cfg.settings[index]!
    const merged = unmaskSecrets((req.body ?? {}) as DdnsRecord, existing, secrets)
    const errors = validateRecord(merged, getProviderSchema(String(merged.provider)))
    if (errors.length > 0) return reply.code(400).send({ errors })

    cfg.settings[index] = merged
    await store.write(cfg)
    return { index }
  })

  app.delete('/api/records/:index', async (req, reply) => {
    const index = parseIndex((req.params as { index: string }).index)
    const cfg = await store.read()
    if (!Number.isInteger(index) || index < 0 || index >= cfg.settings.length) {
      return reply.code(404).send({ error: 'Record not found' })
    }

    cfg.settings.splice(index, 1)
    await store.write(cfg)
    return { ok: true }
  })
}

export default recordsRoutes

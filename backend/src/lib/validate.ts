import type { DdnsRecord } from './configStore.js'
import { IP_VERSIONS, type ProviderSchema } from './providers.js'

export interface ValidationError {
  field: string
  message: string
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

/**
 * Validates a record against the common fields and, when a schema is supplied,
 * the provider-specific requirements. Returns an empty array when valid.
 *
 * Auth groups model "provide ONE of these credential sets" (e.g. Cloudflare:
 * API token, OR email+global key, OR user service key).
 */
export function validateRecord(record: DdnsRecord, schema?: ProviderSchema): ValidationError[] {
  const errors: ValidationError[] = []

  if (isBlank(record.provider)) errors.push({ field: 'provider', message: 'Provider is required' })
  if (isBlank(record.domain)) errors.push({ field: 'domain', message: 'Domain is required' })

  if (!isBlank(record.ip_version) && !(IP_VERSIONS as readonly string[]).includes(record.ip_version as string)) {
    errors.push({
      field: 'ip_version',
      message: `ip_version must be one of: ${IP_VERSIONS.join(', ')}`,
    })
  }

  if (schema) {
    // Fields that belong to an auth group are checked via the group, not individually.
    const authFields = new Set((schema.authGroups ?? []).flatMap((g) => g.fields))

    for (const f of schema.fields) {
      if (f.required && !authFields.has(f.name) && isBlank(record[f.name])) {
        errors.push({ field: f.name, message: `${f.label} is required` })
      }
    }

    if (schema.authGroups && schema.authGroups.length > 0) {
      const satisfied = schema.authGroups.some((g) => g.fields.every((name) => !isBlank(record[name])))
      if (!satisfied) {
        const options = schema.authGroups.map((g) => g.label).join(' OR ')
        errors.push({ field: 'auth', message: `Provide credentials: ${options}` })
      }
    }
  }

  return errors
}

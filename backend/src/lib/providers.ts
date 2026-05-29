/**
 * Declarative provider schemas — the single source of truth for which fields a
 * record needs. Served to the frontend via GET /api/providers so the dynamic
 * form and the backend validation always agree.
 *
 * Only a handful of popular providers are modelled in detail; any other
 * provider still works through the generic key/value path (no schema => only
 * the common fields are required).
 */

export const IP_VERSIONS = ['ipv4', 'ipv6', 'ipv4 or ipv6'] as const
export type IpVersion = (typeof IP_VERSIONS)[number]

export type FieldType = 'text' | 'password' | 'number' | 'boolean' | 'select'

export interface ProviderField {
  /** JSON key written into the record */
  name: string
  label: string
  type: FieldType
  required?: boolean
  /** mask this value in API responses (tokens, passwords, keys) */
  secret?: boolean
  help?: string
  placeholder?: string
  /** options for select fields */
  options?: readonly string[]
}

export interface AuthGroup {
  label: string
  /** all of these field names must be present for the group to be satisfied */
  fields: string[]
}

export interface ProviderSchema {
  id: string
  label: string
  docsUrl?: string
  /** provider-specific fields, in display order (beyond the common fields) */
  fields: ProviderField[]
  /** if set, at least one group's fields must all be present */
  authGroups?: AuthGroup[]
}

const DOCS = (file: string) =>
  `https://github.com/qdm12/ddns-updater/blob/master/docs/${file}`

/** Fields shared by every provider, rendered above the provider-specific ones. */
export const COMMON_FIELDS: ProviderField[] = [
  {
    name: 'domain',
    label: 'Domain',
    type: 'text',
    required: true,
    placeholder: 'home.example.com',
    help: 'Full record — e.g. home.example.com, example.com, or *.example.com',
  },
  {
    name: 'ip_version',
    label: 'IP version',
    type: 'select',
    options: IP_VERSIONS,
    help: 'Which record type(s) to update',
  },
  {
    name: 'ipv6_suffix',
    label: 'IPv6 suffix',
    type: 'text',
    placeholder: '0:0:0:0:72ad:8fbb:a54e:bedd/64',
    help: 'Optional IPv6 interface identifier',
  },
]

const PROVIDERS: ProviderSchema[] = [
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    docsUrl: DOCS('cloudflare.md'),
    fields: [
      {
        name: 'zone_identifier',
        label: 'Zone ID',
        type: 'text',
        required: true,
        help: 'Zone ID from the domain overview page',
      },
      { name: 'token', label: 'API Token', type: 'password', secret: true, help: 'Token with DNS edit permission' },
      { name: 'email', label: 'Account email', type: 'text' },
      { name: 'key', label: 'Global API Key', type: 'password', secret: true },
      { name: 'user_service_key', label: 'User service key', type: 'password', secret: true },
      { name: 'ttl', label: 'TTL (seconds)', type: 'number', placeholder: '600', help: '1 = automatic' },
      { name: 'proxied', label: 'Proxied (orange cloud)', type: 'boolean' },
    ],
    authGroups: [
      { label: 'API Token', fields: ['token'] },
      { label: 'Email + Global API Key', fields: ['email', 'key'] },
      { label: 'User service key', fields: ['user_service_key'] },
    ],
  },
  {
    id: 'duckdns',
    label: 'DuckDNS',
    docsUrl: DOCS('duckdns.md'),
    fields: [
      { name: 'token', label: 'Token', type: 'password', required: true, secret: true },
    ],
  },
  {
    id: 'noip',
    label: 'No-IP',
    docsUrl: DOCS('noip.md'),
    fields: [
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true, secret: true },
    ],
  },
  {
    id: 'godaddy',
    label: 'GoDaddy',
    docsUrl: DOCS('godaddy.md'),
    fields: [
      { name: 'key', label: 'API Key', type: 'password', required: true, secret: true },
      { name: 'secret', label: 'API Secret', type: 'password', required: true, secret: true },
    ],
  },
  {
    id: 'namecheap',
    label: 'Namecheap',
    docsUrl: DOCS('namecheap.md'),
    fields: [
      {
        name: 'password',
        label: 'DDNS Password',
        type: 'password',
        required: true,
        secret: true,
        help: 'Dynamic DNS password from Namecheap (IPv4 only)',
      },
    ],
  },
  {
    id: 'porkbun',
    label: 'Porkbun',
    docsUrl: DOCS('porkbun.md'),
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true, secret: true },
      { name: 'secret_api_key', label: 'Secret API Key', type: 'password', required: true, secret: true },
      { name: 'ttl', label: 'TTL (seconds)', type: 'number' },
    ],
  },
]

export function listProviders(): ProviderSchema[] {
  return PROVIDERS
}

export function getProviderSchema(id: string): ProviderSchema | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

/** Names of every secret field across all providers — used for masking. */
export function secretFieldNames(): Set<string> {
  const names = new Set<string>()
  for (const p of PROVIDERS) {
    for (const f of p.fields) if (f.secret) names.add(f.name)
  }
  return names
}

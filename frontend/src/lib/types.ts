export type FieldType = 'text' | 'password' | 'number' | 'boolean' | 'select'

export interface ProviderField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  secret?: boolean
  help?: string
  placeholder?: string
  options?: string[]
}

export interface AuthGroup {
  label: string
  fields: string[]
}

export interface ProviderSchema {
  id: string
  label: string
  docsUrl?: string
  fields: ProviderField[]
  authGroups?: AuthGroup[]
}

export interface ProvidersResponse {
  common: ProviderField[]
  providers: ProviderSchema[]
}

/** A record as returned by GET /api/records (secrets masked). */
export interface RecordRow {
  index: number
  provider: string
  domain: string
  [key: string]: unknown
}

/** A record joined with status from GET /api/status. */
export interface StatusRow {
  index: number
  provider: string
  domain: string
  ip_version?: string
  currentIp?: string
  lastUpdate?: string
  hasData: boolean
}

export interface ValidationError {
  field: string
  message: string
}

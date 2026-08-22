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
  rootDomain?: string
  [key: string]: unknown
}

/** A record joined with status from GET /api/status. */
export interface StatusRow {
  index: number
  provider: string
  domain: string
  rootDomain?: string
  ip_version?: string
  currentIp?: string
  lastUpdate?: string
  hasData: boolean
}

export interface ValidationError {
  field: string
  message: string
}

/** Whether the GUI can restart ddns-updater itself (GET /api/restart). */
export interface RestartInfo {
  available: boolean
  /** Container the backend is configured to restart. */
  container: string
  /** Docker endpoint in use, e.g. unix:///var/run/docker.sock. */
  target: string
  /** Why restarting is unavailable — shown to the user so they can fix it. */
  reason?: string
  state?: { status?: string; running?: boolean; startedAt?: string }
}

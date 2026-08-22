import type { ProvidersResponse, RecordRow, RestartInfo, StatusRow, ValidationError } from './types'

async function req(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export interface MutationResult {
  ok: boolean
  errors?: ValidationError[]
  message?: string
}

export const api = {
  async getProviders(): Promise<ProvidersResponse> {
    return (await req('GET', '/api/providers')).data as ProvidersResponse
  },

  async getRecords(): Promise<RecordRow[]> {
    return ((await req('GET', '/api/records')).data.records ?? []) as RecordRow[]
  },

  async getStatus(): Promise<StatusRow[]> {
    return ((await req('GET', '/api/status')).data.records ?? []) as StatusRow[]
  },

  async createRecord(record: Record<string, unknown>): Promise<MutationResult> {
    const r = await req('POST', '/api/records', record)
    return r.ok ? { ok: true } : { ok: false, errors: r.data.errors, message: r.data.error }
  },

  async updateRecord(index: number, record: Record<string, unknown>): Promise<MutationResult> {
    const r = await req('PUT', `/api/records/${index}`, record)
    return r.ok ? { ok: true } : { ok: false, errors: r.data.errors, message: r.data.error }
  },

  async deleteRecord(index: number): Promise<MutationResult> {
    const r = await req('DELETE', `/api/records/${index}`)
    return { ok: r.ok, message: r.data.error }
  },

  async refresh(): Promise<{ ok: boolean; message: string }> {
    const r = await req('POST', '/api/refresh')
    return { ok: Boolean(r.data.ok), message: r.data.message ?? (r.ok ? 'Triggered' : 'Failed') }
  },

  async getRestartInfo(): Promise<RestartInfo> {
    const r = await req('GET', '/api/restart')
    return {
      available: Boolean(r.data.available),
      container: r.data.container ?? 'ddns-updater',
      target: r.data.target ?? '',
      reason: r.data.reason,
      state: r.data.state,
    }
  },

  /** Restarts ddns-updater so config.json changes take effect. Can take ~10s. */
  async restart(): Promise<{ ok: boolean; message: string }> {
    const r = await req('POST', '/api/restart')
    return { ok: Boolean(r.data.ok), message: r.data.message ?? (r.ok ? 'Restarted' : 'Restart failed') }
  },
}

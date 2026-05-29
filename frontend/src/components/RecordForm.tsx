import { useMemo, useState, type FormEvent } from 'react'
import type { ProviderField, ProviderSchema, ProvidersResponse, RecordRow, ValidationError } from '../lib/types'
import type { MutationResult } from '../lib/api'
import { Button } from './ui'
import { IconEye, IconEyeOff, IconExternal, IconX } from './icons'

const SECRET_MASK = '••••••••'
const INPUT =
  'w-full rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-accent/60 focus:bg-ink-950'

type Values = Record<string, unknown>

function initValues(initial: RecordRow | null, providers: ProvidersResponse): Values {
  if (!initial) return { provider: providers.providers[0]?.id ?? '', ip_version: '' }
  const out: Values = {}
  for (const [k, v] of Object.entries(initial)) {
    if (k === 'index') continue
    out[k] = typeof v === 'boolean' ? v : v == null ? '' : String(v)
  }
  if (out.ip_version === undefined) out.ip_version = ''
  return out
}

function initAuthMethod(values: Values, schema?: ProviderSchema): number {
  if (!schema?.authGroups) return 0
  const idx = schema.authGroups.findIndex((g) => g.fields.every((f) => String(values[f] ?? '') !== ''))
  return idx >= 0 ? idx : 0
}

export function RecordForm({
  providers,
  initial,
  onClose,
  onSubmit,
}: {
  providers: ProvidersResponse
  initial: RecordRow | null
  onClose: () => void
  onSubmit: (record: Record<string, unknown>) => Promise<MutationResult>
}) {
  const [values, setValues] = useState<Values>(() => initValues(initial, providers))
  const provider = String(values.provider ?? '')
  const schema = useMemo(() => providers.providers.find((p) => p.id === provider), [providers, provider])
  const [authMethod, setAuthMethod] = useState<number>(() => initAuthMethod(values, schema))
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [submitting, setSubmitting] = useState(false)

  const editing = initial !== null
  const commonNames = useMemo(() => new Set(providers.common.map((f) => f.name)), [providers])

  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }))
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message
  const toggleReveal = (name: string) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // provider-specific fields, split into "always shown" vs auth-group fields
  const authFieldNames = useMemo(
    () => new Set((schema?.authGroups ?? []).flatMap((g) => g.fields)),
    [schema],
  )
  const plainFields = (schema?.fields ?? []).filter((f) => !authFieldNames.has(f.name))
  const activeGroup = schema?.authGroups?.[authMethod]

  // generic extra fields when the provider has no schema (don't lose them)
  const genericFields = !schema
    ? Object.keys(values).filter((k) => k !== 'provider' && !commonNames.has(k))
    : []

  function buildPayload(): Record<string, unknown> {
    const out: Record<string, unknown> = { provider }
    for (const f of providers.common) {
      const v = values[f.name]
      if (v !== undefined && v !== '') out[f.name] = v
    }
    if (schema) {
      for (const f of plainFields) {
        const v = values[f.name]
        if (f.type === 'boolean') {
          if (v) out[f.name] = true
        } else if (v !== undefined && v !== '') {
          out[f.name] = f.type === 'number' ? Number(v) : v
        }
      }
      for (const name of activeGroup?.fields ?? []) {
        const v = values[name]
        if (v !== undefined && v !== '') out[name] = v
      }
    } else {
      for (const k of genericFields) {
        const v = values[k]
        if (v !== undefined && v !== '') out[k] = v
      }
    }
    return out
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const result = await onSubmit(buildPayload())
    setSubmitting(false)
    if (!result.ok) setErrors(result.errors ?? [{ field: '', message: result.message ?? 'Save failed' }])
  }

  function renderField(field: ProviderField) {
    const id = `f-${field.name}`
    const err = errorFor(field.name)
    const value = values[field.name]

    let control
    if (field.type === 'boolean') {
      control = (
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={Boolean(value)}
          onClick={() => set(field.name, !value)}
          className={`relative h-6 w-11 rounded-full border transition-colors ${
            value ? 'border-accent/60 bg-accent/30' : 'border-line bg-ink-950'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
              value ? 'left-[22px] bg-accent' : 'left-0.5 bg-fg-faint'
            }`}
          />
        </button>
      )
    } else if (field.type === 'select') {
      control = (
        <select id={id} className={INPUT} value={String(value ?? '')} onChange={(e) => set(field.name, e.target.value)}>
          {field.name === 'ip_version' && <option value="">Default (ipv4 or ipv6)</option>}
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    } else if (field.secret) {
      const show = revealed.has(field.name)
      control = (
        <div className="relative">
          <input
            id={id}
            type={show ? 'text' : 'password'}
            className={`${INPUT} pr-10`}
            placeholder={field.placeholder}
            value={String(value ?? '')}
            onChange={(e) => set(field.name, e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => toggleReveal(field.name)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"
            title={show ? 'Hide' : 'Show'}
          >
            {show ? <IconEyeOff width={16} height={16} /> : <IconEye width={16} height={16} />}
          </button>
        </div>
      )
    } else {
      control = (
        <input
          id={id}
          type={field.type === 'number' ? 'number' : 'text'}
          className={INPUT}
          placeholder={field.placeholder}
          value={String(value ?? '')}
          onChange={(e) => set(field.name, e.target.value)}
        />
      )
    }

    return (
      <div key={field.name} className="space-y-1.5">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-fg-dim">
          {field.label}
          {field.required && <span className="text-accent">*</span>}
        </label>
        {control}
        {field.help && <p className="text-xs text-fg-faint">{field.help}</p>}
        {field.secret && editing && String(value ?? '') === SECRET_MASK && (
          <p className="text-xs text-fg-faint">Masked — leave as is to keep the current value.</p>
        )}
        {err && <p className="text-xs text-down">{err}</p>}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
        style={{ animation: 'rise 0.2s ease-out' }}
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative flex h-full w-full max-w-md flex-col border-l border-line-bright bg-surface shadow-2xl"
        style={{ animation: 'slideIn 0.28s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="font-mono text-lg text-fg">{editing ? 'Edit record' : 'Add record'}</h2>
            <p className="mt-0.5 text-xs text-fg-dim">Writes to ddns-updater config.json</p>
          </div>
          <button type="button" onClick={onClose} className="text-fg-faint hover:text-fg" aria-label="Close">
            <IconX />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* provider */}
          <div className="space-y-1.5">
            <label htmlFor="f-provider" className="text-xs font-medium uppercase tracking-wider text-fg-dim">
              Provider <span className="text-accent">*</span>
            </label>
            <select
              id="f-provider"
              className={INPUT}
              value={provider}
              onChange={(e) => {
                set('provider', e.target.value)
                setAuthMethod(0)
              }}
            >
              {!providers.providers.some((p) => p.id === provider) && provider && (
                <option value={provider}>{provider} (custom)</option>
              )}
              {providers.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {schema?.docsUrl && (
              <a
                href={schema.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-fg-faint hover:text-accent"
              >
                {schema.label} setup docs <IconExternal width={12} height={12} />
              </a>
            )}
            {errorFor('provider') && <p className="text-xs text-down">{errorFor('provider')}</p>}
          </div>

          {/* common fields */}
          {providers.common.map(renderField)}

          {/* provider-specific */}
          {plainFields.length > 0 && (
            <div className="space-y-5 border-t border-line pt-5">
              {plainFields.map(renderField)}
            </div>
          )}

          {/* auth method selector */}
          {schema?.authGroups && (
            <div className="space-y-3 border-t border-line pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-fg-dim">Authentication</p>
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-ink-950/60 p-1">
                {schema.authGroups.map((g, i) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setAuthMethod(i)}
                    className={`flex-1 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      authMethod === i ? 'bg-accent/20 text-accent' : 'text-fg-dim hover:text-fg'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {(activeGroup?.fields ?? []).map((name) => {
                const f = schema.fields.find((x) => x.name === name)
                return f ? renderField(f) : null
              })}
              {errorFor('auth') && <p className="text-xs text-down">{errorFor('auth')}</p>}
            </div>
          )}

          {/* generic provider extra fields */}
          {genericFields.length > 0 && (
            <div className="space-y-5 border-t border-line pt-5">
              <p className="text-xs text-fg-faint">Custom provider — editing raw fields.</p>
              {genericFields.map((name) =>
                renderField({ name, label: name, type: 'text' }),
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {editing ? 'Save changes' : 'Add record'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

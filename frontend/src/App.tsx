import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import type { ProvidersResponse, RecordRow, RestartInfo, StatusRow } from './lib/types'
import { Button, StatusDot } from './components/ui'
import { DashboardView } from './components/DashboardView'
import { RecordsView } from './components/RecordsView'
import { RecordForm } from './components/RecordForm'
import { RestartBanner } from './components/RestartBanner'
import { IconRefresh, IconPower, IconServer } from './components/icons'

type Tab = 'dashboard' | 'records'
type Toast = { kind: 'ok' | 'err'; msg: string } | null

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [providers, setProviders] = useState<ProvidersResponse | null>(null)
  const [statusRows, setStatusRows] = useState<StatusRow[]>([])
  const [recordRows, setRecordRows] = useState<RecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [restartInfo, setRestartInfo] = useState<RestartInfo | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [form, setForm] = useState<{ open: boolean; record: RecordRow | null }>({ open: false, record: null })

  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [status, records] = await Promise.all([api.getStatus(), api.getRecords()])
      setStatusRows(status)
      setRecordRows(records)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRestartInfo = useCallback(async () => {
    setRestartInfo(await api.getRestartInfo().catch(() => null))
  }, [])

  useEffect(() => {
    api.getProviders().then(setProviders).catch(() => showToast('err', 'Could not load provider schemas'))
    reload().catch(() => showToast('err', 'Could not load records'))
    loadRestartInfo()
  }, [reload, showToast, loadRestartInfo])

  const onForceRefresh = async () => {
    setRefreshing(true)
    const r = await api.refresh()
    setRefreshing(false)
    showToast(r.ok ? 'ok' : 'err', r.message)
    if (r.ok) reload()
  }

  // Restarting is what actually applies config.json changes — ddns-updater
  // reads its records only at startup.
  const onRestart = async () => {
    setRestarting(true)
    const r = await api.restart()
    setRestarting(false)
    showToast(r.ok ? 'ok' : 'err', r.message)
    loadRestartInfo()
    if (r.ok) {
      setDirty(false)
      reload()
      // ddns-updater rewrites updates.json a moment after it comes back up.
      window.setTimeout(() => reload(), 4000)
    }
  }

  const submitRecord = async (record: Record<string, unknown>) => {
    const editing = form.record
    const result = editing ? await api.updateRecord(editing.index, record) : await api.createRecord(record)
    if (result.ok) {
      setForm({ open: false, record: null })
      setDirty(true)
      showToast('ok', editing ? 'Record updated' : 'Record added')
      reload()
    }
    return result
  }

  const onDelete = async (index: number) => {
    const r = await api.deleteRecord(index)
    if (r.ok) {
      setDirty(true)
      showToast('ok', 'Record removed')
      reload()
    } else {
      showToast('err', r.message ?? 'Delete failed')
    }
  }

  const onlineCount = statusRows.filter((r) => r.hasData).length
  const total = statusRows.length

  return (
    <div className="relative min-h-screen bg-grid">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_10%,transparent),transparent)]" />

      <div className="relative mx-auto max-w-5xl px-5 pb-24">
        {/* header */}
        <header className="flex flex-col gap-5 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-accent">
              <IconServer width={20} height={20} />
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-fg-dim">ddns-updater</span>
            </div>
            <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight text-fg">
              DDNS<span className="text-accent">::</span>Manager
              <span className="cursor-blink ml-1 inline-block h-6 w-2.5 translate-y-0.5 bg-accent align-middle" />
            </h1>
            <p className="mt-1 text-sm text-fg-dim">Configure records &amp; watch status — backed by config.json</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-fg-dim sm:flex">
              <StatusDot kind={total && onlineCount === total ? 'online' : total ? 'warn' : 'idle'} />
              {total ? `${onlineCount}/${total} online` : 'no records'}
            </span>
            <Button variant="ghost" onClick={onForceRefresh} loading={refreshing} title="Trigger ddns-updater GET /update">
              {!refreshing && <IconRefresh width={16} height={16} />} Force refresh
            </Button>
            <Button
              variant={dirty && restartInfo?.available ? 'primary' : 'ghost'}
              onClick={onRestart}
              loading={restarting}
              disabled={!restartInfo?.available}
              title={
                restartInfo?.available
                  ? `Restart ${restartInfo.container} to apply config.json changes`
                  : `One-click restart unavailable: ${restartInfo?.reason ?? 'checking…'}`
              }
            >
              {!restarting && <IconPower width={16} height={16} />} Restart
            </Button>
          </div>
        </header>

        {/* tabs */}
        <nav className="mb-6 flex gap-1 border-b border-line">
          {(['dashboard', 'records'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors ${
                tab === t ? 'text-fg' : 'text-fg-faint hover:text-fg-dim'
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent shadow-[0_0_10px_var(--color-accent)]" />
              )}
            </button>
          ))}
        </nav>

        {/* dirty / restart banner */}
        {dirty && (
          <RestartBanner
            info={restartInfo}
            restarting={restarting}
            onRestart={onRestart}
            onDismiss={() => setDirty(false)}
          />
        )}

        {/* views */}
        {tab === 'dashboard' ? (
          <DashboardView rows={statusRows} loading={loading} onAdd={() => setForm({ open: true, record: null })} />
        ) : (
          <RecordsView
            rows={recordRows}
            loading={loading}
            onAdd={() => setForm({ open: true, record: null })}
            onEdit={(record) => setForm({ open: true, record })}
            onDelete={onDelete}
          />
        )}
      </div>

      {/* slide-in form */}
      {form.open && providers && (
        <RecordForm
          providers={providers}
          initial={form.record}
          onClose={() => setForm({ open: false, record: null })}
          onSubmit={submitRecord}
        />
      )}

      {/* toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border bg-surface px-4 py-2.5 text-sm text-fg shadow-xl ${
            toast.kind === 'ok' ? 'border-accent/40' : 'border-down/40'
          }`}
          style={{ animation: 'rise 0.25s ease-out' }}
        >
          <span className="inline-flex items-center gap-2">
            <StatusDot kind={toast.kind === 'ok' ? 'online' : 'error'} />
            {toast.msg}
          </span>
        </div>
      )}
    </div>
  )
}

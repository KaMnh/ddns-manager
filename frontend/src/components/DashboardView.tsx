import { useState } from 'react'
import type { StatusRow } from '../lib/types'
import { relativeTime, fullTime } from '../lib/format'
import { Button, ProviderBadge, StatusDot, Spinner } from './ui'
import { IconPlus, IconCopy, IconCheck } from './icons'

function CopyableIp({ ip }: { ip?: string }) {
  const [copied, setCopied] = useState(false)
  if (!ip) return <span className="text-fg-faint">—</span>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      onClick={copy}
      title="Copy IP"
      className="group inline-flex items-center gap-2 font-mono text-fg transition-colors hover:text-accent"
    >
      {ip}
      <span className="text-fg-faint opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
      </span>
    </button>
  )
}

export function DashboardView({
  rows,
  loading,
  onAdd,
}: {
  rows: StatusRow[]
  loading: boolean
  onAdd: () => void
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-fg-dim">
        <Spinner /> Loading records…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-bright bg-surface/40 px-8 py-20 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-2 text-fg-faint">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
        </div>
        <h3 className="font-mono text-lg text-fg">No records configured</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-dim">
          Add your first DNS record and DDNS Manager will write it to ddns-updater&apos;s{' '}
          <code className="font-mono text-fg-dim">config.json</code>.
        </p>
        <Button variant="primary" className="mt-6" onClick={onAdd}>
          <IconPlus width={16} height={16} /> Add record
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface/60">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-[0.16em] text-fg-faint">
            <th className="px-5 py-3.5 font-medium">Status</th>
            <th className="px-5 py-3.5 font-medium">Provider</th>
            <th className="px-5 py-3.5 font-medium">Domain</th>
            <th className="px-5 py-3.5 font-medium">Current IP</th>
            <th className="px-5 py-3.5 font-medium">Last update</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const online = row.hasData
            return (
              <tr
                key={`${row.domain}-${row.index}`}
                className="border-b border-line/60 opacity-0 transition-colors last:border-0 hover:bg-surface-2/60"
                style={{ animation: 'rise 0.4s ease-out forwards', animationDelay: `${i * 45}ms` }}
              >
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-2.5">
                    <StatusDot kind={online ? 'online' : 'pending'} pulse={!online} />
                    <span className={`text-xs ${online ? 'text-accent' : 'text-info'}`}>
                      {online ? 'online' : 'pending'}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-4">
                  <ProviderBadge provider={row.provider} />
                </td>
                <td className="px-5 py-4 font-mono text-sm text-fg">{row.domain}</td>
                <td className="px-5 py-4 text-sm">
                  <CopyableIp ip={row.currentIp} />
                </td>
                <td className="px-5 py-4 text-sm text-fg-dim" title={fullTime(row.lastUpdate)}>
                  {relativeTime(row.lastUpdate)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

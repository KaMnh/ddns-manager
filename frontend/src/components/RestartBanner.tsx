import { useState } from 'react'
import type { RestartInfo } from '../lib/types'
import { Button } from './ui'
import { IconWarning, IconX, IconPower, IconCopy, IconCheck } from './icons'

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      onClick={copy}
      title="Copy command"
      className="group mt-2 inline-flex items-center gap-2 rounded-md border border-line bg-ink-950/60 px-2 py-1 font-mono text-xs text-fg-dim transition-colors hover:border-line-bright hover:text-fg"
    >
      {command}
      <span className="text-fg-faint opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
      </span>
    </button>
  )
}

/**
 * Shown after a record is added, edited or removed: ddns-updater loads
 * config.json only at startup, so the change is on disk but not yet live.
 * Restarts it in one click when the backend can reach Docker, and otherwise
 * explains how to enable that — plus the command to run in the meantime.
 */
export function RestartBanner({
  info,
  restarting,
  onRestart,
  onDismiss,
}: {
  info: RestartInfo | null
  restarting: boolean
  onRestart: () => void
  onDismiss: () => void
}) {
  const container = info?.container || 'ddns-updater'

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm">
      <IconWarning width={18} height={18} className="mt-0.5 shrink-0 text-warn" />
      <div className="flex-1 text-fg-dim">
        <span className="text-warn">Config changed.</span> Restart ddns-updater to apply added, edited or removed
        records — <span className="text-fg">Force refresh</span> only re-checks IPs of already-loaded records.
        {info && !info.available && (
          <div className="mt-2 text-xs text-fg-faint">
            One-click restart unavailable — {info.reason}
            <br />
            Run this instead: <CopyableCommand command={`docker compose restart ${container}`} />
          </div>
        )}
      </div>
      {info?.available && (
        <Button variant="primary" onClick={onRestart} loading={restarting} title={`Restart ${container}`}>
          {!restarting && <IconPower width={16} height={16} />}
          {restarting ? 'Restarting…' : 'Restart & apply'}
        </Button>
      )}
      <button onClick={onDismiss} className="mt-0.5 text-fg-faint hover:text-fg" aria-label="Dismiss">
        <IconX width={16} height={16} />
      </button>
    </div>
  )
}

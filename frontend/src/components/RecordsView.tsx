import { useState } from 'react'
import type { RecordRow } from '../lib/types'
import { Button, ProviderBadge, Spinner } from './ui'
import { IconPlus, IconPencil, IconTrash } from './icons'

const ICON_BTN =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-dim transition-colors hover:border-line-bright hover:text-fg'

export function RecordsView({
  rows,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: {
  rows: RecordRow[]
  loading: boolean
  onAdd: () => void
  onEdit: (row: RecordRow) => void
  onDelete: (index: number) => void
}) {
  const [confirm, setConfirm] = useState<number | null>(null)

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-fg-dim">
        <Spinner /> Loading records…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-dim">
          <span className="font-mono text-fg">{rows.length}</span> record{rows.length !== 1 ? 's' : ''} in config.json
        </p>
        <Button variant="primary" onClick={onAdd}>
          <IconPlus width={16} height={16} /> Add record
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-bright bg-surface/40 px-8 py-16 text-center text-sm text-fg-dim">
          No records yet. Click <span className="text-accent">Add record</span> to write your first one.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li
              key={r.index}
              className="rounded-xl border border-line bg-surface/60 px-5 py-4 opacity-0 transition-colors hover:border-line-bright"
              style={{ animation: 'rise 0.35s ease-out forwards', animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <ProviderBadge provider={r.provider} />
                    <span className="truncate font-mono text-sm text-fg">{r.domain}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-fg-faint">
                    {String(r.ip_version ?? 'ipv4 or ipv6')}
                  </div>
                </div>

                {confirm === r.index ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-fg-dim">Remove?</span>
                    <Button variant="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={() => setConfirm(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => {
                        onDelete(r.index)
                        setConfirm(null)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button className={ICON_BTN} title="Edit" onClick={() => onEdit(r)}>
                      <IconPencil width={16} height={16} />
                    </button>
                    <button
                      className={`${ICON_BTN} hover:border-down/50 hover:text-down`}
                      title="Delete"
                      onClick={() => setConfirm(r.index)}
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

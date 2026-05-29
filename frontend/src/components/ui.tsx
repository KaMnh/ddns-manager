import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-ink-950 hover:bg-accent-soft border border-transparent shadow-[0_0_22px_-8px_var(--color-accent)]',
  ghost: 'bg-transparent text-fg-dim hover:text-fg border border-line hover:border-line-bright',
  danger:
    'bg-transparent text-down/90 hover:text-down border border-down/30 hover:border-down/60 hover:bg-down/10',
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Button({
  variant = 'ghost',
  loading = false,
  className = '',
  children,
  ...props
}: { variant?: Variant; loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

const DOT_COLOR = {
  online: 'text-accent',
  pending: 'text-info',
  warn: 'text-warn',
  error: 'text-down',
  idle: 'text-fg-faint',
} as const

export function StatusDot({ kind, pulse = false }: { kind: keyof typeof DOT_COLOR; pulse?: boolean }) {
  return <span className={`dot ${DOT_COLOR[kind]} ${pulse ? 'dot-pulse' : ''}`} aria-hidden />
}

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs lowercase text-fg-dim">
      {provider}
    </span>
  )
}

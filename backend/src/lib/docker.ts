import http from 'node:http'

/**
 * Minimal Docker Engine API client — just enough to inspect and restart one
 * container, over the Unix socket (default) or a TCP endpoint such as a
 * docker-socket-proxy. Deliberately dependency-free: the daemon speaks plain
 * HTTP, and `node:http` can dial a Unix socket directly.
 */

export interface DockerClientOptions {
  /** DOCKER_HOST-style URL: unix:///path, tcp://host:port or http://host:port. */
  dockerHost?: string
  /** Unix socket path, used when dockerHost is unset. */
  socketPath?: string
}

export interface ContainerState {
  /** created | running | restarting | exited | ... */
  status?: string
  running?: boolean
  startedAt?: string
}

/** An error carrying the HTTP status (from the daemon) or a socket error code. */
export class DockerError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'DockerError'
  }
}

interface Target {
  socketPath?: string
  hostname?: string
  port?: number
  label: string
}

const DEFAULT_SOCKET = '/var/run/docker.sock'

/** Resolves DOCKER_HOST / socket path into connection details. */
export function resolveTarget(opts: DockerClientOptions = {}): Target {
  const host = opts.dockerHost?.trim()
  if (!host) {
    const socketPath = opts.socketPath || DEFAULT_SOCKET
    return { socketPath, label: `unix://${socketPath}` }
  }

  if (host.startsWith('unix://')) {
    const socketPath = host.slice('unix://'.length) || DEFAULT_SOCKET
    return { socketPath, label: `unix://${socketPath}` }
  }

  if (host.startsWith('tcp://') || host.startsWith('http://')) {
    const url = new URL(host.replace(/^tcp:\/\//, 'http://'))
    const port = Number(url.port || 2375)
    return { hostname: url.hostname, port, label: `tcp://${url.hostname}:${port}` }
  }

  throw new DockerError(
    `Unsupported DOCKER_HOST "${host}" — use unix:///var/run/docker.sock or tcp://host:port`,
    undefined,
    'UNSUPPORTED_SCHEME',
  )
}

interface RawResponse {
  status: number
  body: string
}

function request(target: Target, method: string, path: string, timeoutMs: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        ...(target.socketPath
          ? { socketPath: target.socketPath }
          : { host: target.hostname, port: target.port }),
        method,
        path,
        // The daemon ignores Host, but Node needs one for socket requests.
        headers: { host: 'docker', accept: 'application/json' },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }),
        )
        res.on('error', reject)
      },
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy(new DockerError(`Docker API did not respond within ${timeoutMs}ms`, undefined, 'ETIMEDOUT'))
    })
    req.on('error', reject)
    req.end()
  })
}

/** Turns socket-level failures into messages that say what to fix. */
function connectionError(err: unknown, target: Target): DockerError {
  if (err instanceof DockerError) return err
  const e = err as NodeJS.ErrnoException
  const where = target.socketPath ?? target.label
  switch (e.code) {
    case 'ENOENT':
      return new DockerError(
        `Docker socket ${where} not found — mount it into this container to enable restarts (-v /var/run/docker.sock:/var/run/docker.sock)`,
        undefined,
        e.code,
      )
    case 'EACCES':
    case 'EPERM':
      return new DockerError(
        `Permission denied on ${where} — the GUI process needs access to the Docker socket`,
        undefined,
        e.code,
      )
    case 'ECONNREFUSED':
      return new DockerError(`Nothing is listening on ${target.label}`, undefined, e.code)
    default:
      return new DockerError(`Could not reach Docker at ${target.label}: ${e.message}`, undefined, e.code)
  }
}

/** The daemon reports errors as {"message": "..."}; fall back to raw text. */
function apiMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message
  } catch {
    /* not JSON */
  }
  return body.trim()
}

export class DockerClient {
  private readonly target: Target
  /** Set when the configuration itself is invalid (bad DOCKER_HOST). */
  private readonly configError?: DockerError

  constructor(opts: DockerClientOptions = {}) {
    try {
      this.target = resolveTarget(opts)
    } catch (err) {
      this.configError = err as DockerError
      this.target = { label: String(opts.dockerHost ?? '') }
    }
  }

  /** Human-readable endpoint, e.g. `unix:///var/run/docker.sock`. */
  get label(): string {
    return this.target.label
  }

  private async call(method: string, path: string, timeoutMs: number): Promise<RawResponse> {
    if (this.configError) throw this.configError
    try {
      return await request(this.target, method, path, timeoutMs)
    } catch (err) {
      throw connectionError(err, this.target)
    }
  }

  /** Container state, or throws a DockerError explaining why it's not reachable. */
  async inspect(container: string, timeoutMs = 5000): Promise<ContainerState> {
    const res = await this.call('GET', `/containers/${encodeURIComponent(container)}/json`, timeoutMs)
    if (res.status === 404) {
      throw new DockerError(`No container named "${container}"`, 404)
    }
    if (res.status < 200 || res.status >= 300) {
      throw new DockerError(
        apiMessage(res.body) || `Docker API returned ${res.status}`,
        res.status,
      )
    }
    let parsed: { State?: Record<string, unknown> }
    try {
      parsed = JSON.parse(res.body) as { State?: Record<string, unknown> }
    } catch {
      // Not the Docker API — a reverse proxy or captive portal answering instead.
      throw new DockerError(`${this.target.label} did not answer with Docker API JSON`, res.status)
    }
    const state = parsed.State ?? {}
    return {
      status: typeof state.Status === 'string' ? state.Status : undefined,
      running: typeof state.Running === 'boolean' ? state.Running : undefined,
      startedAt: typeof state.StartedAt === 'string' ? state.StartedAt : undefined,
    }
  }

  /**
   * Restarts a container. `stopTimeout` is the grace period (seconds) Docker
   * gives it to stop before killing it; the call returns once it is back up.
   */
  async restart(container: string, stopTimeout = 10): Promise<void> {
    const res = await this.call(
      'POST',
      `/containers/${encodeURIComponent(container)}/restart?t=${stopTimeout}`,
      (stopTimeout + 30) * 1000,
    )
    if (res.status >= 200 && res.status < 300) return
    if (res.status === 404) {
      throw new DockerError(`No container named "${container}"`, 404)
    }
    if (res.status === 403) {
      throw new DockerError(
        `Docker refused the restart — a socket proxy is likely blocking POST /containers/…/restart`,
        403,
      )
    }
    throw new DockerError(apiMessage(res.body) || `Docker API returned ${res.status}`, res.status)
  }
}

import { readFile, writeFile, rename, copyFile } from 'node:fs/promises'

/** A single DDNS record as stored in config.json "settings". Provider-specific
 *  fields (token, key, secret, zone_identifier, ...) and any unknown keys are
 *  preserved verbatim via the index signature. */
export interface DdnsRecord {
  provider: string
  domain: string
  ip_version?: string
  ipv6_suffix?: string
  [key: string]: unknown
}

/** The whole config.json. Unknown top-level keys are preserved on round-trip. */
export interface DdnsConfig {
  settings: DdnsRecord[]
  [key: string]: unknown
}

/**
 * Reads and writes ddns-updater's config.json safely:
 *  - read() tolerates a missing file (returns empty settings)
 *  - write() backs up the previous file to <file>.bak and writes atomically
 *    (temp file + rename) so a crash mid-write can't corrupt the config
 *  - the full object is round-tripped, so records/fields we don't understand
 *    (other providers, future options) are never dropped
 */
export class ConfigStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<DdnsConfig> {
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { settings: [] }
      }
      throw err
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      throw new Error(`Invalid JSON in config file ${this.filePath}: ${(err as Error).message}`)
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { settings: [] }
    }
    const obj = parsed as DdnsConfig
    if (!Array.isArray(obj.settings)) {
      obj.settings = []
    }
    return obj
  }

  async write(config: DdnsConfig): Promise<void> {
    // Back up the current file (if any) before overwriting it.
    try {
      await copyFile(this.filePath, `${this.filePath}.bak`)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }

    const tmp = `${this.filePath}.tmp`
    const json = `${JSON.stringify(config, null, 2)}\n`
    await writeFile(tmp, json, 'utf8')
    await rename(tmp, this.filePath)
  }
}

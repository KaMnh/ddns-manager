// A small set of common two-level public suffixes so that e.g. shop.example.co.uk
// and www.example.com.vn group under example.co.uk / example.com.vn rather than
// co.uk / com.vn. Not a full Public Suffix List — just the cases users hit most.
const TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.kr', 'co.in', 'co.za',
  'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn', 'biz.vn',
  'com.br', 'com.cn', 'com.sg', 'com.my', 'com.tr', 'com.mx', 'com.ua', 'com.hk', 'com.tw',
])

/**
 * Reduces a record's domain to its registrable ("root") domain, used to group
 * records in the UI. Strips a leading wildcard, lower-cases, and accounts for a
 * handful of two-level suffixes. Returns the input unchanged when it has no dot.
 */
export function rootDomain(input: string): string {
  const domain = input.trim().toLowerCase().replace(/^\*\./, '')
  if (!domain.includes('.')) return domain

  const labels = domain.split('.')
  if (labels.length <= 2) return domain

  const lastTwo = labels.slice(-2).join('.')
  if (TWO_LEVEL_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join('.')
  }
  return lastTwo
}

/**
 * Splits a possibly comma-separated `domain` field into individual domains.
 * ddns-updater treats `"a.example.com,b.example.com"` as multiple records (one
 * updates.json entry each), so the GUI must expand them too. A single domain
 * returns a one-element array.
 */
export function splitDomains(domain: string): string[] {
  return domain
    .split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
}

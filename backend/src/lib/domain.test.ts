import { describe, test, expect } from 'vitest'
import { rootDomain } from './domain.js'

describe('rootDomain', () => {
  test('reduces a subdomain to its registrable domain', () => {
    expect(rootDomain('home.example.com')).toBe('example.com')
    expect(rootDomain('a.b.c.example.com')).toBe('example.com')
  })

  test('returns an apex domain unchanged', () => {
    expect(rootDomain('example.com')).toBe('example.com')
  })

  test('strips a wildcard prefix', () => {
    expect(rootDomain('*.example.com')).toBe('example.com')
  })

  test('handles two-level public suffixes (.co.uk, .com.vn)', () => {
    expect(rootDomain('shop.example.co.uk')).toBe('example.co.uk')
    expect(rootDomain('www.example.com.vn')).toBe('example.com.vn')
    expect(rootDomain('example.com.vn')).toBe('example.com.vn')
  })

  test('is case-insensitive and trims whitespace', () => {
    expect(rootDomain('  WWW.Example.COM ')).toBe('example.com')
  })

  test('falls back to the input for values without a dot', () => {
    expect(rootDomain('localhost')).toBe('localhost')
    expect(rootDomain('')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'

import { cleanProposalText, cleanProposalTitle, normalizeProposalDate, normalizeProposalKey } from './proposal-normalization'

describe('AI proposal normalization', () => {
  it('removes markdown, punctuation, and duplicate whitespace', () => {
    expect(cleanProposalTitle('## **1. Ship   the release!!!**')).toBe('Ship the release')
    expect(cleanProposalText('```md\n- Validate   output\n```', 200)).toBe('Validate output')
  })

  it('creates semantic duplicate keys and rejects meaningless titles', () => {
    expect(normalizeProposalKey('Ship-the release!')).toBe(normalizeProposalKey('Ship the release'))
    expect(cleanProposalTitle('!! a !!')).toBeNull()
  })

  it('rejects past, rollover, and out-of-project dates', () => {
    const now = new Date('2026-06-27T12:00:00Z')
    expect(normalizeProposalDate('2026-02-31', { now })).toBeNull()
    expect(normalizeProposalDate('2026-06-26', { now })).toBeNull()
    expect(normalizeProposalDate('2026-07-02', { now, maxDate: '2026-07-01' })).toBeNull()
    expect(normalizeProposalDate('2026-07-01', { now, maxDate: '2026-07-01' })).toBe('2026-07-01')
  })
})

import { describe, expect, it } from 'vitest'

import { MomentumError } from '@/lib/momentum/errors'
import { normalizeMomentumFlowError } from './momentum-flow-readiness'

describe('Momentum Flow readiness errors', () => {
  it('classifies missing Momentum Flow schema with a stable code', () => {
    const result = normalizeMomentumFlowError(new Error('PGRST205: momentum_flow_proposals missing from schema cache'))
    expect(result).toBeInstanceOf(MomentumError)
    expect((result as MomentumError).code).toBe('MOMENTUM_FLOW_SETUP_REQUIRED')
    expect((result as MomentumError).status).toBe(503)
  })

  it('does not misclassify auth, network, or empty-data errors', () => {
    const auth = new Error('JWT expired')
    const network = new Error('fetch failed')
    const empty = new Error('No candidate tasks found')
    expect(normalizeMomentumFlowError(auth)).toBe(auth)
    expect(normalizeMomentumFlowError(network)).toBe(network)
    expect(normalizeMomentumFlowError(empty)).toBe(empty)
  })
})

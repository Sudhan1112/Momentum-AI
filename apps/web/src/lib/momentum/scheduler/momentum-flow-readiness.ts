import { MomentumError } from '@/lib/momentum/errors'

const MOMENTUM_FLOW_SCHEMA_NAMES = [
  'momentum_flow_proposals',
  'momentum_flow_sessions',
  'user_capacity_profiles',
  'momentum_flow_proposal_status',
  'momentum_flow_session_status',
  'focus_session_type',
  'energy_requirement',
]

export function normalizeMomentumFlowError(caught: unknown) {
  if (caught instanceof MomentumError) return caught

  const message = caught instanceof Error ? caught.message : String(caught)
  const lower = message.toLowerCase()
  const referencesMomentumSchema = MOMENTUM_FLOW_SCHEMA_NAMES.some((name) => lower.includes(name))
  const isMissingSchema =
    lower.includes('42p01') ||
    lower.includes('pgrst205') ||
    lower.includes('schema cache') ||
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('could not find the type')

  if (referencesMomentumSchema && isMissingSchema) {
    return new MomentumError(
      'Momentum Flow database setup is required. Apply supabase/patches/add_momentum_flow.sql and reload the schema.',
      503,
      'MOMENTUM_FLOW_SETUP_REQUIRED'
    )
  }

  return caught
}

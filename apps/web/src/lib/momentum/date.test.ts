import { describe, expect, it } from 'vitest'

import {
  calendarDayDifference,
  parseDateOnly,
  remainingCalendarDays,
  validatePlanningDate,
} from './date'

describe('business dates', () => {
  it('accepts real leap dates and rejects rollover dates', () => {
    expect(parseDateOnly('2028-02-29')).not.toBeNull()
    expect(parseDateOnly('2027-02-29')).toBeNull()
    expect(parseDateOnly('2026-02-31')).toBeNull()
  })

  it('uses calendar days across timezone and DST offsets', () => {
    expect(calendarDayDifference('2026-03-07T23:30:00-08:00', '2026-03-09T00:30:00-07:00')).toBe(1)
  })

  it('degrades invalid legacy dates to a bounded fallback', () => {
    expect(remainingCalendarDays('not-a-date', new Date('2026-06-27T12:00:00Z'), 7)).toBe(7)
    expect(remainingCalendarDays('2226-06-27', new Date('2026-06-27T12:00:00Z'), 7)).toBe(7)
  })

  it('rejects past and more-than-ten-year planning dates', () => {
    const now = new Date('2026-06-27T12:00:00Z')
    expect(validatePlanningDate('2026-06-26', { field: 'deadline', now }).ok).toBe(false)
    expect(validatePlanningDate('2036-06-27', { field: 'deadline', now }).ok).toBe(true)
    expect(validatePlanningDate('2036-06-28', { field: 'deadline', now }).ok).toBe(false)
  })
})

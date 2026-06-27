import { jsonError, jsonServerError } from '@/lib/api-route-errors'

export class MomentumError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'MomentumError'
    this.status = status
    this.code = code
  }
}

export function badRequest(message: string) {
  return new MomentumError(message, 400)
}

export function forbidden(message = 'Forbidden') {
  return new MomentumError(message, 403)
}

export function notFound(message = 'Not found') {
  return new MomentumError(message, 404)
}

export function conflict(message: string) {
  return new MomentumError(message, 409)
}

export function jsonMomentumError(caught: unknown) {
  if (caught instanceof MomentumError) {
    if (caught.code) {
      return Response.json({ error: caught.message, code: caught.code }, { status: caught.status })
    }
    return jsonError(caught.message, caught.status)
  }

  return jsonServerError(caught)
}

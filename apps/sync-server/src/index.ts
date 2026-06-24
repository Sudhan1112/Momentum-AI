import express from 'express'
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import * as Y from 'yjs'
import dotenv from 'dotenv'

dotenv.config()

import { verifyUserToken, assertDocumentAccess, assertDocumentWriteAccess } from './auth'
import { getOrCreateDoc, schedulePersist } from './yjsManager'

/** Always allowed for local development. Production origins are supplied through CLIENT_URL. */
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
] as const

function corsOrigin(): string | string[] | boolean {
  const raw = process.env.CLIENT_URL?.trim()
  if (raw === '*') return true

  const fromEnv =
    raw && raw !== '*'
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : []

  const merged = [...new Set<string>([...LOCAL_DEV_ORIGINS, ...fromEnv])]
  if (merged.length === 0) return true
  return merged.length === 1 ? merged[0]! : merged
}

const app = express()
app.use(cors({ origin: corsOrigin(), credentials: true }))

app.get('/health', (req, res) => res.send('OK'))

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin(),
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

const WRITE_ROLES = new Set(['owner', 'editor', 'admin'])
const ACCESS_CACHE_TTL_MS = 4_000

type CachedAccess = {
  documentId: string
  role: string
  checkedAt: number
}

async function resolveSocketAccess(socket: Socket, documentId: string, requireWrite: boolean) {
  const cached = socket.data.documentAccess as CachedAccess | undefined
  const hasFreshCache =
    cached &&
    cached.documentId === documentId &&
    Date.now() - cached.checkedAt <= ACCESS_CACHE_TTL_MS

  if (hasFreshCache) {
    if (requireWrite && !WRITE_ROLES.has(cached.role)) {
      throw new Error('Read-only role')
    }
    return cached
  }

  const access = requireWrite
    ? await assertDocumentWriteAccess(socket.data.user.id, documentId)
    : await assertDocumentAccess(socket.data.user.id, documentId)

  const nextAccess: CachedAccess = {
    documentId,
    role: access.role,
    checkedAt: Date.now(),
  }
  socket.data.documentAccess = nextAccess
  return nextAccess
}

function rejectDocumentAccess(socket: Socket, documentId: string, reason: string) {
  socket.emit('doc:rejected', { reason })
  socket.leave(documentId)
  if (socket.data.documentId === documentId) {
    socket.data.documentId = undefined
    socket.data.documentAccess = undefined
  }
}

function isNonEmptyDocumentId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0
}

// Real-time synchronization state per room
// Each room has an Awareness state, which is just an object of socket IDs to awareness data
const roomAwareness = new Map<string, Record<string, any>>()

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token
    if (!token) throw new Error('No token provided')
    const user = await verifyUserToken(token as string)
    socket.data.user = user
    next()
  } catch (err) {
    console.error('Socket auth failed', err)
    next(new Error('Authentication failed'))
  }
})

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id, 'User:', socket.data.user?.email)

  socket.on('doc:join', async (documentId: string) => {
    if (!isNonEmptyDocumentId(documentId)) {
      socket.emit('doc:rejected', { reason: 'invalid_document' })
      return
    }
    try {
      const access = await assertDocumentAccess(socket.data.user.id, documentId)
      socket.data.documentAccess = {
        documentId,
        role: access.role,
        checkedAt: Date.now(),
      }
    } catch (err) {
      console.warn('doc:join denied', documentId, err)
      socket.emit('doc:rejected', { reason: 'access_denied' })
      return
    }

    try {
      if (socket.data.documentId && socket.data.documentId !== documentId) {
        socket.leave(socket.data.documentId)
      }

      socket.join(documentId)
      const doc = await getOrCreateDoc(documentId)

      // Send full doc state
      const stateBinary = Y.encodeStateAsUpdate(doc)
      const stateBase64 = Buffer.from(stateBinary).toString('base64')
      socket.emit('doc:load', stateBase64)

      // Setup awareness room
      if (!roomAwareness.has(documentId)) {
        roomAwareness.set(documentId, {})
      }
      const awareness = roomAwareness.get(documentId)!
      socket.emit('awareness:sync', awareness)

      // Notify others
      socket.to(documentId).emit('presence:joined', { socketId: socket.id, userId: socket.data.user?.id })

      // Store current room to handle disconnects securely
      socket.data.documentId = documentId
    } catch (err) {
      console.error('doc:join error', err)
      socket.leave(documentId)
      if (socket.data.documentAccess?.documentId === documentId) {
        socket.data.documentAccess = undefined
      }
      if (socket.data.documentId === documentId) {
        socket.data.documentId = undefined
      }
      socket.emit('doc:rejected', { reason: 'server_error' })
      return
    }
  })

  socket.on('doc:update', async (documentId: string, updateBase64: string) => {
    if (socket.data.documentId !== documentId) return

    try {
      await resolveSocketAccess(socket, documentId, true)
      const updateBinary = Buffer.from(updateBase64, 'base64')
      const doc = await getOrCreateDoc(documentId)
      try {
        Y.applyUpdate(doc, updateBinary)
      } catch (applyErr) {
        console.warn('doc:update invalid Yjs payload', documentId, applyErr)
        rejectDocumentAccess(socket, documentId, 'invalid_update')
        return
      }

      schedulePersist(documentId, doc)

      // Broadcast to other clients in room
      socket.to(documentId).emit('doc:broadcast', updateBase64)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'Read-only role') {
        console.warn('doc:update write denied', documentId)
        rejectDocumentAccess(socket, documentId, 'write_forbidden')
      } else if (msg === 'Forbidden' || msg === 'Document not found') {
        console.warn('doc:update access revoked', documentId, msg)
        rejectDocumentAccess(socket, documentId, 'access_denied')
      } else {
        console.error('doc:update error', documentId, e)
        rejectDocumentAccess(socket, documentId, 'server_error')
      }
    }
  })

  socket.on('awareness:update', async (documentId: string, updateBase64: string) => {
    if (socket.data.documentId !== documentId) return
    try {
      await resolveSocketAccess(socket, documentId, false)
    } catch (e) {
      console.warn('awareness:update denied', documentId, e)
      rejectDocumentAccess(socket, documentId, 'presence_forbidden')
      return
    }

    // Blindly echo standard Yjs awareness payloads
    socket.to(documentId).emit('awareness:diff', updateBase64)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 4000

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
})

httpServer.listen(PORT, () => {
  console.log(`Sync server running on port ${PORT}`)
})

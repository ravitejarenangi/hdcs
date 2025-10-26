// In-memory storage for export progress tracking
// This is a simple Map-based cache for tracking export progress across requests
// In production, consider using Redis or another distributed cache for multi-instance deployments

export interface ExportProgress {
  sessionId: string
  totalRecords: number
  processedRecords: number
  currentBatch: number
  totalBatches: number
  status: "initializing" | "processing" | "completed" | "error"
  message?: string
  startTime: number
  lastUpdateTime: number
}

// Use globalThis to ensure the Map is shared across all module instances
// This is critical for Next.js with Turbopack which can create separate module instances
declare global {
  // eslint-disable-next-line no-var
  var exportProgressStore: Map<string, ExportProgress> | undefined
}

// Global Map to store progress for active exports
// Key: sessionId, Value: ExportProgress
const progressStore = globalThis.exportProgressStore ?? new Map<string, ExportProgress>()

// Store the reference in globalThis so it's shared across all module instances
if (!globalThis.exportProgressStore) {
  globalThis.exportProgressStore = progressStore
}

// Cleanup old progress entries after 1 hour
const PROGRESS_TTL = 60 * 60 * 1000 // 1 hour in milliseconds

export function createProgress(sessionId: string, totalRecords: number, totalBatches: number): ExportProgress {
  const progress: ExportProgress = {
    sessionId,
    totalRecords,
    processedRecords: 0,
    currentBatch: 0,
    totalBatches,
    status: "initializing",
    message: "Initializing export...",
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
  }

  console.log(`[ProgressStore] Creating progress for sessionId: ${sessionId}`, progress)
  console.log(`[ProgressStore] Using globalThis store:`, progressStore === globalThis.exportProgressStore)
  progressStore.set(sessionId, progress)
  console.log(`[ProgressStore] Progress stored. Store size: ${progressStore.size}, globalThis store size: ${globalThis.exportProgressStore?.size}`)
  return progress
}

export function updateProgress(
  sessionId: string,
  updates: Partial<Omit<ExportProgress, "sessionId" | "startTime">>
): ExportProgress | null {
  const progress = progressStore.get(sessionId)
  if (!progress) {
    return null
  }

  const updated: ExportProgress = {
    ...progress,
    ...updates,
    lastUpdateTime: Date.now(),
  }

  progressStore.set(sessionId, updated)
  return updated
}

export function getProgress(sessionId: string): ExportProgress | null {
  const progress = progressStore.get(sessionId) || null
  console.log(`[ProgressStore] Getting progress for sessionId: ${sessionId}, found:`, progress ? 'YES' : 'NO')
  console.log(`[ProgressStore] Using globalThis store:`, progressStore === globalThis.exportProgressStore)
  console.log(`[ProgressStore] Store size: ${progressStore.size}, globalThis store size: ${globalThis.exportProgressStore?.size}`)
  if (progress) {
    console.log(`[ProgressStore] Progress details:`, progress)
  }
  return progress
}

export function deleteProgress(sessionId: string): void {
  progressStore.delete(sessionId)
}

export function completeProgress(sessionId: string, message?: string): ExportProgress | null {
  return updateProgress(sessionId, {
    status: "completed",
    message: message || "Export completed successfully!",
  })
}

export function errorProgress(sessionId: string, message: string): ExportProgress | null {
  return updateProgress(sessionId, {
    status: "error",
    message,
  })
}

// Cleanup function to remove old progress entries
export function cleanupOldProgress(): void {
  const now = Date.now()
  const toDelete: string[] = []

  for (const [sessionId, progress] of progressStore.entries()) {
    if (now - progress.lastUpdateTime > PROGRESS_TTL) {
      toDelete.push(sessionId)
    }
  }

  toDelete.forEach((sessionId) => progressStore.delete(sessionId))
  
  if (toDelete.length > 0) {
    console.log(`Cleaned up ${toDelete.length} old export progress entries`)
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldProgress, 10 * 60 * 1000)


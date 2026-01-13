import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getProgress } from "@/lib/export-progress"

// SSE endpoint for export progress updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Authentication check
  const session = await auth()
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Authorization check - Admin only
  if (session.user.role !== "ADMIN") {
    return new Response(
      JSON.stringify({ error: "Access denied. Admin privileges required." }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // Await params in Next.js 15+
  const { sessionId } = await params

  // Create SSE stream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false
      let pollCount = 0
      const maxPolls = 600 // 10 minutes max

      const sendSSE = (data: object) => {
        if (isClosed) return
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch {
          isClosed = true
        }
      }

      const poll = async () => {
        if (isClosed || pollCount >= maxPolls) {
          if (!isClosed) {
            sendSSE({ error: "Progress timeout" })
            controller.close()
          }
          return
        }

        pollCount++
        const progress = getProgress(sessionId)

        if (progress) {
          sendSSE(progress)

          // Close connection if export completed or errored
          if (progress.status === "completed" || progress.status === "error") {
            setTimeout(() => {
              if (!isClosed) {
                isClosed = true
                controller.close()
              }
            }, 1000)
            return
          }
        } else {
          // No progress found yet, send initializing status
          sendSSE({
            sessionId,
            status: "initializing",
            message: "Waiting for export to start...",
            totalRecords: 0,
            processedRecords: 0,
            currentBatch: 0,
            totalBatches: 0,
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
          })
        }

        // Poll every 1 second
        setTimeout(poll, 1000)
      }

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        isClosed = true
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })

      // Start polling
      poll()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

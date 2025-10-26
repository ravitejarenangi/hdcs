import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getProgress } from "@/lib/export-progress"

// Server-Sent Events (SSE) endpoint for real-time export progress updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authentication check
    const session = await auth()
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Authorization check - Admin or Super Admin only
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
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
    console.log(`[SSE Progress] Starting SSE stream for sessionId: ${sessionId}`)

    // Create a ReadableStream for Server-Sent Events
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        controller.enqueue(encoder.encode(`: Connected to progress stream\n\n`))

        // Track how many times we've checked for progress
        let checkCount = 0
        const MAX_WAIT_CHECKS = 20 // Wait up to 10 seconds (20 * 500ms) for progress to be initialized

        // Poll for progress updates every 500ms
        const intervalId = setInterval(() => {
          const progress = getProgress(sessionId)
          console.log(`[SSE Progress] Check ${checkCount + 1}: sessionId=${sessionId}, progress=`, progress)

          if (!progress) {
            checkCount++

            // If we've waited long enough and still no progress, it's an error
            if (checkCount >= MAX_WAIT_CHECKS) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    error: "Progress not found - export may have failed to start",
                    sessionId
                  })}\n\n`
                )
              )
              clearInterval(intervalId)
              controller.close()
              return
            }

            // Otherwise, just wait - progress might be initializing
            // Send a waiting status to keep connection alive
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  status: "initializing",
                  message: "Waiting for export to start...",
                  sessionId,
                  totalRecords: 0,
                  processedRecords: 0,
                  currentBatch: 0,
                  totalBatches: 0,
                  startTime: Date.now(),
                  lastUpdateTime: Date.now()
                })}\n\n`
              )
            )
            return
          }

          // Reset check count once we have progress
          checkCount = 0

          // Send progress update
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
          )

          // Close stream if export is completed or errored
          if (progress.status === "completed" || progress.status === "error") {
            clearInterval(intervalId)
            // Wait a bit before closing to ensure client receives final message
            setTimeout(() => {
              controller.close()
            }, 1000)
          }
        }, 500) // Update every 500ms

        // Cleanup on client disconnect
        request.signal.addEventListener("abort", () => {
          clearInterval(intervalId)
          controller.close()
        })
      },
    })

    // Return SSE response
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering in nginx
      },
    })
  } catch (error) {
    console.error("Progress SSE error:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to stream progress",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}


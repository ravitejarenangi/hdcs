import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getProgress } from "@/lib/export-progress"

// Server-Sent Events (SSE) endpoint for real-time export progress updates
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
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

    const { sessionId } = params

    // Create a ReadableStream for Server-Sent Events
    const encoder = new TextEncoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        controller.enqueue(encoder.encode(`: Connected to progress stream\n\n`))

        // Poll for progress updates every 500ms
        const intervalId = setInterval(() => {
          const progress = getProgress(sessionId)

          if (!progress) {
            // Progress not found - might be too old or invalid session
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  error: "Progress not found",
                  sessionId 
                })}\n\n`
              )
            )
            clearInterval(intervalId)
            controller.close()
            return
          }

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


import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getProgress } from "@/lib/export-progress"

// Simple JSON endpoint for export progress updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Authentication check
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Authorization check - Admin only
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      )
    }

    // Await params in Next.js 15+
    const { sessionId } = await params

    // Get progress from store
    const progress = getProgress(sessionId)

    if (!progress) {
      return NextResponse.json(
        {
          status: "initializing",
          message: "Waiting for export to start...",
          totalRecords: 0,
          processedRecords: 0,
          currentBatch: 0,
          totalBatches: 0,
        },
        { status: 200 }
      )
    }

    // Return progress as JSON
    return NextResponse.json(progress, { status: 200 })
  } catch (error) {
    console.error("Progress API error:", error)
    return NextResponse.json(
      {
        error: "Failed to get progress",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

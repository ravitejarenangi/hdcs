import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Fetch import history
    const importLogs = await prisma.importLog.findMany({
      orderBy: { importedAt: "desc" },
      take: 50, // Last 50 imports
    })

    // Get user details for each import
    const userIds = [...new Set(importLogs.map((log) => log.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, username: true },
    })

    const userMap = new Map(users.map((user) => [user.id, user]))

    // Combine data
    const history = importLogs.map((log) => ({
      id: log.id,
      fileName: log.fileName,
      fileSize: log.fileSize,
      totalRecords: log.totalRecords,
      successRecords: log.successRecords,
      failedRecords: log.failedRecords,
      duplicateRecords: log.duplicateRecords,
      importMode: log.importMode,
      status: log.status,
      importedAt: log.importedAt,
      importedBy: userMap.get(log.userId)?.fullName || "Unknown",
      username: userMap.get(log.userId)?.username || "unknown",
    }))

    return NextResponse.json(history)
  } catch (error) {
    console.error("Import history error:", error)
    return NextResponse.json(
      { error: "Failed to fetch import history" },
      { status: 500 }
    )
  }
}


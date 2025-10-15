import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Authorization check - Admin or Super Admin only
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      )
    }

    // Get filter parameters from query string
    const searchParams = request.nextUrl.searchParams
    const mandalName = searchParams.get("mandalName")
    const secName = searchParams.get("secName")
    const phcName = searchParams.get("phcName")

    // Build where clause based on filters
    const whereClause: Record<string, string> = {}
    if (mandalName && mandalName !== "all") {
      whereClause.mandalName = mandalName
    }
    if (secName && secName !== "all") {
      whereClause.secName = secName
    }
    if (phcName && phcName !== "all") {
      whereClause.phcName = phcName
    }

    // Count residents matching the filters
    const count = await prisma.resident.count({
      where: whereClause,
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error("Record count error:", error)
    return NextResponse.json(
      { error: "Failed to count records" },
      { status: 500 }
    )
  }
}


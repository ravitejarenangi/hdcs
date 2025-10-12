import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is ADMIN
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    )
  }

  try {
    // Get optional mandal filter from query params
    const { searchParams } = new URL(request.url)
    const mandalFilter = searchParams.get("mandal")

    // Build where clause
    const whereClause: {
      secName: { not: null }
      mandalName?: string | { not: null }
    } = {
      secName: { not: null },
    }

    if (mandalFilter) {
      whereClause.mandalName = mandalFilter
    } else {
      whereClause.mandalName = { not: null }
    }

    // Fetch secretariats grouped by secName and mandalName
    const secretariats = await prisma.resident.groupBy({
      by: ["secName", "mandalName"],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: [
        { mandalName: "asc" },
        { secName: "asc" },
      ],
    })

    // Format response
    const secretariatList = secretariats.map((sec) => ({
      name: sec.secName || "",
      mandalName: sec.mandalName || "",
      residentCount: sec._count.id,
    }))

    return NextResponse.json({
      secretariats: secretariatList,
      total: secretariatList.length,
      filteredByMandal: mandalFilter || null,
    })
  } catch (error) {
    console.error("Secretariats fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


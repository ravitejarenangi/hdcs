import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get optional filters from query params
    const { searchParams } = new URL(request.url)
    const mandalFilter = searchParams.get("mandal")
    const secretariatFilter = searchParams.get("secretariat")

    // Build where clause
    const whereClause: {
      phcName: { not: null }
      mandalName?: string | { not: null }
      secName?: string
    } = {
      phcName: { not: null },
    }

    if (mandalFilter) {
      whereClause.mandalName = mandalFilter
    } else {
      whereClause.mandalName = { not: null }
    }

    if (secretariatFilter) {
      whereClause.secName = secretariatFilter
    }

    // Fetch PHCs grouped by phcName, secName, and mandalName
    const phcs = await prisma.resident.groupBy({
      by: ["phcName", "secName", "mandalName"],
      where: whereClause,
      _count: {
        id: true,
      },
      orderBy: [
        { mandalName: "asc" },
        { secName: "asc" },
        { phcName: "asc" },
      ],
    })

    // Format response
    const phcList = phcs.map((phc) => ({
      name: phc.phcName || "",
      secretariatName: phc.secName || "",
      mandalName: phc.mandalName || "",
      residentCount: phc._count.id,
    }))

    return NextResponse.json({
      phcs: phcList,
      total: phcList.length,
      filteredByMandal: mandalFilter || null,
      filteredBySecretariat: secretariatFilter || null,
    })
  } catch (error) {
    console.error("PHCs fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


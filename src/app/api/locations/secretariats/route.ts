import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildResidentAccessFilter,
  getAccessibleSecretariats,
  type UserSession,
} from "@/lib/access-control"

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Build user session object for access control
  const userSession: UserSession = {
    id: session.user.id,
    role: session.user.role as "ADMIN" | "PANCHAYAT_SECRETARY" | "FIELD_OFFICER",
    mandalName: session.user.mandalName,
    assignedSecretariats: session.user.assignedSecretariats,
  }

  try {
    // Get optional mandal filter from query params
    const { searchParams } = new URL(request.url)
    const mandalFilter = searchParams.get("mandal")

    // Get accessible secretariats based on role
    const accessibleSecretariats = getAccessibleSecretariats(
      userSession,
      mandalFilter || undefined
    )

    // Build access filter
    const accessFilter = buildResidentAccessFilter(userSession)

    // Build where clause
    const whereClause: {
      secName: { not: null }
      mandalName?: string | { not: null }
      OR?: Array<{ mandalName: string; secName: string }>
    } = {
      secName: { not: null },
      ...accessFilter,
    }

    if (mandalFilter) {
      whereClause.mandalName = mandalFilter
    } else if (!accessFilter.OR) {
      // Only add this if not using OR clause from access filter
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
    let secretariatList = secretariats.map((sec) => ({
      name: sec.secName || "",
      mandalName: sec.mandalName || "",
      residentCount: sec._count.id,
    }))

    // For Field Officers, filter to only accessible secretariats
    if (accessibleSecretariats.length > 0) {
      secretariatList = secretariatList.filter((sec) =>
        accessibleSecretariats.includes(sec.name)
      )
    }

    return NextResponse.json({
      secretariats: secretariatList,
      total: secretariatList.length,
      filteredByMandal: mandalFilter || null,
      role: userSession.role,
      restricted: accessibleSecretariats.length > 0,
    })
  } catch (error) {
    console.error("Secretariats fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildResidentAccessFilter,
  getAccessibleMandals,
  type UserSession,
} from "@/lib/access-control"

export async function GET(_request: NextRequest) {
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
    // Get accessible mandals based on role
    const accessibleMandals = getAccessibleMandals(userSession)

    // Build access filter
    const accessFilter = buildResidentAccessFilter(userSession)

    // Fetch unique mandals from residents table with access control
    const mandals = await prisma.resident.groupBy({
      by: ["mandalName"],
      where: {
        mandalName: { not: null },
        ...accessFilter,
      },
      _count: {
        id: true,
      },
      orderBy: {
        mandalName: "asc",
      },
    })

    // Format response
    let mandalList = mandals.map((mandal) => ({
      name: mandal.mandalName || "",
      residentCount: mandal._count.id,
    }))

    // For Field Officers and Panchayat Secretaries, filter to only accessible mandals
    if (accessibleMandals.length > 0) {
      mandalList = mandalList.filter((mandal) =>
        accessibleMandals.includes(mandal.name)
      )
    }

    return NextResponse.json({
      mandals: mandalList,
      total: mandalList.length,
      role: userSession.role,
      restricted: accessibleMandals.length > 0,
    })
  } catch (error) {
    console.error("Mandals fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


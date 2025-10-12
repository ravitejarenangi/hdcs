import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(_request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is PANCHAYAT_SECRETARY
  if (session.user.role !== "PANCHAYAT_SECRETARY") {
    return NextResponse.json(
      { error: "Forbidden - Panchayat Secretary access required" },
      { status: 403 }
    )
  }

  // Get mandal from session
  const mandalName = session.user.mandalName

  if (!mandalName) {
    return NextResponse.json(
      { error: "Mandal not assigned to user" },
      { status: 400 }
    )
  }

  try {
    // Fetch unique secretariats in the mandal
    const secretariats = await prisma.resident.groupBy({
      by: ["secName"],
      where: {
        mandalName,
        secName: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        secName: "asc",
      },
    })

    // Format response - include mandal name in each secretariat
    const secretariatList = secretariats.map((sec) => ({
      name: sec.secName || "",
      mandalName: mandalName,
      residentCount: sec._count.id,
    }))

    return NextResponse.json({
      mandalName,
      secretariats: secretariatList,
      total: secretariatList.length,
    })
  } catch (error) {
    console.error("Secretariats fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


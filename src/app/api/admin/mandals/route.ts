import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(_request: NextRequest) {
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
    // Fetch unique mandals from residents table
    const mandals = await prisma.resident.groupBy({
      by: ["mandalName"],
      where: {
        mandalName: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        mandalName: "asc",
      },
    })

    // Format response
    const mandalList = mandals.map((mandal) => ({
      name: mandal.mandalName || "",
      residentCount: mandal._count.id,
    }))

    return NextResponse.json({
      mandals: mandalList,
      total: mandalList.length,
    })
  } catch (error) {
    console.error("Mandals fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


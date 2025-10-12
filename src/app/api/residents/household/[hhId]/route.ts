import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildResidentAccessFilter, type UserSession } from "@/lib/access-control"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hhId: string }> }
) {
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
    const { hhId } = await params

    if (!hhId) {
      return NextResponse.json(
        { error: "Household ID is required" },
        { status: 400 }
      )
    }

    // Build access filter based on user role
    const accessFilter = buildResidentAccessFilter(userSession)

    // Find all household members with access control
    const householdMembers = await prisma.resident.findMany({
      where: {
        hhId,
        ...accessFilter,
      },
      orderBy: { name: "asc" },
    })

    if (householdMembers.length === 0) {
      return NextResponse.json(
        { error: "No household members found or you do not have access" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      householdId: hhId,
      totalMembers: householdMembers.length,
      members: householdMembers,
    })
  } catch (error) {
    console.error("Fetch household members error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


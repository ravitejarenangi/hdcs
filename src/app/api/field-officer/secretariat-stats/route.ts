import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    // Check authentication
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is a field officer
    if (session.user.role !== "FIELD_OFFICER") {
      return NextResponse.json(
        { error: "Access denied. Field Officers only." },
        { status: 403 }
      )
    }

    // Get field officer's assigned secretariat from User model
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        mandalName: true,
        assignedSecretariats: true,
      },
    })

    if (!user || !user.assignedSecretariats) {
      return NextResponse.json(
        { error: "No secretariat assigned to this field officer" },
        { status: 404 }
      )
    }

    // Parse assigned secretariats (stored as JSON string)
    let assignedSecretariats: Array<{ mandalName: string; secName: string }> = []
    try {
      assignedSecretariats = JSON.parse(user.assignedSecretariats)
    } catch (error) {
      console.error("Failed to parse assigned secretariats:", error)
      return NextResponse.json(
        { error: "Invalid secretariat assignment data" },
        { status: 500 }
      )
    }

    if (assignedSecretariats.length === 0) {
      return NextResponse.json(
        { error: "No secretariat assigned to this field officer" },
        { status: 404 }
      )
    }

    // For now, use the first assigned secretariat
    // In the future, this could be enhanced to aggregate stats across all assigned secretariats
    const { mandalName, secName } = assignedSecretariats[0]

    // Fetch all residents in the assigned secretariat
    const residents = await prisma.resident.findMany({
      where: {
        mandalName,
        secName,
      },
      select: {
        citizenMobile: true,
        healthId: true,
      },
    })

    // Calculate statistics
    const total = residents.length
    const mobilePending = residents.filter(
      (r) => !r.citizenMobile || r.citizenMobile === ""
    ).length
    const mobileUpdated = residents.filter(
      (r) => r.citizenMobile && r.citizenMobile !== ""
    ).length
    const healthIdPending = residents.filter(
      (r) => !r.healthId || r.healthId === "" || r.healthId === "N/A"
    ).length
    const healthIdUpdated = residents.filter(
      (r) => r.healthId && r.healthId !== "" && r.healthId !== "N/A"
    ).length

    return NextResponse.json({
      secretariat: {
        mandalName,
        secName,
      },
      stats: {
        total,
        mobilePending,
        mobileUpdated,
        healthIdPending,
        healthIdUpdated,
      },
    })
  } catch (error) {
    console.error("Secretariat stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


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

    // Fetch cutoff date for filtering (exclude locked data)
    const cutoffSetting = await prisma.systemSettings.findUnique({
      where: { key: "RESIDENT_UPDATE_CUTOFF_DATE" },
    })
    const cutoffDate = cutoffSetting?.value ? new Date(cutoffSetting.value) : null

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
        updatedAt: true,
      },
    })

    // Helper function to check if a resident is "locked" (complete and before cutoff)
    // A resident is locked if:
    // 1. Updated before cutoff date
    // 2. Has valid mobile number (10 digits starting with 6-9)
    // 3. Has valid health ID (at least 14 characters, not N/A)
    const isResidentLocked = (resident: { citizenMobile: string | null; healthId: string | null; updatedAt: Date }) => {
      if (!cutoffDate) return false
      if (resident.updatedAt >= cutoffDate) return false

      const hasMobile = resident.citizenMobile && /^[6-9]\d{9}$/.test(resident.citizenMobile)
      const hasAbha = resident.healthId && resident.healthId.length >= 14 && resident.healthId !== "N/A"

      return hasMobile && hasAbha
    }

    // Filter out locked residents for pending/progress stats
    const unlockedResidents = residents.filter(r => !isResidentLocked(r))

    // Calculate statistics for unlocked residents only (what field officer can actually work on)
    const total = unlockedResidents.length
    const mobilePending = unlockedResidents.filter(
      (r) => !r.citizenMobile || r.citizenMobile === ""
    ).length
    const mobileUpdated = unlockedResidents.filter(
      (r) => r.citizenMobile && r.citizenMobile !== ""
    ).length
    const healthIdPending = unlockedResidents.filter(
      (r) => !r.healthId || r.healthId === "" || r.healthId === "N/A"
    ).length
    const healthIdUpdated = unlockedResidents.filter(
      (r) => r.healthId && r.healthId !== "" && r.healthId !== "N/A"
    ).length

    // Also include count of locked residents for reference
    const lockedCount = residents.length - unlockedResidents.length

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
        lockedCount, // Number of locked records (complete and before cutoff)
        totalIncludingLocked: residents.length, // Total including locked
      },
      // Include cutoff date for reference
      dataCutoffDate: cutoffDate ? cutoffDate.toISOString() : null,
    })
  } catch (error) {
    console.error("Secretariat stats error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


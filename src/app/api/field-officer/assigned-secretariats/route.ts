import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { parseAssignedSecretariats } from "@/lib/access-control"

/**
 * GET /api/field-officer/assigned-secretariats
 * Get the field officer's assigned secretariats
 */
export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is FIELD_OFFICER
    if (session.user.role !== "FIELD_OFFICER") {
      return NextResponse.json(
        { error: "Forbidden - Field Officer access required" },
        { status: 403 }
      )
    }

    // Parse assigned secretariats
    const secretariats = parseAssignedSecretariats(
      session.user.assignedSecretariats
    )

    if (secretariats.length === 0) {
      return NextResponse.json(
        { error: "No secretariats assigned to this field officer" },
        { status: 400 }
      )
    }

    // Get unique mandals
    const uniqueMandals = [...new Set(secretariats.map((s) => s.mandalName))]

    // Group secretariats by mandal
    const secretariatsByMandal = uniqueMandals.map((mandal) => ({
      mandalName: mandal,
      secretariats: secretariats
        .filter((s) => s.mandalName === mandal)
        .map((s) => s.secName),
    }))

    return NextResponse.json({
      secretariats,
      uniqueMandals,
      secretariatsByMandal,
      totalSecretariats: secretariats.length,
      totalMandals: uniqueMandals.length,
    })
  } catch (error) {
    console.error("Get assigned secretariats error:", error)
    return NextResponse.json(
      { error: "Failed to get assigned secretariats" },
      { status: 500 }
    )
  }
}


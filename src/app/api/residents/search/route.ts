import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const uid = searchParams.get("uid")
  const mandal = searchParams.get("mandal")
  const secretariat = searchParams.get("secretariat")
  const phc = searchParams.get("phc")
  const searchMode = searchParams.get("mode") || "uid" // "uid" or "advanced"

  try {
    // Mode 1: Direct UID Search (original functionality)
    if (searchMode === "uid" || uid) {
      // Validate UID parameter
      if (!uid) {
        return NextResponse.json({ error: "UID is required for UID search" }, { status: 400 })
      }

      // Validate UID format (12 digits)
      if (!/^\d{12}$/.test(uid)) {
        return NextResponse.json(
          { error: "Invalid UID format. Must be 12 digits." },
          { status: 400 }
        )
      }

      // Find resident by UID (single table query - no JOINs needed)
      const resident = await prisma.resident.findUnique({
        where: { uid },
      })

      if (!resident) {
        return NextResponse.json(
          { error: "Resident not found" },
          { status: 404 }
        )
      }

      // Find all household members using the same hhId
      const householdMembers = await prisma.resident.findMany({
        where: { hhId: resident.hhId },
        orderBy: { name: "asc" },
      })

      return NextResponse.json({
        searchedResident: resident,
        householdMembers,
        householdId: resident.hhId,
        totalMembers: householdMembers.length,
        searchMode: "uid",
      })
    }

    // Mode 2: Advanced Filter Search (hierarchical)
    if (searchMode === "advanced") {
      // Build where clause based on filters
      const whereClause: {
        mandalName?: string
        secName?: string
        phcName?: string
      } = {}

      if (mandal) {
        whereClause.mandalName = mandal
      }

      if (secretariat) {
        whereClause.secName = secretariat
      }

      if (phc) {
        whereClause.phcName = phc
      }

      // At least one filter must be provided
      if (Object.keys(whereClause).length === 0) {
        return NextResponse.json(
          { error: "At least one filter (mandal, secretariat, or PHC) is required for advanced search" },
          { status: 400 }
        )
      }

      // Find all residents matching the filters
      const residents = await prisma.resident.findMany({
        where: whereClause,
        orderBy: [
          { hhId: "asc" },
          { name: "asc" },
        ],
      })

      if (residents.length === 0) {
        return NextResponse.json(
          { error: "No residents found matching the filters" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        residents,
        totalResidents: residents.length,
        filters: {
          mandal: mandal || null,
          secretariat: secretariat || null,
          phc: phc || null,
        },
        searchMode: "advanced",
      })
    }

    // Invalid search mode
    return NextResponse.json(
      { error: "Invalid search mode. Use 'uid' or 'advanced'" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


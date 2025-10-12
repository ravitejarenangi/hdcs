import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildResidentAccessFilter,
  canAccessResident,
  validateSearchFilters,
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

  const { searchParams } = new URL(request.url)
  const uid = searchParams.get("uid")
  const mandal = searchParams.get("mandal")
  const secretariat = searchParams.get("secretariat")
  const phc = searchParams.get("phc")
  const searchMode = searchParams.get("mode") || "uid" // "uid" or "advanced"
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")

  try {
    // Build base access filter for role-based data restriction
    const accessFilter = buildResidentAccessFilter(userSession)

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

      // Find resident by UID with role-based access filter
      const resident = await prisma.resident.findFirst({
        where: {
          uid,
          ...accessFilter,
        },
      })

      if (!resident) {
        return NextResponse.json(
          { error: "Resident not found or you do not have access to this resident" },
          { status: 404 }
        )
      }

      // Verify access to this specific resident
      if (!canAccessResident(userSession, resident)) {
        return NextResponse.json(
          { error: "You do not have permission to access this resident" },
          { status: 403 }
        )
      }

      // Find all household members using the same hhId with access filter
      const householdMembers = await prisma.resident.findMany({
        where: {
          hhId: resident.hhId,
          ...accessFilter,
        },
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

    // Mode 2: Advanced Filter Search (hierarchical) with pagination
    if (searchMode === "advanced") {
      // Validate search filters based on user role
      const validation = validateSearchFilters(userSession, {
        mandal: mandal || undefined,
        secretariat: secretariat || undefined,
        phc: phc || undefined,
      })

      if (!validation.isValid) {
        return NextResponse.json(
          { error: validation.error || "Invalid search filters" },
          { status: 403 }
        )
      }

      // Build where clause based on filters and access control
      const whereClause: any = {}

      // Apply access filter
      if (accessFilter.OR) {
        // For Field Officers with OR clause, we need to combine with user filters
        const userFilters: any = {}
        if (mandal) userFilters.mandalName = mandal
        if (secretariat) userFilters.secName = secretariat
        if (phc) userFilters.phcName = phc

        // Combine access filter OR with user filters using AND
        whereClause.AND = [
          { OR: accessFilter.OR },
          userFilters,
        ]
      } else {
        // For ADMIN or PANCHAYAT_SECRETARY, apply filters directly
        if (accessFilter.mandalName) {
          whereClause.mandalName = accessFilter.mandalName
        }

        if (mandal) {
          whereClause.mandalName = mandal
        }

        if (secretariat) {
          whereClause.secName = secretariat
        }

        if (phc) {
          whereClause.phcName = phc
        }
      }

      // At least one filter must be provided (or access filter is applied)
      if (
        !mandal &&
        !secretariat &&
        !phc &&
        Object.keys(accessFilter).length === 0
      ) {
        return NextResponse.json(
          { error: "At least one filter (mandal, secretariat, or PHC) is required for advanced search" },
          { status: 400 }
        )
      }

      // Validate pagination parameters
      const validatedPage = Math.max(1, page)
      const validatedLimit = Math.min(Math.max(1, limit), 100) // Max 100 per page
      const skip = (validatedPage - 1) * validatedLimit

      // Get total count
      const totalResidents = await prisma.resident.count({
        where: whereClause,
      })

      if (totalResidents === 0) {
        return NextResponse.json(
          { error: "No residents found matching the filters" },
          { status: 404 }
        )
      }

      // Find residents matching the filters with pagination
      const residents = await prisma.resident.findMany({
        where: whereClause,
        orderBy: [
          { hhId: "asc" },
          { name: "asc" },
        ],
        skip,
        take: validatedLimit,
      })

      const totalPages = Math.ceil(totalResidents / validatedLimit)

      return NextResponse.json({
        residents,
        totalResidents,
        pagination: {
          currentPage: validatedPage,
          totalPages,
          pageSize: validatedLimit,
          hasNextPage: validatedPage < totalPages,
          hasPreviousPage: validatedPage > 1,
        },
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


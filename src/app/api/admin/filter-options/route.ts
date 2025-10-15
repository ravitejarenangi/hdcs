import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Authorization check - Admin or Super Admin only
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      )
    }

    // Get optional filters from query string
    const searchParams = request.nextUrl.searchParams
    const mandalName = searchParams.get("mandalName")
    const secName = searchParams.get("secName")

    // Performance tracking
    const startTime = Date.now()

    // Build where clauses
    const secretariatsWhere: any = { secName: { not: null } }
    if (mandalName) {
      secretariatsWhere.mandalName = mandalName
    }

    const phcsWhere: any = { phcName: { not: null } }
    if (secName) {
      phcsWhere.secName = secName
    }

    // Use raw SQL for better performance with large datasets
    // Prisma's distinct queries can be slow on large tables
    const [mandalsRaw, secretariatsRaw, phcsRaw] = await Promise.all([
      // Fetch distinct mandals using GROUP BY (faster than DISTINCT)
      prisma.$queryRaw<Array<{ mandalName: string }>>`
        SELECT mandal_name as mandalName
        FROM residents
        WHERE mandal_name IS NOT NULL
        GROUP BY mandal_name
        ORDER BY mandal_name ASC
      `,
      // Fetch distinct secretariats (filtered by mandal if provided)
      mandalName
        ? prisma.$queryRaw<Array<{ secName: string }>>`
            SELECT sec_name as secName
            FROM residents
            WHERE sec_name IS NOT NULL
              AND mandal_name = ${mandalName}
            GROUP BY sec_name
            ORDER BY sec_name ASC
          `
        : prisma.$queryRaw<Array<{ secName: string }>>`
            SELECT sec_name as secName
            FROM residents
            WHERE sec_name IS NOT NULL
            GROUP BY sec_name
            ORDER BY sec_name ASC
          `,
      // Fetch distinct PHCs (filtered by secretariat if provided)
      secName
        ? prisma.$queryRaw<Array<{ phcName: string }>>`
            SELECT phc_name as phcName
            FROM residents
            WHERE phc_name IS NOT NULL
              AND sec_name = ${secName}
            GROUP BY phc_name
            ORDER BY phc_name ASC
          `
        : prisma.$queryRaw<Array<{ phcName: string }>>`
            SELECT phc_name as phcName
            FROM residents
            WHERE phc_name IS NOT NULL
            GROUP BY phc_name
            ORDER BY phc_name ASC
          `,
    ])

    // Extract values from raw query results
    const mandals = mandalsRaw.map((m) => m.mandalName).filter(Boolean)
    const secretariats = secretariatsRaw.map((s) => s.secName).filter(Boolean)
    const phcs = phcsRaw.map((p) => p.phcName).filter(Boolean)

    // Performance logging
    const duration = Date.now() - startTime
    console.log(`Filter options query completed in ${duration}ms`, {
      mandalCount: mandals.length,
      secretariatCount: secretariats.length,
      phcCount: phcs.length,
      filters: { mandalName, secName },
    })

    // Return response with cache headers
    return NextResponse.json(
      {
        mandals,
        secretariats,
        phcs,
      },
      {
        headers: {
          // Cache for 5 minutes (filter options rarely change)
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    )
  } catch (error) {
    console.error("Filter options error:", error)
    return NextResponse.json(
      { error: "Failed to fetch filter options" },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Fetch duplicate mobile numbers (appearing more than 5 times)
    const duplicates = await prisma.$queryRaw<Array<{
      citizen_mobile: string
      count: number
      sample_names: string
      sample_mandals: string
      sample_secretariats: string
    }>>`
      SELECT
        citizen_mobile,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT name SEPARATOR ', ') as sample_names,
        GROUP_CONCAT(DISTINCT mandal_name SEPARATOR ', ') as sample_mandals,
        GROUP_CONCAT(DISTINCT sec_name SEPARATOR ', ') as sample_secretariats
      FROM residents
      WHERE citizen_mobile IS NOT NULL
        AND citizen_mobile != 'N/A'
        AND citizen_mobile != '0'
        AND citizen_mobile != ''
      GROUP BY citizen_mobile
      HAVING COUNT(*) > 5
      ORDER BY COUNT(*) DESC, citizen_mobile
    `

    // Get detailed residents for each duplicate mobile number
    const mobileNumbers = duplicates.map((d) => d.citizen_mobile)

    // Fetch resident details for all duplicate mobiles
    const residents = await prisma.resident.findMany({
      where: {
        citizenMobile: { in: mobileNumbers },
      },
      select: {
        residentId: true,
        name: true,
        citizenMobile: true,
        healthId: true,
        mandalName: true,
        secName: true,
        updatedAt: true,
      },
      orderBy: { citizenMobile: "asc" },
    })

    // Group residents by mobile number
    const residentsByMobile = residents.reduce((acc, resident) => {
      const mobile = resident.citizenMobile || ""
      if (!acc[mobile]) {
        acc[mobile] = []
      }
      acc[mobile].push(resident)
      return acc
    }, {} as Record<string, typeof residents>)

    // Format the response
    const result = duplicates.map((dup) => ({
      mobileNumber: dup.citizen_mobile,
      count: Number(dup.count),
      sampleNames: dup.sample_names?.split(", ") || [],
      mandals: [...new Set(dup.sample_mandals?.split(", ") || [])],
      secretariats: [...new Set(dup.sample_secretariats?.split(", ") || [])],
      residents: residentsByMobile[dup.citizen_mobile] || [],
    }))

    return NextResponse.json({
      total: result.length,
      totalAffectedResidents: result.reduce((sum, r) => sum + r.count, 0),
      duplicates: result,
    })
  } catch (error) {
    console.error("Error fetching duplicate mobile numbers:", error)
    return NextResponse.json(
      { error: "Failed to fetch duplicate mobile numbers" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(_request: NextRequest) {
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

  try {
    // 1. Total residents count
    const totalResidents = await prisma.resident.count()

    // 2. Mobile number completion rate (excluding placeholders: NULL, "N/A", "0", empty string)
    const residentsWithMobile = await prisma.resident.count({
      where: {
        AND: [
          {
            mobileNumber: {
              not: null,
            },
          },
          {
            mobileNumber: {
              not: "N/A",
            },
          },
          {
            mobileNumber: {
              not: "0",
            },
          },
          {
            mobileNumber: {
              not: "",
            },
          },
        ],
      },
    })
    const mobileCompletionRate =
      totalResidents > 0
        ? Math.round((residentsWithMobile / totalResidents) * 100)
        : 0

    // 3. Health ID completion rate (excluding placeholders: NULL, "N/A", empty string)
    const residentsWithHealthId = await prisma.resident.count({
      where: {
        AND: [
          {
            healthId: {
              not: null,
            },
          },
          {
            healthId: {
              not: "N/A",
            },
          },
          {
            healthId: {
              not: "",
            },
          },
        ],
      },
    })
    const healthIdCompletionRate =
      totalResidents > 0
        ? Math.round((residentsWithHealthId / totalResidents) * 100)
        : 0

    // 3a. Count records with placeholder values
    const residentsWithNamePlaceholder = await prisma.resident.count({
      where: {
        name: {
          startsWith: "UNKNOWN_NAME_",
        },
      },
    })

    const residentsWithHhIdPlaceholder = await prisma.resident.count({
      where: {
        hhId: {
          startsWith: "HH_UNKNOWN_",
        },
      },
    })

    const residentsWithMobilePlaceholder = await prisma.resident.count({
      where: {
        OR: [
          { mobileNumber: null },
          { mobileNumber: "N/A" },
          { mobileNumber: "0" },
          { mobileNumber: "" },
        ],
      },
    })

    const residentsWithHealthIdPlaceholder = await prisma.resident.count({
      where: {
        OR: [
          { healthId: null },
          { healthId: "N/A" },
          { healthId: "" },
        ],
      },
    })

    // 4. Recent updates (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentUpdates = await prisma.updateLog.findMany({
      where: {
        updateTimestamp: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        user: {
          select: {
            username: true,
            fullName: true,
          },
        },
        resident: {
          select: {
            name: true,
            residentId: true,
          },
        },
      },
      orderBy: {
        updateTimestamp: "desc",
      },
      take: 50, // Limit to 50 most recent updates
    })

    const recentUpdatesCount = await prisma.updateLog.count({
      where: {
        updateTimestamp: {
          gte: thirtyDaysAgo,
        },
      },
    })

    // 5. Mandal-wise statistics (using consolidated schema - no JOINs)
    const mandalStats = await prisma.resident.groupBy({
      by: ["mandalName"],
      _count: {
        id: true,
      },
      where: {
        mandalName: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    })

    // Format mandal stats for easier consumption
    const mandalStatistics = mandalStats.map((stat) => ({
      mandalName: stat.mandalName || "Unknown",
      residentCount: stat._count.id,
    }))

    // 6. Field officer performance metrics
    // Get ALL active field officers (not just those with updates)
    const allFieldOfficers = await prisma.user.findMany({
      where: {
        role: "FIELD_OFFICER",
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        assignedSecretariats: true,
        mandalName: true,
      },
    })

    // Get update counts for each field officer
    const updateCounts = await prisma.updateLog.groupBy({
      by: ["userId"],
      _count: {
        id: true,
      },
      where: {
        userId: {
          in: allFieldOfficers.map((officer) => officer.id),
        },
      },
    })

    // Create a map of userId to update count
    const updateCountMap = new Map(
      updateCounts.map((count) => [count.userId, count._count.id])
    )

    // Combine field officer data with update counts (including 0 updates)
    const fieldOfficerStats = allFieldOfficers
      .map((officer) => {
        // Extract mandals from assignedSecretariats for field officers
        let mandals: string[] = []
        if (officer.role === "FIELD_OFFICER" && officer.assignedSecretariats) {
          try {
            const secretariats = JSON.parse(officer.assignedSecretariats)
            if (Array.isArray(secretariats)) {
              // Handle both old and new formats
              const mandalNames = secretariats.map((s: any) => {
                if (typeof s === 'string') {
                  // Old format: "MANDAL -> SECRETARIAT"
                  const parts = s.split(' -> ')
                  return parts[0]?.trim()
                } else if (typeof s === 'object' && s.mandalName) {
                  // New format: {mandalName: "CHITTOOR", secName: "KONGAREDDYPALLI"}
                  return s.mandalName
                }
                return null
              }).filter(Boolean)

              // Get unique mandal names
              mandals = [...new Set(mandalNames)]
            }
          } catch (e) {
            console.error(`Failed to parse assignedSecretariats for officer ${officer.username}:`, e)
          }
        } else if (officer.mandalName) {
          // For Panchayat Secretary
          mandals = [officer.mandalName]
        }

        return {
          userId: officer.id,
          username: officer.username,
          name: officer.fullName,
          role: officer.role,
          mandals, // Array of mandal names this officer is assigned to
          updatesCount: updateCountMap.get(officer.id) || 0,
        }
      })
      .sort((a, b) => b.updatesCount - a.updatesCount) // Sort by update count descending

    // 6a. Count officers who are currently active (made updates in last 15 minutes)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)

    const activeOfficersInLast15Min = await prisma.updateLog.groupBy({
      by: ["userId"],
      where: {
        updateTimestamp: {
          gte: fifteenMinutesAgo,
        },
        user: {
          role: "FIELD_OFFICER",
          isActive: true,
        },
      },
    })

    const currentlyActiveOfficersCount = activeOfficersInLast15Min.length

    // 7. Updates over time (last 7 days for chart)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const updatesOverTime = await prisma.updateLog.findMany({
      where: {
        updateTimestamp: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        updateTimestamp: true,
      },
    })

    // Group by date (not datetime)
    const updatesByDate: { [key: string]: number } = {}
    updatesOverTime.forEach((update) => {
      const date = update.updateTimestamp.toISOString().split("T")[0]
      updatesByDate[date] = (updatesByDate[date] || 0) + 1
    })

    const updatesTimeline = Object.entries(updatesByDate).map(
      ([date, count]) => ({
        date,
        count,
      })
    )

    // 8. Completion statistics by mandal (excluding placeholder values)
    const mandalCompletionStats = await prisma.$queryRaw<
      Array<{
        mandalName: string
        totalResidents: bigint
        withMobile: bigint
        withHealthId: bigint
      }>
    >`
      SELECT
        mandal_name as mandalName,
        COUNT(*) as totalResidents,
        SUM(CASE
          WHEN mobile_number IS NOT NULL
            AND mobile_number != 'N/A'
            AND mobile_number != '0'
            AND mobile_number != ''
          THEN 1
          ELSE 0
        END) as withMobile,
        SUM(CASE
          WHEN health_id IS NOT NULL
            AND health_id != 'N/A'
            AND health_id != ''
          THEN 1
          ELSE 0
        END) as withHealthId
      FROM residents
      WHERE mandal_name IS NOT NULL
      GROUP BY mandal_name
      ORDER BY totalResidents DESC
    `

    const mandalCompletion = mandalCompletionStats.map((stat) => ({
      mandalName: stat.mandalName,
      totalResidents: Number(stat.totalResidents),
      withMobile: Number(stat.withMobile),
      withHealthId: Number(stat.withHealthId),
      mobileCompletionRate:
        Number(stat.totalResidents) > 0
          ? Math.round(
              (Number(stat.withMobile) / Number(stat.totalResidents)) * 100
            )
          : 0,
      healthIdCompletionRate:
        Number(stat.totalResidents) > 0
          ? Math.round(
              (Number(stat.withHealthId) / Number(stat.totalResidents)) * 100
            )
          : 0,
    }))

    // 9. Hierarchical completion statistics (Mandal → Secretariat)
    const hierarchicalStats = await prisma.$queryRaw<
      Array<{
        mandalName: string
        secName: string | null
        totalResidents: bigint
        withMobile: bigint
        withHealthId: bigint
      }>
    >`
      SELECT
        mandal_name as mandalName,
        sec_name as secName,
        COUNT(*) as totalResidents,
        SUM(CASE
          WHEN mobile_number IS NOT NULL
            AND mobile_number != 'N/A'
            AND mobile_number != '0'
            AND mobile_number != ''
          THEN 1
          ELSE 0
        END) as withMobile,
        SUM(CASE
          WHEN health_id IS NOT NULL
            AND health_id != 'N/A'
            AND health_id != ''
          THEN 1
          ELSE 0
        END) as withHealthId
      FROM residents
      WHERE mandal_name IS NOT NULL AND sec_name IS NOT NULL
      GROUP BY mandal_name, sec_name
      ORDER BY mandal_name, sec_name
    `

    // Build hierarchical structure (2 levels: Mandal → Secretariat)
    const mandalHierarchy = mandalCompletion.map((mandal) => {
      // Get all secretariats for this mandal
      const secretariats = hierarchicalStats
        .filter((stat) => stat.mandalName === mandal.mandalName && stat.secName)
        .map((stat) => ({
          secName: stat.secName!,
          totalResidents: Number(stat.totalResidents),
          withMobile: Number(stat.withMobile),
          withHealthId: Number(stat.withHealthId),
          mobileCompletionRate:
            Number(stat.totalResidents) > 0
              ? Math.round((Number(stat.withMobile) / Number(stat.totalResidents)) * 100)
              : 0,
          healthIdCompletionRate:
            Number(stat.totalResidents) > 0
              ? Math.round((Number(stat.withHealthId) / Number(stat.totalResidents)) * 100)
              : 0,
        }))

      return {
        ...mandal,
        secretariats,
      }
    })

    // Return comprehensive analytics
    return NextResponse.json({
      overview: {
        totalResidents,
        residentsWithMobile,
        residentsWithHealthId,
        mobileCompletionRate,
        healthIdCompletionRate,
        recentUpdatesCount,
        // Placeholder metrics
        residentsWithNamePlaceholder,
        residentsWithHhIdPlaceholder,
        residentsWithMobilePlaceholder,
        residentsWithHealthIdPlaceholder,
        // Field officer activity metrics
        currentlyActiveOfficersCount, // Officers active in last 15 minutes
        totalActiveOfficersCount: allFieldOfficers.length, // Total enabled officers
      },
      mandalStatistics,
      mandalCompletion,
      mandalHierarchy, // New hierarchical data
      fieldOfficerPerformance: fieldOfficerStats,
      recentUpdates: recentUpdates.map((update) => ({
        id: update.id,
        residentName: update.resident.name,
        residentId: update.resident.residentId,
        fieldUpdated: update.fieldUpdated,
        oldValue: update.oldValue,
        newValue: update.newValue,
        updatedBy: update.user.fullName,
        username: update.user.username,
        updatedAt: update.updateTimestamp,
      })),
      updatesTimeline,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


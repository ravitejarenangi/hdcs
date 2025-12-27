import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cache, CacheKeys } from "@/lib/cache"

// Performance monitoring helper
function logTiming(label: string, startTime: number) {
  const duration = Date.now() - startTime
  console.log(`[Analytics] ${label}: ${duration}ms`)
  return duration
}

export async function GET(request: Request) {
  const requestStart = Date.now()

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

  // Parse query parameters for date filtering
  const { searchParams } = new URL(request.url)
  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")

  let startDate: Date | null = null
  let endDate: Date | null = null

  if (startDateParam) {
    startDate = new Date(startDateParam)
  }
  if (endDateParam) {
    endDate = new Date(endDateParam)
    // Set to end of day
    endDate.setHours(23, 59, 59, 999)
  }

  // Check cache first (only if no date filters)
  const cacheKey = CacheKeys.adminAnalytics()
  const cachedData = cache.get<Record<string, unknown>>(cacheKey)

  if (cachedData && !startDate && !endDate) {
    console.log('[Analytics] Returning cached data')
    return NextResponse.json({
      ...cachedData,
      cached: true,
    })
  }

  try {
    console.log('[Analytics] Generating fresh analytics data...')

    // Execute all independent queries in parallel for better performance
    const [
      totalResidents,
      residentsWithMobile,
      residentsWithHealthId,
      residentsWithNamePlaceholder,
      residentsWithHhIdPlaceholder,
      residentsWithMobilePlaceholder,
      residentsWithHealthIdPlaceholder,
      duplicateMobileNumbers,
      duplicateHealthIds,
    ] = await Promise.all([
      // 1. Total residents count
      prisma.resident.count(),

      // 2. Mobile number completion rate (excluding placeholders)
      prisma.resident.count({
        where: {
          AND: [
            { citizenMobile: { not: null } },
            { citizenMobile: { not: "N/A" } },
            { citizenMobile: { not: "0" } },
            { citizenMobile: { not: "" } },
          ],
        },
      }),

      // 3. Health ID completion rate (excluding placeholders)
      prisma.resident.count({
        where: {
          AND: [
            { healthId: { not: null } },
            { healthId: { not: "N/A" } },
            { healthId: { not: "" } },
          ],
        },
      }),

      // 3a. Count records with placeholder values
      prisma.resident.count({
        where: { name: { startsWith: "UNKNOWN_NAME_" } },
      }),

      prisma.resident.count({
        where: { hhId: { startsWith: "HH_UNKNOWN_" } },
      }),

      prisma.resident.count({
        where: {
          OR: [
            { citizenMobile: null },
            { citizenMobile: "N/A" },
            { citizenMobile: "0" },
            { citizenMobile: "" },
          ],
        },
      }),

      prisma.resident.count({
        where: {
          OR: [
            { healthId: null },
            { healthId: "N/A" },
            { healthId: "" },
          ],
        },
      }),

      // Count duplicate mobile numbers (excluding null/invalid values)
      // Mobile numbers appearing MORE THAN 5 times (6+ occurrences) are considered duplicates
      prisma.$queryRaw<{ count: bigint }>`
        SELECT COUNT(*) as count
        FROM (
          SELECT citizen_mobile
          FROM residents
          WHERE citizen_mobile IS NOT NULL
            AND citizen_mobile != 'N/A'
            AND citizen_mobile != '0'
            AND citizen_mobile != ''
          GROUP BY citizen_mobile
          HAVING COUNT(*) > 5
        ) AS duplicates
      `,

      // Count duplicate ABHA IDs (excluding null/invalid values)
      // ABHA IDs appearing MORE THAN 1 time (2+ occurrences) are considered duplicates
      prisma.$queryRaw<{ count: bigint }>`
        SELECT COUNT(*) as count
        FROM (
          SELECT health_id
          FROM residents
          WHERE health_id IS NOT NULL
            AND health_id != 'N/A'
            AND health_id != ''
          GROUP BY health_id
          HAVING COUNT(*) > 1
        ) AS duplicates
      `,
    ])

    logTiming('Basic counts', requestStart)

    const mobileCompletionRate =
      totalResidents > 0
        ? Math.round((residentsWithMobile / totalResidents) * 100)
        : 0

    const healthIdCompletionRate =
      totalResidents > 0
        ? Math.round((residentsWithHealthId / totalResidents) * 100)
        : 0

    // 4. Recent updates (last 30 days) - Execute in parallel
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get start of today (00:00:00) for today's updates
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [
      recentUpdates,
      recentUpdatesCount,
      mobileUpdatesCount,
      healthIdUpdatesCount,
      mobileUpdatesAllTime,
      mobileUpdatesToday,
      healthIdUpdatesAllTime,
      healthIdsAddedViaUpdates,
    ] = await Promise.all([
      prisma.updateLog.findMany({
        where: {
          updateTimestamp: { gte: thirtyDaysAgo },
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
      }),

      // Total updates count (for backward compatibility)
      prisma.updateLog.count({
        where: {
          updateTimestamp: { gte: thirtyDaysAgo },
        },
      }),

      // Mobile number updates count (last 30 days)
      // Check for both "citizen_mobile" and "mobile_number" for backward compatibility
      prisma.updateLog.count({
        where: {
          updateTimestamp: { gte: thirtyDaysAgo },
          OR: [
            { fieldUpdated: "citizen_mobile" },
            { fieldUpdated: "mobile_number" },
            { fieldUpdated: "citizenMobile" },
            { fieldUpdated: "mobileNumber" },
          ],
        },
      }),

      // Health ID updates count (last 30 days)
      // Check for both "health_id" and "healthId" for backward compatibility
      prisma.updateLog.count({
        where: {
          updateTimestamp: { gte: thirtyDaysAgo },
          OR: [
            { fieldUpdated: "health_id" },
            { fieldUpdated: "healthId" },
          ],
        },
      }),

      // Mobile number updates - ALL TIME
      prisma.updateLog.count({
        where: {
          OR: [
            { fieldUpdated: "citizen_mobile" },
            { fieldUpdated: "mobile_number" },
            { fieldUpdated: "citizenMobile" },
            { fieldUpdated: "mobileNumber" },
          ],
        },
      }),

      // Mobile number updates - TODAY
      prisma.updateLog.count({
        where: {
          updateTimestamp: { gte: startOfToday },
          OR: [
            { fieldUpdated: "citizen_mobile" },
            { fieldUpdated: "mobile_number" },
            { fieldUpdated: "citizenMobile" },
            { fieldUpdated: "mobileNumber" },
          ],
        },
      }),

      // Health ID updates - ALL TIME
      prisma.updateLog.count({
        where: {
          OR: [
            { fieldUpdated: "health_id" },
            { fieldUpdated: "healthId" },
          ],
        },
      }),

      // Health IDs added via updates (where oldValue was null/empty and newValue has a health ID)
      prisma.updateLog.count({
        where: {
          OR: [
            { fieldUpdated: "health_id" },
            { fieldUpdated: "healthId" },
          ],
          AND: [
            {
              OR: [
                { oldValue: null },
                { oldValue: "" },
                { oldValue: "null" },
                { oldValue: "N/A" },
              ],
            },
            {
              newValue: {
                not: null,
                notIn: ["", "null", "N/A"],
              },
            },
          ],
        },
      }),
    ])

    logTiming('Recent updates', requestStart)

    // 5. Mandal-wise statistics (using consolidated schema - no JOINs)
    // Note: Using type assertion as mandalName exists in DB but not in Prisma schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mandalStats = await (prisma.resident.groupBy as any)({
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
    const mandalStatistics = mandalStats.map((stat: Record<string, unknown>) => ({
      mandalName: (stat.mandalName as string) || "Unknown",
      residentCount: ((stat._count as Record<string, number>)?.id) || 0,
    }))

    // 6. Field officer performance metrics - Execute in parallel
    const [allFieldOfficers, updateCounts, mobileUpdateCounts, healthIdUpdateCounts] = await Promise.all([
      // Get ALL active field officers (not just those with updates)
      // Note: Using type assertion as assignedSecretariats/mandalName exist in DB but not in Prisma schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.user.findMany as any)({
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
      }),

      // Get total update counts for all field officers
      prisma.updateLog.groupBy({
        by: ["userId"],
        _count: {
          id: true,
        },
        where: {
          user: {
            role: "FIELD_OFFICER",
            isActive: true,
          },
          ...(startDate || endDate ? {
            updateTimestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          } : {}),
        },
      }),

      // Get mobile number update counts
      prisma.updateLog.groupBy({
        by: ["userId"],
        _count: {
          id: true,
        },
        where: {
          user: {
            role: "FIELD_OFFICER",
            isActive: true,
          },
          fieldUpdated: {
            in: ["citizen_mobile", "mobile_number", "citizenMobile", "mobileNumber"],
          },
          ...(startDate || endDate ? {
            updateTimestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          } : {}),
        },
      }),

      // Get health ID update counts
      prisma.updateLog.groupBy({
        by: ["userId"],
        _count: {
          id: true,
        },
        where: {
          user: {
            role: "FIELD_OFFICER",
            isActive: true,
          },
          fieldUpdated: {
            in: ["health_id", "healthId"],
          },
          ...(startDate || endDate ? {
            updateTimestamp: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          } : {}),
        },
      }),
    ])

    logTiming('Field officer data', requestStart)

    // Create maps of userId to update counts
    const updateCountMap = new Map(
      updateCounts.map((count) => [count.userId, count._count?.id || 0])
    )
    const mobileUpdateCountMap = new Map(
      mobileUpdateCounts.map((count) => [count.userId, count._count?.id || 0])
    )
    const healthIdUpdateCountMap = new Map(
      healthIdUpdateCounts.map((count) => [count.userId, count._count?.id || 0])
    )

    // Combine field officer data with update counts (including 0 updates)
    const fieldOfficerStats = allFieldOfficers
      .map((officer: Record<string, unknown>) => {
        // Extract mandals from assignedSecretariats for field officers
        let mandals: string[] = []
        if (officer.role === "FIELD_OFFICER" && officer.assignedSecretariats) {
          try {
            const secretariats = JSON.parse(officer.assignedSecretariats as string)
            if (Array.isArray(secretariats)) {
              // Handle both old and new formats
              const mandalNames = secretariats.map((s: string | { mandalName?: string }) => {
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
              mandals = [...new Set(mandalNames)] as string[]
            }
          } catch (e) {
            console.error(`Failed to parse assignedSecretariats for officer ${officer.username}:`, e)
          }
        } else if (officer.mandalName) {
          // For Panchayat Secretary
          mandals = [officer.mandalName as string]
        }

        return {
          userId: officer.id as string,
          username: officer.username as string,
          name: officer.fullName as string,
          role: officer.role as string,
          mandals, // Array of mandal names this officer is assigned to
          updatesCount: updateCountMap.get(officer.id as string) || 0,
          mobileUpdatesCount: mobileUpdateCountMap.get(officer.id as string) || 0,
          healthIdUpdatesCount: healthIdUpdateCountMap.get(officer.id as string) || 0,
        }
      })
      .sort((a: { updatesCount: number }, b: { updatesCount: number }) => b.updatesCount - a.updatesCount) // Sort by update count descending

    // 6a. Count officers who are currently active (made updates in last 15 minutes)
    // 7. Updates over time (last 7 days for chart)
    // Execute in parallel
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [activeOfficersInLast15Min, updatesOverTime] = await Promise.all([
      prisma.updateLog.groupBy({
        by: ["userId"],
        where: {
          updateTimestamp: { gte: fifteenMinutesAgo },
          user: {
            role: "FIELD_OFFICER",
            isActive: true,
          },
        },
      }),

      prisma.updateLog.findMany({
        where: {
          updateTimestamp: { gte: sevenDaysAgo },
        },
        select: {
          updateTimestamp: true,
        },
      }),
    ])

    const currentlyActiveOfficersCount = activeOfficersInLast15Min.length

    logTiming('Activity metrics', requestStart)

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

    // 8 & 9. Completion statistics - Execute both raw queries in parallel
    const [mandalCompletionStats, hierarchicalStats] = await Promise.all([
      // 8. Mandal-level completion statistics
      prisma.$queryRaw<
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
            WHEN citizen_mobile IS NOT NULL
              AND citizen_mobile != 'N/A'
              AND citizen_mobile != '0'
              AND citizen_mobile != ''
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
      `,

      // 9. Hierarchical completion statistics (Mandal → Secretariat)
      prisma.$queryRaw<
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
            WHEN citizen_mobile IS NOT NULL
              AND citizen_mobile != 'N/A'
              AND citizen_mobile != '0'
              AND citizen_mobile != ''
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
      `,
    ])

    logTiming('Completion statistics', requestStart)

    // 10. Mandal-wise update statistics
    const mandalUpdateStats = await prisma.$queryRaw<
      Array<{
        mandalName: string
        mobileUpdatesAllTime: bigint
        mobileUpdatesToday: bigint
        healthIdUpdatesAllTime: bigint
        healthIdUpdatesToday: bigint
        healthIdsAddedViaUpdates: bigint
      }>
    >`
      SELECT
        r.mandal_name as mandalName,
        -- Mobile updates (all time)
        COUNT(CASE
          WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
          THEN 1
        END) as mobileUpdatesAllTime,
        -- Mobile updates (today)
        COUNT(CASE
          WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
            AND ul.update_timestamp >= ${startOfToday}
          THEN 1
        END) as mobileUpdatesToday,
        -- Health ID updates (all time)
        COUNT(CASE
          WHEN ul.field_updated IN ('health_id', 'healthId')
          THEN 1
        END) as healthIdUpdatesAllTime,
        -- Health ID updates (today)
        COUNT(CASE
          WHEN ul.field_updated IN ('health_id', 'healthId')
            AND ul.update_timestamp >= ${startOfToday}
          THEN 1
        END) as healthIdUpdatesToday,
        -- Health IDs added via updates (where oldValue was null/empty)
        COUNT(CASE
          WHEN ul.field_updated IN ('health_id', 'healthId')
            AND (ul.old_value IS NULL OR ul.old_value IN ('', 'null', 'N/A'))
            AND ul.new_value IS NOT NULL
            AND ul.new_value NOT IN ('', 'null', 'N/A')
          THEN 1
        END) as healthIdsAddedViaUpdates
      FROM update_logs ul
      INNER JOIN residents r ON ul.resident_id = r.resident_id
      WHERE r.mandal_name IS NOT NULL
      GROUP BY r.mandal_name
    `

    logTiming('Mandal update statistics', requestStart)

    // 11. Secretariat-wise update statistics
    const secretariatUpdateStats = await prisma.$queryRaw<
      Array<{
        mandalName: string
        secName: string
        mobileUpdatesAllTime: bigint
        mobileUpdatesToday: bigint
        healthIdUpdatesAllTime: bigint
        healthIdUpdatesToday: bigint
        healthIdsAddedViaUpdates: bigint
      }>
    >`
      SELECT
        r.mandal_name as mandalName,
        r.sec_name as secName,
        -- Mobile updates (all time)
        COUNT(CASE
          WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
          THEN 1
        END) as mobileUpdatesAllTime,
        -- Mobile updates (today)
        COUNT(CASE
          WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
            AND ul.update_timestamp >= ${startOfToday}
          THEN 1
        END) as mobileUpdatesToday,
        -- Health ID updates (all time)
        COUNT(CASE
          WHEN ul.field_updated IN ('health_id', 'healthId')
          THEN 1
        END) as healthIdUpdatesAllTime,
        -- Health ID updates (today)
        COUNT(CASE
          WHEN ul.field_updated IN ('health_id', 'healthId')
            AND ul.update_timestamp >= ${startOfToday}
          THEN 1
        END) as healthIdUpdatesToday,
        -- Health IDs added via updates (where oldValue was null/empty)
        COUNT(CASE
          WHEN ul.field_updated IN ('health_id', 'healthId')
            AND (ul.old_value IS NULL OR ul.old_value IN ('', 'null', 'N/A'))
            AND ul.new_value IS NOT NULL
            AND ul.new_value NOT IN ('', 'null', 'N/A')
          THEN 1
        END) as healthIdsAddedViaUpdates
      FROM update_logs ul
      INNER JOIN residents r ON ul.resident_id = r.resident_id
      WHERE r.mandal_name IS NOT NULL AND r.sec_name IS NOT NULL
      GROUP BY r.mandal_name, r.sec_name
    `

    logTiming('Secretariat update statistics', requestStart)

    // Create a map for quick lookup of update stats by mandal
    const mandalUpdateStatsMap = new Map(
      mandalUpdateStats.map((stat) => [
        stat.mandalName,
        {
          mobileUpdatesAllTime: Number(stat.mobileUpdatesAllTime),
          mobileUpdatesToday: Number(stat.mobileUpdatesToday),
          healthIdUpdatesAllTime: Number(stat.healthIdUpdatesAllTime),
          healthIdUpdatesToday: Number(stat.healthIdUpdatesToday),
          healthIdsAddedViaUpdates: Number(stat.healthIdsAddedViaUpdates),
        },
      ])
    )

    // Create a map for secretariat update stats
    const secretariatUpdateStatsMap = new Map(
      secretariatUpdateStats.map((stat) => [
        `${stat.mandalName}|${stat.secName}`,
        {
          mobileUpdatesAllTime: Number(stat.mobileUpdatesAllTime),
          mobileUpdatesToday: Number(stat.mobileUpdatesToday),
          healthIdUpdatesAllTime: Number(stat.healthIdUpdatesAllTime),
          healthIdUpdatesToday: Number(stat.healthIdUpdatesToday),
          healthIdsAddedViaUpdates: Number(stat.healthIdsAddedViaUpdates),
        },
      ])
    )

    const mandalCompletion = mandalCompletionStats.map((stat) => {
      const updateStats = mandalUpdateStatsMap.get(stat.mandalName) || {
        mobileUpdatesAllTime: 0,
        mobileUpdatesToday: 0,
        healthIdUpdatesAllTime: 0,
        healthIdUpdatesToday: 0,
        healthIdsAddedViaUpdates: 0,
      }

      const withHealthId = Number(stat.withHealthId)
      const healthIdsOriginal = withHealthId - updateStats.healthIdsAddedViaUpdates

      return {
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
        // Update statistics
        mobileUpdatesAllTime: updateStats.mobileUpdatesAllTime,
        mobileUpdatesToday: updateStats.mobileUpdatesToday,
        healthIdUpdatesAllTime: updateStats.healthIdUpdatesAllTime,
        healthIdUpdatesToday: updateStats.healthIdUpdatesToday,
        healthIdsOriginal,
        healthIdsAddedViaUpdates: updateStats.healthIdsAddedViaUpdates,
      }
    })

    // Build hierarchical structure (2 levels: Mandal → Secretariat)
    const mandalHierarchy = mandalCompletion.map((mandal) => {
      // Get all secretariats for this mandal
      const secretariats = hierarchicalStats
        .filter((stat) => stat.mandalName === mandal.mandalName && stat.secName)
        .map((stat) => {
          const secUpdateStats = secretariatUpdateStatsMap.get(
            `${stat.mandalName}|${stat.secName}`
          ) || {
            mobileUpdatesAllTime: 0,
            mobileUpdatesToday: 0,
            healthIdUpdatesAllTime: 0,
            healthIdUpdatesToday: 0,
            healthIdsAddedViaUpdates: 0,
          }

          const withHealthId = Number(stat.withHealthId)
          const healthIdsOriginal = withHealthId - secUpdateStats.healthIdsAddedViaUpdates

          return {
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
            // Update statistics
            mobileUpdatesAllTime: secUpdateStats.mobileUpdatesAllTime,
            mobileUpdatesToday: secUpdateStats.mobileUpdatesToday,
            healthIdUpdatesAllTime: secUpdateStats.healthIdUpdatesAllTime,
            healthIdUpdatesToday: secUpdateStats.healthIdUpdatesToday,
            healthIdsOriginal,
            healthIdsAddedViaUpdates: secUpdateStats.healthIdsAddedViaUpdates,
          }
        })

      return {
        ...mandal,
        secretariats,
      }
    })

    // Build final response
    const responseData = {
      overview: {
        totalResidents,
        residentsWithMobile,
        residentsWithHealthId,
        mobileCompletionRate,
        healthIdCompletionRate,
        recentUpdatesCount,
        // Separate update counts by field type
        mobileUpdatesCount,
        healthIdUpdatesCount,
        // Enhanced mobile and health ID statistics
        mobileUpdatesAllTime,
        mobileUpdatesToday,
        healthIdUpdatesAllTime,
        healthIdsAddedViaUpdates,
        // Calculate original health IDs (before updates)
        healthIdsOriginal: residentsWithHealthId - healthIdsAddedViaUpdates,
        // Placeholder metrics
        residentsWithNamePlaceholder,
        residentsWithHhIdPlaceholder,
        residentsWithMobilePlaceholder,
        residentsWithHealthIdPlaceholder,
        // Duplicate metrics
        duplicateMobileNumbers: Number(duplicateMobileNumbers[0]?.count || 0),
        duplicateHealthIds: Number(duplicateHealthIds[0]?.count || 0),
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
    }

    // Cache the response for 5 minutes (300 seconds)
    cache.set(cacheKey, responseData, 300)

    const totalTime = logTiming('Total analytics generation', requestStart)
    console.log(`[Analytics] Total time: ${totalTime}ms`)

    return NextResponse.json({
      ...responseData,
      cached: false,
    })
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


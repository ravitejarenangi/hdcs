import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { cache, CacheKeys } from "@/lib/cache"

// Performance monitoring helper
function logTiming(label: string, startTime: number) {
  const duration = Date.now() - startTime
  console.log(`[Panchayat Analytics] ${label}: ${duration}ms`)
  return duration
}

export async function GET() {
  const requestStart = Date.now()

  // Check authentication
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is PANCHAYAT_SECRETARY
  if (session.user.role !== "PANCHAYAT_SECRETARY") {
    return NextResponse.json(
      { error: "Forbidden - Panchayat Secretary access required" },
      { status: 403 }
    )
  }

  // Get mandal from session
  const mandalName = session.user.mandalName

  if (!mandalName) {
    return NextResponse.json(
      { error: "Mandal not assigned to user" },
      { status: 400 }
    )
  }

  // Check cache first
  const cacheKey = CacheKeys.panchayatAnalytics(mandalName)
  const cachedData = cache.get<Record<string, unknown>>(cacheKey)

  if (cachedData) {
    console.log(`[Panchayat Analytics] Returning cached data for ${mandalName}`)
    return NextResponse.json({
      ...cachedData,
      cached: true,
    })
  }

  try {
    console.log(`[Panchayat Analytics] Generating fresh analytics data for ${mandalName}...`)

    // Fetch cutoff date for filtering update metrics (exclude locked data)
    const cutoffSetting = await prisma.systemSettings.findUnique({
      where: { key: "RESIDENT_UPDATE_CUTOFF_DATE" },
    })
    const cutoffDate = cutoffSetting?.value ? new Date(cutoffSetting.value) : null

    // Common where clause for excluding placeholder names
    const baseWhere = {
      mandalName,
      name: {
        not: {
          startsWith: "UNKNOWN_NAME_",
        },
      },
    }

    // Execute all independent count queries in parallel
    const sixHoursAgo = new Date()
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6)

    // Start of today (midnight)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    // Basic counts - using raw SQL to exclude locked residents
    const [
      basicCounts,
      lockedCount,
    ] = await Promise.all([
      // All basic counts in one query, excluding locked residents
      cutoffDate
        ? prisma.$queryRaw<Array<{
            totalResidents: bigint
            residentsWithMobile: bigint
            residentsWithHealthId: bigint
          }>>`
            SELECT
              COUNT(*) as totalResidents,
              SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as residentsWithMobile,
              SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as residentsWithHealthId
            FROM residents
            WHERE mandal_name = ${mandalName}
              AND name NOT LIKE 'UNKNOWN_NAME_%'
              AND NOT (
                updated_at < ${cutoffDate}
                AND citizen_mobile IS NOT NULL
                AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                AND health_id IS NOT NULL
                AND health_id != 'N/A'
                AND health_id != ''
                AND CHAR_LENGTH(health_id) >= 14
              )
          `
        : prisma.$queryRaw<Array<{
            totalResidents: bigint
            residentsWithMobile: bigint
            residentsWithHealthId: bigint
          }>>`
            SELECT
              COUNT(*) as totalResidents,
              SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as residentsWithMobile,
              SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as residentsWithHealthId
            FROM residents
            WHERE mandal_name = ${mandalName}
              AND name NOT LIKE 'UNKNOWN_NAME_%'
          `,
      // Count locked residents for reference
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM residents
            WHERE mandal_name = ${mandalName}
              AND name NOT LIKE 'UNKNOWN_NAME_%'
              AND updated_at < ${cutoffDate}
              AND citizen_mobile IS NOT NULL
              AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
              AND health_id IS NOT NULL
              AND health_id != 'N/A'
              AND health_id != ''
              AND CHAR_LENGTH(health_id) >= 14
          `
        : Promise.resolve([{ count: BigInt(0) }]),
    ])

    const totalResidents = Number(basicCounts[0]?.totalResidents || 0)
    const residentsWithMobile = Number(basicCounts[0]?.residentsWithMobile || 0)
    const residentsWithHealthId = Number(basicCounts[0]?.residentsWithHealthId || 0)
    const totalLockedResidents = Number(lockedCount[0]?.count || 0)

    const [
      recentUpdatesCount,
      mobileUpdatesCount,
      mobileUpdatesToday,
      healthIdOriginalCount,
      healthIdUpdatesCount,
      healthIdUpdatesToday,
      recentMobileUpdatesCount,
      recentHealthIdUpdatesCount,
    ] = await Promise.all([
      // 4. Recent updates in mandal (last 6 hours, after cutoff if set)
      prisma.updateLog.count({
        where: {
          updateTimestamp: { gte: cutoffDate && cutoffDate > sixHoursAgo ? cutoffDate : sixHoursAgo },
          resident: baseWhere,
        },
      }),

      // 5. Mobile numbers updated (total count of residents with mobile updates, after cutoff if set)
      prisma.updateLog.groupBy({
        by: ['residentId'],
        where: {
          fieldUpdated: { in: ['citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber'] },
          ...(cutoffDate ? { updateTimestamp: { gte: cutoffDate } } : {}),
          resident: baseWhere,
        },
      }).then(result => result.length),

      // 6. Mobile numbers updated today (after cutoff if set)
      prisma.updateLog.groupBy({
        by: ['residentId'],
        where: {
          fieldUpdated: { in: ['citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber'] },
          updateTimestamp: { gte: cutoffDate && cutoffDate > startOfToday ? cutoffDate : startOfToday },
          resident: baseWhere,
        },
      }).then(result => result.length),

      // 7. Health IDs in original data (residents with health ID but no update logs after cutoff)
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT r.resident_id) as count
            FROM residents r
            LEFT JOIN update_logs ul ON r.resident_id = ul.resident_id
              AND ul.field_updated IN ('health_id', 'healthId', 'citizen_health_id', 'citizenHealthId')
              AND ul.update_timestamp >= ${cutoffDate}
            WHERE r.mandal_name = ${mandalName}
              AND r.name NOT LIKE 'UNKNOWN_NAME_%'
              AND r.health_id IS NOT NULL
              AND r.health_id != 'N/A'
              AND r.health_id != '0'
              AND r.health_id != ''
              AND ul.id IS NULL
          `.then(result => Number(result[0]?.count || 0))
        : prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT r.resident_id) as count
            FROM residents r
            LEFT JOIN update_logs ul ON r.resident_id = ul.resident_id
              AND ul.field_updated IN ('health_id', 'healthId', 'citizen_health_id', 'citizenHealthId')
            WHERE r.mandal_name = ${mandalName}
              AND r.name NOT LIKE 'UNKNOWN_NAME_%'
              AND r.health_id IS NOT NULL
              AND r.health_id != 'N/A'
              AND r.health_id != '0'
              AND r.health_id != ''
              AND ul.id IS NULL
          `.then(result => Number(result[0]?.count || 0)),

      // 8. Health IDs updated (total count of residents with health ID updates, after cutoff if set)
      prisma.updateLog.groupBy({
        by: ['residentId'],
        where: {
          fieldUpdated: { in: ['health_id', 'healthId', 'citizen_health_id', 'citizenHealthId'] },
          ...(cutoffDate ? { updateTimestamp: { gte: cutoffDate } } : {}),
          resident: baseWhere,
        },
      }).then(result => result.length),

      // 9. Health IDs updated today (after cutoff if set)
      prisma.updateLog.groupBy({
        by: ['residentId'],
        where: {
          fieldUpdated: { in: ['health_id', 'healthId', 'citizen_health_id', 'citizenHealthId'] },
          updateTimestamp: { gte: cutoffDate && cutoffDate > startOfToday ? cutoffDate : startOfToday },
          resident: baseWhere,
        },
      }).then(result => result.length),

      // 10. Recent mobile updates (last 6 hours, after cutoff if set)
      prisma.updateLog.count({
        where: {
          fieldUpdated: { in: ['citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber'] },
          updateTimestamp: { gte: cutoffDate && cutoffDate > sixHoursAgo ? cutoffDate : sixHoursAgo },
          resident: baseWhere,
        },
      }),

      // 11. Recent health ID updates (last 6 hours, after cutoff if set)
      prisma.updateLog.count({
        where: {
          fieldUpdated: { in: ['health_id', 'healthId', 'citizen_health_id', 'citizenHealthId'] },
          updateTimestamp: { gte: cutoffDate && cutoffDate > sixHoursAgo ? cutoffDate : sixHoursAgo },
          resident: baseWhere,
        },
      }),
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

    // 5 & 6. Secretariat statistics - Execute in parallel
    const [secretariatStats, secretariatCompletion] = await Promise.all([
      // 5. Secretariat-wise statistics (excluding locked residents)
      cutoffDate
        ? prisma.$queryRaw<Array<{ secName: string; residentCount: bigint }>>`
            SELECT sec_name as secName, COUNT(*) as residentCount
            FROM residents
            WHERE mandal_name = ${mandalName}
              AND sec_name IS NOT NULL
              AND name NOT LIKE 'UNKNOWN_NAME_%'
              AND NOT (
                updated_at < ${cutoffDate}
                AND citizen_mobile IS NOT NULL
                AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                AND health_id IS NOT NULL
                AND health_id != 'N/A'
                AND health_id != ''
                AND CHAR_LENGTH(health_id) >= 14
              )
            GROUP BY sec_name
            ORDER BY COUNT(*) DESC
          `
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (prisma.resident.groupBy as any)({
            by: ["secName"],
            _count: { id: true },
            where: {
              mandalName: mandalName,
              secName: { not: null },
              name: {
                not: {
                  startsWith: "UNKNOWN_NAME_",
                },
              },
            },
            orderBy: {
              _count: { id: "desc" },
            },
          }),

      // 6. Secretariat completion statistics with update counts (excluding locked residents, filtered by cutoff date)
      cutoffDate
        ? prisma.$queryRaw<
            Array<{
              secName: string
              totalResidents: bigint
              withMobile: bigint
              withHealthId: bigint
              mobileUpdatesCount: bigint
              mobileUpdatesToday: bigint
              healthIdOriginal: bigint
              healthIdUpdatesCount: bigint
              healthIdUpdatesToday: bigint
            }>
          >`
            SELECT
              r.sec_name as secName,
              COUNT(DISTINCT r.id) as totalResidents,
              SUM(CASE
                WHEN r.citizen_mobile IS NOT NULL
                  AND r.citizen_mobile != 'N/A'
                  AND r.citizen_mobile != '0'
                  AND r.citizen_mobile != ''
                THEN 1
                ELSE 0
              END) as withMobile,
              SUM(CASE
                WHEN r.health_id IS NOT NULL
                  AND r.health_id != 'N/A'
                  AND r.health_id != '0'
                  AND r.health_id != ''
                THEN 1
                ELSE 0
              END) as withHealthId,
              COUNT(DISTINCT CASE
                WHEN ul_mobile.id IS NOT NULL AND ul_mobile.update_timestamp >= ${cutoffDate}
                THEN r.resident_id
                ELSE NULL
              END) as mobileUpdatesCount,
              COUNT(DISTINCT CASE
                WHEN ul_mobile.id IS NOT NULL
                  AND ul_mobile.update_timestamp >= ${cutoffDate}
                  AND DATE(ul_mobile.update_timestamp) = CURDATE()
                THEN r.resident_id
                ELSE NULL
              END) as mobileUpdatesToday,
              SUM(CASE
                WHEN r.health_id IS NOT NULL
                  AND r.health_id != 'N/A'
                  AND r.health_id != '0'
                  AND r.health_id != ''
                  AND (ul_health.id IS NULL OR ul_health.update_timestamp < ${cutoffDate})
                THEN 1
                ELSE 0
              END) as healthIdOriginal,
              COUNT(DISTINCT CASE
                WHEN ul_health.id IS NOT NULL AND ul_health.update_timestamp >= ${cutoffDate}
                THEN r.resident_id
                ELSE NULL
              END) as healthIdUpdatesCount,
              COUNT(DISTINCT CASE
                WHEN ul_health.id IS NOT NULL
                  AND ul_health.update_timestamp >= ${cutoffDate}
                  AND DATE(ul_health.update_timestamp) = CURDATE()
                THEN r.resident_id
                ELSE NULL
              END) as healthIdUpdatesToday
            FROM residents r
            LEFT JOIN update_logs ul_mobile ON r.resident_id = ul_mobile.resident_id
              AND ul_mobile.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
            LEFT JOIN update_logs ul_health ON r.resident_id = ul_health.resident_id
              AND ul_health.field_updated IN ('health_id', 'healthId', 'citizen_health_id', 'citizenHealthId')
            WHERE r.mandal_name = ${mandalName}
              AND r.sec_name IS NOT NULL
              AND r.name NOT LIKE 'UNKNOWN_NAME_%'
              AND NOT (
                r.updated_at < ${cutoffDate}
                AND r.citizen_mobile IS NOT NULL
                AND r.citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                AND r.health_id IS NOT NULL
                AND r.health_id != 'N/A'
                AND r.health_id != ''
                AND CHAR_LENGTH(r.health_id) >= 14
              )
            GROUP BY r.sec_name
            ORDER BY totalResidents DESC
          `
        : prisma.$queryRaw<
            Array<{
              secName: string
              totalResidents: bigint
              withMobile: bigint
              withHealthId: bigint
              mobileUpdatesCount: bigint
              mobileUpdatesToday: bigint
              healthIdOriginal: bigint
              healthIdUpdatesCount: bigint
              healthIdUpdatesToday: bigint
            }>
          >`
            SELECT
              r.sec_name as secName,
              COUNT(DISTINCT r.id) as totalResidents,
              SUM(CASE
                WHEN r.citizen_mobile IS NOT NULL
                  AND r.citizen_mobile != 'N/A'
                  AND r.citizen_mobile != '0'
                  AND r.citizen_mobile != ''
                THEN 1
                ELSE 0
              END) as withMobile,
              SUM(CASE
                WHEN r.health_id IS NOT NULL
                  AND r.health_id != 'N/A'
                  AND r.health_id != '0'
                  AND r.health_id != ''
                THEN 1
                ELSE 0
              END) as withHealthId,
              COUNT(DISTINCT CASE
                WHEN ul_mobile.id IS NOT NULL
                THEN r.resident_id
                ELSE NULL
              END) as mobileUpdatesCount,
              COUNT(DISTINCT CASE
                WHEN ul_mobile.id IS NOT NULL
                  AND DATE(ul_mobile.update_timestamp) = CURDATE()
                THEN r.resident_id
                ELSE NULL
              END) as mobileUpdatesToday,
              SUM(CASE
                WHEN r.health_id IS NOT NULL
                  AND r.health_id != 'N/A'
                  AND r.health_id != '0'
                  AND r.health_id != ''
                  AND ul_health.id IS NULL
                THEN 1
                ELSE 0
              END) as healthIdOriginal,
              COUNT(DISTINCT CASE
                WHEN ul_health.id IS NOT NULL
                THEN r.resident_id
                ELSE NULL
              END) as healthIdUpdatesCount,
              COUNT(DISTINCT CASE
                WHEN ul_health.id IS NOT NULL
                  AND DATE(ul_health.update_timestamp) = CURDATE()
                THEN r.resident_id
                ELSE NULL
              END) as healthIdUpdatesToday
            FROM residents r
            LEFT JOIN update_logs ul_mobile ON r.resident_id = ul_mobile.resident_id
              AND ul_mobile.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
            LEFT JOIN update_logs ul_health ON r.resident_id = ul_health.resident_id
              AND ul_health.field_updated IN ('health_id', 'healthId', 'citizen_health_id', 'citizenHealthId')
            WHERE r.mandal_name = ${mandalName}
              AND r.sec_name IS NOT NULL
              AND r.name NOT LIKE 'UNKNOWN_NAME_%'
            GROUP BY r.sec_name
            ORDER BY totalResidents DESC
          `,
    ])

    logTiming('Secretariat statistics', requestStart)

    // Handle both raw query format (residentCount) and groupBy format (_count.id)
    const secretariatStatistics = secretariatStats.map((stat: Record<string, unknown>) => ({
      secretariatName: (stat.secName as string) || "Unknown",
      residentCount: stat.residentCount ? Number(stat.residentCount) : (((stat._count as Record<string, number>)?.id) || 0),
    }))

    const secretariatCompletionFormatted = secretariatCompletion.map((stat) => ({
      secretariatName: stat.secName,
      totalResidents: Number(stat.totalResidents),
      withMobile: Number(stat.withMobile),
      withHealthId: Number(stat.withHealthId),
      mobileUpdatesCount: Number(stat.mobileUpdatesCount),
      mobileUpdatesToday: Number(stat.mobileUpdatesToday),
      healthIdOriginal: Number(stat.healthIdOriginal),
      healthIdUpdatesCount: Number(stat.healthIdUpdatesCount),
      healthIdUpdatesToday: Number(stat.healthIdUpdatesToday),
      mobileCompletionRate:
        Number(stat.totalResidents) > 0
          ? Math.round((Number(stat.withMobile) / Number(stat.totalResidents)) * 100)
          : 0,
      healthIdCompletionRate:
        Number(stat.totalResidents) > 0
          ? Math.round((Number(stat.withHealthId) / Number(stat.totalResidents)) * 100)
          : 0,
    }))

    // 7. Field officer performance in mandal - Execute in parallel
    const [fieldOfficers, allUpdateCounts] = await Promise.all([
      // Note: Using type assertion as assignedSecretariats exists in DB but not in Prisma schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.user.findMany as any)({
        where: {
          role: "FIELD_OFFICER",
          isActive: true,
          assignedSecretariats: { not: null },
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          assignedSecretariats: true,
        },
      }),

      // Get all update counts for this mandal (filtered by cutoff date if set)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.updateLog.groupBy as any)({
        by: ["userId"],
        where: {
          resident: { mandalName: mandalName },
          ...(cutoffDate ? { updateTimestamp: { gte: cutoffDate } } : {}),
        },
        _count: { id: true },
      }),
    ])

    logTiming('Field officer data', requestStart)

    // Filter field officers who have secretariats in this mandal
    const mandalFieldOfficers = fieldOfficers.filter((officer: Record<string, unknown>) => {
      if (!officer.assignedSecretariats) return false
      try {
        const secretariats = JSON.parse(officer.assignedSecretariats as string)
        // Check if any assigned secretariat belongs to this mandal
        return secretariatStatistics.some((stat: { secretariatName: string }) =>
          secretariats.includes(stat.secretariatName)
        )
      } catch {
        return false
      }
    })

    const updateCountMap = new Map(
      allUpdateCounts.map((uc: { userId: string; _count?: { id: number } }) => [uc.userId, uc._count?.id || 0])
    )

    const fieldOfficerPerformance = mandalFieldOfficers.map((officer: Record<string, unknown>) => ({
      id: officer.id as string,
      username: officer.username as string,
      fullName: officer.fullName as string,
      assignedSecretariats: officer.assignedSecretariats
        ? JSON.parse(officer.assignedSecretariats as string)
        : [],
      updateCount: updateCountMap.get(officer.id as string) || 0,
    }))

    // 8 & 9. Updates timeline and recent updates - Execute in parallel
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [updatesTimeline, recentUpdates] = await Promise.all([
      // 8. Updates timeline (last 7 days)
      prisma.$queryRaw<
        Array<{
          date: Date
          updateCount: bigint
        }>
      >`
        SELECT
          DATE(update_timestamp) as date,
          COUNT(*) as updateCount
        FROM update_logs ul
        INNER JOIN residents r ON ul.resident_id = r.resident_id
        WHERE r.mandal_name = ${mandalName}
          AND ul.update_timestamp >= ${sevenDaysAgo}
          AND r.name NOT LIKE 'UNKNOWN_NAME_%'
        GROUP BY DATE(update_timestamp)
        ORDER BY date ASC
      `,

      // 9. Recent updates list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma.updateLog.findMany as any)({
        where: {
          updateTimestamp: { gte: sixHoursAgo },
          resident: {
            mandalName: mandalName,
            name: {
              not: {
                startsWith: "UNKNOWN_NAME_",
              },
            },
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
              secName: true,
            },
          },
        },
        orderBy: {
          updateTimestamp: "desc",
        },
        take: 50,
      }),
    ])

    logTiming('Timeline and recent updates', requestStart)

    const updatesTimelineFormatted = updatesTimeline.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      updateCount: Number(item.updateCount),
    }))

    // Build final response
    const responseData = {
      mandalName,
      overview: {
        totalResidents,
        residentsWithMobile,
        residentsWithHealthId,
        mobileCompletionRate,
        healthIdCompletionRate,
        recentUpdatesCount,
        mobileUpdatesCount,
        mobileUpdatesToday,
        healthIdOriginalCount,
        healthIdUpdatesCount,
        healthIdUpdatesToday,
        recentMobileUpdatesCount,
        recentHealthIdUpdatesCount,
        // Locked residents count (excluded from all metrics above)
        totalLockedResidents,
      },
      secretariatStatistics,
      secretariatCompletion: secretariatCompletionFormatted,
      fieldOfficerPerformance,
      updatesTimeline: updatesTimelineFormatted,
      recentUpdates: recentUpdates.map((update: {
        id: string;
        resident: { name: string; residentId: string; secName: string };
        fieldUpdated: string;
        oldValue: string | null;
        newValue: string | null;
        user: { fullName: string; username: string };
        updateTimestamp: Date;
      }) => ({
        id: update.id,
        residentName: update.resident.name,
        residentId: update.resident.residentId,
        secretariatName: update.resident.secName,
        fieldUpdated: update.fieldUpdated,
        oldValue: update.oldValue,
        newValue: update.newValue,
        updatedBy: update.user.fullName,
        username: update.user.username,
        updatedAt: update.updateTimestamp,
      })),
      generatedAt: new Date().toISOString(),
      // Include cutoff date for reference (metrics after this date are shown)
      dataCutoffDate: cutoffDate ? cutoffDate.toISOString() : null,
    }

    // Cache the response for 5 minutes (300 seconds)
    cache.set(cacheKey, responseData, 300)

    const totalTime = logTiming('Total analytics generation', requestStart)
    console.log(`[Panchayat Analytics] Total time for ${mandalName}: ${totalTime}ms`)

    return NextResponse.json({
      ...responseData,
      cached: false,
    })
  } catch (error) {
    console.error("Panchayat analytics error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


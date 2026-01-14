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

    // Fetch cutoff date for filtering (exclude locked data from all metrics)
    const cutoffSetting = await prisma.systemSettings.findUnique({
      where: { key: "RESIDENT_UPDATE_CUTOFF_DATE" },
    })
    const cutoffDate = cutoffSetting?.value ? new Date(cutoffSetting.value) : null

    // Execute all independent queries in parallel for better performance
    // All queries now exclude locked residents when cutoff date is set
    const [
      basicCounts,
      duplicateMobileNumbers,
      duplicateHealthIds,
      lockedResidentsCount,
    ] = await Promise.all([
      // Basic counts - all excluding locked residents
      cutoffDate
        ? prisma.$queryRaw<Array<{
            totalResidents: bigint
            residentsWithMobile: bigint
            residentsWithHealthId: bigint
            residentsWithBothMobileAndHealthId: bigint
            residentsWithNamePlaceholder: bigint
            residentsWithHhIdPlaceholder: bigint
            residentsWithMobilePlaceholder: bigint
            residentsWithHealthIdPlaceholder: bigint
          }>>`
            SELECT
              COUNT(*) as totalResidents,
              SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as residentsWithMobile,
              SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as residentsWithHealthId,
              SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' AND health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as residentsWithBothMobileAndHealthId,
              SUM(CASE WHEN name LIKE 'UNKNOWN_NAME_%' THEN 1 ELSE 0 END) as residentsWithNamePlaceholder,
              SUM(CASE WHEN hh_id LIKE 'HH_UNKNOWN_%' THEN 1 ELSE 0 END) as residentsWithHhIdPlaceholder,
              SUM(CASE WHEN citizen_mobile IS NULL OR citizen_mobile = 'N/A' OR citizen_mobile = '0' OR citizen_mobile = '' THEN 1 ELSE 0 END) as residentsWithMobilePlaceholder,
              SUM(CASE WHEN health_id IS NULL OR health_id = 'N/A' OR health_id = '' THEN 1 ELSE 0 END) as residentsWithHealthIdPlaceholder
            FROM residents
            WHERE 1=1
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
            residentsWithBothMobileAndHealthId: bigint
            residentsWithNamePlaceholder: bigint
            residentsWithHhIdPlaceholder: bigint
            residentsWithMobilePlaceholder: bigint
            residentsWithHealthIdPlaceholder: bigint
          }>>`
            SELECT
              COUNT(*) as totalResidents,
              SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as residentsWithMobile,
              SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as residentsWithHealthId,
              SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' AND health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as residentsWithBothMobileAndHealthId,
              SUM(CASE WHEN name LIKE 'UNKNOWN_NAME_%' THEN 1 ELSE 0 END) as residentsWithNamePlaceholder,
              SUM(CASE WHEN hh_id LIKE 'HH_UNKNOWN_%' THEN 1 ELSE 0 END) as residentsWithHhIdPlaceholder,
              SUM(CASE WHEN citizen_mobile IS NULL OR citizen_mobile = 'N/A' OR citizen_mobile = '0' OR citizen_mobile = '' THEN 1 ELSE 0 END) as residentsWithMobilePlaceholder,
              SUM(CASE WHEN health_id IS NULL OR health_id = 'N/A' OR health_id = '' THEN 1 ELSE 0 END) as residentsWithHealthIdPlaceholder
            FROM residents
          `,

      // Count duplicate mobile numbers (excluding locked residents)
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM (
              SELECT citizen_mobile
              FROM residents
              WHERE citizen_mobile IS NOT NULL
                AND citizen_mobile != 'N/A'
                AND citizen_mobile != '0'
                AND citizen_mobile != ''
                AND NOT (
                  updated_at < ${cutoffDate}
                  AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                  AND health_id IS NOT NULL
                  AND health_id != 'N/A'
                  AND health_id != ''
                  AND CHAR_LENGTH(health_id) >= 14
                )
              GROUP BY citizen_mobile
              HAVING COUNT(*) > 5
            ) AS duplicates
          `
        : prisma.$queryRaw<Array<{ count: bigint }>>`
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

      // Count duplicate ABHA IDs (excluding locked residents)
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM (
              SELECT health_id
              FROM residents
              WHERE health_id IS NOT NULL
                AND health_id != 'N/A'
                AND health_id != ''
                AND NOT (
                  updated_at < ${cutoffDate}
                  AND citizen_mobile IS NOT NULL
                  AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                  AND health_id != 'N/A'
                  AND health_id != ''
                  AND CHAR_LENGTH(health_id) >= 14
                )
              GROUP BY health_id
              HAVING COUNT(*) > 1
            ) AS duplicates
          `
        : prisma.$queryRaw<Array<{ count: bigint }>>`
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

      // Count locked residents (for reference)
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count
            FROM residents
            WHERE updated_at < ${cutoffDate}
              AND citizen_mobile IS NOT NULL
              AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
              AND health_id IS NOT NULL
              AND health_id != 'N/A'
              AND health_id != ''
              AND CHAR_LENGTH(health_id) >= 14
          `
        : Promise.resolve([{ count: BigInt(0) }]),
    ])

    // Extract basic counts
    const counts = basicCounts[0]
    const totalResidents = Number(counts?.totalResidents || 0)
    const residentsWithMobile = Number(counts?.residentsWithMobile || 0)
    const residentsWithHealthId = Number(counts?.residentsWithHealthId || 0)
    const residentsWithBothMobileAndHealthId = Number(counts?.residentsWithBothMobileAndHealthId || 0)
    const residentsWithNamePlaceholder = Number(counts?.residentsWithNamePlaceholder || 0)
    const residentsWithHhIdPlaceholder = Number(counts?.residentsWithHhIdPlaceholder || 0)
    const residentsWithMobilePlaceholder = Number(counts?.residentsWithMobilePlaceholder || 0)
    const residentsWithHealthIdPlaceholder = Number(counts?.residentsWithHealthIdPlaceholder || 0)
    const totalLockedResidents = Number(lockedResidentsCount[0]?.count || 0)

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

      // Mobile number updates count (last 30 days, after cutoff if set)
      // Check for both "citizen_mobile" and "mobile_number" for backward compatibility
      prisma.updateLog.count({
        where: {
          updateTimestamp: {
            gte: cutoffDate && cutoffDate > thirtyDaysAgo ? cutoffDate : thirtyDaysAgo
          },
          OR: [
            { fieldUpdated: "citizen_mobile" },
            { fieldUpdated: "mobile_number" },
            { fieldUpdated: "citizenMobile" },
            { fieldUpdated: "mobileNumber" },
          ],
        },
      }),

      // Health ID updates count (last 30 days, after cutoff if set)
      // Check for both "health_id" and "healthId" for backward compatibility
      prisma.updateLog.count({
        where: {
          updateTimestamp: {
            gte: cutoffDate && cutoffDate > thirtyDaysAgo ? cutoffDate : thirtyDaysAgo
          },
          OR: [
            { fieldUpdated: "health_id" },
            { fieldUpdated: "healthId" },
          ],
        },
      }),

      // Mobile number updates - ALL TIME (unique residents with valid mobile now, after cutoff if set)
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT ul.resident_id) as count
            FROM update_logs ul
            INNER JOIN residents r ON ul.resident_id = r.resident_id
            WHERE ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
              AND ul.update_timestamp >= ${cutoffDate}
              AND r.citizen_mobile IS NOT NULL
              AND r.citizen_mobile != 'N/A'
              AND r.citizen_mobile != '0'
              AND r.citizen_mobile != ''
          `
        : prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT ul.resident_id) as count
            FROM update_logs ul
            INNER JOIN residents r ON ul.resident_id = r.resident_id
            WHERE ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
              AND r.citizen_mobile IS NOT NULL
              AND r.citizen_mobile != 'N/A'
              AND r.citizen_mobile != '0'
              AND r.citizen_mobile != ''
          `,

      // Mobile number updates - TODAY (unique residents with valid mobile now, after cutoff if set)
      cutoffDate
        ? prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT ul.resident_id) as count
            FROM update_logs ul
            INNER JOIN residents r ON ul.resident_id = r.resident_id
            WHERE ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
              AND ul.update_timestamp >= ${startOfToday}
              AND ul.update_timestamp >= ${cutoffDate}
              AND r.citizen_mobile IS NOT NULL
              AND r.citizen_mobile != 'N/A'
              AND r.citizen_mobile != '0'
              AND r.citizen_mobile != ''
          `
        : prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT ul.resident_id) as count
            FROM update_logs ul
            INNER JOIN residents r ON ul.resident_id = r.resident_id
            WHERE ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber')
              AND ul.update_timestamp >= ${startOfToday}
              AND r.citizen_mobile IS NOT NULL
              AND r.citizen_mobile != 'N/A'
              AND r.citizen_mobile != '0'
              AND r.citizen_mobile != ''
          `,

      // Health ID updates - ALL TIME (after cutoff if set)
      prisma.updateLog.count({
        where: {
          ...(cutoffDate ? { updateTimestamp: { gte: cutoffDate } } : {}),
          OR: [
            { fieldUpdated: "health_id" },
            { fieldUpdated: "healthId" },
          ],
        },
      }),

      // Health IDs added via updates (where oldValue was null/empty and newValue has a health ID, after cutoff if set)
      prisma.updateLog.count({
        where: {
          ...(cutoffDate ? { updateTimestamp: { gte: cutoffDate } } : {}),
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

    // Execute heavy queries in parallel
    const [
      fieldOfficerData,
      activeOfficersInLast15Min,
      updatesOverTime,
      mandalStats,
      completionStats,
      secretariatUpdateStats
    ] = await Promise.all([
      // A. Field Officer Data (Step 6)
      // Filter by cutoff date if set to exclude locked data from field officer metrics
      (async () => {
        // Build update timestamp filter - use the later of cutoffDate and startDate
        const effectiveStartDate = (() => {
          if (cutoffDate && startDate) {
            return cutoffDate > startDate ? cutoffDate : startDate
          }
          return cutoffDate || startDate || undefined
        })()

        const timestampFilter = {
          ...(effectiveStartDate ? { gte: effectiveStartDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        }

        const hasTimestampFilter = Object.keys(timestampFilter).length > 0

        return Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (prisma.user.findMany as any)({
            where: { role: "FIELD_OFFICER", isActive: true },
            select: { id: true, username: true, fullName: true, role: true, assignedSecretariats: true, mandalName: true },
          }),
          prisma.updateLog.groupBy({
            by: ["userId"],
            _count: { id: true },
            where: {
              user: { role: "FIELD_OFFICER", isActive: true },
              ...(hasTimestampFilter ? { updateTimestamp: timestampFilter } : {}),
            },
          }),
          prisma.updateLog.groupBy({
            by: ["userId"],
            _count: { id: true },
            where: {
              user: { role: "FIELD_OFFICER", isActive: true },
              fieldUpdated: { in: ["citizen_mobile", "mobile_number", "citizenMobile", "mobileNumber"] },
              ...(hasTimestampFilter ? { updateTimestamp: timestampFilter } : {}),
            },
          }),
          prisma.updateLog.groupBy({
            by: ["userId"],
            _count: { id: true },
            where: {
              user: { role: "FIELD_OFFICER", isActive: true },
              fieldUpdated: { in: ["health_id", "healthId"] },
              ...(hasTimestampFilter ? { updateTimestamp: timestampFilter } : {}),
            },
          }),
        ])
      })(),

      // B. Activity Metrics (Step 6a, 7)
      prisma.updateLog.groupBy({
        by: ["userId"],
        where: {
          updateTimestamp: { gte: new Date(Date.now() - 15 * 60 * 1000) },
          user: { role: "FIELD_OFFICER", isActive: true },
        },
      }),
      prisma.updateLog.findMany({
        where: { updateTimestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { updateTimestamp: true },
      }),

      // C. Mandal Stats (Step 5) - Excluding locked residents
      cutoffDate
        ? prisma.$queryRaw<Array<{ mandalName: string; residentCount: bigint }>>`
            SELECT mandal_name as mandalName, COUNT(*) as residentCount
            FROM residents
            WHERE mandal_name IS NOT NULL
              AND NOT (
                updated_at < ${cutoffDate}
                AND citizen_mobile IS NOT NULL
                AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                AND health_id IS NOT NULL
                AND health_id != 'N/A'
                AND health_id != ''
                AND CHAR_LENGTH(health_id) >= 14
              )
            GROUP BY mandal_name
            ORDER BY COUNT(*) DESC
          `
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (prisma.resident.groupBy as any)({
            by: ["mandalName"],
            _count: { id: true },
            where: { mandalName: { not: null } },
            orderBy: { _count: { id: "desc" } },
          }),

      // D. Completion Statistics (Steps 8 & 9) - Excluding locked residents
      Promise.all([
        // Mandal Completion
        cutoffDate
          ? prisma.$queryRaw<Array<{ mandalName: string; totalResidents: bigint; withMobile: bigint; withHealthId: bigint }>>`
              SELECT
                mandal_name as mandalName,
                COUNT(*) as totalResidents,
                SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as withMobile,
                SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as withHealthId
              FROM residents
              WHERE mandal_name IS NOT NULL
                AND NOT (
                  updated_at < ${cutoffDate}
                  AND citizen_mobile IS NOT NULL
                  AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                  AND health_id IS NOT NULL
                  AND health_id != 'N/A'
                  AND health_id != ''
                  AND CHAR_LENGTH(health_id) >= 14
                )
              GROUP BY mandal_name
              ORDER BY totalResidents DESC
            `
          : prisma.$queryRaw<Array<{ mandalName: string; totalResidents: bigint; withMobile: bigint; withHealthId: bigint }>>`
              SELECT
                mandal_name as mandalName,
                COUNT(*) as totalResidents,
                SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as withMobile,
                SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as withHealthId
              FROM residents
              WHERE mandal_name IS NOT NULL
              GROUP BY mandal_name
              ORDER BY totalResidents DESC
            `,
        // Hierarchical (Secretariat) Completion
        cutoffDate
          ? prisma.$queryRaw<Array<{ mandalName: string; secName: string | null; totalResidents: bigint; withMobile: bigint; withHealthId: bigint }>>`
              SELECT
                mandal_name as mandalName,
                sec_name as secName,
                COUNT(*) as totalResidents,
                SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as withMobile,
                SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as withHealthId
              FROM residents
              WHERE mandal_name IS NOT NULL AND sec_name IS NOT NULL
                AND NOT (
                  updated_at < ${cutoffDate}
                  AND citizen_mobile IS NOT NULL
                  AND citizen_mobile REGEXP '^[6-9][0-9]{9}$'
                  AND health_id IS NOT NULL
                  AND health_id != 'N/A'
                  AND health_id != ''
                  AND CHAR_LENGTH(health_id) >= 14
                )
              GROUP BY mandal_name, sec_name
              ORDER BY mandal_name, sec_name
            `
          : prisma.$queryRaw<Array<{ mandalName: string; secName: string | null; totalResidents: bigint; withMobile: bigint; withHealthId: bigint }>>`
              SELECT
                mandal_name as mandalName,
                sec_name as secName,
                COUNT(*) as totalResidents,
                SUM(CASE WHEN citizen_mobile IS NOT NULL AND citizen_mobile != 'N/A' AND citizen_mobile != '0' AND citizen_mobile != '' THEN 1 ELSE 0 END) as withMobile,
                SUM(CASE WHEN health_id IS NOT NULL AND health_id != 'N/A' AND health_id != '' THEN 1 ELSE 0 END) as withHealthId
              FROM residents
              WHERE mandal_name IS NOT NULL AND sec_name IS NOT NULL
              GROUP BY mandal_name, sec_name
              ORDER BY mandal_name, sec_name
            `,
      ]),

      // E. Secretariat Update Statistics (Step 11) - Modified to include logic for Mandal derivation
      // Note: We removed the explicit "mandalUpdateStats" (Step 10) query to save time.
      // We will derive mandal stats from this result.
      // Filter by cutoff date if set to exclude locked data
      cutoffDate
        ? prisma.$queryRaw<
            Array<{
              mandalName: string
              secName: string | null
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
              COUNT(CASE WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber') AND ul.update_timestamp >= ${cutoffDate} THEN 1 END) as mobileUpdatesAllTime,
              COUNT(CASE WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber') AND ul.update_timestamp >= ${startOfToday} AND ul.update_timestamp >= ${cutoffDate} THEN 1 END) as mobileUpdatesToday,
              COUNT(CASE WHEN ul.field_updated IN ('health_id', 'healthId') AND ul.update_timestamp >= ${cutoffDate} THEN 1 END) as healthIdUpdatesAllTime,
              COUNT(CASE WHEN ul.field_updated IN ('health_id', 'healthId') AND ul.update_timestamp >= ${startOfToday} AND ul.update_timestamp >= ${cutoffDate} THEN 1 END) as healthIdUpdatesToday,
              COUNT(CASE WHEN ul.field_updated IN ('health_id', 'healthId') AND ul.update_timestamp >= ${cutoffDate} AND (ul.old_value IS NULL OR ul.old_value IN ('', 'null', 'N/A')) AND ul.new_value IS NOT NULL AND ul.new_value NOT IN ('', 'null', 'N/A') THEN 1 END) as healthIdsAddedViaUpdates
            FROM update_logs ul
            INNER JOIN residents r ON ul.resident_id = r.resident_id
            WHERE r.mandal_name IS NOT NULL
            GROUP BY r.mandal_name, r.sec_name
          `
        : prisma.$queryRaw<
            Array<{
              mandalName: string
              secName: string | null
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
              COUNT(CASE WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber') THEN 1 END) as mobileUpdatesAllTime,
              COUNT(CASE WHEN ul.field_updated IN ('citizen_mobile', 'mobile_number', 'citizenMobile', 'mobileNumber') AND ul.update_timestamp >= ${startOfToday} THEN 1 END) as mobileUpdatesToday,
              COUNT(CASE WHEN ul.field_updated IN ('health_id', 'healthId') THEN 1 END) as healthIdUpdatesAllTime,
              COUNT(CASE WHEN ul.field_updated IN ('health_id', 'healthId') AND ul.update_timestamp >= ${startOfToday} THEN 1 END) as healthIdUpdatesToday,
              COUNT(CASE WHEN ul.field_updated IN ('health_id', 'healthId') AND (ul.old_value IS NULL OR ul.old_value IN ('', 'null', 'N/A')) AND ul.new_value IS NOT NULL AND ul.new_value NOT IN ('', 'null', 'N/A') THEN 1 END) as healthIdsAddedViaUpdates
            FROM update_logs ul
            INNER JOIN residents r ON ul.resident_id = r.resident_id
            WHERE r.mandal_name IS NOT NULL
            GROUP BY r.mandal_name, r.sec_name
          `
    ])

    logTiming('Parallel Heavy Queries', requestStart)

    // Unpack Promise Results

    // 1. Process Field Officer Data
    const [allFieldOfficers, updateCounts, mobileUpdateCounts, healthIdUpdateCounts] = fieldOfficerData

    const updateCountMap = new Map(updateCounts.map((c) => [c.userId, c._count?.id || 0]))
    const mobileUpdateCountMap = new Map(mobileUpdateCounts.map((c) => [c.userId, c._count?.id || 0]))
    const healthIdUpdateCountMap = new Map(healthIdUpdateCounts.map((c) => [c.userId, c._count?.id || 0]))

    const fieldOfficerStats = allFieldOfficers
      .map((officer: { id: string; username: string; fullName: string; role: string; assignedSecretariats: string | null; mandalName: string | null }) => {
        let mandals: string[] = []
        if (officer.role === "FIELD_OFFICER" && officer.assignedSecretariats) {
          try {
            const secretariats = JSON.parse(officer.assignedSecretariats as string)
            if (Array.isArray(secretariats)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const mandalNames = secretariats.map((s: any) => typeof s === 'string' ? s.split(' -> ')[0]?.trim() : s.mandalName).filter(Boolean)
              mandals = [...new Set(mandalNames)] as string[]
            }
          } catch (e) { console.error(`Failed to parse assignedSecretariats`, e) }
        } else if (officer.mandalName) { mandals = [officer.mandalName as string] }

        return {
          userId: officer.id,
          username: officer.username,
          name: officer.fullName,
          role: officer.role,
          mandals,
          updatesCount: updateCountMap.get(officer.id) || 0,
          mobileUpdatesCount: mobileUpdateCountMap.get(officer.id) || 0,
          healthIdUpdatesCount: healthIdUpdateCountMap.get(officer.id) || 0,
        }
      })
      .sort((a: { updatesCount: number }, b: { updatesCount: number }) => b.updatesCount - a.updatesCount)

    // 2. Process Activity Metrics
    const currentlyActiveOfficersCount = activeOfficersInLast15Min.length

    const updatesByDate: { [key: string]: number } = {}
    updatesOverTime.forEach((update) => {
      const date = update.updateTimestamp.toISOString().split("T")[0]
      updatesByDate[date] = (updatesByDate[date] || 0) + 1
    })
    const updatesTimeline = Object.entries(updatesByDate).map(([date, count]) => ({ date, count }))

    // 3. Process Mandal Stats
    // Handle both raw query format (residentCount) and groupBy format (_count.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mandalStatistics = mandalStats.map((stat: any) => ({
      mandalName: stat.mandalName || "Unknown",
      residentCount: stat.residentCount ? Number(stat.residentCount) : (stat._count?.id || 0),
    }))

    // 4. Process Completion Stats
    // Ensure we have a robust list of mandals by merging data sources
    const [rawMandalCompletionStats, hierarchicalStats] = completionStats

    // Map raw stats to a map for easy lookup
    const rawStatsMap = new Map(rawMandalCompletionStats.map((s) => [s.mandalName, s]))

    // Use mandalStats (from simple groupBy) as the base list to ensure we don't miss any mandals
    // and merge with the detailed completion stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mandalCompletionStats = mandalStats.map((baseStat: any) => {
      const mandalName = baseStat.mandalName
      const detailedStat = rawStatsMap.get(mandalName)
      // Handle both raw query format (residentCount) and groupBy format (_count.id)
      const totalResidents = baseStat.residentCount ? Number(baseStat.residentCount) : (baseStat._count?.id || 0)
      return {
        mandalName,
        totalResidents, // Source of truth for total
        withMobile: detailedStat?.withMobile || 0,
        withHealthId: detailedStat?.withHealthId || 0,
      }
    })

    // 5. Process Update Stats (Secretariat & Derived Mandal)

    // Create secretariat update map
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

    // Derive Mandal Update Stats from Secretariat Update Stats (Aggregation)
    const mandalUpdateStatsMap = new Map<string, { mobileUpdatesAllTime: number; mobileUpdatesToday: number; healthIdUpdatesAllTime: number; healthIdUpdatesToday: number; healthIdsAddedViaUpdates: number }>()

    secretariatUpdateStats.forEach(stat => {
      const current = mandalUpdateStatsMap.get(stat.mandalName) || {
        mobileUpdatesAllTime: 0, mobileUpdatesToday: 0, healthIdUpdatesAllTime: 0, healthIdUpdatesToday: 0, healthIdsAddedViaUpdates: 0
      }

      mandalUpdateStatsMap.set(stat.mandalName, {
        mobileUpdatesAllTime: current.mobileUpdatesAllTime + Number(stat.mobileUpdatesAllTime),
        mobileUpdatesToday: current.mobileUpdatesToday + Number(stat.mobileUpdatesToday),
        healthIdUpdatesAllTime: current.healthIdUpdatesAllTime + Number(stat.healthIdUpdatesAllTime),
        healthIdUpdatesToday: current.healthIdUpdatesToday + Number(stat.healthIdUpdatesToday),
        healthIdsAddedViaUpdates: current.healthIdsAddedViaUpdates + Number(stat.healthIdsAddedViaUpdates)
      })
    })


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mandalCompletion = mandalCompletionStats.map((stat: any) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mandalHierarchy = mandalCompletion.map((mandal: any) => {
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
            mobileUpdatesAllTime: secUpdateStats.mobileUpdatesAllTime,
            mobileUpdatesToday: secUpdateStats.mobileUpdatesToday,
            healthIdUpdatesAllTime: secUpdateStats.healthIdUpdatesAllTime,
            healthIdUpdatesToday: secUpdateStats.healthIdUpdatesToday,
            healthIdsOriginal,
            healthIdsAddedViaUpdates: secUpdateStats.healthIdsAddedViaUpdates,
          }
        })
        .sort((a, b) => b.totalResidents - a.totalResidents)

      return {
        ...mandal,
        secretariats,
      }
    })

    logTiming('Final data processing', requestStart)

    const responseData = {
      overview: {
        totalResidents,
        residentsWithMobile,
        residentsWithHealthId,
        residentsWithBothMobileAndHealthId,
        mobileCompletionRate,
        healthIdCompletionRate,
        recentUpdatesCount,
        // Separate update counts by field type
        mobileUpdatesCount,
        healthIdUpdatesCount,
        // Enhanced mobile and health ID statistics (unique residents updated)
        mobileUpdatesAllTime: Number(mobileUpdatesAllTime[0]?.count || 0),
        mobileUpdatesToday: Number(mobileUpdatesToday[0]?.count || 0),
        healthIdUpdatesAllTime,
        healthIdsAddedViaUpdates,
        // Calculate original health IDs (before updates)
        healthIdsOriginal: residentsWithHealthId - Number(healthIdsAddedViaUpdates),
        // Placeholder metrics
        residentsWithNamePlaceholder,
        residentsWithHhIdPlaceholder,
        residentsWithMobilePlaceholder,
        residentsWithHealthIdPlaceholder,
        // Duplicate metrics
        duplicateMobileNumbers: Number(duplicateMobileNumbers[0]?.count || 0),
        duplicateHealthIds: Number(duplicateHealthIds[0]?.count || 0),
        // Field officer activity metrics
        currentlyActiveOfficersCount,
        totalActiveOfficersCount: allFieldOfficers.length,
        // Locked residents count (excluded from all metrics above)
        totalLockedResidents,
      },
      mandalStatistics,
      mandalCompletion: mandalHierarchy,
      mandalHierarchy, // Required for Mandal-wise Completion Rates table
      fieldOfficerPerformance: fieldOfficerStats,
      activeOfficersInLast15Min: currentlyActiveOfficersCount,
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
      lastUpdated: new Date(),
      // Include cutoff date for reference (metrics after this date are shown)
      dataCutoffDate: cutoffDate ? cutoffDate.toISOString() : null,
    }

    // Cache the successful response (if no date filters)
    if (!startDate && !endDate) {
      cache.set(cacheKey, responseData)
    }

    logTiming('Total time', requestStart)

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


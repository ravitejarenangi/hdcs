import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(_request: NextRequest) {
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

  try {
    // 1. Total residents in mandal
    const totalResidents = await prisma.resident.count({
      where: { mandalName },
    })

    // 2. Mobile number completion rate
    const residentsWithMobile = await prisma.resident.count({
      where: {
        mandalName,
        mobileNumber: { not: null },
      },
    })
    const mobileCompletionRate =
      totalResidents > 0
        ? Math.round((residentsWithMobile / totalResidents) * 100)
        : 0

    // 3. Health ID completion rate
    const residentsWithHealthId = await prisma.resident.count({
      where: {
        mandalName,
        healthId: { not: null },
      },
    })
    const healthIdCompletionRate =
      totalResidents > 0
        ? Math.round((residentsWithHealthId / totalResidents) * 100)
        : 0

    // 4. Recent updates in mandal (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentUpdatesCount = await prisma.updateLog.count({
      where: {
        updateTimestamp: { gte: thirtyDaysAgo },
        resident: { mandalName },
      },
    })

    // 5. Secretariat-wise statistics
    const secretariatStats = await prisma.resident.groupBy({
      by: ["secName"],
      _count: { id: true },
      where: {
        mandalName,
        secName: { not: null },
      },
      orderBy: {
        _count: { id: "desc" },
      },
    })

    const secretariatStatistics = secretariatStats.map((stat) => ({
      secretariatName: stat.secName || "Unknown",
      residentCount: stat._count.id,
    }))

    // 6. Secretariat completion statistics
    const secretariatCompletion = await prisma.$queryRaw<
      Array<{
        secName: string
        totalResidents: bigint
        withMobile: bigint
        withHealthId: bigint
      }>
    >`
      SELECT 
        sec_name as secName,
        COUNT(*) as totalResidents,
        SUM(CASE WHEN mobile_number IS NOT NULL THEN 1 ELSE 0 END) as withMobile,
        SUM(CASE WHEN health_id IS NOT NULL THEN 1 ELSE 0 END) as withHealthId
      FROM residents
      WHERE mandal_name = ${mandalName} AND sec_name IS NOT NULL
      GROUP BY sec_name
      ORDER BY totalResidents DESC
    `

    const secretariatCompletionFormatted = secretariatCompletion.map((stat) => ({
      secretariatName: stat.secName,
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

    // 7. Field officer performance in mandal
    const fieldOfficers = await prisma.user.findMany({
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
    })

    // Filter field officers who have secretariats in this mandal
    const mandalFieldOfficers = fieldOfficers.filter((officer) => {
      if (!officer.assignedSecretariats) return false
      try {
        const secretariats = JSON.parse(officer.assignedSecretariats)
        // Check if any assigned secretariat belongs to this mandal
        return secretariatStatistics.some((stat) =>
          secretariats.includes(stat.secretariatName)
        )
      } catch {
        return false
      }
    })

    // Get update counts for these officers
    const officerIds = mandalFieldOfficers.map((o) => o.id)
    const updateCounts = await prisma.updateLog.groupBy({
      by: ["userId"],
      where: {
        userId: { in: officerIds },
        resident: { mandalName },
      },
      _count: { id: true },
    })

    const updateCountMap = new Map(
      updateCounts.map((uc) => [uc.userId, uc._count.id])
    )

    const fieldOfficerPerformance = mandalFieldOfficers.map((officer) => ({
      id: officer.id,
      username: officer.username,
      fullName: officer.fullName,
      assignedSecretariats: officer.assignedSecretariats
        ? JSON.parse(officer.assignedSecretariats)
        : [],
      updateCount: updateCountMap.get(officer.id) || 0,
    }))

    // 8. Updates timeline (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const updatesTimeline = await prisma.$queryRaw<
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
      GROUP BY DATE(update_timestamp)
      ORDER BY date ASC
    `

    const updatesTimelineFormatted = updatesTimeline.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      updateCount: Number(item.updateCount),
    }))

    // 9. Recent updates list
    const recentUpdates = await prisma.updateLog.findMany({
      where: {
        updateTimestamp: { gte: thirtyDaysAgo },
        resident: { mandalName },
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
    })

    // Return mandal-specific analytics
    return NextResponse.json({
      mandalName,
      overview: {
        totalResidents,
        residentsWithMobile,
        residentsWithHealthId,
        mobileCompletionRate,
        healthIdCompletionRate,
        recentUpdatesCount,
      },
      secretariatStatistics,
      secretariatCompletion: secretariatCompletionFormatted,
      fieldOfficerPerformance,
      updatesTimeline: updatesTimelineFormatted,
      recentUpdates: recentUpdates.map((update) => ({
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
    })
  } catch (error) {
    console.error("Panchayat analytics error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


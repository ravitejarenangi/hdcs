import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import ExcelJS from "exceljs"
import { createProgress, updateProgress, completeProgress, errorProgress } from "@/lib/export-progress"

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

    // Parse filter parameters from query string
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const mandalsParam = searchParams.get("mandals")
    const officersParam = searchParams.get("officers")
    const mobileStatus = searchParams.get("mobileStatus")
    const healthIdStatus = searchParams.get("healthIdStatus")
    const ruralUrbanParam = searchParams.get("ruralUrban")
    const sessionId = searchParams.get("sessionId") // For progress tracking

    console.log(`[Excel Export] Filter parameters:`, {
      startDate,
      endDate,
      mandals: mandalsParam,
      officers: officersParam,
      mobileStatus,
      healthIdStatus,
      ruralUrban: ruralUrbanParam,
      sessionId
    })

    // Build where clause for filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {}

    // Date range filter - using updatedAt to track when mobile numbers and health IDs were updated
    // Skip date filtering when BOTH mobileStatus and healthIdStatus are "without"
    // (old/incomplete records may not have recent update timestamps)
    const skipDateFilter = mobileStatus === "without" && healthIdStatus === "without"

    if (skipDateFilter && (startDate || endDate)) {
      console.log(`[Excel Export] Skipping date filter because both mobileStatus and healthIdStatus are "without"`)
    }

    if ((startDate || endDate) && !skipDateFilter) {
      whereClause.updatedAt = {}
      if (startDate) {
        whereClause.updatedAt.gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        whereClause.updatedAt.lte = endDateTime
      }
      console.log(`[Excel Export] Applied date filter:`, whereClause.updatedAt)
    }

    // Mandal filter
    if (mandalsParam) {
      const mandals = mandalsParam.split(",").filter((m) => m.trim())
      if (mandals.length > 0) {
        whereClause.mandalName = { in: mandals }
      }
    }

    // Mobile status filter - exclude placeholder values
    if (mobileStatus === "with") {
      whereClause.AND = whereClause.AND || []
      whereClause.AND.push(
        { citizenMobile: { not: null } },
        { citizenMobile: { not: "N/A" } },
        { citizenMobile: { not: "0" } },
        { citizenMobile: { not: "" } }
      )
    } else if (mobileStatus === "without") {
      // When filtering for "without", we need records where mobile is NULL or a placeholder
      // Use OR to match any of these conditions for the mobile field
      whereClause.AND = whereClause.AND || []
      whereClause.AND.push({
        OR: [
          { citizenMobile: null },
          { citizenMobile: "N/A" },
          { citizenMobile: "0" },
          { citizenMobile: "" }
        ]
      })
    }

    // Health ID status filter - exclude placeholder values
    if (healthIdStatus === "with") {
      whereClause.AND = whereClause.AND || []
      whereClause.AND.push(
        { healthId: { not: null } },
        { healthId: { not: "N/A" } },
        { healthId: { not: "" } }
      )
    } else if (healthIdStatus === "without") {
      // When filtering for "without", we need records where health ID is NULL or a placeholder
      // Use OR to match any of these conditions for the health ID field
      whereClause.AND = whereClause.AND || []
      whereClause.AND.push({
        OR: [
          { healthId: null },
          { healthId: "N/A" },
          { healthId: "" }
        ]
      })
    }

    // Rural/Urban filter
    if (ruralUrbanParam) {
      const ruralUrban = ruralUrbanParam.split(",").filter((r) => r.trim())
      if (ruralUrban.length > 0 && ruralUrban.length < 2) {
        whereClause.ruralUrban = { in: ruralUrban }
      }
    }

    // Field Officer filter - filter by assigned secretariats
    if (officersParam) {
      const officerIds = officersParam.split(",").filter((o) => o.trim())
      if (officerIds.length > 0) {
        // Fetch the selected field officers and their assigned secretariats
        const officers = await prisma.user.findMany({
          where: {
            id: { in: officerIds },
            role: "FIELD_OFFICER",
          },
          select: {
            assignedSecretariats: true,
          },
        })

        // Parse and collect all secretariat assignments
        interface SecretariatAssignment {
          mandalName: string
          secName: string
        }

        const allSecretariats: SecretariatAssignment[] = []

        for (const officer of officers) {
          if (officer.assignedSecretariats) {
            try {
              const parsed = JSON.parse(officer.assignedSecretariats)
              if (Array.isArray(parsed)) {
                // Filter valid secretariat objects
                const validSecretariats = parsed.filter(
                  (item): item is SecretariatAssignment =>
                    typeof item === "object" &&
                    item !== null &&
                    typeof item.mandalName === "string" &&
                    typeof item.secName === "string"
                )
                allSecretariats.push(...validSecretariats)
              }
            } catch (error) {
              console.error("Failed to parse assignedSecretariats:", error)
            }
          }
        }

        // Build OR clause for secretariat filtering (mandalName + secName combinations)
        if (allSecretariats.length > 0) {
          // If mandal filter is already applied, filter secretariats to match
          if (whereClause.mandalName) {
            const selectedMandals = Array.isArray(whereClause.mandalName.in)
              ? whereClause.mandalName.in
              : [whereClause.mandalName]

            const filteredSecretariats = allSecretariats.filter((sec) =>
              selectedMandals.includes(sec.mandalName)
            )

            if (filteredSecretariats.length > 0) {
              // Remove mandal filter and replace with specific secretariat combinations
              delete whereClause.mandalName

              // Use AND with OR to combine secretariat filter with other filters
              const secretariatOrConditions = filteredSecretariats.map((sec) => ({
                AND: [
                  { mandalName: sec.mandalName },
                  { secName: sec.secName },
                ],
              }))

              // If there are other filters, wrap everything in AND
              const otherFilters = { ...whereClause }
              whereClause.AND = [
                ...Object.keys(otherFilters).map((key) => ({ [key]: otherFilters[key] })),
                { OR: secretariatOrConditions },
              ]

              // Remove the individual filter keys since they're now in AND
              Object.keys(otherFilters).forEach((key) => {
                if (key !== "AND") {
                  delete whereClause[key]
                }
              })
            }
          } else {
            // No mandal filter, use all secretariats
            const secretariatOrConditions = allSecretariats.map((sec) => ({
              AND: [
                { mandalName: sec.mandalName },
                { secName: sec.secName },
              ],
            }))

            // If there are other filters, wrap everything in AND
            const otherFilters = { ...whereClause }
            if (Object.keys(otherFilters).length > 0) {
              whereClause.AND = [
                ...Object.keys(otherFilters).map((key) => ({ [key]: otherFilters[key] })),
                { OR: secretariatOrConditions },
              ]

              // Remove the individual filter keys since they're now in AND
              Object.keys(otherFilters).forEach((key) => {
                if (key !== "AND") {
                  delete whereClause[key]
                }
              })
            } else {
              // No other filters, just use OR
              whereClause.OR = secretariatOrConditions
            }
          }
        }
      }
    }

    // Helper function to mask UID (show only last 4 digits)
    const maskUID = (uid: string | null): string => {
      if (!uid || uid.length < 4) return ""
      const lastFour = uid.slice(-4)
      const masked = "*".repeat(uid.length - 4) + lastFour
      return masked
    }

    // Get total count and statistics for summary
    console.log(`[Excel Export] WHERE clause:`, JSON.stringify(whereClause, null, 2))
    const totalCount = await prisma.resident.count({
      where: whereClause,
    })
    console.log(`[Excel Export] Total records matching filters: ${totalCount}`)

    // Get counts for statistics (using aggregation for efficiency)
    const [withMobileCount, withHealthIdCount] = await Promise.all([
      prisma.resident.count({
        where: {
          ...whereClause,
          citizenMobile: { not: null },
        },
      }),
      prisma.resident.count({
        where: {
          ...whereClause,
          healthId: { not: null },
        },
      }),
    ])

    // Calculate completion rates
    const mobileCompletionRate =
      totalCount > 0 ? Math.round((withMobileCount / totalCount) * 100) : 0
    const healthIdCompletionRate =
      totalCount > 0 ? Math.round((withHealthIdCount / totalCount) * 100) : 0
    const dataQualityScore = Math.round((mobileCompletionRate + healthIdCompletionRate) / 2)

    // Initialize progress tracking if sessionId is provided
    if (sessionId) {
      const totalBatches = Math.ceil(totalCount / 1000)
      createProgress(sessionId, totalCount, totalBatches)
    }

    // Get mandal-wise statistics
    const mandalStats = await prisma.resident.groupBy({
      by: ["mandalName"],
      where: whereClause,
      _count: {
        id: true,
        citizenMobile: true,
        healthId: true,
      },
    })

    const mandalCompletion = mandalStats
      .map((stat) => ({
        mandalName: stat.mandalName || "Unknown",
        totalResidents: stat._count.id,
        withMobile: stat._count.citizenMobile,
        withHealthId: stat._count.healthId,
        mobileCompletionRate:
          stat._count.id > 0 ? Math.round((stat._count.citizenMobile / stat._count.id) * 100) : 0,
        healthIdCompletionRate:
          stat._count.id > 0 ? Math.round((stat._count.healthId / stat._count.id) * 100) : 0,
      }))
      .sort((a, b) => b.totalResidents - a.totalResidents)

    // Build filter summary
    const filterSummary: string[] = []
    if (startDate || endDate) {
      filterSummary.push(`Date Range: ${startDate || "Any"} to ${endDate || "Any"}`)
    }
    if (mandalsParam) {
      const mandals = mandalsParam.split(",")
      filterSummary.push(`Mandals: ${mandals.length} selected`)
    }
    if (officersParam) {
      const officers = officersParam.split(",")
      filterSummary.push(`Field Officers: ${officers.length} selected`)
    }
    if (mobileStatus !== "all" && mobileStatus) {
      filterSummary.push(`Mobile: ${mobileStatus === "with" ? "With Mobile Only" : "Without Mobile Only"}`)
    }
    if (healthIdStatus !== "all" && healthIdStatus) {
      filterSummary.push(`Health ID: ${healthIdStatus === "with" ? "With Health ID Only" : "Without Health ID Only"}`)
    }
    if (ruralUrbanParam) {
      filterSummary.push(`Area: ${ruralUrbanParam}`)
    }

    const hasFilters = filterSummary.length > 0

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "_")
    const filename = `chittoor_health_report_${timestamp}.xlsx`

    // Create workbook using ExcelJS (in-memory with batching for efficiency)
    const workbook = new ExcelJS.Workbook()
    const BATCH_SIZE = 1000 // Process 1000 records at a time

    // Sheet 1: Summary Statistics
    const summarySheet = workbook.addWorksheet("Summary")
    summarySheet.columns = [
      { header: "", key: "label", width: 35 },
      { header: "", key: "value", width: 20 },
    ]

    // Add summary data
    summarySheet.addRow(["Chittoor District Health Data Collection System", ""])
    summarySheet.addRow([hasFilters ? "Filtered Export Summary Report" : "Export Summary Report", ""])
    summarySheet.addRow([`Generated: ${new Date().toLocaleString()}`, ""])
    summarySheet.addRow(["", ""])

    // Add filter information if filters are applied
    if (hasFilters) {
      summarySheet.addRow(["Applied Filters", ""])
      filterSummary.forEach((filter) => {
        summarySheet.addRow([filter, ""])
      })
      summarySheet.addRow(["", ""])
    }

    summarySheet.addRow(["Metric", "Value"])
    summarySheet.addRow(["Total Residents (Filtered)", totalCount.toString()])
    summarySheet.addRow(["Residents with Mobile Number", withMobileCount.toString()])
    summarySheet.addRow(["Mobile Number Completion Rate", `${mobileCompletionRate}%`])
    summarySheet.addRow(["Residents with Health ID", withHealthIdCount.toString()])
    summarySheet.addRow(["Health ID Completion Rate", `${healthIdCompletionRate}%`])
    summarySheet.addRow(["Overall Data Quality Score", `${dataQualityScore}%`])
    summarySheet.addRow(["", ""])
    summarySheet.addRow(["Total Mandals", mandalCompletion.length.toString()])

    // Sheet 2: Detailed Resident Data (with batching)
    const detailedSheetName = hasFilters ? "Filtered Data" : "Detailed Data"
    const detailedSheet = workbook.addWorksheet(detailedSheetName)

    // Define columns (11 columns total)
    detailedSheet.columns = [
      { header: "Mandal Name", key: "mandalName", width: 25 },
      { header: "Secretariat Name", key: "secName", width: 25 },
      { header: "Resident ID", key: "residentId", width: 15 },
      { header: "Health ID (ABHA ID)", key: "healthId", width: 20 },
      { header: "UID", key: "uid", width: 18 },
      { header: "Mobile Number", key: "mobile", width: 15 },
      { header: "Name", key: "name", width: 25 },
      { header: "Door No", key: "doorNo", width: 15 },
      { header: "Address (eKYC)", key: "addressEkyc", width: 40 },
      { header: "Address (Household)", key: "addressHh", width: 40 },
      { header: "HHID", key: "hhId", width: 15 },
    ]

    // Fetch and add data in batches
    let cursor: string | undefined = undefined
    let processedCount = 0
    let currentBatch = 0

    while (true) {
      currentBatch++
      type ResidentBatch = Array<{
        id: string
        residentId: string
        uid: string | null
        hhId: string | null
        name: string
        healthId: string | null
        mandalName: string | null
        secName: string | null
        doorNumber: string | null
        addressEkyc: string | null
        addressHh: string | null
        citizenMobile: string | null
      }>

      const batch: ResidentBatch = await prisma.resident.findMany({
        where: whereClause,
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          residentId: true,
          uid: true,
          hhId: true,
          name: true,
          healthId: true,
          mandalName: true,
          secName: true,
          doorNumber: true,
          addressEkyc: true,
          addressHh: true,
          citizenMobile: true,
        },
      })

      if (batch.length === 0) {
        break
      }

      // Add rows to sheet
      for (const resident of batch) {
        detailedSheet.addRow({
          mandalName: resident.mandalName || "",
          secName: resident.secName || "",
          residentId: resident.residentId,
          healthId: resident.healthId || "",
          uid: maskUID(resident.uid),
          mobile: resident.citizenMobile || "",
          name: resident.name,
          doorNo: resident.doorNumber || "",
          addressEkyc: resident.addressEkyc || "",
          addressHh: resident.addressHh || "",
          hhId: resident.hhId || "",
        })
      }

      processedCount += batch.length
      console.log(`[Excel Export] Processed ${processedCount}/${totalCount} records`)

      // Update progress if sessionId is provided
      if (sessionId) {
        updateProgress(sessionId, {
          processedRecords: processedCount,
          currentBatch,
          status: "processing",
          message: `Processing batch ${currentBatch}... (${processedCount.toLocaleString()} / ${totalCount.toLocaleString()} records)`,
        })
      }

      cursor = batch[batch.length - 1].id

      if (batch.length < BATCH_SIZE) {
        break
      }
    }

    // Sheet 3: Mandal-wise Breakdown
    const mandalSheet = workbook.addWorksheet("Mandal Breakdown")
    mandalSheet.columns = [
      { header: "Mandal", key: "mandal", width: 25 },
      { header: "Total Residents", key: "total", width: 18 },
      { header: "With Mobile", key: "withMobile", width: 15 },
      { header: "Mobile Completion %", key: "mobileRate", width: 20 },
      { header: "With Health ID", key: "withHealthId", width: 18 },
      { header: "Health ID Completion %", key: "healthIdRate", width: 22 },
      { header: "Average Quality %", key: "avgQuality", width: 18 },
    ]

    // Add mandal data
    for (const mandal of mandalCompletion) {
      mandalSheet.addRow({
        mandal: mandal.mandalName,
        total: mandal.totalResidents,
        withMobile: mandal.withMobile,
        mobileRate: mandal.mobileCompletionRate,
        withHealthId: mandal.withHealthId,
        healthIdRate: mandal.healthIdCompletionRate,
        avgQuality: Math.round((mandal.mobileCompletionRate + mandal.healthIdCompletionRate) / 2),
      })
    }

    console.log(`[Excel Export] Completed - Total records: ${processedCount}`)

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Mark progress as completed
    if (sessionId) {
      completeProgress(sessionId, `Export completed successfully! ${processedCount.toLocaleString()} records exported.`)
    }

    // Return the Excel file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Excel export error:", error)

    // Mark progress as error
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get("sessionId")
    if (sessionId) {
      errorProgress(sessionId, error instanceof Error ? error.message : "Unknown error occurred")
    }

    return NextResponse.json(
      { error: "Failed to generate Excel export" },
      { status: 500 }
    )
  }
}


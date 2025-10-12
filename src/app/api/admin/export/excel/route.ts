import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"

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

    // Build where clause for filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {}

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        whereClause.createdAt.lte = endDateTime
      }
    }

    // Mandal filter
    if (mandalsParam) {
      const mandals = mandalsParam.split(",").filter((m) => m.trim())
      if (mandals.length > 0) {
        whereClause.mandalName = { in: mandals }
      }
    }

    // Mobile status filter
    if (mobileStatus === "with") {
      whereClause.mobileNumber = { not: null }
    } else if (mobileStatus === "without") {
      whereClause.mobileNumber = null
    }

    // Health ID status filter
    if (healthIdStatus === "with") {
      whereClause.healthId = { not: null }
    } else if (healthIdStatus === "without") {
      whereClause.healthId = null
    }

    // Rural/Urban filter
    if (ruralUrbanParam) {
      const ruralUrban = ruralUrbanParam.split(",").filter((r) => r.trim())
      if (ruralUrban.length > 0 && ruralUrban.length < 2) {
        whereClause.ruralUrban = { in: ruralUrban }
      }
    }

    // Fetch filtered data
    const [residents, totalResidents, residentsWithMobile, residentsWithHealthId] =
      await Promise.all([
        prisma.resident.findMany({
          where: whereClause,
          orderBy: { residentId: "asc" },
          select: {
            id: true,
            residentId: true,
            uid: true,
            hhId: true,
            name: true,
            dob: true,
            gender: true,
            mobileNumber: true,
            healthId: true,
            distName: true,
            mandalName: true,
            mandalCode: true,
            secName: true,
            secCode: true,
            ruralUrban: true,
            clusterName: true,
            qualification: true,
            occupation: true,
            caste: true,
            subCaste: true,
            casteCategory: true,
            casteCategoryDetailed: true,
            hofMember: true,
            doorNumber: true,
            addressEkyc: true,
            addressHh: true,
            citizenMobile: true,
            age: true,
            phcName: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.resident.count({ where: whereClause }),
        prisma.resident.count({ where: { ...whereClause, mobileNumber: { not: null } } }),
        prisma.resident.count({ where: { ...whereClause, healthId: { not: null } } }),
      ])

    // Calculate completion rates
    const mobileCompletionRate =
      totalResidents > 0 ? Math.round((residentsWithMobile / totalResidents) * 100) : 0
    const healthIdCompletionRate =
      totalResidents > 0 ? Math.round((residentsWithHealthId / totalResidents) * 100) : 0
    const dataQualityScore = Math.round((mobileCompletionRate + healthIdCompletionRate) / 2)

    // Fetch mandal-wise statistics
    const mandalStats = await prisma.$queryRaw<
      Array<{
        mandalName: string
        totalResidents: bigint
        withMobile: bigint
        withHealthId: bigint
      }>
    >`
      SELECT 
        mandalName,
        COUNT(*) as totalResidents,
        SUM(CASE WHEN mobileNumber IS NOT NULL THEN 1 ELSE 0 END) as withMobile,
        SUM(CASE WHEN healthId IS NOT NULL THEN 1 ELSE 0 END) as withHealthId
      FROM residents
      WHERE mandalName IS NOT NULL
      GROUP BY mandalName
      ORDER BY totalResidents DESC
    `

    const mandalCompletion = mandalStats.map((stat) => ({
      mandalName: stat.mandalName,
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

    // Fetch field officer performance
    const fieldOfficerStats = await prisma.$queryRaw<
      Array<{
        officerName: string
        totalUpdates: bigint
        last7Days: bigint
        last30Days: bigint
        last90Days: bigint
      }>
    >`
      SELECT 
        u.fullName as officerName,
        COUNT(*) as totalUpdates,
        SUM(CASE WHEN ul.updateTimestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as last7Days,
        SUM(CASE WHEN ul.updateTimestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as last30Days,
        SUM(CASE WHEN ul.updateTimestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) as last90Days
      FROM update_logs ul
      INNER JOIN users u ON ul.userId = u.id
      WHERE u.role = 'FIELD_OFFICER'
      GROUP BY u.id, u.fullName
      ORDER BY totalUpdates DESC
    `

    const fieldOfficerPerformance = fieldOfficerStats.map((stat) => ({
      officerName: stat.officerName,
      totalUpdates: Number(stat.totalUpdates),
      last7Days: Number(stat.last7Days),
      last30Days: Number(stat.last30Days),
      last90Days: Number(stat.last90Days),
    }))

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Build filter summary
    const filterSummary: string[] = []
    if (startDate || endDate) {
      filterSummary.push(
        `Date Range: ${startDate || "Any"} to ${endDate || "Any"}`
      )
    }
    if (mandalsParam) {
      const mandals = mandalsParam.split(",")
      filterSummary.push(`Mandals: ${mandals.length} selected`)
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

    // Sheet 1: Summary Statistics
    const summaryData = [
      ["Chittoor District Health Data Collection System"],
      [hasFilters ? "Filtered Export Summary Report" : "Export Summary Report"],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
    ]

    // Add filter information if filters are applied
    if (hasFilters) {
      summaryData.push(["Applied Filters", ""])
      filterSummary.forEach((filter) => {
        summaryData.push([filter, ""])
      })
      summaryData.push([])
    }

    summaryData.push(
      ["Metric", "Value"],
      ["Total Residents (Filtered)", totalResidents.toString()],
      ["Residents with Mobile Number", residentsWithMobile.toString()],
      ["Mobile Number Completion Rate", `${mobileCompletionRate}%`],
      ["Residents with Health ID", residentsWithHealthId.toString()],
      ["Health ID Completion Rate", `${healthIdCompletionRate}%`],
      ["Overall Data Quality Score", `${dataQualityScore}%`],
      [],
      ["Total Mandals", mandalCompletion.length.toString()],
      ["Active Field Officers", fieldOfficerPerformance.length.toString()]
    )

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

    // Apply formatting to summary sheet
    summarySheet["!cols"] = [{ wch: 35 }, { wch: 20 }]

    // Make headers bold (row 5)
    if (!summarySheet["A5"]) summarySheet["A5"] = { t: "s", v: "Metric" }
    if (!summarySheet["B5"]) summarySheet["B5"] = { t: "s", v: "Value" }

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")

    // Sheet 2: Detailed Resident Data
    const detailedSheetName = hasFilters ? "Filtered Data" : "Detailed Data"
    const detailedData = residents.map((resident) => ({
      "System ID": resident.id,
      "Resident ID": resident.residentId,
      "UID (Aadhar)": resident.uid || "",
      "Household ID": resident.hhId || "",
      Name: resident.name,
      "Date of Birth": resident.dob ? new Date(resident.dob).toLocaleDateString() : "",
      Gender: resident.gender || "",
      Age: resident.age?.toString() || "",
      "Mobile Number": resident.mobileNumber || "",
      "Citizen Mobile": resident.citizenMobile || "",
      "Health ID": resident.healthId || "",
      District: resident.distName || "",
      Mandal: resident.mandalName || "",
      "Mandal Code": resident.mandalCode || "",
      Secretariat: resident.secName || "",
      "Secretariat Code": resident.secCode || "",
      "Rural/Urban": resident.ruralUrban || "",
      PHC: resident.phcName || "",
      Cluster: resident.clusterName || "",
      "Door Number": resident.doorNumber || "",
      "Address (eKYC)": resident.addressEkyc || "",
      "Address (Household)": resident.addressHh || "",
      Qualification: resident.qualification || "",
      Occupation: resident.occupation || "",
      Caste: resident.caste || "",
      "Sub Caste": resident.subCaste || "",
      "Caste Category": resident.casteCategory || "",
      "Caste Category (Detailed)": resident.casteCategoryDetailed || "",
      "Head of Family": resident.hofMember || "",
      "Created At": resident.createdAt ? new Date(resident.createdAt).toLocaleString() : "",
      "Updated At": resident.updatedAt ? new Date(resident.updatedAt).toLocaleString() : "",
    }))

    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)

    // Auto-size columns (31 columns total)
    const detailedCols = [
      { wch: 25 }, // System ID
      { wch: 15 }, // Resident ID
      { wch: 15 }, // UID (Aadhar)
      { wch: 15 }, // Household ID
      { wch: 25 }, // Name
      { wch: 15 }, // Date of Birth
      { wch: 10 }, // Gender
      { wch: 8 },  // Age
      { wch: 15 }, // Mobile Number
      { wch: 15 }, // Citizen Mobile
      { wch: 20 }, // Health ID
      { wch: 20 }, // District
      { wch: 20 }, // Mandal
      { wch: 15 }, // Mandal Code
      { wch: 25 }, // Secretariat
      { wch: 15 }, // Secretariat Code
      { wch: 12 }, // Rural/Urban
      { wch: 25 }, // PHC
      { wch: 20 }, // Cluster
      { wch: 15 }, // Door Number
      { wch: 40 }, // Address (eKYC)
      { wch: 40 }, // Address (Household)
      { wch: 20 }, // Qualification
      { wch: 20 }, // Occupation
      { wch: 15 }, // Caste
      { wch: 15 }, // Sub Caste
      { wch: 18 }, // Caste Category
      { wch: 25 }, // Caste Category (Detailed)
      { wch: 20 }, // Head of Family
      { wch: 20 }, // Created At
      { wch: 20 }, // Updated At
    ]
    detailedSheet["!cols"] = detailedCols

    // Freeze top row
    detailedSheet["!freeze"] = { xSplit: 0, ySplit: 1 }

    // Add autofilter (31 columns: A to AE)
    detailedSheet["!autofilter"] = { ref: `A1:AE${residents.length + 1}` }

    XLSX.utils.book_append_sheet(workbook, detailedSheet, detailedSheetName)

    // Sheet 3: Mandal-wise Breakdown
    const mandalData = mandalCompletion.map((mandal) => ({
      Mandal: mandal.mandalName,
      "Total Residents": mandal.totalResidents,
      "With Mobile": mandal.withMobile,
      "Mobile Completion %": mandal.mobileCompletionRate,
      "With Health ID": mandal.withHealthId,
      "Health ID Completion %": mandal.healthIdCompletionRate,
      "Average Quality %": Math.round(
        (mandal.mobileCompletionRate + mandal.healthIdCompletionRate) / 2
      ),
    }))

    const mandalSheet = XLSX.utils.json_to_sheet(mandalData)

    // Auto-size columns
    mandalSheet["!cols"] = [
      { wch: 25 }, // Mandal
      { wch: 18 }, // Total Residents
      { wch: 15 }, // With Mobile
      { wch: 20 }, // Mobile Completion %
      { wch: 18 }, // With Health ID
      { wch: 22 }, // Health ID Completion %
      { wch: 18 }, // Average Quality %
    ]

    // Freeze top row and add autofilter
    mandalSheet["!freeze"] = { xSplit: 0, ySplit: 1 }
    mandalSheet["!autofilter"] = { ref: `A1:G${mandalCompletion.length + 1}` }

    XLSX.utils.book_append_sheet(workbook, mandalSheet, "Mandal Breakdown")

    // Sheet 4: Field Officer Performance
    const officerData = fieldOfficerPerformance.map((officer) => ({
      "Officer Name": officer.officerName,
      "Total Updates": officer.totalUpdates,
      "Last 7 Days": officer.last7Days,
      "Last 30 Days": officer.last30Days,
      "Last 90 Days": officer.last90Days,
      "Avg per Day (30d)": (officer.last30Days / 30).toFixed(1),
    }))

    const officerSheet = XLSX.utils.json_to_sheet(officerData)

    // Auto-size columns
    officerSheet["!cols"] = [
      { wch: 25 }, // Officer Name
      { wch: 15 }, // Total Updates
      { wch: 15 }, // Last 7 Days
      { wch: 15 }, // Last 30 Days
      { wch: 15 }, // Last 90 Days
      { wch: 18 }, // Avg per Day
    ]

    // Freeze top row and add autofilter
    officerSheet["!freeze"] = { xSplit: 0, ySplit: 1 }
    officerSheet["!autofilter"] = { ref: `A1:F${fieldOfficerPerformance.length + 1}` }

    XLSX.utils.book_append_sheet(workbook, officerSheet, "Field Officer Performance")

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "_")
    const filename = `chittoor_health_report_${timestamp}.xlsx`

    // Return file as download
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Excel export error:", error)
    return NextResponse.json(
      { error: "Failed to generate Excel export" },
      { status: 500 }
    )
  }
}


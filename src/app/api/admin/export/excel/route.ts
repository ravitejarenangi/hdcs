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
      whereClause.citizenMobile = { not: null }
    } else if (mobileStatus === "without") {
      whereClause.citizenMobile = null
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

    // Fetch filtered data (single query to avoid connection pool exhaustion)
    const residents = await prisma.resident.findMany({
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
    })

    // Calculate counts from fetched data instead of separate queries
    const totalResidents = residents.length
    const residentsWithMobile = residents.filter((r) => r.citizenMobile !== null).length
    const residentsWithHealthId = residents.filter((r) => r.healthId !== null).length

    // Calculate completion rates
    const mobileCompletionRate =
      totalResidents > 0 ? Math.round((residentsWithMobile / totalResidents) * 100) : 0
    const healthIdCompletionRate =
      totalResidents > 0 ? Math.round((residentsWithHealthId / totalResidents) * 100) : 0
    const dataQualityScore = Math.round((mobileCompletionRate + healthIdCompletionRate) / 2)

    // Calculate mandal-wise statistics from fetched data (avoid additional DB queries)
    const mandalMap = new Map<string, { total: number; withMobile: number; withHealthId: number }>()

    residents.forEach((resident) => {
      const mandal = resident.mandalName || "Unknown"
      const existing = mandalMap.get(mandal) || { total: 0, withMobile: 0, withHealthId: 0 }
      existing.total++
      if (resident.citizenMobile) existing.withMobile++
      if (resident.healthId) existing.withHealthId++
      mandalMap.set(mandal, existing)
    })

    const mandalCompletion = Array.from(mandalMap.entries())
      .map(([mandalName, stats]) => ({
        mandalName,
        totalResidents: stats.total,
        withMobile: stats.withMobile,
        withHealthId: stats.withHealthId,
        mobileCompletionRate:
          stats.total > 0 ? Math.round((stats.withMobile / stats.total) * 100) : 0,
        healthIdCompletionRate:
          stats.total > 0 ? Math.round((stats.withHealthId / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalResidents - a.totalResidents)

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
      ["Total Mandals", mandalCompletion.length.toString()]
    )

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

    // Apply formatting to summary sheet
    summarySheet["!cols"] = [{ wch: 35 }, { wch: 20 }]

    // Make headers bold (row 5)
    if (!summarySheet["A5"]) summarySheet["A5"] = { t: "s", v: "Metric" }
    if (!summarySheet["B5"]) summarySheet["B5"] = { t: "s", v: "Value" }

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")

    // Helper function to mask UID (show only last 4 digits)
    const maskUID = (uid: string | null): string => {
      if (!uid || uid.length < 4) return ""
      const lastFour = uid.slice(-4)
      const masked = "*".repeat(uid.length - 4) + lastFour
      return masked
    }

    // Sheet 2: Detailed Resident Data (only 11 specified columns)
    const detailedSheetName = hasFilters ? "Filtered Data" : "Detailed Data"
    const detailedData = residents.map((resident) => ({
      "Mandal Name": resident.mandalName || "",
      "Secretariat Name": resident.secName || "",
      "Resident ID": resident.residentId,
      "Health ID (ABHA ID)": resident.healthId || "",
      "UID": maskUID(resident.uid),
      "Mobile Number": resident.citizenMobile || "",
      "Name": resident.name,
      "Door No": resident.doorNumber || "",
      "Address (eKYC)": resident.addressEkyc || "",
      "Address (Household)": resident.addressHh || "",
      "HHID": resident.hhId || "",
    }))

    const detailedSheet = XLSX.utils.json_to_sheet(detailedData)

    // Auto-size columns (11 columns total)
    const detailedCols = [
      { wch: 25 }, // Mandal Name
      { wch: 25 }, // Secretariat Name
      { wch: 15 }, // Resident ID
      { wch: 20 }, // Health ID (ABHA ID)
      { wch: 18 }, // UID (masked)
      { wch: 15 }, // Mobile Number
      { wch: 25 }, // Name
      { wch: 15 }, // Door No
      { wch: 40 }, // Address (eKYC)
      { wch: 40 }, // Address (Household)
      { wch: 15 }, // HHID
    ]
    detailedSheet["!cols"] = detailedCols

    // Freeze top row
    detailedSheet["!freeze"] = { xSplit: 0, ySplit: 1 }

    // Add autofilter (11 columns: A to K)
    detailedSheet["!autofilter"] = { ref: `A1:K${residents.length + 1}` }

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


import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

// Helper function to escape CSV values
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return ""
  }

  const stringValue = String(value)

  // If the value contains comma, quote, or newline, wrap it in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

// Helper function to convert array of objects to CSV
function arrayToCSV(data: Array<Record<string, unknown>>, headers: string[]): string {
  const rows: string[] = []

  // Add header row
  rows.push(headers.map((h) => escapeCSV(h)).join(","))

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header]
      if (value instanceof Date) {
        return escapeCSV(value.toLocaleDateString())
      }
      return escapeCSV(String(value ?? ""))
    })
    rows.push(values.join(","))
  }

  return rows.join("\n")
}

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

    // Fetch filtered residents data (all 31 fields)
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

    // Prepare data for CSV (all 31 fields)
    const csvData = residents.map((resident) => ({
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

    // Define headers in the order we want them (31 columns total)
    const headers = [
      "System ID",
      "Resident ID",
      "UID (Aadhar)",
      "Household ID",
      "Name",
      "Date of Birth",
      "Gender",
      "Age",
      "Mobile Number",
      "Citizen Mobile",
      "Health ID",
      "District",
      "Mandal",
      "Mandal Code",
      "Secretariat",
      "Secretariat Code",
      "Rural/Urban",
      "PHC",
      "Cluster",
      "Door Number",
      "Address (eKYC)",
      "Address (Household)",
      "Qualification",
      "Occupation",
      "Caste",
      "Sub Caste",
      "Caste Category",
      "Caste Category (Detailed)",
      "Head of Family",
      "Created At",
      "Updated At",
    ]

    // Build filter summary for CSV header comments
    const filterComments: string[] = []
    filterComments.push("# Chittoor District Health Data Collection System")
    filterComments.push(`# Generated: ${new Date().toLocaleString()}`)
    filterComments.push(`# Total Records: ${residents.length}`)

    // Add filter information if filters are applied
    if (startDate || endDate) {
      filterComments.push(`# Date Range: ${startDate || "Any"} to ${endDate || "Any"}`)
    }
    if (mandalsParam) {
      const mandals = mandalsParam.split(",")
      filterComments.push(`# Mandals: ${mandals.length} selected (${mandals.join(", ")})`)
    }
    if (mobileStatus !== "all" && mobileStatus) {
      filterComments.push(
        `# Mobile Filter: ${mobileStatus === "with" ? "With Mobile Only" : "Without Mobile Only"}`
      )
    }
    if (healthIdStatus !== "all" && healthIdStatus) {
      filterComments.push(
        `# Health ID Filter: ${healthIdStatus === "with" ? "With Health ID Only" : "Without Health ID Only"}`
      )
    }
    if (ruralUrbanParam) {
      filterComments.push(`# Area Filter: ${ruralUrbanParam}`)
    }

    filterComments.push("#")

    // Convert to CSV
    const csvContent = arrayToCSV(csvData, headers)

    // Add filter comments and UTF-8 BOM for Excel compatibility
    const BOM = "\uFEFF"
    const csvWithBOM = BOM + filterComments.join("\n") + "\n" + csvContent

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "_")
    const filename = `chittoor_health_report_${timestamp}.csv`

    // Return CSV file as download
    return new NextResponse(csvWithBOM, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("CSV export error:", error)
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 })
  }
}


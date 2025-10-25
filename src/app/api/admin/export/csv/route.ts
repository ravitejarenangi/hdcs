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
          // If mandal filter is already applied, combine with AND
          if (whereClause.mandalName) {
            // Filter secretariats to only include those in the selected mandals
            const selectedMandals = Array.isArray(whereClause.mandalName.in)
              ? whereClause.mandalName.in
              : [whereClause.mandalName]

            const filteredSecretariats = allSecretariats.filter((sec) =>
              selectedMandals.includes(sec.mandalName)
            )

            if (filteredSecretariats.length > 0) {
              whereClause.OR = filteredSecretariats.map((sec) => ({
                mandalName: sec.mandalName,
                secName: sec.secName,
              }))
              // Remove the mandal filter since it's now part of the OR clause
              delete whereClause.mandalName
            }
          } else {
            // No mandal filter, use all secretariats
            whereClause.OR = allSecretariats.map((sec) => ({
              mandalName: sec.mandalName,
              secName: sec.secName,
            }))
          }
        }
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

    // Helper function to mask UID (show only last 4 digits)
    const maskUID = (uid: string | null): string => {
      if (!uid || uid.length < 4) return ""
      const lastFour = uid.slice(-4)
      const masked = "*".repeat(uid.length - 4) + lastFour
      return masked
    }

    // Prepare data for CSV (only 11 specified columns)
    const csvData = residents.map((resident) => ({
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

    // Define headers in the exact order required (11 columns total)
    const headers = [
      "Mandal Name",
      "Secretariat Name",
      "Resident ID",
      "Health ID (ABHA ID)",
      "UID",
      "Mobile Number",
      "Name",
      "Door No",
      "Address (eKYC)",
      "Address (Household)",
      "HHID",
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
    if (officersParam) {
      const officers = officersParam.split(",")
      filterComments.push(`# Field Officers: ${officers.length} selected`)
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


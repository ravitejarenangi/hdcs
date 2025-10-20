import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Authorization check - Admin or Super Admin only
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      )
    }

    // Get filter parameters from query string
    const searchParams = request.nextUrl.searchParams
    const mandalName = searchParams.get("mandalName")
    const secName = searchParams.get("secName")
    const phcName = searchParams.get("phcName")

    // Build WHERE clause for SQL query
    const whereConditions: string[] = ["1=1"]
    if (mandalName && mandalName !== "all") {
      whereConditions.push(`mandal_name = '${mandalName.replace(/'/g, "''")}'`)
    }
    if (secName && secName !== "all") {
      whereConditions.push(`sec_name = '${secName.replace(/'/g, "''")}'`)
    }
    if (phcName && phcName !== "all") {
      whereConditions.push(`phc_name = '${phcName.replace(/'/g, "''")}'`)
    }
    const whereClause = whereConditions.join(" AND ")

    // First, get the total count to check if we need batch processing
    const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) as count
      FROM residents
      WHERE ${whereClause}
    `)
    const totalCount = Number(countResult[0].count)

    console.log(`CSV Export: Total records to export: ${totalCount}`)

    // If more than 50,000 records, use batch processing to avoid memory issues
    const BATCH_SIZE = 50000
    const useBatchProcessing = totalCount > BATCH_SIZE

    let csvContent = ""

    if (useBatchProcessing) {
      console.log(`Using batch processing with batch size: ${BATCH_SIZE}`)

      // Generate CSV header
      csvContent = getCSVHeaders() + "\n"

      // Process in batches
      const totalBatches = Math.ceil(totalCount / BATCH_SIZE)
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const offset = batchIndex * BATCH_SIZE
        console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (offset: ${offset})`)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batchResidents = await prisma.$queryRawUnsafe<any[]>(`
          SELECT
            id,
            resident_id,
            uid,
            hh_id,
            name,
            CASE
              WHEN dob IS NULL OR dob = '0000-00-00' OR DAY(dob) = 0 OR MONTH(dob) = 0
              THEN NULL
              ELSE dob
            END as dob,
            gender,
            mobile_number,
            health_id,
            dist_name,
            mandal_name,
            mandal_code,
            sec_name,
            sec_code,
            rural_urban,
            cluster_name,
            qualification,
            occupation,
            caste,
            sub_caste,
            caste_category,
            caste_category_detailed,
            hof_member,
            door_number,
            address_ekyc,
            address_hh,
            citizen_mobile,
            age,
            phc_name,
            created_at,
            updated_at
          FROM residents
          WHERE ${whereClause}
          ORDER BY mandal_name ASC, sec_name ASC, name ASC
          LIMIT ${BATCH_SIZE} OFFSET ${offset}
        `)

        // Generate CSV rows for this batch
        const batchRows = generateCSVRows(batchResidents)
        csvContent += batchRows.join("\n")

        // Add newline if not the last batch
        if (batchIndex < totalBatches - 1) {
          csvContent += "\n"
        }

        console.log(`Batch ${batchIndex + 1}/${totalBatches} completed (${batchResidents.length} records)`)
      }
    } else {
      // For smaller datasets, fetch all at once
      console.log(`Fetching all ${totalCount} records at once`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const residents = await prisma.$queryRawUnsafe<any[]>(`
        SELECT
          id,
          resident_id,
          uid,
          hh_id,
          name,
          CASE
            WHEN dob IS NULL OR dob = '0000-00-00' OR DAY(dob) = 0 OR MONTH(dob) = 0
            THEN NULL
            ELSE dob
          END as dob,
          gender,
          mobile_number,
          health_id,
          dist_name,
          mandal_name,
          mandal_code,
          sec_name,
          sec_code,
          rural_urban,
          cluster_name,
          qualification,
          occupation,
          caste,
          sub_caste,
          caste_category,
          caste_category_detailed,
          hof_member,
          door_number,
          address_ekyc,
          address_hh,
          citizen_mobile,
          age,
          phc_name,
          created_at,
          updated_at
        FROM residents
        WHERE ${whereClause}
        ORDER BY mandal_name ASC, sec_name ASC, name ASC
      `)

      csvContent = generateCSV(residents)
    }

    // Log export activity to console
    console.log("CSV Export Activity:", {
      userId: session.user.id,
      recordCount: totalCount,
      filters: { mandalName, secName, phcName },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const filename = `residents_export_${timestamp}.csv`

    // Return CSV file as downloadable response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    })
  } catch (error) {
    console.error("CSV export error:", error)
    console.error("Error details:", error instanceof Error ? error.message : String(error))
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        error: "Failed to generate CSV export",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Helper function to get CSV headers
function getCSVHeaders(): string {
  const headers = [
    "id",
    "resident_id",
    "uid",
    "hh_id",
    "name",
    "dob",
    "age",
    "gender",
    "mobile_number",
    "health_id",
    "dist_name",
    "mandal_name",
    "mandal_code",
    "sec_name",
    "sec_code",
    "rural_urban",
    "cluster_name",
    "qualification",
    "occupation",
    "caste",
    "sub_caste",
    "caste_category",
    "caste_category_detailed",
    "hof_member",
    "door_number",
    "address_ekyc",
    "address_hh",
    "citizen_mobile",
    "phc_name",
    "created_at",
    "updated_at",
  ]
  return headers.join(",")
}

// Helper function to generate CSV rows from residents data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCSVRows(residents: any[]): string[] {
  return residents.map((resident) => {
    // Calculate age from date of birth (handle invalid dates)
    let age = null
    let dob = ""

    try {
      if (resident.dob) {
        const dobDate = new Date(resident.dob)
        // Check if date is valid
        if (!isNaN(dobDate.getTime())) {
          age = Math.floor(
            (new Date().getTime() - dobDate.getTime()) /
              (1000 * 60 * 60 * 24 * 365.25)
          )
          dob = dobDate.toISOString().split("T")[0]
        }
      }
    } catch {
      // Invalid date, leave as empty
      console.warn(`Invalid DOB for resident ${resident.resident_id}:`, resident.dob)
    }

    // Use age from database if DOB calculation failed
    if (age === null && resident.age) {
      age = resident.age
    }

    // Format timestamps (handle invalid dates)
    let createdAt = ""
    let updatedAt = ""

    try {
      if (resident.created_at) {
        const createdDate = new Date(resident.created_at)
        if (!isNaN(createdDate.getTime())) {
          createdAt = createdDate.toISOString()
        }
      }
      if (resident.updated_at) {
        const updatedDate = new Date(resident.updated_at)
        if (!isNaN(updatedDate.getTime())) {
          updatedAt = updatedDate.toISOString()
        }
      }
    } catch {
      // Invalid timestamp, leave as empty
    }

    // Create row data array with ALL columns (use snake_case field names from raw query)
    const rowData = [
      resident.id || "",
      resident.resident_id || "",
      resident.uid || "", // UNMASKED UID for admin export
      resident.hh_id || "",
      escapeCsvValue(resident.name || ""),
      dob,
      age !== null ? age.toString() : "",
      resident.gender || "",
      resident.mobile_number || "",
      resident.health_id || "",
      escapeCsvValue(resident.dist_name || ""),
      escapeCsvValue(resident.mandal_name || ""),
      resident.mandal_code !== null ? resident.mandal_code.toString() : "",
      escapeCsvValue(resident.sec_name || ""),
      resident.sec_code !== null ? resident.sec_code.toString() : "",
      escapeCsvValue(resident.rural_urban || ""),
      escapeCsvValue(resident.cluster_name || ""),
      escapeCsvValue(resident.qualification || ""),
      escapeCsvValue(resident.occupation || ""),
      escapeCsvValue(resident.caste || ""),
      escapeCsvValue(resident.sub_caste || ""),
      escapeCsvValue(resident.caste_category || ""),
      escapeCsvValue(resident.caste_category_detailed || ""),
      escapeCsvValue(resident.hof_member || ""),
      escapeCsvValue(resident.door_number || ""),
      escapeCsvValue(resident.address_ekyc || ""),
      escapeCsvValue(resident.address_hh || ""),
      resident.citizen_mobile || "",
      escapeCsvValue(resident.phc_name || ""),
      createdAt,
      updatedAt,
    ]

    return rowData.join(",")
  })
}

// Helper function to generate complete CSV content (header + rows)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCSV(residents: any[]): string {
  const headerRow = getCSVHeaders()
  const dataRows = generateCSVRows(residents)
  return [headerRow, ...dataRows].join("\n")
}

// Helper function to escape CSV values
function escapeCsvValue(value: string): string {
  if (!value) return ""

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}


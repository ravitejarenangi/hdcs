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

    // Build where clause based on filters
    const whereClause: any = {}
    if (mandalName && mandalName !== "all") {
      whereClause.mandalName = mandalName
    }
    if (secName && secName !== "all") {
      whereClause.secName = secName
    }
    if (phcName && phcName !== "all") {
      whereClause.phcName = phcName
    }

    // Fetch residents data using raw query to handle invalid dates
    // Prisma cannot handle dates with day/month = 0 (e.g., 0000-00-00, 2000-00-00)
    // Select ALL columns from residents table
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
      WHERE 1=1
        ${mandalName && mandalName !== "all" ? `AND mandal_name = '${mandalName.replace(/'/g, "''")}'` : ""}
        ${secName && secName !== "all" ? `AND sec_name = '${secName.replace(/'/g, "''")}'` : ""}
        ${phcName && phcName !== "all" ? `AND phc_name = '${phcName.replace(/'/g, "''")}'` : ""}
      ORDER BY mandal_name ASC, sec_name ASC, name ASC
    `)

    // Generate CSV content
    const csvContent = generateCSV(residents)

    // Log export activity to console (UpdateLog requires valid residentId foreign key)
    console.log("CSV Export Activity:", {
      userId: session.user.id,
      recordCount: residents.length,
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

// Helper function to generate CSV content
function generateCSV(residents: any[]): string {
  // Define CSV headers - ALL columns from residents table
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

  // Create CSV header row
  const headerRow = headers.join(",")

  // Create CSV data rows
  const dataRows = residents.map((resident) => {
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
    } catch (error) {
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
    } catch (error) {
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

  // Combine header and data rows
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


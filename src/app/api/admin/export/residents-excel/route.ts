import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"

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

    console.log("Excel Export Request:", {
      userId: session.user.id,
      userRole: session.user.role,
      filters: { mandalName, secName, phcName },
    })

    // Fetch residents data using raw query to handle invalid dates
    // Same query as CSV export for consistency
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
      WHERE 1=1
        ${mandalName && mandalName !== "all" ? `AND mandal_name = '${mandalName.replace(/'/g, "''")}'` : ""}
        ${secName && secName !== "all" ? `AND sec_name = '${secName.replace(/'/g, "''")}'` : ""}
        ${phcName && phcName !== "all" ? `AND phc_name = '${phcName.replace(/'/g, "''")}'` : ""}
      ORDER BY mandal_name ASC, sec_name ASC, name ASC
    `)

    console.log(`Fetched ${residents.length} residents for Excel export`)

    // Generate Excel file
    const excelBuffer = generateExcel(residents)

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "")
      .replace("T", "_")
    const filename = `residents_export_${timestamp}.xlsx`

    // Log export activity
    console.log("Excel Export Activity:", {
      userId: session.user.id,
      recordCount: residents.length,
      filters: { mandalName, secName, phcName },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
    })

    // Return Excel file
    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("Excel export error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate Excel export",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Helper function to generate Excel file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateExcel(residents: any[]): Buffer {
  // Transform data for Excel
  const excelData = residents.map((resident) => {
    // Handle date of birth
    let dobValue: Date | string = ""
    try {
      if (resident.dob) {
        const dobDate = new Date(resident.dob)
        if (!isNaN(dobDate.getTime())) {
          dobValue = dobDate // Excel will format as date
        }
      }
    } catch {
      // Invalid date, leave as empty
    }

    // Handle timestamps
    let createdAtValue: Date | string = ""
    let updatedAtValue: Date | string = ""
    try {
      if (resident.created_at) {
        const createdDate = new Date(resident.created_at)
        if (!isNaN(createdDate.getTime())) {
          createdAtValue = createdDate
        }
      }
      if (resident.updated_at) {
        const updatedDate = new Date(resident.updated_at)
        if (!isNaN(updatedDate.getTime())) {
          updatedAtValue = updatedDate
        }
      }
    } catch {
      // Invalid timestamp, leave as empty
    }

    // Calculate age if not in database
    let age = resident.age
    if (!age && dobValue instanceof Date) {
      age = Math.floor(
        (new Date().getTime() - dobValue.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      )
    }

    return {
      "ID": resident.id || "",
      "Resident ID": resident.resident_id || "",
      "UID (Aadhaar)": resident.uid || "", // UNMASKED UID
      "Household ID": resident.hh_id || "",
      "Name": resident.name || "",
      "Date of Birth": dobValue,
      "Age": age || "",
      "Gender": resident.gender || "",
      "Mobile Number": resident.mobile_number || "",
      "Health ID": resident.health_id || "",
      "District Name": resident.dist_name || "",
      "Mandal Name": resident.mandal_name || "",
      "Mandal Code": resident.mandal_code || "",
      "Secretariat Name": resident.sec_name || "",
      "Secretariat Code": resident.sec_code || "",
      "Rural/Urban": resident.rural_urban || "",
      "Cluster Name": resident.cluster_name || "",
      "Qualification": resident.qualification || "",
      "Occupation": resident.occupation || "",
      "Caste": resident.caste || "",
      "Sub Caste": resident.sub_caste || "",
      "Caste Category": resident.caste_category || "",
      "Caste Category Detailed": resident.caste_category_detailed || "",
      "Head of Family": resident.hof_member || "",
      "Door Number": resident.door_number || "",
      "Address (eKYC)": resident.address_ekyc || "",
      "Address (Household)": resident.address_hh || "",
      "Citizen Mobile": resident.citizen_mobile || "",
      "PHC Name": resident.phc_name || "",
      "Created At": createdAtValue,
      "Updated At": updatedAtValue,
    }
  })

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(excelData)

  // Set column widths for better readability
  const columnWidths = [
    { wch: 12 },  // ID
    { wch: 15 },  // Resident ID
    { wch: 15 },  // UID
    { wch: 12 },  // Household ID
    { wch: 25 },  // Name
    { wch: 12 },  // DOB
    { wch: 6 },   // Age
    { wch: 10 },  // Gender
    { wch: 15 },  // Mobile Number
    { wch: 20 },  // Health ID
    { wch: 15 },  // District Name
    { wch: 20 },  // Mandal Name
    { wch: 12 },  // Mandal Code
    { wch: 20 },  // Secretariat Name
    { wch: 12 },  // Secretariat Code
    { wch: 12 },  // Rural/Urban
    { wch: 15 },  // Cluster Name
    { wch: 15 },  // Qualification
    { wch: 15 },  // Occupation
    { wch: 12 },  // Caste
    { wch: 12 },  // Sub Caste
    { wch: 15 },  // Caste Category
    { wch: 20 },  // Caste Category Detailed
    { wch: 15 },  // Head of Family
    { wch: 12 },  // Door Number
    { wch: 30 },  // Address (eKYC)
    { wch: 30 },  // Address (Household)
    { wch: 15 },  // Citizen Mobile
    { wch: 20 },  // PHC Name
    { wch: 20 },  // Created At
    { wch: 20 },  // Updated At
  ]
  worksheet["!cols"] = columnWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Residents")

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

  return excelBuffer
}


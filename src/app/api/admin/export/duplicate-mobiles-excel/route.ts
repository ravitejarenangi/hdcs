import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import ExcelJS from "exceljs"
import { createProgress, updateProgress, completeProgress, errorProgress } from "@/lib/export-progress"

// Helper function to mask UID (show only last 4 digits)
const maskUID = (uid: string | null): string => {
  if (!uid || uid.length < 4) return ""
  const lastFour = uid.slice(-4)
  const masked = "*".repeat(uid.length - 4) + lastFour
  return masked
}

export async function GET(request: NextRequest) {
  try {
    console.log(`[Duplicate Mobiles Excel Export] Starting export...`)

    // Check authentication
    const session = await auth()

    if (!session) {
      console.error(`[Duplicate Mobiles Excel Export] Unauthorized - No session`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user) {
      console.error(`[Duplicate Mobiles Excel Export] Unauthorized - No user in session`)
      return NextResponse.json({ error: "Unauthorized - No user found" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "ADMIN") {
      console.error(`[Duplicate Mobiles Excel Export] Forbidden - User role: ${session.user.role}`)
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Check for maskUid and sessionId parameters
    const searchParams = request.nextUrl.searchParams
    const maskUidParam = searchParams.get("maskUid")
    const sessionIdParam = searchParams.get("sessionId")
    const maskUid = maskUidParam === "false" ? false : true
    console.log(`[Duplicate Mobiles Excel Export] maskUid: ${maskUid}`)

    // Initialize progress tracking if sessionId is provided
    if (sessionIdParam) {
      createProgress(sessionIdParam, 100, 5) // Estimate: 100 records, 5 steps
    }

    // Fetch duplicate mobile numbers (appearing more than 5 times) with resident details
    console.log(`[Duplicate Mobiles Excel Export] Fetching duplicate mobile numbers...`)

    if (sessionIdParam) {
      updateProgress(sessionIdParam, {
        status: "processing",
        message: "Fetching duplicate mobile numbers...",
        currentBatch: 1,
      })
    }

    const duplicates = await prisma.$queryRaw<Array<{
      citizen_mobile: string
      count: number
    }>>`
      SELECT
        citizen_mobile,
        COUNT(*) as count
      FROM residents
      WHERE citizen_mobile IS NOT NULL
        AND citizen_mobile != 'N/A'
        AND citizen_mobile != '0'
        AND citizen_mobile != ''
      GROUP BY citizen_mobile
      HAVING COUNT(*) > 5
      ORDER BY COUNT(*) DESC, citizen_mobile
    `

    console.log(`[Duplicate Mobiles Excel Export] Found ${duplicates.length} duplicate mobile numbers`)

    if (duplicates.length === 0) {
      if (sessionIdParam) {
        errorProgress(sessionIdParam, "No duplicate mobile numbers found to export")
      }
      return NextResponse.json(
        { error: "No duplicate mobile numbers found to export" },
        { status: 404 }
      )
    }

    const mobileNumbers = duplicates.map((d) => d.citizen_mobile)
    const totalDuplicates = duplicates.length
    const totalAffectedResidents = duplicates.reduce((sum, d) => sum + Number(d.count), 0)

    console.log(`[Duplicate Mobiles Excel Export] Fetching residents for ${mobileNumbers.length} mobile numbers...`)

    if (sessionIdParam) {
      updateProgress(sessionIdParam, {
        message: `Fetching residents for ${mobileNumbers.length} duplicate mobile numbers...`,
        currentBatch: 2,
        totalRecords: totalAffectedResidents,
        totalBatches: 5,
      })
    }

    // Fetch all residents with duplicate mobile numbers
    const residents = await prisma.resident.findMany({
      where: {
        citizenMobile: { in: mobileNumbers },
      },
      select: {
        name: true,
        citizenMobile: true,
        healthId: true,
        uid: true,
        mandalName: true,
        secName: true,
      },
      orderBy: { citizenMobile: "asc" },
    })

    console.log(`[Duplicate Mobiles Excel Export] Found ${residents.length} residents`)

    if (sessionIdParam) {
      updateProgress(sessionIdParam, {
        message: `Generating Excel file with ${residents.length} residents...`,
        currentBatch: 3,
        processedRecords: residents.length,
      })
    }

    // Create a map of mobile number to count
    const mobileCountMap = duplicates.reduce((acc, dup) => {
      acc[dup.citizen_mobile] = Number(dup.count)
      return acc
    }, {} as Record<string, number>)

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "_")
    const filename = `duplicate_mobile_numbers_${timestamp}.xlsx`

    console.log(`[Duplicate Mobiles Excel Export] Generating Excel file: ${filename}`)

    // Create workbook
    const workbook = new ExcelJS.Workbook()

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet("Summary")
    summarySheet.columns = [
      { header: "", key: "label", width: 35 },
      { header: "", key: "value", width: 20 },
    ]

    // Add summary data
    summarySheet.addRow(["Duplicate Mobile Numbers Report", ""])
    summarySheet.addRow([`Generated: ${new Date().toLocaleString()}`, ""])
    summarySheet.addRow(["", ""])
    summarySheet.addRow(["Metric", "Value"])
    summarySheet.addRow(["Total Duplicate Mobile Numbers", totalDuplicates.toString()])
    summarySheet.addRow(["Total Affected Residents", totalAffectedResidents.toString()])
    summarySheet.addRow(["Average Occurrences per Mobile", totalDuplicates > 0 ? (totalAffectedResidents / totalDuplicates).toFixed(1) : "0"])
    summarySheet.addRow(["", ""])
    summarySheet.addRow(["Note", "Mobile numbers appearing more than 5 times"])

    // Sheet 2: Detailed Data
    const detailedSheet = workbook.addWorksheet("Detailed Data")
    detailedSheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Mandal", key: "mandal", width: 25 },
      { header: "Secretariat", key: "secretariat", width: 25 },
      { header: "Mobile Number", key: "mobile", width: 15 },
      { header: "ABHA ID", key: "abhaId", width: 20 },
      { header: "Aadhaar Number (UID)", key: "uid", width: 18 },
      { header: "Repeat Count", key: "count", width: 12 },
    ]

    // Style the header row
    const headerRow = detailedSheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF4A460" },
    }

    // Add data rows
    residents.forEach((resident) => {
      const mobile = resident.citizenMobile || ""
      const count = mobileCountMap[mobile] || 0

      detailedSheet.addRow({
        name: resident.name,
        mandal: resident.mandalName || "",
        secretariat: resident.secName || "",
        mobile: mobile,
        abhaId: resident.healthId || "",
        uid: maskUid ? maskUID(resident.uid) : (resident.uid || ""),
        count: count,
      })
    })

    console.log(`[Duplicate Mobiles Excel Export] Completed adding rows - Total records: ${residents.length}`)

    // Generate Excel buffer
    console.log(`[Duplicate Mobiles Excel Export] Writing Excel buffer...`)
    const buffer = await workbook.xlsx.writeBuffer()
    console.log(`[Duplicate Mobiles Excel Export] Buffer size: ${buffer.byteLength} bytes`)

    // Return the Excel file
    console.log(`[Duplicate Mobiles Excel Export] Sending file response...`)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("[Duplicate Mobiles Excel Export] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Duplicate Mobiles Excel Export] Error message:", errorMessage)
    return NextResponse.json(
      { error: `Failed to generate Excel export: ${errorMessage}` },
      { status: 500 }
    )
  }
}

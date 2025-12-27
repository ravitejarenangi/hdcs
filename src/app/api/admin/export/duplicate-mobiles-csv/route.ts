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

// Helper function to mask UID (show only last 4 digits)
const maskUID = (uid: string | null): string => {
  if (!uid || uid.length < 4) return ""
  const lastFour = uid.slice(-4)
  const masked = "*".repeat(uid.length - 4) + lastFour
  return masked
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

    // Check for maskUid parameter
    const searchParams = request.nextUrl.searchParams
    const maskUidParam = searchParams.get("maskUid")
    const maskUid = maskUidParam === "false" ? false : true

    // Fetch duplicate mobile numbers (appearing more than 5 times) with resident details
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

    const mobileNumbers = duplicates.map((d) => d.citizen_mobile)

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
    const filename = `duplicate_mobile_numbers_${timestamp}.csv`

    // Create a streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send UTF-8 BOM for Excel compatibility
          const BOM = "\uFEFF"
          controller.enqueue(encoder.encode(BOM))

          // Define headers
          const headers = [
            "Name",
            "Mandal",
            "Secretariat",
            "Mobile Number",
            "ABHA ID",
            "Aadhaar Number (UID)",
            "Repeat Count",
          ]

          // Send CSV header row
          const headerRow = headers.map((h) => escapeCSV(h)).join(",") + "\n"
          controller.enqueue(encoder.encode(headerRow))

          // Process and stream each row
          for (const resident of residents) {
            const mobile = resident.citizenMobile || ""
            const count = mobileCountMap[mobile] || 0

            const row = [
              escapeCSV(resident.name),
              escapeCSV(resident.mandalName || ""),
              escapeCSV(resident.secName || ""),
              escapeCSV(mobile),
              escapeCSV(resident.healthId || ""),
              escapeCSV(maskUid ? maskUID(resident.uid) : (resident.uid || "")),
              escapeCSV(count.toString()),
            ]
            controller.enqueue(encoder.encode(row.join(",") + "\n"))
          }

          console.log(`[Duplicate Mobiles CSV Export] Completed - Total records: ${residents.length}`)

          controller.close()
        } catch (error) {
          console.error("[Duplicate Mobiles CSV Export] Streaming error:", error)
          controller.error(error)
        }
      },
    })

    // Return streaming response
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("Duplicate mobiles CSV export error:", error)
    return NextResponse.json(
      { error: "Failed to generate CSV export" },
      { status: 500 }
    )
  }
}

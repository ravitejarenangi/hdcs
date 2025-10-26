import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createProgress, updateProgress, completeProgress, errorProgress } from "@/lib/export-progress"

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

    // Get total count for the filter summary
    const totalCount = await prisma.resident.count({
      where: whereClause,
    })

    // Initialize progress tracking if sessionId is provided
    if (sessionId) {
      const totalBatches = Math.ceil(totalCount / 1000)
      createProgress(sessionId, totalCount, totalBatches)
    }

    // Build filter summary for CSV header comments
    const filterComments: string[] = []
    filterComments.push("# Chittoor District Health Data Collection System")
    filterComments.push(`# Generated: ${new Date().toLocaleString()}`)
    filterComments.push(`# Total Records: ${totalCount}`)

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

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "")
      .replace("T", "_")
    const filename = `chittoor_health_report_${timestamp}.csv`

    // Create a streaming response
    const encoder = new TextEncoder()
    const BATCH_SIZE = 1000 // Process 1000 records at a time

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send UTF-8 BOM for Excel compatibility
          const BOM = "\uFEFF"
          controller.enqueue(encoder.encode(BOM))

          // Send filter comments
          controller.enqueue(encoder.encode(filterComments.join("\n") + "\n"))

          // Send CSV header row
          const headerRow = headers.map((h) => escapeCSV(h)).join(",") + "\n"
          controller.enqueue(encoder.encode(headerRow))

          // Stream data in batches using cursor-based pagination
          let cursor: string | undefined = undefined
          let processedCount = 0
          let currentBatch = 0

          while (true) {
            currentBatch++
            // Fetch batch of residents
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

            // If no more records, break
            if (batch.length === 0) {
              break
            }

            // Process and stream each row in the batch
            for (const resident of batch) {
              const row = [
                escapeCSV(resident.mandalName || ""),
                escapeCSV(resident.secName || ""),
                escapeCSV(resident.residentId),
                escapeCSV(resident.healthId || ""),
                escapeCSV(maskUID(resident.uid)),
                escapeCSV(resident.citizenMobile || ""),
                escapeCSV(resident.name),
                escapeCSV(resident.doorNumber || ""),
                escapeCSV(resident.addressEkyc || ""),
                escapeCSV(resident.addressHh || ""),
                escapeCSV(resident.hhId || ""),
              ]
              controller.enqueue(encoder.encode(row.join(",") + "\n"))
            }

            processedCount += batch.length
            console.log(`[CSV Export] Streamed ${processedCount}/${totalCount} records`)

            // Update progress if sessionId is provided
            if (sessionId) {
              updateProgress(sessionId, {
                processedRecords: processedCount,
                currentBatch,
                status: "processing",
                message: `Processing batch ${currentBatch}... (${processedCount.toLocaleString()} / ${totalCount.toLocaleString()} records)`,
              })
            }

            // Update cursor for next batch
            cursor = batch[batch.length - 1].id

            // If we got fewer records than BATCH_SIZE, we're done
            if (batch.length < BATCH_SIZE) {
              break
            }
          }

          console.log(`[CSV Export] Completed - Total records: ${processedCount}`)

          // Mark progress as completed
          if (sessionId) {
            completeProgress(sessionId, `Export completed successfully! ${processedCount.toLocaleString()} records exported.`)
          }

          controller.close()
        } catch (error) {
          console.error("[CSV Export] Streaming error:", error)

          // Mark progress as error
          if (sessionId) {
            errorProgress(sessionId, error instanceof Error ? error.message : "Unknown error occurred")
          }

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
    console.error("CSV export error:", error)
    return NextResponse.json({ error: "Failed to generate CSV export" }, { status: 500 })
  }
}


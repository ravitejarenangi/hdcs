import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function exportFieldOfficerCredentials() {
  console.log("📄 Exporting Field Officer Credentials to CSV...\n")

  try {
    // Fetch all Field Officer users
    const users = await prisma.user.findMany({
      where: {
        role: "FIELD_OFFICER",
      },
      orderBy: [{ mandalName: "asc" }, { username: "asc" }],
    })

    console.log(`Found ${users.length} Field Officer accounts\n`)

    // Get secretariat info from residents table
    const secretariatMap = new Map<
      string,
      { secName: string; secCode: number; mandalName: string }
    >()

    const secretariatData = await prisma.resident.groupBy({
      by: ["secName", "secCode", "mandalName"],
      where: {
        secName: { not: null },
        secCode: { not: null },
        mandalName: { not: null },
      },
    })

    for (const item of secretariatData) {
      if (item.secName && item.secCode && item.mandalName) {
        const key = `${item.secCode}`
        secretariatMap.set(key, {
          secName: item.secName,
          secCode: item.secCode,
          mandalName: item.mandalName,
        })
      }
    }

    // Build CSV content
    const csvRows: string[] = []

    // Header
    csvRows.push(
      "Secretariat Name,Mandal,Username,Password,Full Name,Secretariat Code,Role"
    )

    // Data rows
    for (const user of users) {
      // Extract secretariat code from username (format: fo_11090438)
      const secCode = user.username.replace("fo_", "")
      const secInfo = secretariatMap.get(secCode)

      const secName = secInfo?.secName || "Unknown"
      const mandalName = user.mandalName || "Unknown"

      const row = [
        secName,
        mandalName,
        user.username,
        "Welcome@123",
        user.fullName,
        secCode,
        user.role,
      ]

      // Escape fields that contain commas
      const escapedRow = row.map((field) => {
        if (field.includes(",")) {
          return `"${field}"`
        }
        return field
      })

      csvRows.push(escapedRow.join(","))
    }

    // Write to file
    const outputPath = path.join(process.cwd(), "field-officers-credentials.csv")
    fs.writeFileSync(outputPath, csvRows.join("\n"), "utf-8")

    console.log("✅ CSV file created successfully!\n")
    console.log("=" .repeat(80))
    console.log("📊 FILE DETAILS")
    console.log("=" .repeat(80))
    console.log(`File Name: field-officers-credentials.csv`)
    console.log(`Location: ${outputPath}`)
    console.log(`Total Records: ${users.length}`)
    console.log(`File Size: ${fs.statSync(outputPath).size} bytes\n`)

    console.log("=" .repeat(80))
    console.log("📋 FILE PREVIEW (First 20 rows)")
    console.log("=" .repeat(80))

    const previewRows = csvRows.slice(0, 21) // Header + 20 data rows
    for (const row of previewRows) {
      console.log(row)
    }

    console.log(`\n... and ${users.length - 20} more rows\n`)

    console.log("=" .repeat(80))
    console.log("📈 SUMMARY")
    console.log("=" .repeat(80))
    console.log(`Total Field Officers: ${users.length}`)

    // Count mandals
    const mandalSet = new Set(users.map((u) => u.mandalName))
    console.log(`Mandals Covered: ${mandalSet.size}`)

    // Count secretariats with duplicate names
    const secNameCount = new Map<string, number>()
    for (const [_, info] of secretariatMap) {
      secNameCount.set(info.secName, (secNameCount.get(info.secName) || 0) + 1)
    }
    const duplicateCount = Array.from(secNameCount.values()).filter((c) => c > 1).length
    console.log(`Secretariats with Duplicate Names: ${duplicateCount}`)

    console.log(`Default Password: Welcome@123\n`)

    console.log("✅ Export Complete!\n")
  } catch (error) {
    console.error("❌ Error:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

exportFieldOfficerCredentials()


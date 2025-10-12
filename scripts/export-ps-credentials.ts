import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function exportCredentials() {
  console.log("📄 Exporting Panchayat Secretary Credentials to CSV...\n")

  try {
    // Get all mandals with their codes
    const mandalData = await prisma.resident.groupBy({
      by: ["mandalName", "mandalCode"],
      _count: { id: true },
      where: {
        mandalName: { not: null },
        mandalCode: { not: null },
      },
      orderBy: {
        mandalName: "asc",
      },
    })

    // Group by mandal name
    const mandalMap = new Map<
      string,
      { codes: number[]; preferredCode: number; residentCount: number }
    >()

    for (const item of mandalData) {
      const name = item.mandalName!
      const code = item.mandalCode!
      const count = item._count.id

      if (!mandalMap.has(name)) {
        mandalMap.set(name, {
          codes: [code],
          preferredCode: code,
          residentCount: count,
        })
      } else {
        const existing = mandalMap.get(name)!
        existing.codes.push(code)

        // Prefer 5xxx series codes over 1xxx series
        const existingIs5xxx = existing.preferredCode >= 5000
        const newIs5xxx = code >= 5000

        if (newIs5xxx && !existingIs5xxx) {
          existing.preferredCode = code
          existing.residentCount = count
        } else if (existingIs5xxx === newIs5xxx && count > existing.residentCount) {
          existing.preferredCode = code
          existing.residentCount = count
        }
      }
    }

    // Remove N/A mandal if exists
    mandalMap.delete("N/A")

    // Get all Panchayat Secretary users
    const users = await prisma.user.findMany({
      where: {
        role: "PANCHAYAT_SECRETARY",
      },
      select: {
        username: true,
        fullName: true,
        role: true,
        mandalName: true,
      },
      orderBy: {
        mandalName: "asc",
      },
    })

    console.log(`Found ${users.length} Panchayat Secretary accounts\n`)

    // Create CSV content
    const csvRows: string[] = []

    // Header row
    csvRows.push(
      "Mandal Name,Username,Password,Full Name,Mandal Code(s),Role"
    )

    // Data rows
    for (const user of users) {
      if (!user.mandalName) continue

      const mandalInfo = mandalMap.get(user.mandalName)
      const codes = mandalInfo ? mandalInfo.codes.sort((a, b) => a - b).join(", ") : ""

      const row = [
        user.mandalName,
        user.username,
        "Welcome@123",
        user.fullName,
        codes,
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
    const outputPath = path.join(process.cwd(), "panchayat-secretaries-credentials.csv")
    fs.writeFileSync(outputPath, csvRows.join("\n"), "utf-8")

    console.log("✅ CSV file created successfully!\n")
    console.log("=" .repeat(80))
    console.log("📊 FILE DETAILS")
    console.log("=" .repeat(80))
    console.log(`File Name: panchayat-secretaries-credentials.csv`)
    console.log(`Location: ${outputPath}`)
    console.log(`Total Records: ${users.length}`)
    console.log(`File Size: ${fs.statSync(outputPath).size} bytes`)

    // Display preview
    console.log("\n" + "=".repeat(80))
    console.log("📋 FILE PREVIEW (First 10 rows)")
    console.log("=" .repeat(80))
    console.log(csvRows.slice(0, 11).join("\n"))

    if (csvRows.length > 11) {
      console.log(`\n... and ${csvRows.length - 11} more rows`)
    }

    // Summary statistics
    const mandalsWithMultipleCodes = Array.from(mandalMap.entries())
      .filter(([_, info]) => info.codes.length > 1)
      .map(([name]) => name)

    console.log("\n" + "=".repeat(80))
    console.log("📈 SUMMARY")
    console.log("=" .repeat(80))
    console.log(`Total Panchayat Secretaries: ${users.length}`)
    console.log(`Mandals with Multiple Codes: ${mandalsWithMultipleCodes.length}`)
    console.log(`  - ${mandalsWithMultipleCodes.join(", ")}`)
    console.log(`Default Password: Welcome@123`)
    console.log(`\n✅ Export Complete!`)
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

exportCredentials()


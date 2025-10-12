import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

interface SecretariatInfo {
  secName: string
  secCode: number
  mandalName: string
  residentCount: number
}

async function createFieldOfficers() {
  console.log("🔐 Creating Field Officer User Accounts\n")
  console.log("=" .repeat(80))

  try {
    // Step 1: Get all unique secretariat + mandal combinations
    console.log("📊 Step 1: Analyzing Secretariats...\n")

    const secretariatData = await prisma.resident.groupBy({
      by: ["secName", "secCode", "mandalName"],
      _count: { id: true },
      where: {
        secName: { not: null },
        secCode: { not: null },
        mandalName: { not: null },
      },
      orderBy: [{ mandalName: "asc" }, { secName: "asc" }],
    })

    // Filter out N/A entries
    const secretariats: SecretariatInfo[] = secretariatData
      .filter((item) => item.secName !== "N/A" && item.mandalName !== "N/A")
      .map((item) => ({
        secName: item.secName!,
        secCode: item.secCode!,
        mandalName: item.mandalName!,
        residentCount: item._count.id,
      }))

    console.log(`Found ${secretariats.length} unique secretariat + mandal combinations\n`)

    // Check for duplicate secretariat names across mandals
    const secNameCount = new Map<string, number>()
    for (const sec of secretariats) {
      secNameCount.set(sec.secName, (secNameCount.get(sec.secName) || 0) + 1)
    }

    const duplicateNames = Array.from(secNameCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([name]) => name)

    if (duplicateNames.length > 0) {
      console.log("⚠️  Secretariat names appearing in multiple mandals:")
      console.log("─".repeat(80))
      for (const name of duplicateNames) {
        const locations = secretariats
          .filter((s) => s.secName === name)
          .map((s) => `${s.mandalName} (${s.secCode})`)
        console.log(`  ${name}: ${locations.join(", ")}`)
      }
      console.log()
    }

    // Step 2: Create Field Officer accounts
    console.log("=" .repeat(80))
    console.log("👥 Step 2: Creating Field Officer Accounts...\n")

    const password = "Welcome@123"
    const hashedPassword = await bcrypt.hash(password, 10)

    const results: Array<{
      secName: string
      mandalName: string
      username: string
      fullName: string
      secCode: number
      status: string
    }> = []

    let created = 0
    let existing = 0
    let errors = 0

    for (const secretariat of secretariats) {
      const username = `fo_${secretariat.secCode}`
      const fullName = `FO ${secretariat.secName}`

      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { username },
        })

        if (existingUser) {
          existing++
          if (existing <= 5) {
            console.log(`⏭️  Skipped: ${username} (${secretariat.secName}) - Already exists`)
          }
          results.push({
            secName: secretariat.secName,
            mandalName: secretariat.mandalName,
            username,
            fullName,
            secCode: secretariat.secCode,
            status: "Already Exists",
          })
          continue
        }

        // Create new Field Officer
        // Store secretariat in format: "MANDAL -> SECRETARIAT"
        const secretariatFormat = `${secretariat.mandalName} -> ${secretariat.secName}`

        await prisma.user.create({
          data: {
            username,
            passwordHash: hashedPassword,
            fullName,
            role: "FIELD_OFFICER",
            mandalName: secretariat.mandalName,
            assignedSecretariats: JSON.stringify([secretariatFormat]),
          },
        })

        created++
        if (created <= 10) {
          console.log(`✅ Created: ${username} (${secretariat.secName} - ${secretariat.mandalName})`)
        } else if (created === 11) {
          console.log(`\n... creating remaining accounts (showing progress every 50)...\n`)
        } else if (created % 50 === 0) {
          console.log(`✅ Progress: ${created} accounts created...`)
        }

        results.push({
          secName: secretariat.secName,
          mandalName: secretariat.mandalName,
          username,
          fullName,
          secCode: secretariat.secCode,
          status: "Created",
        })
      } catch (error) {
        errors++
        console.error(`❌ Error creating ${username}:`, error instanceof Error ? error.message : error)
        results.push({
          secName: secretariat.secName,
          mandalName: secretariat.mandalName,
          username,
          fullName,
          secCode: secretariat.secCode,
          status: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
        })
      }
    }

    // Step 3: Summary Report
    console.log("\n" + "=".repeat(80))
    console.log("📋 SUMMARY REPORT")
    console.log("=" .repeat(80))

    console.log("\n📊 Creation Statistics:\n")
    console.log("─".repeat(80))
    console.log(`Total Secretariats: ${results.length}`)
    console.log(`✅ Created: ${created}`)
    console.log(`⏭️  Already Existed: ${existing}`)
    console.log(`❌ Errors: ${errors}`)

    // Sample of created accounts
    console.log("\n📋 Sample Created Accounts (First 20):\n")
    console.log("─".repeat(80))
    console.log(
      `${"Secretariat".padEnd(30)} | ${"Mandal".padEnd(25)} | ${"Username".padEnd(15)} | ${"Status"}`
    )
    console.log("─".repeat(80))

    const createdAccounts = results.filter((r) => r.status === "Created")
    for (const result of createdAccounts.slice(0, 20)) {
      const statusIcon = "✅"
      console.log(
        `${result.secName.padEnd(30)} | ${result.mandalName.padEnd(25)} | ${result.username.padEnd(15)} | ${statusIcon} ${result.status}`
      )
    }

    if (createdAccounts.length > 20) {
      console.log(`\n... and ${createdAccounts.length - 20} more accounts created`)
    }

    // Mandal-wise distribution
    console.log("\n" + "=".repeat(80))
    console.log("📊 MANDAL-WISE DISTRIBUTION")
    console.log("=" .repeat(80))

    const mandalDistribution = new Map<string, number>()
    for (const result of results) {
      mandalDistribution.set(
        result.mandalName,
        (mandalDistribution.get(result.mandalName) || 0) + 1
      )
    }

    const sortedMandals = Array.from(mandalDistribution.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    )

    console.log("\n" + `${"Mandal".padEnd(30)} | ${"Field Officers"}`)
    console.log("─".repeat(80))
    for (const [mandal, count] of sortedMandals) {
      console.log(`${mandal.padEnd(30)} | ${count}`)
    }

    // Secretariats with duplicate names
    if (duplicateNames.length > 0) {
      console.log("\n" + "=".repeat(80))
      console.log("⚠️  SECRETARIATS WITH DUPLICATE NAMES")
      console.log("=" .repeat(80))
      console.log(`
The following secretariat names appear in multiple mandals.
Each has a unique secretariat code and Field Officer account.
`)
      console.log("─".repeat(80))
      console.log(`${"Secretariat".padEnd(30)} | ${"Mandal".padEnd(25)} | ${"Username (Code)"}`)
      console.log("─".repeat(80))

      for (const name of duplicateNames) {
        const instances = results.filter((r) => r.secName === name)
        for (const instance of instances) {
          console.log(
            `${instance.secName.padEnd(30)} | ${instance.mandalName.padEnd(25)} | ${instance.username}`
          )
        }
        console.log("─".repeat(80))
      }
    }

    console.log("\n" + "=".repeat(80))
    console.log("🔑 LOGIN CREDENTIALS")
    console.log("=" .repeat(80))
    console.log(`
Default Password for all Field Officers: Welcome@123

Sample Login Credentials:
--------------------------`)

    for (const result of createdAccounts.slice(0, 5)) {
      console.log(`Username: ${result.username}`)
      console.log(`Password: Welcome@123`)
      console.log(`Secretariat: ${result.secName}`)
      console.log(`Mandal: ${result.mandalName}`)
      console.log(`---`)
    }

    console.log(`\n... and ${createdAccounts.length - 5} more accounts\n`)

    console.log("=" .repeat(80))
    console.log("✅ FIELD OFFICER ACCOUNT CREATION COMPLETE!")
    console.log("=" .repeat(80))

    // Return results for CSV export
    return results
  } catch (error) {
    console.error("❌ Fatal Error:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createFieldOfficers()


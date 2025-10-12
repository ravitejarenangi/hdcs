import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

interface MandalInfo {
  mandalName: string
  preferredCode: number
  allCodes: number[]
  residentCount: number
}

async function createPanchayatSecretaries() {
  console.log("🔐 Creating Panchayat Secretary User Accounts\n")
  console.log("=" .repeat(80))

  try {
    // Step 1: Get all unique mandals with their codes
    console.log("📊 Step 1: Analyzing Mandals and Codes...\n")

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

    // Group by mandal name and determine preferred code
    const mandalMap = new Map<string, MandalInfo>()

    for (const item of mandalData) {
      const name = item.mandalName!
      const code = item.mandalCode!
      const count = item._count.id

      if (!mandalMap.has(name)) {
        mandalMap.set(name, {
          mandalName: name,
          preferredCode: code,
          allCodes: [code],
          residentCount: count,
        })
      } else {
        const existing = mandalMap.get(name)!
        existing.allCodes.push(code)

        // Prefer 5xxx series codes over 1xxx series
        // If both are 5xxx or both are 1xxx, prefer the one with more residents
        const existingIs5xxx = existing.preferredCode >= 5000
        const newIs5xxx = code >= 5000

        if (newIs5xxx && !existingIs5xxx) {
          // New code is 5xxx, existing is 1xxx - prefer new
          existing.preferredCode = code
          existing.residentCount = count
        } else if (existingIs5xxx === newIs5xxx && count > existing.residentCount) {
          // Both same series, prefer higher count
          existing.preferredCode = code
          existing.residentCount = count
        }
      }
    }

    // Remove N/A mandal if exists
    mandalMap.delete("N/A")

    const mandals = Array.from(mandalMap.values()).sort((a, b) =>
      a.mandalName.localeCompare(b.mandalName)
    )

    console.log(`Found ${mandals.length} unique mandals\n`)

    // Show mandals with multiple codes
    const duplicateMandals = mandals.filter((m) => m.allCodes.length > 1)
    if (duplicateMandals.length > 0) {
      console.log("⚠️  Mandals with multiple codes:")
      console.log("─".repeat(80))
      for (const mandal of duplicateMandals) {
        console.log(
          `  ${mandal.mandalName.padEnd(25)} → Codes: ${mandal.allCodes.join(", ")} | Using: ${mandal.preferredCode}`
        )
      }
      console.log()
    }

    // Step 2: Create users
    console.log("=" .repeat(80))
    console.log("👥 Step 2: Creating Panchayat Secretary Accounts...\n")

    const password = "Welcome@123"
    const hashedPassword = await bcrypt.hash(password, 10)

    const results: Array<{
      mandalName: string
      username: string
      fullName: string
      status: string
      codes: number[]
    }> = []

    for (const mandal of mandals) {
      const username = `ps_${mandal.preferredCode}`
      const fullName = `PS ${mandal.mandalName}`

      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { username },
        })

        if (existingUser) {
          console.log(`⏭️  Skipped: ${username} (${mandal.mandalName}) - Already exists`)
          results.push({
            mandalName: mandal.mandalName,
            username,
            fullName,
            status: "Already Exists",
            codes: mandal.allCodes,
          })
          continue
        }

        // Create new user
        await prisma.user.create({
          data: {
            username,
            passwordHash: hashedPassword,
            fullName,
            role: "PANCHAYAT_SECRETARY",
            mandalName: mandal.mandalName,
          },
        })

        console.log(`✅ Created: ${username} (${mandal.mandalName})`)
        results.push({
          mandalName: mandal.mandalName,
          username,
          fullName,
          status: "Created",
          codes: mandal.allCodes,
        })
      } catch (error) {
        console.error(`❌ Error creating ${username}:`, error)
        results.push({
          mandalName: mandal.mandalName,
          username,
          fullName,
          status: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          codes: mandal.allCodes,
        })
      }
    }

    // Step 3: Summary Report
    console.log("\n" + "=".repeat(80))
    console.log("📋 SUMMARY REPORT")
    console.log("=" .repeat(80))

    console.log("\n📊 User Creation Summary:\n")
    console.log("─".repeat(80))
    console.log(
      `${"Mandal Name".padEnd(25)} | ${"Username".padEnd(15)} | ${"Full Name".padEnd(25)} | ${"Status"}`
    )
    console.log("─".repeat(80))

    for (const result of results) {
      const statusIcon = result.status === "Created" ? "✅" : result.status === "Already Exists" ? "⏭️ " : "❌"
      console.log(
        `${result.mandalName.padEnd(25)} | ${result.username.padEnd(15)} | ${result.fullName.padEnd(25)} | ${statusIcon} ${result.status}`
      )
    }

    const created = results.filter((r) => r.status === "Created").length
    const existing = results.filter((r) => r.status === "Already Exists").length
    const errors = results.filter((r) => r.status.startsWith("Error")).length

    console.log("\n" + "=".repeat(80))
    console.log("📈 Statistics:")
    console.log("─".repeat(80))
    console.log(`Total Mandals: ${results.length}`)
    console.log(`✅ Created: ${created}`)
    console.log(`⏭️  Already Existed: ${existing}`)
    console.log(`❌ Errors: ${errors}`)

    // Step 4: Login Credentials
    console.log("\n" + "=".repeat(80))
    console.log("🔑 LOGIN CREDENTIALS")
    console.log("=" .repeat(80))
    console.log(`
Default Password for all Panchayat Secretaries: Welcome@123

Sample Login Credentials:
--------------------------`)

    for (const result of results.slice(0, 5)) {
      console.log(`Username: ${result.username}`)
      console.log(`Password: Welcome@123`)
      console.log(`Mandal: ${result.mandalName}`)
      console.log(`---`)
    }

    console.log(`\n... and ${results.length - 5} more accounts\n`)

    // Step 5: Mandals with Multiple Codes
    if (duplicateMandals.length > 0) {
      console.log("=" .repeat(80))
      console.log("⚠️  MANDALS WITH MULTIPLE CODES")
      console.log("=" .repeat(80))
      console.log(`
The following mandals have multiple codes in the database.
The Panchayat Secretary will have access to ALL residents in their mandal,
regardless of which code is assigned to the resident.

`)
      console.log("─".repeat(80))
      console.log(`${"Mandal".padEnd(25)} | ${"All Codes".padEnd(20)} | ${"Username (Using Code)"}`)
      console.log("─".repeat(80))

      for (const mandal of duplicateMandals) {
        const result = results.find((r) => r.mandalName === mandal.mandalName)!
        console.log(
          `${mandal.mandalName.padEnd(25)} | ${mandal.allCodes.join(", ").padEnd(20)} | ${result.username}`
        )
      }
    }

    console.log("\n" + "=".repeat(80))
    console.log("✅ PANCHAYAT SECRETARY ACCOUNT CREATION COMPLETE!")
    console.log("=" .repeat(80))
  } catch (error) {
    console.error("❌ Fatal Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

createPanchayatSecretaries()


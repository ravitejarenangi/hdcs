/**
 * Script to update Mandal Officer full names from "PS <Mandal>" to "MO <Mandal>"
 * 
 * This script:
 * 1. Finds all Mandal Officer users (PANCHAYAT_SECRETARY role)
 * 2. Updates their fullName from "PS <MANDAL_NAME>" to "MO <MANDAL_NAME>"
 * 3. Also handles any variations like "PS-<MANDAL>" or "PS_<MANDAL>"
 * 
 * Usage: npx tsx scripts/update-mo-fullnames.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function updateMandalOfficerFullNames() {
  console.log("🔄 Starting Mandal Officer fullName update...")
  console.log("=" .repeat(80))

  try {
    // Find all Mandal Officers
    const mandalOfficers = await prisma.user.findMany({
      where: {
        role: "PANCHAYAT_SECRETARY",
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        mandalName: true,
      },
    })

    console.log(`\n📊 Found ${mandalOfficers.length} Mandal Officer(s)\n`)

    if (mandalOfficers.length === 0) {
      console.log("✅ No Mandal Officers found. Nothing to update.")
      return
    }

    const updates: Array<{
      username: string
      mandalName: string | null
      oldFullName: string
      newFullName: string
      status: string
    }> = []

    for (const officer of mandalOfficers) {
      const oldFullName = officer.fullName
      let newFullName = oldFullName

      // Check if fullName starts with "PS" (with various separators)
      if (
        oldFullName.startsWith("PS ") ||
        oldFullName.startsWith("PS-") ||
        oldFullName.startsWith("PS_")
      ) {
        // Replace "PS" with "MO" at the beginning
        newFullName = oldFullName.replace(/^PS[\s\-_]/, "MO ")
      } else if (officer.mandalName && !oldFullName.startsWith("MO ")) {
        // If fullName doesn't follow the pattern but we have mandalName, construct it
        newFullName = `MO ${officer.mandalName}`
      }

      // Only update if there's a change
      if (newFullName !== oldFullName) {
        try {
          await prisma.user.update({
            where: { id: officer.id },
            data: { fullName: newFullName },
          })

          console.log(`✅ Updated: ${officer.username}`)
          console.log(`   Old: "${oldFullName}"`)
          console.log(`   New: "${newFullName}"`)
          console.log()

          updates.push({
            username: officer.username,
            mandalName: officer.mandalName,
            oldFullName,
            newFullName,
            status: "Updated",
          })
        } catch (error) {
          console.error(`❌ Error updating ${officer.username}:`, error)
          updates.push({
            username: officer.username,
            mandalName: officer.mandalName,
            oldFullName,
            newFullName,
            status: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          })
        }
      } else {
        console.log(`⏭️  Skipped: ${officer.username} - Already has correct format`)
        console.log(`   Current: "${oldFullName}"`)
        console.log()

        updates.push({
          username: officer.username,
          mandalName: officer.mandalName,
          oldFullName,
          newFullName,
          status: "No Change Needed",
        })
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80))
    console.log("📋 SUMMARY")
    console.log("=".repeat(80))
    console.log(
      `${"Username".padEnd(20)} | ${"Mandal".padEnd(25)} | ${"Old Name".padEnd(30)} | ${"New Name".padEnd(30)} | Status`
    )
    console.log("-".repeat(140))

    for (const update of updates) {
      const statusIcon =
        update.status === "Updated"
          ? "✅"
          : update.status === "No Change Needed"
          ? "⏭️ "
          : "❌"
      console.log(
        `${update.username.padEnd(20)} | ${(update.mandalName || "N/A").padEnd(25)} | ${update.oldFullName.padEnd(30)} | ${update.newFullName.padEnd(30)} | ${statusIcon} ${update.status}`
      )
    }

    const updated = updates.filter((u) => u.status === "Updated").length
    const skipped = updates.filter((u) => u.status === "No Change Needed").length
    const errors = updates.filter((u) => u.status.startsWith("Error")).length

    console.log("\n" + "=".repeat(80))
    console.log(`✅ Updated: ${updated}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`❌ Errors: ${errors}`)
    console.log(`📊 Total: ${updates.length}`)
    console.log("=".repeat(80))

    if (updated > 0) {
      console.log("\n✨ Mandal Officer fullName update completed successfully!")
      console.log("All Mandal Officers now have 'MO <MANDAL_NAME>' format.")
    } else {
      console.log("\n✅ All Mandal Officers already have the correct fullName format.")
    }
  } catch (error) {
    console.error("\n❌ Error during update:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateMandalOfficerFullNames()
  .then(() => {
    console.log("\n✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })


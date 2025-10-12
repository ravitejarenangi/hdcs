import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function fixFieldOfficerSecretariatFormat() {
  console.log("🔧 Fixing Field Officer Secretariat Format\n")
  console.log("=" .repeat(80))

  try {
    // Get all Field Officer users
    const fieldOfficers = await prisma.user.findMany({
      where: {
        role: "FIELD_OFFICER",
      },
    })

    console.log(`Found ${fieldOfficers.length} Field Officer accounts\n`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const officer of fieldOfficers) {
      try {
        // Skip if no assignedSecretariats
        if (!officer.assignedSecretariats) {
          skipped++
          continue
        }

        // Parse the current format
        let secretariats: string[]
        try {
          secretariats = JSON.parse(officer.assignedSecretariats)
        } catch {
          // If not JSON, treat as single value
          secretariats = [officer.assignedSecretariats]
        }

        // Check if already in correct format (contains " -> ")
        if (secretariats.length > 0 && secretariats[0].includes(" -> ")) {
          skipped++
          if (skipped <= 5) {
            console.log(`⏭️  Skipped: ${officer.username} - Already in correct format`)
          }
          continue
        }

        // Convert to new format: "MANDAL -> SECRETARIAT"
        const mandalName = officer.mandalName
        if (!mandalName) {
          console.log(`⚠️  Warning: ${officer.username} has no mandal assigned`)
          skipped++
          continue
        }

        const newFormat = secretariats.map((secName) => `${mandalName} -> ${secName}`)

        // Update the user
        await prisma.user.update({
          where: { id: officer.id },
          data: {
            assignedSecretariats: JSON.stringify(newFormat),
          },
        })

        updated++
        if (updated <= 10) {
          console.log(
            `✅ Updated: ${officer.username} - ${secretariats[0]} → ${newFormat[0]}`
          )
        } else if (updated === 11) {
          console.log(`\n... updating remaining accounts (showing progress every 50)...\n`)
        } else if (updated % 50 === 0) {
          console.log(`✅ Progress: ${updated} accounts updated...`)
        }
      } catch (error) {
        errors++
        console.error(
          `❌ Error updating ${officer.username}:`,
          error instanceof Error ? error.message : error
        )
      }
    }

    // Summary
    console.log("\n" + "=".repeat(80))
    console.log("📋 SUMMARY")
    console.log("=" .repeat(80))
    console.log(`Total Field Officers: ${fieldOfficers.length}`)
    console.log(`✅ Updated: ${updated}`)
    console.log(`⏭️  Skipped (already correct): ${skipped}`)
    console.log(`❌ Errors: ${errors}`)

    console.log("\n" + "=".repeat(80))
    console.log("✅ MIGRATION COMPLETE!")
    console.log("=" .repeat(80))
  } catch (error) {
    console.error("❌ Fatal Error:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixFieldOfficerSecretariatFormat()


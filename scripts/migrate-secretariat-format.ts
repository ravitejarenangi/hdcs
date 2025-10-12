import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔧 Migrating assignedSecretariats format...\n")

  // Get all field officers
  const fieldOfficers = await prisma.user.findMany({
    where: {
      role: "FIELD_OFFICER",
      assignedSecretariats: { not: null },
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      assignedSecretariats: true,
    },
  })

  console.log(`Found ${fieldOfficers.length} field officers with assigned secretariats\n`)

  let migratedCount = 0
  let alreadyCorrectCount = 0
  let errorCount = 0

  for (const officer of fieldOfficers) {
    try {
      if (!officer.assignedSecretariats) continue

      const secretariats = JSON.parse(officer.assignedSecretariats)
      
      if (!Array.isArray(secretariats) || secretariats.length === 0) {
        console.log(`⚠️  ${officer.username}: Empty or invalid secretariats array`)
        continue
      }

      // Check if already in new format
      const firstItem = secretariats[0]
      if (typeof firstItem === 'object' && firstItem.mandalName && firstItem.secName) {
        alreadyCorrectCount++
        if (alreadyCorrectCount <= 5) {
          console.log(`✅ ${officer.username}: Already in correct format`)
        }
        continue
      }

      // Migrate from old format to new format
      if (typeof firstItem === 'string') {
        const newFormat = secretariats.map((s: string) => {
          // Parse "MANDAL -> SECRETARIAT" format
          const parts = s.split(' -> ')
          if (parts.length === 2) {
            return {
              mandalName: parts[0].trim(),
              secName: parts[1].trim(),
            }
          }
          return null
        }).filter(Boolean)

        if (newFormat.length > 0) {
          // Update the officer with new format
          await prisma.user.update({
            where: { id: officer.id },
            data: {
              assignedSecretariats: JSON.stringify(newFormat),
            },
          })

          migratedCount++
          if (migratedCount <= 10) {
            console.log(`🔄 ${officer.username}: Migrated ${newFormat.length} secretariat(s)`)
            console.log(`   Old: ${officer.assignedSecretariats}`)
            console.log(`   New: ${JSON.stringify(newFormat)}`)
          }
        } else {
          console.log(`⚠️  ${officer.username}: Could not parse secretariats`)
          errorCount++
        }
      } else {
        console.log(`⚠️  ${officer.username}: Unknown format`)
        errorCount++
      }
    } catch (error) {
      console.error(`❌ Error processing ${officer.username}:`, error)
      errorCount++
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("📊 Migration Summary:")
  console.log("=".repeat(60))
  console.log(`Total field officers: ${fieldOfficers.length}`)
  console.log(`Already in correct format: ${alreadyCorrectCount}`)
  console.log(`Migrated: ${migratedCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log("=".repeat(60))

  if (migratedCount > 0) {
    console.log("\n✅ Migration completed successfully!")
    console.log("Please refresh the Reports page to see the updated officer assignments.")
  } else if (alreadyCorrectCount === fieldOfficers.length) {
    console.log("\n✅ All officers are already in the correct format!")
  } else {
    console.log("\n⚠️  Migration completed with some issues. Please review the errors above.")
  }
}

main()
  .catch((error) => {
    console.error("❌ Fatal error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Checking All Field Officers...\n")

  // Get all field officers
  const fieldOfficers = await prisma.user.findMany({
    where: { role: "FIELD_OFFICER" },
    select: {
      id: true,
      username: true,
      fullName: true,
      assignedSecretariats: true,
      isActive: true,
    },
    orderBy: { username: "asc" },
  })

  if (fieldOfficers.length === 0) {
    console.log("ℹ️  No Field Officers found in the database.")
    return
  }

  console.log(`Found ${fieldOfficers.length} Field Officer(s)\n`)
  console.log("=" .repeat(80))

  let correctCount = 0
  let incorrectCount = 0
  let noAssignmentCount = 0

  for (const officer of fieldOfficers) {
    console.log(`\n👤 ${officer.username} (${officer.fullName})`)
    console.log("   Active:", officer.isActive ? "✅ Yes" : "❌ No")

    if (!officer.assignedSecretariats) {
      console.log("   Status: ❌ NO ASSIGNMENT")
      console.log("   Issue: No secretariats assigned")
      noAssignmentCount++
      continue
    }

    try {
      const parsed = JSON.parse(officer.assignedSecretariats)

      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.log("   Status: ❌ INVALID FORMAT")
        console.log("   Issue: Not an array or empty")
        incorrectCount++
        continue
      }

      // Check format
      const firstItem = parsed[0]

      if (typeof firstItem === "string") {
        // Old format
        console.log("   Status: ❌ INCORRECT FORMAT")
        console.log("   Current:", JSON.stringify(parsed))
        console.log("   Issue: Using old format (string array)")
        console.log("   Secretariats:", parsed.join(", "))
        incorrectCount++

        // Try to find mandals for these secretariats
        console.log("   Suggested Fix:")
        for (const secName of parsed) {
          const resident = await prisma.resident.findFirst({
            where: { secName },
            select: { mandalName: true, secName: true },
          })

          if (resident) {
            console.log(`     - { mandalName: "${resident.mandalName}", secName: "${resident.secName}" }`)
          } else {
            console.log(`     - ⚠️  Secretariat "${secName}" not found in residents table`)
          }
        }
      } else if (
        typeof firstItem === "object" &&
        firstItem !== null &&
        "mandalName" in firstItem &&
        "secName" in firstItem
      ) {
        // New format
        console.log("   Status: ✅ CORRECT FORMAT")
        console.log("   Secretariats:")
        for (const sec of parsed) {
          console.log(`     - ${sec.mandalName} → ${sec.secName}`)
        }
        correctCount++
      } else {
        console.log("   Status: ❌ UNKNOWN FORMAT")
        console.log("   Current:", JSON.stringify(parsed))
        incorrectCount++
      }
    } catch (error) {
      console.log("   Status: ❌ PARSE ERROR")
      console.log("   Issue: Failed to parse JSON")
      console.log("   Error:", error)
      incorrectCount++
    }
  }

  console.log("\n" + "=".repeat(80))
  console.log("\n📊 Summary:")
  console.log(`   Total Field Officers: ${fieldOfficers.length}`)
  console.log(`   ✅ Correct Format: ${correctCount}`)
  console.log(`   ❌ Incorrect Format: ${incorrectCount}`)
  console.log(`   ⚠️  No Assignment: ${noAssignmentCount}`)

  if (incorrectCount > 0 || noAssignmentCount > 0) {
    console.log("\n⚠️  Action Required:")
    if (incorrectCount > 0) {
      console.log(`   - ${incorrectCount} Field Officer(s) need format correction`)
      console.log("   - Run migration script to fix all at once")
      console.log("   - Or fix individually using the suggested fixes above")
    }
    if (noAssignmentCount > 0) {
      console.log(`   - ${noAssignmentCount} Field Officer(s) have no secretariat assignments`)
      console.log("   - Assign secretariats through Panchayat Secretary UI")
    }
  } else {
    console.log("\n✅ All Field Officers have correct secretariat assignments!")
  }

  console.log()
}

main()
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


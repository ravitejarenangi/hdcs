import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Checking Field Officer Assignment...\n")

  // 1. Check field_officer_1 user
  const user = await prisma.user.findUnique({
    where: { username: "field_officer_1" },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      mandalName: true,
      assignedSecretariats: true,
      isActive: true,
    },
  })

  if (!user) {
    console.log("❌ User 'field_officer_1' not found!")
    return
  }

  console.log("👤 User Information:")
  console.log("   ID:", user.id)
  console.log("   Username:", user.username)
  console.log("   Full Name:", user.fullName)
  console.log("   Role:", user.role)
  console.log("   Mandal Name:", user.mandalName || "(not set)")
  console.log("   Assigned Secretariats:", user.assignedSecretariats || "(not set)")
  console.log("   Active:", user.isActive)
  console.log()

  // 2. Find the mandal for KONGAREDDYPALLI secretariat
  console.log("🔍 Finding mandal for KONGAREDDYPALLI secretariat...")
  const secretariatData = await prisma.resident.findFirst({
    where: {
      secName: "KONGAREDDYPALLI",
    },
    select: {
      mandalName: true,
      secName: true,
    },
  })

  if (secretariatData) {
    console.log("✅ Found secretariat:")
    console.log("   Mandal:", secretariatData.mandalName)
    console.log("   Secretariat:", secretariatData.secName)
    console.log()

    // 3. Check if assignment is correct
    if (user.assignedSecretariats) {
      try {
        const parsed = JSON.parse(user.assignedSecretariats)
        console.log("📋 Current Assignment (parsed):")
        console.log(JSON.stringify(parsed, null, 2))
        console.log()

        // Check if it has the correct format
        const isCorrectFormat = Array.isArray(parsed) && parsed.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            typeof item.mandalName === "string" &&
            typeof item.secName === "string"
        )

        if (isCorrectFormat) {
          console.log("✅ Assignment format is correct!")
          
          // Check if KONGAREDDYPALLI is in the list
          const hasKongareddypalli = parsed.some(
            (item) => item.secName === "KONGAREDDYPALLI"
          )
          
          if (hasKongareddypalli) {
            console.log("✅ KONGAREDDYPALLI is in the assigned secretariats")
          } else {
            console.log("❌ KONGAREDDYPALLI is NOT in the assigned secretariats")
          }
        } else {
          console.log("❌ Assignment format is INCORRECT!")
          console.log("   Expected format: [{ mandalName: string, secName: string }]")
        }
      } catch (error) {
        console.log("❌ Failed to parse assignedSecretariats JSON:")
        console.log("   Error:", error)
      }
    } else {
      console.log("❌ No secretariats assigned!")
    }
    console.log()

    // 4. Generate correct SQL update command
    console.log("🔧 Correct SQL Update Command:")
    console.log("---")
    const correctAssignment = JSON.stringify([
      {
        mandalName: secretariatData.mandalName,
        secName: secretariatData.secName,
      },
    ])
    console.log(`UPDATE users`)
    console.log(`SET assigned_secretariats = '${correctAssignment}'`)
    console.log(`WHERE username = 'field_officer_1';`)
    console.log("---")
    console.log()

    // 5. Generate Prisma update command
    console.log("🔧 Prisma Update Command:")
    console.log("---")
    console.log(`await prisma.user.update({`)
    console.log(`  where: { username: "field_officer_1" },`)
    console.log(`  data: {`)
    console.log(`    assignedSecretariats: JSON.stringify([`)
    console.log(`      {`)
    console.log(`        mandalName: "${secretariatData.mandalName}",`)
    console.log(`        secName: "${secretariatData.secName}",`)
    console.log(`      },`)
    console.log(`    ]),`)
    console.log(`  },`)
    console.log(`})`)
    console.log("---")
  } else {
    console.log("❌ Secretariat 'KONGAREDDYPALLI' not found in residents table!")
    console.log("   Please check the secretariat name spelling.")
  }
}

main()
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


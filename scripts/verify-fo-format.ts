import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function verifyFieldOfficerFormat() {
  console.log("🔍 Verifying Field Officer Secretariat Format\n")
  console.log("=" .repeat(80))

  try {
    // Get sample Field Officers
    const fieldOfficers = await prisma.user.findMany({
      where: {
        role: "FIELD_OFFICER",
        username: {
          startsWith: "fo_",
        },
      },
      take: 10,
      orderBy: {
        username: "asc",
      },
    })

    console.log(`Checking ${fieldOfficers.length} sample Field Officer accounts:\n`)
    console.log("─".repeat(80))

    for (const officer of fieldOfficers) {
      let secretariats: string[] = []
      
      if (officer.assignedSecretariats) {
        try {
          secretariats = JSON.parse(officer.assignedSecretariats)
        } catch {
          secretariats = [officer.assignedSecretariats]
        }
      }

      const format = secretariats.length > 0 && secretariats[0].includes(" -> ") 
        ? "✅ Correct" 
        : "❌ Incorrect"

      console.log(`Username: ${officer.username}`)
      console.log(`Mandal: ${officer.mandalName}`)
      console.log(`Assigned Secretariats: ${JSON.stringify(secretariats)}`)
      console.log(`Format: ${format}`)
      console.log("─".repeat(80))
    }

    // Count total correct vs incorrect
    const allFieldOfficers = await prisma.user.findMany({
      where: {
        role: "FIELD_OFFICER",
      },
      select: {
        assignedSecretariats: true,
      },
    })

    let correct = 0
    let incorrect = 0
    let noSecretariats = 0

    for (const officer of allFieldOfficers) {
      if (!officer.assignedSecretariats) {
        noSecretariats++
        continue
      }

      try {
        const secretariats = JSON.parse(officer.assignedSecretariats)
        if (Array.isArray(secretariats) && secretariats.length > 0) {
          if (typeof secretariats[0] === "string" && secretariats[0].includes(" -> ")) {
            correct++
          } else {
            incorrect++
          }
        } else {
          noSecretariats++
        }
      } catch {
        incorrect++
      }
    }

    console.log("\n" + "=".repeat(80))
    console.log("📊 OVERALL STATISTICS")
    console.log("=" .repeat(80))
    console.log(`Total Field Officers: ${allFieldOfficers.length}`)
    console.log(`✅ Correct Format (MANDAL -> SECRETARIAT): ${correct}`)
    console.log(`❌ Incorrect Format: ${incorrect}`)
    console.log(`⚠️  No Secretariats Assigned: ${noSecretariats}`)
    console.log("=" .repeat(80))

    if (incorrect === 0) {
      console.log("\n🎉 All Field Officers have correct secretariat format!")
    } else {
      console.log(`\n⚠️  ${incorrect} Field Officers still need format correction`)
    }
  } catch (error) {
    console.error("❌ Error:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifyFieldOfficerFormat()


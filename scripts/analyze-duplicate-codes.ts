import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function analyzeDuplicateCodes() {
  console.log("🔍 Detailed Analysis of Duplicate Codes\n")

  try {
    // Analyze Mandal Code Issues
    console.log("=" .repeat(80))
    console.log("📍 MANDAL CODE DUPLICATE ANALYSIS")
    console.log("=" .repeat(80))

    const problematicMandals = ["CHITTOOR", "KUPPAM", "NAGARI", "PALAMANER", "PUNGANUR"]

    for (const mandalName of problematicMandals) {
      console.log(`\n🔍 Analyzing: ${mandalName}`)
      console.log("─".repeat(80))

      const data = await prisma.resident.groupBy({
        by: ["mandalCode"],
        _count: { id: true },
        where: {
          mandalName,
        },
      })

      console.log(`\nMandal Code Distribution:`)
      for (const item of data) {
        console.log(`  Code: ${item.mandalCode || "NULL"} → ${item._count.id.toLocaleString()} residents`)
      }

      // Get sample records for each code
      for (const item of data) {
        const samples = await prisma.resident.findMany({
          where: {
            mandalName,
            mandalCode: item.mandalCode,
          },
          select: {
            residentId: true,
            name: true,
            mandalName: true,
            mandalCode: true,
            secName: true,
            secCode: true,
          },
          take: 3,
        })

        console.log(`\n  Sample records with code "${item.mandalCode}":`)
        for (const sample of samples) {
          console.log(`    - ${sample.residentId}: ${sample.name} (Sec: ${sample.secName})`)
        }
      }
    }

    // Analyze Secretariat Code Issues
    console.log("\n\n" + "=".repeat(80))
    console.log("🏢 SECRETARIAT CODE DUPLICATE ANALYSIS")
    console.log("=" .repeat(80))

    const problematicSecs = [
      "AGARAM",
      "GADDAMVARIPALLE",
      "KOTHAPALLI",
      "KOTHAPETA",
      "MUTHUKUR",
      "PULLUR",
    ]

    for (const secName of problematicSecs) {
      console.log(`\n🔍 Analyzing: ${secName}`)
      console.log("─".repeat(80))

      const data = await prisma.resident.groupBy({
        by: ["secCode", "mandalName"],
        _count: { id: true },
        where: {
          secName,
        },
      })

      console.log(`\nSecretariat Code Distribution:`)
      for (const item of data) {
        console.log(
          `  Code: ${item.secCode || "NULL"} (Mandal: ${item.mandalName}) → ${item._count.id.toLocaleString()} residents`
        )
      }

      // Get sample records for each code
      for (const item of data) {
        const samples = await prisma.resident.findMany({
          where: {
            secName,
            secCode: item.secCode,
            mandalName: item.mandalName,
          },
          select: {
            residentId: true,
            name: true,
            mandalName: true,
            mandalCode: true,
            secName: true,
            secCode: true,
          },
          take: 3,
        })

        console.log(`\n  Sample records with code "${item.secCode}" in ${item.mandalName}:`)
        for (const sample of samples) {
          console.log(
            `    - ${sample.residentId}: ${sample.name} (Mandal Code: ${sample.mandalCode})`
          )
        }
      }
    }

    // Recommendations
    console.log("\n\n" + "=".repeat(80))
    console.log("💡 RECOMMENDATIONS")
    console.log("=" .repeat(80))

    console.log(`
📌 MANDAL CODE ISSUES:

The following mandals have multiple codes in the database:
  • CHITTOOR: 1008.0, 5421.0
  • KUPPAM: 1180.0, 5427.0
  • NAGARI: 1118.0, 5406.0
  • PALAMANER: 1117.0, 5422.0
  • PUNGANUR: 1010.0, 5415.0

Possible Reasons:
  1. Data imported from different sources with different coding systems
  2. Urban vs Rural areas within same mandal having different codes
  3. Administrative changes over time
  4. Data entry errors

Recommended Actions:
  ✅ Verify which code is the official/correct one for each mandal
  ✅ Standardize all records to use the correct code
  ✅ Update import process to validate codes against master list

📌 SECRETARIAT CODE ISSUES:

The following secretariats have multiple codes:
  • AGARAM: 11090285.0, 11090353.0
  • GADDAMVARIPALLE: 11090032.0, 11090765.0
  • KOTHAPALLI: 11090335.0, 11090681.0
  • KOTHAPETA: 21010016.0, 21117007.0
  • MUTHUKUR: 11090466.0, 11090572.0
  • PULLUR: 11090611.0, 11090686.0

Possible Reasons:
  1. Same secretariat name exists in different mandals
  2. Secretariat boundary/code changes
  3. Data from different time periods
  4. Data entry inconsistencies

Recommended Actions:
  ✅ Check if these are actually different secretariats in different mandals
  ✅ If same secretariat, standardize to one code
  ✅ If different secretariats, consider adding mandal prefix to name
  ✅ Create master secretariat list with unique codes

🔧 NEXT STEPS:

1. Review the sample records above to understand the pattern
2. Consult with district administration for official codes
3. Create a data cleanup script to standardize codes
4. Add validation in import process to prevent future duplicates
5. Consider adding unique constraints if codes should be truly unique
`)
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

analyzeDuplicateCodes()


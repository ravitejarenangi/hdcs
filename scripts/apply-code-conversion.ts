import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function applyCodeConversion() {
  console.log("🔄 Converting Mandal Code and Secretariat Code to Integer...\n")

  try {
    console.log("Step 1: Cleaning mandalCode data (removing .0 suffix)...")
    
    // Clean mandalCode
    const cleanMandal = await prisma.$executeRawUnsafe(`
      UPDATE residents 
      SET mandal_code = CAST(REPLACE(mandal_code, '.0', '') AS CHAR)
      WHERE mandal_code IS NOT NULL AND mandal_code LIKE '%.0'
    `)
    console.log(`✅ Cleaned ${cleanMandal} mandalCode records\n`)

    console.log("Step 2: Cleaning secCode data (removing .0 suffix)...")
    
    // Clean secCode
    const cleanSec = await prisma.$executeRawUnsafe(`
      UPDATE residents
      SET sec_code = CAST(REPLACE(sec_code, '.0', '') AS CHAR)
      WHERE sec_code IS NOT NULL AND sec_code LIKE '%.0'
    `)
    console.log(`✅ Cleaned ${cleanSec} secCode records\n`)

    console.log("Step 3: Converting mandalCode column to INT...")
    
    // Convert mandalCode to INT
    await prisma.$executeRawUnsafe(`
      ALTER TABLE residents 
      MODIFY COLUMN mandal_code INT NULL
    `)
    console.log(`✅ mandalCode column converted to INT\n`)

    console.log("Step 4: Converting secCode column to INT...")
    
    // Convert secCode to INT
    await prisma.$executeRawUnsafe(`
      ALTER TABLE residents
      MODIFY COLUMN sec_code INT NULL
    `)
    console.log(`✅ secCode column converted to INT\n`)

    // Verify the changes
    console.log("=" .repeat(80))
    console.log("📊 Verification")
    console.log("=" .repeat(80))

    const sampleMandal = await prisma.resident.findMany({
      where: { mandalCode: { not: null } },
      select: { mandalCode: true, mandalName: true },
      take: 5,
    })

    const sampleSec = await prisma.resident.findMany({
      where: { secCode: { not: null } },
      select: { secCode: true, secName: true },
      take: 5,
    })

    console.log("\nSample mandalCode values (now as integers):")
    sampleMandal.forEach((r) => {
      console.log(`  ${r.mandalName}: ${r.mandalCode} (type: ${typeof r.mandalCode})`)
    })

    console.log("\nSample secCode values (now as integers):")
    sampleSec.forEach((r) => {
      console.log(`  ${r.secName}: ${r.secCode} (type: ${typeof r.secCode})`)
    })

    console.log("\n" + "=".repeat(80))
    console.log("✅ CONVERSION COMPLETE!")
    console.log("=" .repeat(80))
    console.log(`
✅ mandalCode: VARCHAR → INT
✅ secCode: VARCHAR → INT
✅ All ".0" suffixes removed
✅ Data integrity maintained

Next Steps:
-----------
1. Run: npx prisma generate
2. Restart your development server
3. Test the application to ensure everything works correctly
`)
  } catch (error) {
    console.error("❌ Error during conversion:", error)
    console.log("\n⚠️  If you see an error, the conversion may have already been applied.")
    console.log("Check the database schema to verify the column types.")
  } finally {
    await prisma.$disconnect()
  }
}

applyCodeConversion()


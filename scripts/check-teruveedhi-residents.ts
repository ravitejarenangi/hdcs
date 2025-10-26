import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkResidents() {
  try {
    // Count residents in TERUVEEDHI-03
    const teruveedhiCount = await prisma.resident.count({
      where: {
        mandalName: "PUNGANUR",
        secName: "TERUVEEDHI-03",
      },
    })

    console.log(`Residents in TERUVEEDHI-03: ${teruveedhiCount}`)

    // Count all residents in PUNGANUR
    const punganurCount = await prisma.resident.count({
      where: {
        mandalName: "PUNGANUR",
      },
    })

    console.log(`Total residents in PUNGANUR mandal: ${punganurCount}`)

    // Get unique secretariats in PUNGANUR
    const secretariats = await prisma.resident.groupBy({
      by: ["secName"],
      where: {
        mandalName: "PUNGANUR",
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    })

    console.log(`\nUnique secretariats in PUNGANUR: ${secretariats.length}`)
    console.log("\nTop 10 secretariats by resident count:")
    secretariats.slice(0, 10).forEach((sec, index) => {
      console.log(`${index + 1}. ${sec.secName}: ${sec._count.id} residents`)
    })

    // Check if TERUVEEDHI-03 is in the list
    const teruveedhiSec = secretariats.find((s) => s.secName === "TERUVEEDHI-03")
    if (teruveedhiSec) {
      console.log(`\nTERUVEEDHI-03 found with ${teruveedhiSec._count.id} residents`)
    } else {
      console.log("\nTERUVEEDHI-03 NOT FOUND in secretariats list!")
    }
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkResidents()


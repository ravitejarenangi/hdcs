import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkUUID() {
  const uuid = "60f0063c-b4ad-4783-9cc8-bb63fdd67429"

  try {
    console.log(`Checking UUID: ${uuid}\n`)

    // Check if it's a user ID
    const user = await prisma.user.findUnique({
      where: { id: uuid },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        mandalName: true,
        assignedSecretariats: true,
      },
    })

    if (user) {
      console.log("Found User:")
      console.log(`  ID: ${user.id}`)
      console.log(`  Username: ${user.username}`)
      console.log(`  Full Name: ${user.fullName}`)
      console.log(`  Role: ${user.role}`)
      console.log(`  Mandal: ${user.mandalName}`)
      console.log(`  Assigned Secretariats: ${user.assignedSecretariats}`)

      if (user.assignedSecretariats) {
        try {
          const parsed = JSON.parse(user.assignedSecretariats)
          console.log("\n  Parsed Secretariats:")
          console.log(JSON.stringify(parsed, null, 4))
        } catch (e) {
          console.log("  Failed to parse assignedSecretariats")
        }
      }
      return
    }

    // Check if it's a resident ID
    const resident = await prisma.resident.findUnique({
      where: { id: uuid },
      select: {
        id: true,
        residentId: true,
        name: true,
        mandalName: true,
        secName: true,
        phcName: true,
      },
    })

    if (resident) {
      console.log("Found Resident:")
      console.log(`  ID: ${resident.id}`)
      console.log(`  Resident ID: ${resident.residentId}`)
      console.log(`  Name: ${resident.name}`)
      console.log(`  Mandal: ${resident.mandalName}`)
      console.log(`  Secretariat: ${resident.secName}`)
      console.log(`  PHC: ${resident.phcName}`)
      return
    }

    console.log("UUID not found in users or residents tables")
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUUID()


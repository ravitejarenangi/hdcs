import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkFieldOfficer() {
  try {
    // Find field officer for TERUVEEDHI-03
    const officers = await prisma.user.findMany({
      where: {
        role: "FIELD_OFFICER",
        fullName: {
          contains: "TERUVEEDHI-03",
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        mandalName: true,
        assignedSecretariats: true,
      },
    })

    console.log(`Found ${officers.length} field officers for TERUVEEDHI-03:\n`)

    for (const officer of officers) {
      console.log("─".repeat(80))
      console.log(`ID: ${officer.id}`)
      console.log(`Username: ${officer.username}`)
      console.log(`Full Name: ${officer.fullName}`)
      console.log(`Mandal: ${officer.mandalName}`)
      console.log(`Assigned Secretariats (raw): ${officer.assignedSecretariats}`)
      
      if (officer.assignedSecretariats) {
        try {
          const parsed = JSON.parse(officer.assignedSecretariats)
          console.log(`Parsed: ${JSON.stringify(parsed, null, 2)}`)
          console.log(`Type: ${typeof parsed[0]}`)
          if (typeof parsed[0] === 'object') {
            console.log(`Format: Object format {mandalName, secName}`)
          } else if (typeof parsed[0] === 'string') {
            console.log(`Format: String format "MANDAL -> SECRETARIAT"`)
          }
        } catch (error) {
          console.log(`Parse error: ${error}`)
        }
      }
      console.log("─".repeat(80))
      console.log()
    }
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFieldOfficer()


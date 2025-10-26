import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function testExportFilter() {
  try {
    // Simulate the exact filter scenario from the user's report
    const officerIds = ["cmgo5g4f700bn2g8ha7kybipx"] // FO TERUVEEDHI-03
    const mandalsParam = "PUNGANUR"

    console.log("=".repeat(80))
    console.log("TESTING EXPORT FILTER LOGIC")
    console.log("=".repeat(80))
    console.log(`Officer IDs: ${officerIds.join(", ")}`)
    console.log(`Mandals: ${mandalsParam}`)
    console.log()

    // Build where clause (simulating the export route logic)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {}

    // Mandal filter
    if (mandalsParam) {
      const mandals = mandalsParam.split(",").filter((m) => m.trim())
      if (mandals.length > 0) {
        whereClause.mandalName = { in: mandals }
      }
    }

    console.log("Initial whereClause:")
    console.log(JSON.stringify(whereClause, null, 2))
    console.log()

    // Field Officer filter
    if (officerIds.length > 0) {
      // Fetch the selected field officers and their assigned secretariats
      const officers = await prisma.user.findMany({
        where: {
          id: { in: officerIds },
          role: "FIELD_OFFICER",
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          assignedSecretariats: true,
        },
      })

      console.log(`Fetched ${officers.length} field officers:`)
      officers.forEach((officer) => {
        console.log(`  - ${officer.fullName} (${officer.username})`)
        console.log(`    ID: ${officer.id}`)
        console.log(`    Assigned Secretariats: ${officer.assignedSecretariats}`)
      })
      console.log()

      // Parse and collect all secretariat assignments
      interface SecretariatAssignment {
        mandalName: string
        secName: string
      }

      const allSecretariats: SecretariatAssignment[] = []

      for (const officer of officers) {
        if (officer.assignedSecretariats) {
          try {
            const parsed = JSON.parse(officer.assignedSecretariats)
            console.log(`Parsed assignedSecretariats for ${officer.fullName}:`)
            console.log(JSON.stringify(parsed, null, 2))

            if (Array.isArray(parsed)) {
              // Filter valid secretariat objects
              const validSecretariats = parsed.filter(
                (item): item is SecretariatAssignment =>
                  typeof item === "object" &&
                  item !== null &&
                  typeof item.mandalName === "string" &&
                  typeof item.secName === "string"
              )
              console.log(`Valid secretariats: ${validSecretariats.length}`)
              allSecretariats.push(...validSecretariats)
            }
          } catch (error) {
            console.error("Failed to parse assignedSecretariats:", error)
          }
        }
      }

      console.log()
      console.log(`Total secretariats collected: ${allSecretariats.length}`)
      console.log("All secretariats:")
      console.log(JSON.stringify(allSecretariats, null, 2))
      console.log()

      // Build OR clause for secretariat filtering
      if (allSecretariats.length > 0) {
        // If mandal filter is already applied, filter secretariats to match
        if (whereClause.mandalName) {
          const selectedMandals = Array.isArray(whereClause.mandalName.in)
            ? whereClause.mandalName.in
            : [whereClause.mandalName]

          console.log(`Mandal filter exists: ${selectedMandals.join(", ")}`)

          const filteredSecretariats = allSecretariats.filter((sec) =>
            selectedMandals.includes(sec.mandalName)
          )

          console.log(`Filtered secretariats: ${filteredSecretariats.length}`)
          console.log(JSON.stringify(filteredSecretariats, null, 2))
          console.log()

          if (filteredSecretariats.length > 0) {
            // Remove mandal filter and replace with specific secretariat combinations
            delete whereClause.mandalName

            // Use AND with OR to combine secretariat filter with other filters
            const secretariatOrConditions = filteredSecretariats.map((sec) => ({
              AND: [{ mandalName: sec.mandalName }, { secName: sec.secName }],
            }))

            // If there are other filters, wrap everything in AND
            const otherFilters = { ...whereClause }
            whereClause.AND = [
              ...Object.keys(otherFilters).map((key) => ({ [key]: otherFilters[key] })),
              { OR: secretariatOrConditions },
            ]

            // Remove the individual filter keys since they're now in AND
            Object.keys(otherFilters).forEach((key) => {
              if (key !== "AND") {
                delete whereClause[key]
              }
            })
          }
        }
      }
    }

    console.log("Final whereClause:")
    console.log(JSON.stringify(whereClause, null, 2))
    console.log()

    // Execute the query
    console.log("Executing query...")
    const residents = await prisma.resident.findMany({
      where: whereClause,
      select: {
        id: true,
        mandalName: true,
        secName: true,
      },
      take: 10, // Just get first 10 for testing
    })

    console.log(`Query returned ${residents.length} residents (showing first 10)`)
    residents.forEach((r, index) => {
      console.log(`${index + 1}. ${r.mandalName} -> ${r.secName}`)
    })
    console.log()

    // Get total count
    const totalCount = await prisma.resident.count({
      where: whereClause,
    })

    console.log("=".repeat(80))
    console.log(`TOTAL RESIDENTS MATCHING FILTER: ${totalCount}`)
    console.log("=".repeat(80))
    console.log()
    console.log("Expected: ~3,343 (TERUVEEDHI-03 only)")
    console.log("If showing 121,338: Bug still exists (entire PUNGANUR mandal)")
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testExportFilter()


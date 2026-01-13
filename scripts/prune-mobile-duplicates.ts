
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function pruneDuplicates() {
    console.log('🔍 Starting Mobile Duplicate Pruning (Max 5 per number)...')

    try {
        // 1. Find mobile numbers with > 5 occurrences
        // We use a raw query for performance and flexibility with GROUP BY/HAVING
        const duplicates = await prisma.$queryRaw<Array<{ citizenMobile: string; count: bigint }>>`
      SELECT citizen_mobile as citizenMobile, COUNT(*) as count
      FROM residents
      WHERE citizen_mobile IS NOT NULL 
        AND citizen_mobile != '' 
        AND citizen_mobile != '0' 
        AND citizen_mobile != 'N/A'
      GROUP BY citizen_mobile
      HAVING COUNT(*) > 5
    `

        console.log(`Found ${duplicates.length} mobile numbers exceeding the limit of 5.`)

        if (duplicates.length === 0) {
            console.log('✅ No duplicates found.')
            return
        }

        let totalPruned = 0

        // 2. Process each duplicate mobile number
        for (const dup of duplicates) {
            const mobile = dup.citizenMobile
            const count = Number(dup.count)

            // Fetch residents with this mobile, sorted by importance (e.g., recently updated or created)
            // We keep the most recently updated ones as they are likely the valid ones.
            const residents = await prisma.resident.findMany({
                where: { citizenMobile: mobile },
                orderBy: { updatedAt: 'desc' },
                select: { id: true, name: true, residentId: true },
                // We need to fetch all of them to determine which to keep/prune
            })

            // Constraint: Keep max 5
            const toKeep = residents.slice(0, 5)
            const toPrune = residents.slice(5)

            if (toPrune.length === 0) continue

            console.log(`Processing ${mobile} (Count: ${count}): Keeping 5, Pruning ${toPrune.length}`)

            const idsToPrune = toPrune.map(r => r.id)

            // 3. Update the pruned residents
            await prisma.resident.updateMany({
                where: { id: { in: idsToPrune } },
                data: { citizenMobile: null } // Setting to NULL as per clean database practice (user accepted null/0)
            })

            totalPruned += toPrune.length
        }

        console.log(`\n✅ Pruning Complete.`)
        console.log(`Total residents updated (mobile set to NULL): ${totalPruned}`)

    } catch (error) {
        console.error('❌ Error during pruning:', error)
    } finally {
        await prisma.$disconnect()
    }
}

pruneDuplicates()

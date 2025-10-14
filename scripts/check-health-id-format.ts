import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkHealthIdFormat() {
  try {
    console.log('Checking Health ID storage format in database...\n')
    
    // Query sample Health IDs
    const residents = await prisma.resident.findMany({
      where: {
        healthId: {
          not: null,
        },
      },
      select: {
        residentId: true,
        name: true,
        healthId: true,
      },
      take: 10,
    })

    if (residents.length === 0) {
      console.log('❌ No Health IDs found in database')
      return
    }

    console.log(`✅ Found ${residents.length} Health ID records:\n`)
    
    let withDashes = 0
    let withoutDashes = 0
    
    residents.forEach((resident, index) => {
      const healthId = resident.healthId || ''
      const hasDashes = healthId.includes('-')
      
      if (hasDashes) {
        withDashes++
      } else {
        withoutDashes++
      }
      
      console.log(`${index + 1}. ${resident.name}`)
      console.log(`   Resident ID: ${resident.residentId}`)
      console.log(`   Health ID: ${healthId}`)
      console.log(`   Format: ${hasDashes ? 'WITH dashes' : 'WITHOUT dashes'}`)
      console.log(`   Length: ${healthId.length} characters`)
      console.log('')
    })

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('SUMMARY:')
    console.log(`  WITH dashes: ${withDashes}`)
    console.log(`  WITHOUT dashes: ${withoutDashes}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (withDashes > 0 && withoutDashes === 0) {
      console.log('✅ RESULT: All Health IDs are stored WITH dashes')
      console.log('📝 ACTION REQUIRED: Remove removeHealthIdFormatting() transformation')
      console.log('   Health IDs should be saved WITH dashes to match existing data\n')
    } else if (withoutDashes > 0 && withDashes === 0) {
      console.log('✅ RESULT: All Health IDs are stored WITHOUT dashes')
      console.log('✅ CURRENT IMPLEMENTATION IS CORRECT')
      console.log('   Health IDs are being stripped of dashes before saving\n')
    } else if (withDashes > 0 && withoutDashes > 0) {
      console.log('⚠️  RESULT: Mixed format detected!')
      console.log(`   ${withDashes} records WITH dashes`)
      console.log(`   ${withoutDashes} records WITHOUT dashes`)
      console.log('📝 ACTION REQUIRED: Decide on standard format and migrate data\n')
    }

  } catch (error) {
    console.error('Error checking Health ID format:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkHealthIdFormat()


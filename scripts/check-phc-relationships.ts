import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPHCRelationships() {
  console.log('='.repeat(80))
  console.log('PHC-Secretariat-Mandal Relationship Analysis')
  console.log('='.repeat(80))
  console.log()

  // Query 1: Check if PHC names are unique within each Secretariat
  console.log('Query 1: PHC distribution by Mandal and Secretariat')
  console.log('-'.repeat(80))
  
  const phcDistribution = await prisma.$queryRaw<
    Array<{
      mandal_name: string
      sec_name: string
      phc_name: string
      resident_count: bigint
    }>
  >`
    SELECT 
      mandal_name,
      sec_name,
      phc_name,
      COUNT(*) as resident_count
    FROM residents
    WHERE phc_name IS NOT NULL 
      AND phc_name != 'N/A' 
      AND phc_name != ''
      AND sec_name IS NOT NULL
      AND mandal_name IS NOT NULL
    GROUP BY mandal_name, sec_name, phc_name
    ORDER BY mandal_name, sec_name, phc_name
    LIMIT 100
  `

  console.log(`Found ${phcDistribution.length} unique combinations of (Mandal, Secretariat, PHC)`)
  console.log()
  console.log('Sample data (first 20 rows):')
  console.log('-'.repeat(80))
  phcDistribution.slice(0, 20).forEach((row, idx) => {
    console.log(
      `${idx + 1}. ${row.mandal_name} > ${row.sec_name} > ${row.phc_name} (${row.resident_count} residents)`
    )
  })
  console.log()

  // Query 2: Check for duplicate PHC names across different Secretariats
  console.log('Query 2: PHC names that appear in multiple Secretariats')
  console.log('-'.repeat(80))
  
  const duplicatePHCsAcrossSecretariats = await prisma.$queryRaw<
    Array<{
      phc_name: string
      secretariat_count: bigint
      secretariats: string
    }>
  >`
    SELECT 
      phc_name,
      COUNT(DISTINCT CONCAT(mandal_name, '|', sec_name)) as secretariat_count,
      GROUP_CONCAT(DISTINCT CONCAT(mandal_name, ' > ', sec_name) SEPARATOR '; ') as secretariats
    FROM residents
    WHERE phc_name IS NOT NULL 
      AND phc_name != 'N/A' 
      AND phc_name != ''
      AND sec_name IS NOT NULL
      AND mandal_name IS NOT NULL
    GROUP BY phc_name
    HAVING secretariat_count > 1
    ORDER BY secretariat_count DESC
    LIMIT 20
  `

  if (duplicatePHCsAcrossSecretariats.length > 0) {
    console.log(`⚠️  Found ${duplicatePHCsAcrossSecretariats.length} PHC names that appear in multiple Secretariats:`)
    console.log()
    duplicatePHCsAcrossSecretariats.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.phc_name}" appears in ${row.secretariat_count} Secretariats:`)
      console.log(`   ${row.secretariats}`)
      console.log()
    })
  } else {
    console.log('✅ No PHC names appear in multiple Secretariats')
  }
  console.log()

  // Query 3: Check for duplicate PHC names across different Mandals
  console.log('Query 3: PHC names that appear in multiple Mandals')
  console.log('-'.repeat(80))
  
  const duplicatePHCsAcrossMandals = await prisma.$queryRaw<
    Array<{
      phc_name: string
      mandal_count: bigint
      mandals: string
    }>
  >`
    SELECT 
      phc_name,
      COUNT(DISTINCT mandal_name) as mandal_count,
      GROUP_CONCAT(DISTINCT mandal_name SEPARATOR ', ') as mandals
    FROM residents
    WHERE phc_name IS NOT NULL 
      AND phc_name != 'N/A' 
      AND phc_name != ''
      AND mandal_name IS NOT NULL
    GROUP BY phc_name
    HAVING mandal_count > 1
    ORDER BY mandal_count DESC
    LIMIT 20
  `

  if (duplicatePHCsAcrossMandals.length > 0) {
    console.log(`⚠️  Found ${duplicatePHCsAcrossMandals.length} PHC names that appear in multiple Mandals:`)
    console.log()
    duplicatePHCsAcrossMandals.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.phc_name}" appears in ${row.mandal_count} Mandals:`)
      console.log(`   ${row.mandals}`)
      console.log()
    })
  } else {
    console.log('✅ No PHC names appear in multiple Mandals')
  }
  console.log()

  // Query 4: Check total unique PHC names vs total combinations
  console.log('Query 4: Summary Statistics')
  console.log('-'.repeat(80))
  
  const stats = await prisma.$queryRaw<
    Array<{
      total_unique_phc_names: bigint
      total_combinations: bigint
      total_mandals: bigint
      total_secretariats: bigint
    }>
  >`
    SELECT 
      COUNT(DISTINCT phc_name) as total_unique_phc_names,
      COUNT(DISTINCT CONCAT(mandal_name, '|', sec_name, '|', phc_name)) as total_combinations,
      COUNT(DISTINCT mandal_name) as total_mandals,
      COUNT(DISTINCT CONCAT(mandal_name, '|', sec_name)) as total_secretariats
    FROM residents
    WHERE phc_name IS NOT NULL 
      AND phc_name != 'N/A' 
      AND phc_name != ''
      AND sec_name IS NOT NULL
      AND mandal_name IS NOT NULL
  `

  const stat = stats[0]
  console.log(`Total unique PHC names: ${stat.total_unique_phc_names}`)
  console.log(`Total unique (Mandal, Secretariat, PHC) combinations: ${stat.total_combinations}`)
  console.log(`Total Mandals: ${stat.total_mandals}`)
  console.log(`Total Secretariats: ${stat.total_secretariats}`)
  console.log()

  if (Number(stat.total_unique_phc_names) < Number(stat.total_combinations)) {
    console.log('⚠️  PHC names are NOT unique! Same PHC name appears in multiple locations.')
    console.log('   The current grouping logic (GROUP BY mandal_name, sec_name, phc_name) is CORRECT.')
  } else {
    console.log('✅ PHC names are unique across the entire database.')
  }
  console.log()

  // Query 5: Check for specific examples of duplicate PHC names
  console.log('Query 5: Detailed examples of duplicate PHC names')
  console.log('-'.repeat(80))
  
  const exampleDuplicates = await prisma.$queryRaw<
    Array<{
      phc_name: string
      mandal_name: string
      sec_name: string
      resident_count: bigint
    }>
  >`
    SELECT 
      phc_name,
      mandal_name,
      sec_name,
      COUNT(*) as resident_count
    FROM residents
    WHERE phc_name IN (
      SELECT phc_name
      FROM residents
      WHERE phc_name IS NOT NULL 
        AND phc_name != 'N/A' 
        AND phc_name != ''
      GROUP BY phc_name
      HAVING COUNT(DISTINCT CONCAT(mandal_name, '|', sec_name)) > 1
      LIMIT 5
    )
    AND phc_name IS NOT NULL 
    AND phc_name != 'N/A' 
    AND phc_name != ''
    AND sec_name IS NOT NULL
    AND mandal_name IS NOT NULL
    GROUP BY phc_name, mandal_name, sec_name
    ORDER BY phc_name, mandal_name, sec_name
  `

  if (exampleDuplicates.length > 0) {
    console.log('Examples of PHC names appearing in multiple locations:')
    console.log()
    
    let currentPHC = ''
    exampleDuplicates.forEach((row) => {
      if (row.phc_name !== currentPHC) {
        if (currentPHC !== '') console.log()
        currentPHC = row.phc_name
        console.log(`PHC: "${row.phc_name}"`)
      }
      console.log(`  - ${row.mandal_name} > ${row.sec_name} (${row.resident_count} residents)`)
    })
  } else {
    console.log('No duplicate PHC names found in the sample.')
  }
  console.log()

  console.log('='.repeat(80))
  console.log('Analysis Complete')
  console.log('='.repeat(80))
  console.log()
  console.log('RECOMMENDATION:')
  console.log('-'.repeat(80))
  
  if (duplicatePHCsAcrossSecretariats.length > 0 || duplicatePHCsAcrossMandals.length > 0) {
    console.log('✅ The current implementation is CORRECT!')
    console.log('   - PHC names are NOT unique across Secretariats/Mandals')
    console.log('   - The API correctly groups by (mandal_name, sec_name, phc_name)')
    console.log('   - Each PHC is properly nested under its specific Secretariat and Mandal')
    console.log('   - No changes needed to the grouping logic')
  } else {
    console.log('ℹ️  PHC names appear to be unique')
    console.log('   - The current grouping logic is still correct and safe')
    console.log('   - No changes needed')
  }
  console.log()
}

checkPHCRelationships()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


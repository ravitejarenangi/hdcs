/**
 * Database Performance Analysis Script
 * 
 * This script analyzes the current database performance and identifies
 * optimization opportunities for the Chittoor Health System.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface QueryPerformance {
  queryName: string
  executionTime: number
  recordsAffected: number
}

async function measureQueryTime<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<{ result: T; performance: QueryPerformance }> {
  const startTime = performance.now()
  const result = await queryFn()
  const endTime = performance.now()
  const executionTime = endTime - startTime

  const recordsAffected = Array.isArray(result) ? result.length : typeof result === 'number' ? result : 1

  return {
    result,
    performance: {
      queryName,
      executionTime,
      recordsAffected,
    },
  }
}

async function analyzeDatabase() {
  console.log('🔍 Database Performance Analysis\n')
  console.log('='.repeat(80))

  const performances: QueryPerformance[] = []

  try {
    // 1. Analyze table sizes
    console.log('\n📊 Table Sizes:')
    console.log('-'.repeat(80))

    const { result: residentCount, performance: p1 } = await measureQueryTime(
      'Count all residents',
      () => prisma.resident.count()
    )
    performances.push(p1)
    console.log(`   Residents: ${residentCount.toLocaleString()} records (${p1.executionTime.toFixed(2)}ms)`)

    const { result: userCount, performance: p2 } = await measureQueryTime(
      'Count all users',
      () => prisma.user.count()
    )
    performances.push(p2)
    console.log(`   Users: ${userCount.toLocaleString()} records (${p2.executionTime.toFixed(2)}ms)`)

    const { result: updateLogCount, performance: p3 } = await measureQueryTime(
      'Count all update logs',
      () => prisma.updateLog.count()
    )
    performances.push(p3)
    console.log(`   Update Logs: ${updateLogCount.toLocaleString()} records (${p3.executionTime.toFixed(2)}ms)`)

    // 2. Test common query patterns
    console.log('\n🔍 Common Query Patterns:')
    console.log('-'.repeat(80))

    // Query 1: Filter by mandalName (very common)
    const { result: mandalResidents, performance: p4 } = await measureQueryTime(
      'Filter by mandalName (CHITTOOR)',
      () => prisma.resident.count({ where: { mandalName: 'CHITTOOR' } })
    )
    performances.push(p4)
    console.log(`   ✓ Filter by mandalName: ${mandalResidents.toLocaleString()} records (${p4.executionTime.toFixed(2)}ms)`)

    // Query 2: Filter by mandalName + secName (very common)
    const { result: secResidents, performance: p5 } = await measureQueryTime(
      'Filter by mandalName + secName',
      () => prisma.resident.count({ 
        where: { 
          mandalName: 'CHITTOOR',
          secName: 'LALUGARDEN-01'
        } 
      })
    )
    performances.push(p5)
    console.log(`   ✓ Filter by mandal + secretariat: ${secResidents.toLocaleString()} records (${p5.executionTime.toFixed(2)}ms)`)

    // Query 3: Filter by phcName (common)
    const { result: phcResidents, performance: p6 } = await measureQueryTime(
      'Filter by phcName',
      () => prisma.resident.count({ where: { phcName: 'G.D.Nellore' } })
    )
    performances.push(p6)
    console.log(`   ✓ Filter by PHC: ${phcResidents.toLocaleString()} records (${p6.executionTime.toFixed(2)}ms)`)

    // Query 4: Filter by mobileNumber (search queries)
    const { result: mobileSearch, performance: p7 } = await measureQueryTime(
      'Search by mobileNumber',
      () => prisma.resident.findMany({ 
        where: { mobileNumber: '9876543210' },
        take: 10
      })
    )
    performances.push(p7)
    console.log(`   ✓ Search by mobile: ${mobileSearch.length} records (${p7.executionTime.toFixed(2)}ms)`)

    // Query 5: Filter by healthId (search queries)
    const { result: healthIdSearch, performance: p8 } = await measureQueryTime(
      'Search by healthId',
      () => prisma.resident.findMany({ 
        where: { healthId: { contains: '12345' } },
        take: 10
      })
    )
    performances.push(p8)
    console.log(`   ✓ Search by health ID: ${healthIdSearch.length} records (${p8.executionTime.toFixed(2)}ms)`)

    // Query 6: GroupBy mandalName (dashboard analytics)
    const { result: mandalGroups, performance: p9 } = await measureQueryTime(
      'GroupBy mandalName',
      () => prisma.resident.groupBy({
        by: ['mandalName'],
        _count: { id: true },
        where: { mandalName: { not: null } }
      })
    )
    performances.push(p9)
    console.log(`   ✓ Group by mandal: ${mandalGroups.length} groups (${p9.executionTime.toFixed(2)}ms)`)

    // Query 7: GroupBy secName (dashboard analytics)
    const { result: secGroups, performance: p10 } = await measureQueryTime(
      'GroupBy secName for mandal',
      () => prisma.resident.groupBy({
        by: ['secName'],
        _count: { id: true },
        where: { 
          mandalName: 'CHITTOOR',
          secName: { not: null }
        }
      })
    )
    performances.push(p10)
    console.log(`   ✓ Group by secretariat: ${secGroups.length} groups (${p10.executionTime.toFixed(2)}ms)`)

    // Query 8: Complex filter (mobile completion rate)
    const { result: mobileComplete, performance: p11 } = await measureQueryTime(
      'Complex filter - mobile completion',
      () => prisma.resident.count({
        where: {
          mandalName: 'CHITTOOR',
          AND: [
            { mobileNumber: { not: null } },
            { mobileNumber: { not: 'N/A' } },
            { mobileNumber: { not: '0' } },
            { mobileNumber: { not: '' } },
          ]
        }
      })
    )
    performances.push(p11)
    console.log(`   ✓ Mobile completion filter: ${mobileComplete.toLocaleString()} records (${p11.executionTime.toFixed(2)}ms)`)

    // Query 9: Name search with LIKE (startsWith)
    const { result: nameSearch, performance: p12 } = await measureQueryTime(
      'Name search with startsWith',
      () => prisma.resident.findMany({
        where: { 
          name: { startsWith: 'UNKNOWN_NAME_' }
        },
        take: 100
      })
    )
    performances.push(p12)
    console.log(`   ✓ Name search (startsWith): ${nameSearch.length} records (${p12.executionTime.toFixed(2)}ms)`)

    // Query 10: User authentication query
    const { result: userAuth, performance: p13 } = await measureQueryTime(
      'User authentication by username',
      () => prisma.user.findUnique({ where: { username: 'admin' } })
    )
    performances.push(p13)
    console.log(`   ✓ User auth lookup: ${userAuth ? '1' : '0'} record (${p13.executionTime.toFixed(2)}ms)`)

    // Query 11: User filter by role
    const { result: roleUsers, performance: p14 } = await measureQueryTime(
      'Filter users by role',
      () => prisma.user.findMany({ where: { role: 'FIELD_OFFICER' } })
    )
    performances.push(p14)
    console.log(`   ✓ Filter by role: ${roleUsers.length} records (${p14.executionTime.toFixed(2)}ms)`)

    // 3. Performance Summary
    console.log('\n📈 Performance Summary:')
    console.log('-'.repeat(80))

    const avgTime = performances.reduce((sum, p) => sum + p.executionTime, 0) / performances.length
    const slowQueries = performances.filter(p => p.executionTime > 100)
    const fastQueries = performances.filter(p => p.executionTime < 50)

    console.log(`   Average query time: ${avgTime.toFixed(2)}ms`)
    console.log(`   Fast queries (<50ms): ${fastQueries.length}/${performances.length}`)
    console.log(`   Slow queries (>100ms): ${slowQueries.length}/${performances.length}`)

    if (slowQueries.length > 0) {
      console.log(`\n⚠️  Slow Queries Detected:`)
      slowQueries.forEach(q => {
        console.log(`      - ${q.queryName}: ${q.executionTime.toFixed(2)}ms`)
      })
    }

    // 4. Index Analysis
    console.log('\n📋 Current Indexes (from schema):')
    console.log('-'.repeat(80))
    console.log('   Resident table:')
    console.log('      ✓ uid (index)')
    console.log('      ✓ hhId (index)')
    console.log('      ✓ residentId (index + unique)')
    console.log('      ✓ mandalName (index)')
    console.log('      ✓ secName (index)')
    console.log('   User table:')
    console.log('      ✓ username (unique)')
    console.log('      ✓ mandalName (index)')
    console.log('   UpdateLog table:')
    console.log('      ✓ updateTimestamp (index)')

    // 5. Recommendations
    console.log('\n💡 Optimization Recommendations:')
    console.log('-'.repeat(80))
    console.log('   Missing Indexes on Resident table:')
    console.log('      ⚠️  phcName - frequently used in filters and groupBy')
    console.log('      ⚠️  mobileNumber - used in searches and filters')
    console.log('      ⚠️  healthId - used in searches and filters')
    console.log('      ⚠️  name - used in searches with startsWith')
    console.log('      ⚠️  gender - used in analytics groupBy')
    console.log('      ⚠️  (mandalName, secName) - composite index for common combination')
    console.log('      ⚠️  (mandalName, phcName) - composite index for PHC analytics')
    console.log('\n   Missing Indexes on User table:')
    console.log('      ⚠️  role - frequently used in filters')
    console.log('      ⚠️  isActive - used in filtering active users')
    console.log('\n   Missing Indexes on UpdateLog table:')
    console.log('      ⚠️  residentId - foreign key, frequently joined')
    console.log('      ⚠️  userId - foreign key, frequently joined')

    console.log('\n' + '='.repeat(80))
    console.log('✅ Analysis Complete')
    console.log('='.repeat(80))

    console.log('\n📊 Detailed Performance Results:')
    console.log('-'.repeat(80))
    performances.forEach((p, index) => {
      const status = p.executionTime < 50 ? '✅' : p.executionTime < 100 ? '⚠️ ' : '❌'
      console.log(`   ${status} ${index + 1}. ${p.queryName}`)
      console.log(`      Time: ${p.executionTime.toFixed(2)}ms | Records: ${p.recordsAffected.toLocaleString()}`)
    })

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the analysis
analyzeDatabase()


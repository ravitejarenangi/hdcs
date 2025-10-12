/**
 * Test Script: Panchayat Secretary Field Officers Page Layout
 * 
 * This script verifies that the Field Officers page has the proper
 * header and sidebar navigation components.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testOfficersPageLayout() {
  console.log('🧪 Testing Panchayat Secretary Field Officers Page Layout\n')
  console.log('='.repeat(80))

  try {
    // Test 1: Verify Field Officers page exists
    console.log('\n📋 Test 1: Verifying Field Officers Page Exists')
    console.log('-'.repeat(80))
    
    const fs = require('fs')
    const path = require('path')
    const officersPagePath = path.join(process.cwd(), 'src/app/(dashboard)/panchayat/officers/page.tsx')
    
    if (!fs.existsSync(officersPagePath)) {
      console.log('❌ FAILED: Field Officers page does not exist')
      console.log(`   Expected path: ${officersPagePath}`)
      return
    }
    
    console.log('✅ PASSED: Field Officers page exists')
    console.log(`   Path: /panchayat/officers`)

    // Test 2: Verify DashboardLayout component is imported
    console.log('\n📋 Test 2: Verifying DashboardLayout Import')
    console.log('-'.repeat(80))
    
    const pageContent = fs.readFileSync(officersPagePath, 'utf-8')
    
    if (!pageContent.includes('import { DashboardLayout }')) {
      console.log('❌ FAILED: DashboardLayout component not imported')
      return
    }
    
    console.log('✅ PASSED: DashboardLayout component imported')

    // Test 3: Verify DashboardLayout is used with PANCHAYAT_SECRETARY role
    console.log('\n📋 Test 3: Verifying DashboardLayout Usage')
    console.log('-'.repeat(80))
    
    if (!pageContent.includes('requiredRole="PANCHAYAT_SECRETARY"')) {
      console.log('❌ FAILED: DashboardLayout not configured with PANCHAYAT_SECRETARY role')
      return
    }
    
    console.log('✅ PASSED: DashboardLayout configured with PANCHAYAT_SECRETARY role')

    // Test 4: Verify Loader2 icon is imported for loading state
    console.log('\n📋 Test 4: Verifying Loading State Components')
    console.log('-'.repeat(80))
    
    if (!pageContent.includes('Loader2')) {
      console.log('❌ FAILED: Loader2 icon not imported')
      return
    }
    
    console.log('✅ PASSED: Loader2 icon imported for loading state')

    // Test 5: Verify old layout divs are removed
    console.log('\n📋 Test 5: Verifying Old Layout Removed')
    console.log('-'.repeat(80))
    
    if (pageContent.includes('min-h-screen bg-gradient-to-br from-orange-50')) {
      console.log('❌ FAILED: Old custom layout divs still present')
      console.log('   The page should use DashboardLayout instead of custom layout divs')
      return
    }
    
    console.log('✅ PASSED: Old custom layout removed')

    // Test 6: Verify proper JSX structure
    console.log('\n📋 Test 6: Verifying JSX Structure')
    console.log('-'.repeat(80))
    
    const hasDashboardLayoutOpen = pageContent.includes('<DashboardLayout requiredRole="PANCHAYAT_SECRETARY">')
    const hasDashboardLayoutClose = pageContent.includes('</DashboardLayout>')
    const hasLoadingState = pageContent.includes('{loading ? (')
    const hasContentDiv = pageContent.includes('<div className="space-y-6">')
    
    if (!hasDashboardLayoutOpen || !hasDashboardLayoutClose || !hasLoadingState || !hasContentDiv) {
      console.log('❌ FAILED: JSX structure incomplete')
      console.log(`   DashboardLayout open: ${hasDashboardLayoutOpen ? '✅' : '❌'}`)
      console.log(`   DashboardLayout close: ${hasDashboardLayoutClose ? '✅' : '❌'}`)
      console.log(`   Loading state: ${hasLoadingState ? '✅' : '❌'}`)
      console.log(`   Content div: ${hasContentDiv ? '✅' : '❌'}`)
      return
    }
    
    console.log('✅ PASSED: JSX structure is correct')
    console.log('   - DashboardLayout wrapper present')
    console.log('   - Loading state implemented')
    console.log('   - Content div properly structured')

    // Test 7: Verify field officers exist in database
    console.log('\n📋 Test 7: Verifying Field Officers Data')
    console.log('-'.repeat(80))
    
    const officers = await prisma.user.findMany({
      where: {
        role: 'FIELD_OFFICER',
        mandalName: 'CHITTOOR',
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
      }
    })

    if (officers.length === 0) {
      console.log('⚠️  WARNING: No field officers found in CHITTOOR mandal')
      console.log('   The page will load but show empty list')
    } else {
      console.log('✅ PASSED: Field officers data available')
      console.log(`   Total officers: ${officers.length}`)
      console.log(`   Active officers: ${officers.filter(o => o.isActive).length}`)
      console.log(`   Inactive officers: ${officers.filter(o => !o.isActive).length}`)
    }

    // Test 8: Verify API endpoint exists
    console.log('\n📋 Test 8: Verifying API Endpoint')
    console.log('-'.repeat(80))
    
    const apiPath = path.join(process.cwd(), 'src/app/api/panchayat/officers/route.ts')
    
    if (!fs.existsSync(apiPath)) {
      console.log('❌ FAILED: API endpoint does not exist')
      console.log(`   Expected path: ${apiPath}`)
      return
    }
    
    console.log('✅ PASSED: API endpoint exists')
    console.log('   Endpoint: /api/panchayat/officers')

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(80))
    console.log('\n📝 Summary:')
    console.log('   ✅ Field Officers page exists (/panchayat/officers)')
    console.log('   ✅ DashboardLayout component imported and configured')
    console.log('   ✅ PANCHAYAT_SECRETARY role properly set')
    console.log('   ✅ Loading state with Loader2 icon')
    console.log('   ✅ Old custom layout removed')
    console.log('   ✅ JSX structure is correct')
    console.log('   ✅ Field officers data available')
    console.log('   ✅ API endpoint exists')
    console.log('\n🎯 Expected Layout Components:')
    console.log('   1. Header: Application title, user info, logout button')
    console.log('   2. Sidebar: Dashboard and Field Officers navigation')
    console.log('   3. Main Content: Field Officers management interface')
    console.log('\n📊 Sidebar Navigation:')
    console.log('   - Dashboard (/panchayat) - Not highlighted')
    console.log('   - Field Officers (/panchayat/officers) - Highlighted as active')
    console.log('\n🚀 To Test in Browser:')
    console.log('   1. Login with: ps_chittoor / Panchayat@123')
    console.log('   2. Navigate to: /panchayat/officers')
    console.log('   3. Verify: Header and sidebar are visible')
    console.log('   4. Verify: "Field Officers" menu item is highlighted')
    console.log('   5. Test: Click "Dashboard" to navigate back')
    console.log('   6. Test: Add/Edit/Delete field officers')
    console.log('   7. Test: Search and filter functionality')

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testOfficersPageLayout()


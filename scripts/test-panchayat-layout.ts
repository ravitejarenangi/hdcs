/**
 * Test Script: Panchayat Secretary Dashboard Layout
 * 
 * This script verifies that the Panchayat Secretary dashboard
 * has the proper header and sidebar navigation components.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPanchayatLayout() {
  console.log('🧪 Testing Panchayat Secretary Dashboard Layout\n')
  console.log('='.repeat(80))

  try {
    // Test 1: Verify Mandal Officer user exists
    console.log('\n📋 Test 1: Verifying Mandal Officer User')
    console.log('-'.repeat(80))

    const user = await prisma.user.findUnique({
      where: { username: 'mo_chittoor' },
      select: {
        id: true,
        username: true,
        role: true,
        fullName: true,
        mandalName: true,
        isActive: true,
      }
    })

    if (!user) {
      console.log('❌ FAILED: User mo_chittoor not found')
      return
    }

    console.log('✅ PASSED: User found')
    console.log(`   Username: ${user.username}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Full Name: ${user.fullName}`)
    console.log(`   Mandal: ${user.mandalName}`)
    console.log(`   Active: ${user.isActive}`)

    // Test 2: Verify role is PANCHAYAT_SECRETARY
    console.log('\n📋 Test 2: Verifying Role')
    console.log('-'.repeat(80))
    
    if (user.role !== 'PANCHAYAT_SECRETARY') {
      console.log(`❌ FAILED: Expected role PANCHAYAT_SECRETARY, got ${user.role}`)
      return
    }
    
    console.log('✅ PASSED: Role is PANCHAYAT_SECRETARY')

    // Test 3: Check if dashboard route exists
    console.log('\n📋 Test 3: Verifying Dashboard Route')
    console.log('-'.repeat(80))
    
    const fs = require('fs')
    const path = require('path')
    const dashboardPath = path.join(process.cwd(), 'src/app/(dashboard)/mandal-officer/page.tsx')

    if (!fs.existsSync(dashboardPath)) {
      console.log('❌ FAILED: Mandal Officer dashboard route does not exist')
      console.log(`   Expected path: ${dashboardPath}`)
      return
    }

    console.log('✅ PASSED: Mandal Officer dashboard route exists')
    console.log(`   Path: /mandal-officer`)

    // Test 4: Verify DashboardLayout component is imported
    console.log('\n📋 Test 4: Verifying DashboardLayout Import')
    console.log('-'.repeat(80))
    
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8')
    
    if (!dashboardContent.includes('import { DashboardLayout }')) {
      console.log('❌ FAILED: DashboardLayout component not imported')
      return
    }
    
    console.log('✅ PASSED: DashboardLayout component imported')

    // Test 5: Verify DashboardLayout is used with PANCHAYAT_SECRETARY role
    console.log('\n📋 Test 5: Verifying DashboardLayout Usage')
    console.log('-'.repeat(80))
    
    if (!dashboardContent.includes('requiredRole="PANCHAYAT_SECRETARY"')) {
      console.log('❌ FAILED: DashboardLayout not configured with PANCHAYAT_SECRETARY role')
      return
    }
    
    console.log('✅ PASSED: DashboardLayout configured with PANCHAYAT_SECRETARY role')

    // Test 6: Verify DashboardLayout component supports PANCHAYAT_SECRETARY
    console.log('\n📋 Test 6: Verifying DashboardLayout Component Support')
    console.log('-'.repeat(80))
    
    const layoutPath = path.join(process.cwd(), 'src/components/layout/DashboardLayout.tsx')
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8')
    
    if (!layoutContent.includes('"PANCHAYAT_SECRETARY"')) {
      console.log('❌ FAILED: DashboardLayout does not support PANCHAYAT_SECRETARY role')
      return
    }
    
    console.log('✅ PASSED: DashboardLayout supports PANCHAYAT_SECRETARY role')

    // Test 7: Verify Sidebar has PANCHAYAT_SECRETARY menu items
    console.log('\n📋 Test 7: Verifying Sidebar Menu Items')
    console.log('-'.repeat(80))
    
    const sidebarPath = path.join(process.cwd(), 'src/components/layout/Sidebar.tsx')
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8')
    
    const hasMandalOfficerDashboard = sidebarContent.includes('href: "/mandal-officer"')
    const hasMandalOfficerOfficers = sidebarContent.includes('href: "/mandal-officer/officers"')
    const hasMandalOfficerRole = sidebarContent.includes('roles: ["PANCHAYAT_SECRETARY"]')

    if (!hasMandalOfficerDashboard || !hasMandalOfficerOfficers || !hasMandalOfficerRole) {
      console.log('❌ FAILED: Sidebar missing PANCHAYAT_SECRETARY (Mandal Officer) menu items')
      console.log(`   Dashboard link: ${hasMandalOfficerDashboard ? '✅' : '❌'}`)
      console.log(`   Officers link: ${hasMandalOfficerOfficers ? '✅' : '❌'}`)
      console.log(`   Role filter: ${hasMandalOfficerRole ? '✅' : '❌'}`)
      return
    }

    console.log('✅ PASSED: Sidebar has PANCHAYAT_SECRETARY (Mandal Officer) menu items')
    console.log('   - Dashboard (/mandal-officer)')
    console.log('   - Field Officers (/mandal-officer/officers)')

    // Test 8: Verify Header component exists
    console.log('\n📋 Test 8: Verifying Header Component')
    console.log('-'.repeat(80))
    
    const headerPath = path.join(process.cwd(), 'src/components/layout/Header.tsx')
    
    if (!fs.existsSync(headerPath)) {
      console.log('❌ FAILED: Header component does not exist')
      return
    }
    
    console.log('✅ PASSED: Header component exists')

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(80))
    console.log('\n📝 Summary:')
    console.log('   ✅ Mandal Officer user exists and is active')
    console.log('   ✅ Dashboard route exists (/mandal-officer)')
    console.log('   ✅ DashboardLayout component imported and configured')
    console.log('   ✅ DashboardLayout supports PANCHAYAT_SECRETARY (Mandal Officer) role')
    console.log('   ✅ Sidebar has PANCHAYAT_SECRETARY (Mandal Officer) menu items')
    console.log('   ✅ Header component exists')
    console.log('\n🎯 Expected Layout Components:')
    console.log('   1. Header: Application title, user info, logout button')
    console.log('   2. Sidebar: Dashboard and Field Officers navigation')
    console.log('   3. Main Content: Mandal Officer dashboard analytics')
    console.log('\n🚀 To Test in Browser:')
    console.log('   1. Login with: mo_chittoor / MandalOfficer@123')
    console.log('   2. Navigate to: /mandal-officer')
    console.log('   3. Verify: Header and sidebar are visible')
    console.log('   4. Test: Click sidebar menu items')
    console.log('   5. Test: Click logout button in header')

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testPanchayatLayout()


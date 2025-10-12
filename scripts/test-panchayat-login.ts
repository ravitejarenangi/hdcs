/**
 * Test Script: Panchayat Secretary Login Flow
 * 
 * This script tests the Panchayat Secretary login functionality
 * to ensure proper authentication and role-based routing.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testPanchayatLogin() {
  console.log('🧪 Testing Panchayat Secretary Login Flow\n')
  console.log('='.repeat(80))

  try {
    // Test 1: Check if user exists
    console.log('\n📋 Test 1: Checking User Existence')
    console.log('-'.repeat(80))
    
    const user = await prisma.user.findUnique({
      where: { username: 'ps_chittoor' },
      select: {
        id: true,
        username: true,
        role: true,
        fullName: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
        passwordHash: true,
      }
    })

    if (!user) {
      console.log('❌ FAILED: User ps_chittoor not found')
      return
    }

    console.log('✅ PASSED: User found')
    console.log(`   Username: ${user.username}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Full Name: ${user.fullName}`)
    console.log(`   Active: ${user.isActive}`)

    // Test 2: Verify role
    console.log('\n📋 Test 2: Verifying Role')
    console.log('-'.repeat(80))
    
    if (user.role !== 'PANCHAYAT_SECRETARY') {
      console.log(`❌ FAILED: Expected role PANCHAYAT_SECRETARY, got ${user.role}`)
      return
    }
    
    console.log('✅ PASSED: Role is PANCHAYAT_SECRETARY')

    // Test 3: Verify password
    console.log('\n📋 Test 3: Verifying Password')
    console.log('-'.repeat(80))
    
    const isPasswordValid = await bcrypt.compare('Panchayat@123', user.passwordHash)
    
    if (!isPasswordValid) {
      console.log('❌ FAILED: Password does not match')
      return
    }
    
    console.log('✅ PASSED: Password is correct')

    // Test 4: Verify user is active
    console.log('\n📋 Test 4: Verifying Active Status')
    console.log('-'.repeat(80))
    
    if (!user.isActive) {
      console.log('❌ FAILED: User is not active')
      return
    }
    
    console.log('✅ PASSED: User is active')

    // Test 5: Check mandal assignment
    console.log('\n📋 Test 5: Checking Mandal Assignment')
    console.log('-'.repeat(80))
    
    if (!user.mandalName) {
      console.log('⚠️  WARNING: No mandal assigned to user')
    } else {
      console.log(`✅ PASSED: Mandal assigned: ${user.mandalName}`)
    }

    // Test 6: Verify redirect route exists
    console.log('\n📋 Test 6: Verifying Dashboard Route')
    console.log('-'.repeat(80))
    
    const fs = require('fs')
    const path = require('path')
    const dashboardPath = path.join(process.cwd(), 'src/app/(dashboard)/panchayat/page.tsx')
    
    if (!fs.existsSync(dashboardPath)) {
      console.log('❌ FAILED: Panchayat dashboard route does not exist')
      console.log(`   Expected path: ${dashboardPath}`)
      return
    }
    
    console.log('✅ PASSED: Panchayat dashboard route exists')
    console.log(`   Path: /panchayat`)

    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(80))
    console.log('\n📝 Summary:')
    console.log('   ✅ User exists and is active')
    console.log('   ✅ Role is PANCHAYAT_SECRETARY')
    console.log('   ✅ Password is correct (Panchayat@123)')
    console.log('   ✅ Dashboard route exists (/panchayat)')
    console.log('\n🎯 Expected Login Flow:')
    console.log('   1. User enters: ps_chittoor / Panchayat@123')
    console.log('   2. Authentication succeeds')
    console.log('   3. Session created with role: PANCHAYAT_SECRETARY')
    console.log('   4. User redirected to: /panchayat')
    console.log('\n💡 If login still fails, check:')
    console.log('   - Browser console for errors')
    console.log('   - Network tab for failed API calls')
    console.log('   - Session storage/cookies')
    console.log('   - NextAuth configuration')

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testPanchayatLogin()


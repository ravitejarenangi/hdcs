import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkFieldOfficer() {
  const username = 'fo_21008026';
  
  console.log(`🔍 Checking Field Officer: ${username}\n`);
  
  try {
    // Find the user in database
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
        fullName: true,
        mandalName: true,
        assignedSecretariats: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log(`❌ User '${username}' not found in database!`);
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Full Name: ${user.fullName}`);
    console.log(`   Mandal: ${user.mandalName || 'Not assigned'}`);
    console.log(`   Assigned Secretariats: ${user.assignedSecretariats || 'Not assigned'}`);
    console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
    console.log(`   Last Login: ${user.lastLogin || 'Never'}`);
    console.log(`   Created At: ${user.createdAt}`);
    
    if (!user.isActive) {
      console.log(`\n⚠️  ISSUE FOUND: User account is INACTIVE!`);
      console.log(`   This is likely the reason for login failure.`);
    }

    // Test password verification with common passwords
    const testPasswords = [
      'Welcome@123',
      'password',
      '123456',
      username,
      'fo_21008026',
      'admin',
      'changeme'
    ];

    console.log(`\n🔐 Testing password verification:`);
    for (const testPwd of testPasswords) {
      const isValid = await bcrypt.compare(testPwd, user.passwordHash);
      console.log(`   '${testPwd}': ${isValid ? '✅ VALID' : '❌ Invalid'}`);
    }

    // Check if password hash format is correct
    console.log(`\n🔍 Password hash analysis:`);
    console.log(`   Hash starts with $2b$: ${user.passwordHash.startsWith('$2b$') ? '✅ Yes' : '❌ No'}`);
    console.log(`   Hash length: ${user.passwordHash.length} characters`);
    
    if (!user.passwordHash.startsWith('$2b$')) {
      console.log(`   ⚠️  ISSUE: Password hash format is incorrect!`);
      console.log(`   Expected bcrypt format starting with '$2b$'`);
    }

    // Check if user has required fields for field officer
    console.log(`\n📋 Field Officer requirements check:`);
    if (user.role !== 'FIELD_OFFICER') {
      console.log(`   ❌ Role is not FIELD_OFFICER (current: ${user.role})`);
    } else {
      console.log(`   ✅ Role is FIELD_OFFICER`);
    }
    
    if (!user.mandalName) {
      console.log(`   ⚠️  No mandal assigned`);
    } else {
      console.log(`   ✅ Mandal assigned: ${user.mandalName}`);
    }
    
    if (!user.assignedSecretariats) {
      console.log(`   ⚠️  No secretariats assigned`);
    } else {
      console.log(`   ✅ Secretariats assigned`);
    }

  } catch (error) {
    console.error('Error checking field officer:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFieldOfficer();
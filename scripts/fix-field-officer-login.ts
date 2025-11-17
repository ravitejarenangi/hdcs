import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function fixFieldOfficerLogin() {
  const username = 'fo_21008026';
  const newPassword = 'Welcome@123'; // Default password
  
  console.log(`🔧 Fixing login for Field Officer: ${username}\n`);
  
  try {
    // Find the user in database
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      console.log(`❌ User '${username}' not found in database!`);
      return;
    }

    console.log(`✅ User found: ${user.fullName} (${user.role})`);
    console.log(`   Current status: ${user.isActive ? 'ACTIVE' : 'INACTIVE'}`);
    
    // Generate new password hash
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update user: activate and reset password
    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        isActive: true,
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    console.log(`\n✅ User account has been FIXED:`);
    console.log(`   ✅ Status changed to ACTIVE`);
    console.log(`   ✅ Password reset to default`);
    console.log(`   ✅ Updated at: ${updatedUser.updatedAt}`);
    
    console.log(`\n📋 Login Credentials:`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Role: ${updatedUser.role}`);
    console.log(`   Mandal: ${updatedUser.mandalName || 'Not assigned'}`);
    
    // Test the new credentials
    console.log(`\n🔐 Testing new credentials...`);
    const testUser = await prisma.user.findUnique({
      where: { username },
      select: { passwordHash: true, isActive: true }
    });
    
    if (testUser) {
      const isPasswordValid = await bcrypt.compare(newPassword, testUser.passwordHash);
      console.log(`   Password verification: ${isPasswordValid ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   Account status: ${testUser.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}`);
    }
    
    console.log(`\n🎉 The field officer should now be able to login with the credentials above.`);
    
  } catch (error) {
    console.error('Error fixing field officer login:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFieldOfficerLogin();
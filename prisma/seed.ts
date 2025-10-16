import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin@123', 12)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      fullName: 'System Administrator',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log('✅ Created admin user:', admin.username)

  // Create mandal officer user (formerly panchayat secretary)
  const mandalOfficerPasswordHash = await bcrypt.hash('MandalOfficer@123', 12)
  const mandalOfficer = await prisma.user.upsert({
    where: { username: 'mo_chittoor' },
    update: {},
    create: {
      username: 'mo_chittoor',
      passwordHash: mandalOfficerPasswordHash,
      fullName: 'Rajesh Kumar',
      role: 'PANCHAYAT_SECRETARY',
      mobileNumber: '9876543210',
      mandalName: 'CHITTOOR',
      assignedSecretariats: null,
      isActive: true,
    },
  })

  console.log('✅ Created mandal officer user:', mandalOfficer.username)

  // Create field officer users
  const fieldOfficers = [
    {
      username: 'field_officer_1',
      fullName: 'Priya Sharma',
      password: 'Field@123',
      mobileNumber: '9876543211',
      assignedSecretariats: ['CHITTOOR URBAN'],
    },
    {
      username: 'field_officer_2',
      fullName: 'Suresh Reddy',
      password: 'Field@123',
      mobileNumber: '9876543212',
      assignedSecretariats: ['CHITTOOR URBAN'],
    },
    {
      username: 'field_officer_3',
      fullName: 'Venkata Rao',
      password: 'Field@123',
      mobileNumber: '9876543213',
      assignedSecretariats: ['CHITTOOR RURAL'],
    },
  ]

  for (const officer of fieldOfficers) {
    const passwordHash = await bcrypt.hash(officer.password, 12)
    const user = await prisma.user.upsert({
      where: { username: officer.username },
      update: {},
      create: {
        username: officer.username,
        passwordHash,
        fullName: officer.fullName,
        role: 'FIELD_OFFICER',
        mobileNumber: officer.mobileNumber,
        mandalName: null,
        assignedSecretariats: JSON.stringify(officer.assignedSecretariats),
        isActive: true,
      },
    })
    console.log('✅ Created field officer:', user.username, '- Assigned to:', officer.assignedSecretariats.join(', '))
  }

  // Create sample residents for testing (with all data in single table)
  const sampleResidents = [
    {
      residentId: 'RES001',
      uid: '123456789012',
      hhId: 'HH001',
      name: 'Ramesh Kumar',
      dob: new Date('1985-05-15'),
      gender: 'MALE' as const,
      mobileNumber: '9876543210',
      healthId: 'ABHA001',
      // Demographic data
      distName: 'CHITTOOR',
      mandalName: 'CHITTOOR',
      mandalCode: 5423,
      secName: 'CHITTOOR URBAN',
      secCode: 11090438,
      ruralUrban: 'U',
      clusterName: 'CHITTOOR CLUSTER 1',
      qualification: 'Graduate',
      occupation: 'Private Job',
      caste: 'OC',
      subCaste: 'Kapu',
      casteCategory: 'OC',
      hofMember: 'HOF',
      doorNumber: '12-34-56',
      addressEkyc: 'House No: 12-34-56, Street: Main Road, City: Chittoor',
      addressHh: 'Chittoor, Andhra Pradesh',
      // Health data
      citizenMobile: '9876543210',
      age: Math.floor((new Date().getTime() - new Date('1985-05-15').getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
      phcName: 'Chittoor Urban PHC',
    },
    {
      residentId: 'RES002',
      uid: '123456789013',
      hhId: 'HH001',
      name: 'Lakshmi Devi',
      dob: new Date('1990-08-20'),
      gender: 'FEMALE' as const,
      mobileNumber: '9876543211',
      healthId: 'ABHA002',
      // Demographic data
      distName: 'CHITTOOR',
      mandalName: 'CHITTOOR',
      mandalCode: 5423,
      secName: 'CHITTOOR URBAN',
      secCode: 11090438,
      ruralUrban: 'U',
      clusterName: 'CHITTOOR CLUSTER 1',
      qualification: 'Post Graduate',
      occupation: 'Government Job',
      caste: 'BC',
      subCaste: 'Yadav',
      casteCategory: 'BC-A',
      hofMember: 'Member',
      doorNumber: '12-34-56',
      addressEkyc: 'House No: 12-34-56, Street: Main Road, City: Chittoor',
      addressHh: 'Chittoor, Andhra Pradesh',
      // Health data
      citizenMobile: '9876543211',
      age: Math.floor((new Date().getTime() - new Date('1990-08-20').getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
      phcName: 'Chittoor Urban PHC',
    },
    {
      residentId: 'RES003',
      uid: '123456789014',
      hhId: 'HH002',
      name: 'Venkata Rao',
      dob: new Date('1975-12-10'),
      gender: 'MALE' as const,
      mobileNumber: null,
      healthId: null,
      // Demographic data
      distName: 'CHITTOOR',
      mandalName: 'CHITTOOR',
      mandalCode: 5423,
      secName: 'CHITTOOR RURAL',
      secCode: 11090439,
      ruralUrban: 'R',
      clusterName: 'CHITTOOR CLUSTER 2',
      qualification: 'High School',
      occupation: 'Agriculture',
      caste: 'SC',
      subCaste: 'Mala',
      casteCategory: 'SC',
      hofMember: 'HOF',
      doorNumber: '45-67-89',
      addressEkyc: 'House No: 45-67-89, Village: Ramapuram, Mandal: Chittoor',
      addressHh: 'Ramapuram, Chittoor, Andhra Pradesh',
      // Health data
      citizenMobile: null,
      age: Math.floor((new Date().getTime() - new Date('1975-12-10').getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
      phcName: 'Ramapuram PHC',
    },
  ]

  for (const resident of sampleResidents) {
    await prisma.resident.upsert({
      where: { residentId: resident.residentId },
      update: {},
      create: resident,
    })

    console.log('✅ Created sample resident:', resident.name)
  }

  console.log('🎉 Database seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })

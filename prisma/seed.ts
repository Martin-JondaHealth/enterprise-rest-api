import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing records
  await prisma.refreshToken.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.user.deleteMany({});

  const saltRounds = 10;

  // 1. Admin User
  const adminPassword = await bcrypt.hash('AdminPass123!', saltRounds);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@enterprise.dev',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      profile: {
        create: {
          firstName: 'Martin',
          lastName: 'Su',
          bio: 'Lead System Architect & Admin',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        },
      },
    },
    include: { profile: true },
  });

  // 2. Member User
  const memberPassword = await bcrypt.hash('MemberPass123!', saltRounds);
  const member = await prisma.user.create({
    data: {
      email: 'member@enterprise.dev',
      passwordHash: memberPassword,
      role: Role.MEMBER,
      profile: {
        create: {
          firstName: 'Jane',
          lastName: 'Doe',
          bio: 'Senior Backend Contributor',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
        },
      },
    },
    include: { profile: true },
  });

  // 3. Viewer User
  const viewerPassword = await bcrypt.hash('ViewerPass123!', saltRounds);
  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@enterprise.dev',
      passwordHash: viewerPassword,
      role: Role.VIEWER,
      profile: {
        create: {
          firstName: 'Bob',
          lastName: 'Smith',
          bio: 'Auditor & Read-Only Viewer',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        },
      },
    },
    include: { profile: true },
  });

  console.log(`✅ Seeded users:`);
  console.log(` - Admin: ${admin.email} (Role: ${admin.role})`);
  console.log(` - Member: ${member.email} (Role: ${member.role})`);
  console.log(` - Viewer: ${viewer.email} (Role: ${viewer.role})`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

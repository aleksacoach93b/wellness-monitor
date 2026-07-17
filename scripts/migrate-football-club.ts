/**
 * One-time production bootstrap:
 * - Creates Team "Football Club"
 * - Creates SUPER admin aleksacoach@gmail.com / Teodor2025
 * - Attaches all existing players, surveys, tags, kiosk + admin-access settings to that team
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-football-club.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const TEAM_NAME = 'Football Club'
const SUPER_EMAIL = 'aleksacoach@gmail.com'
const SUPER_PASSWORD = 'Teodor2025'
const SUPER_NAME = 'Aleksa'

async function main() {
  console.log('=== Football Club multi-admin migration ===')

  const passwordHash = await bcrypt.hash(SUPER_PASSWORD, 12)

  let team = await prisma.team.findFirst({ where: { name: TEAM_NAME } })
  if (!team) {
    team = await prisma.team.create({ data: { name: TEAM_NAME } })
    console.log('Created team', team.id)
  } else {
    console.log('Team already exists', team.id)
  }

  let admin = await prisma.adminUser.findUnique({ where: { email: SUPER_EMAIL } })
  if (!admin) {
    admin = await prisma.adminUser.create({
      data: {
        email: SUPER_EMAIL,
        passwordHash,
        name: SUPER_NAME,
        role: 'SUPER',
        isActive: true,
      },
    })
    console.log('Created SUPER admin', admin.id)
  } else {
    admin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        role: 'SUPER',
        isActive: true,
        name: admin.name || SUPER_NAME,
      },
    })
    console.log('Updated SUPER admin password/role', admin.id)
  }

  const membership = await prisma.teamMembership.findUnique({
    where: {
      teamId_adminUserId: { teamId: team.id, adminUserId: admin.id },
    },
  })
  if (!membership) {
    await prisma.teamMembership.create({
      data: { teamId: team.id, adminUserId: admin.id, role: 'OWNER' },
    })
    console.log('Linked admin to team')
  }

  const players = await prisma.player.updateMany({
    where: { OR: [{ teamId: null }, { teamId: { not: team.id } }] },
    data: { teamId: team.id },
  })
  console.log('Players attached:', players.count)

  const surveys = await prisma.survey.updateMany({
    where: { OR: [{ teamId: null }, { teamId: { not: team.id } }] },
    data: { teamId: team.id, createdBy: admin.id },
  })
  console.log('Surveys attached:', surveys.count)

  const tags = await prisma.tag.updateMany({
    where: { OR: [{ teamId: null }, { teamId: { not: team.id } }] },
    data: { teamId: team.id },
  })
  console.log('Tags attached:', tags.count)

  const kioskCount = await prisma.kioskSettings.count()
  if (kioskCount === 0) {
    await prisma.kioskSettings.create({
      data: {
        teamId: team.id,
        clubName: TEAM_NAME,
        showClubBranding: true,
      },
    })
    console.log('Created kiosk settings')
  } else {
    const kiosk = await prisma.kioskSettings.updateMany({
      data: { teamId: team.id },
    })
    console.log('Kiosk settings attached:', kiosk.count)
  }

  const accessCount = await prisma.adminAccessSettings.count()
  if (accessCount === 0) {
    await prisma.adminAccessSettings.create({
      data: { teamId: team.id, password: SUPER_PASSWORD },
    })
    console.log('Created admin-access (kiosk exit) settings')
  } else {
    const access = await prisma.adminAccessSettings.updateMany({
      data: { teamId: team.id },
    })
    console.log('Admin-access settings attached:', access.count)
  }

  const summary = {
    teamId: team.id,
    adminId: admin.id,
    players: await prisma.player.count({ where: { teamId: team.id } }),
    surveys: await prisma.survey.count({ where: { teamId: team.id } }),
    responses: await prisma.response.count({
      where: { survey: { teamId: team.id } },
    }),
  }
  console.log('=== DONE ===', summary)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

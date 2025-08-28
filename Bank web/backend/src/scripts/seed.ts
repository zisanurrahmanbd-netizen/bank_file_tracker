import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Starting database seeding...');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        password: adminPassword,
        name: 'System Administrator',
        phone: '+8801700000000',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        language: 'en',
      },
    });

    logger.info(`Created admin user: ${admin.email}`);

    // Create sample banks
    const dhakaBankData = {
      name: 'Dhaka Bank Limited',
      code: 'DBL',
      contactEmail: 'recovery@dhakabank.com.bd',
      contactPhone: '+88029555555',
      commissionRules: {
        rate: 2.5,
        tiers: [
          { min: 0, max: 100000, rate: 2.0 },
          { min: 100001, max: 500000, rate: 2.5 },
          { min: 500001, max: null, rate: 3.0 }
        ]
      },
      slaSettings: {
        depositHours: 48,
        updateDays: 7,
        ptpFollowupDays: 3
      },
    };

    const dhakaBank = await prisma.bank.upsert({
      where: { code: 'DBL' },
      update: dhakaBankData,
      create: dhakaBankData,
    });

    const islamiBankData = {
      name: 'Islami Bank Bangladesh Limited',
      code: 'IBBL',
      contactEmail: 'recovery@islamibankbd.com',
      contactPhone: '+88029555666',
      commissionRules: {
        rate: 2.0,
        tiers: [
          { min: 0, max: 50000, rate: 1.5 },
          { min: 50001, max: 200000, rate: 2.0 },
          { min: 200001, max: null, rate: 2.5 }
        ]
      },
      slaSettings: {
        depositHours: 24,
        updateDays: 5,
        ptpFollowupDays: 2
      },
    };

    const islamiBank = await prisma.bank.upsert({
      where: { code: 'IBBL' },
      update: islamiBankData,
      create: islamiBankData,
    });

    logger.info(`Created banks: ${dhakaBank.name}, ${islamiBank.name}`);

    // Create agent users
    const agent1Password = await bcrypt.hash('agent123', 12);
    const agent1 = await prisma.user.upsert({
      where: { email: 'agent1@example.com' },
      update: {},
      create: {
        email: 'agent1@example.com',
        password: agent1Password,
        name: 'Md. Karim Ahmed',
        phone: '+8801711111111',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        language: 'bn',
      },
    });

    const agent2Password = await bcrypt.hash('agent123', 12);
    const agent2 = await prisma.user.upsert({
      where: { email: 'agent2@example.com' },
      update: {},
      create: {
        email: 'agent2@example.com',
        password: agent2Password,
        name: 'Fatema Begum',
        phone: '+8801722222222',
        role: UserRole.AGENT,
        status: UserStatus.ACTIVE,
        language: 'bn',
      },
    });

    // Create agent profiles
    const agentProfile1 = await prisma.agent.upsert({
      where: { userId: agent1.id },
      update: {},
      create: {
        userId: agent1.id,
        employeeId: 'AGT001',
        bankId: dhakaBank.id,
        territory: 'Dhaka Central',
        targetMonthly: 500000,
        commissionRate: 2.5,
      },
    });

    const agentProfile2 = await prisma.agent.upsert({
      where: { userId: agent2.id },
      update: {},
      create: {
        userId: agent2.id,
        employeeId: 'AGT002',
        bankId: islamiBank.id,
        territory: 'Chittagong',
        targetMonthly: 400000,
        commissionRate: 2.0,
      },
    });

    logger.info(`Created agent profiles: ${agentProfile1.employeeId}, ${agentProfile2.employeeId}`);

    // Create auditor user
    const auditorPassword = await bcrypt.hash('auditor123', 12);
    const auditor = await prisma.user.upsert({
      where: { email: 'auditor@example.com' },
      update: {},
      create: {
        email: 'auditor@example.com',
        password: auditorPassword,
        name: 'Nasir Uddin',
        phone: '+8801733333333',
        role: UserRole.AUDITOR,
        status: UserStatus.ACTIVE,
        language: 'en',
      },
    });

    logger.info(`Created auditor user: ${auditor.email}`);

    // Create sample accounts
    const sampleAccounts = [
      {
        bankId: dhakaBank.id,
        fileNo: 'DBL-2024-001',
        clientName: 'Mohammad Rahman',
        contactPhone: '+8801811111111',
        address: 'House 10, Road 5, Dhanmondi, Dhaka',
        product: 'Personal Loan',
        month: '2024-01',
        allocationDate: new Date('2024-01-15'),
        expiryDate: new Date('2024-12-31'),
        workOrderExpiry: new Date('2024-06-30'),
        outstandingAmount: 150000,
        overdueAmount: 25000,
        emiAmount: 5000,
        statusStage: 'Contact Made',
      },
      {
        bankId: dhakaBank.id,
        fileNo: 'DBL-2024-002',
        clientName: 'Rashida Khatun',
        contactPhone: '+8801822222222',
        address: 'Plot 15, Block C, Bashundhara, Dhaka',
        product: 'Credit Card',
        month: '2024-01',
        allocationDate: new Date('2024-01-20'),
        expiryDate: new Date('2024-12-31'),
        workOrderExpiry: new Date('2024-06-30'),
        outstandingAmount: 75000,
        overdueAmount: 15000,
        emiAmount: 2500,
        statusStage: 'PTP Taken',
      },
      {
        bankId: islamiBank.id,
        fileNo: 'IBBL-2024-001',
        clientName: 'Abdul Karim',
        contactPhone: '+8801833333333',
        address: 'House 25, GEC Circle, Chittagong',
        product: 'Auto Loan',
        month: '2024-01',
        allocationDate: new Date('2024-01-10'),
        expiryDate: new Date('2024-12-31'),
        workOrderExpiry: new Date('2024-06-30'),
        outstandingAmount: 800000,
        overdueAmount: 50000,
        emiAmount: 15000,
        statusStage: 'Field Visit',
      },
      {
        bankId: islamiBank.id,
        fileNo: 'IBBL-2024-002',
        clientName: 'Salma Begum',
        contactPhone: '+8801844444444',
        address: 'Apartment 5B, New Market, Chittagong',
        product: 'Home Loan',
        month: '2024-01',
        allocationDate: new Date('2024-01-25'),
        expiryDate: new Date('2024-12-31'),
        workOrderExpiry: new Date('2024-06-30'),
        outstandingAmount: 1200000,
        overdueAmount: 100000,
        emiAmount: 25000,
        statusStage: 'New',
      },
      {
        bankId: dhakaBank.id,
        fileNo: 'DBL-2024-003',
        clientName: 'Rafiqul Islam',
        contactPhone: '+8801855555555',
        address: 'House 8, Road 12, Gulshan, Dhaka',
        product: 'Business Loan',
        month: '2024-02',
        allocationDate: new Date('2024-02-01'),
        expiryDate: new Date('2024-12-31'),
        workOrderExpiry: new Date('2024-07-31'),
        outstandingAmount: 500000,
        overdueAmount: 75000,
        emiAmount: 12000,
        statusStage: 'Legal Notice',
      },
    ];

    const accounts = [];
    for (const accountData of sampleAccounts) {
      const account = await prisma.account.upsert({
        where: {
          bankId_fileNo: {
            bankId: accountData.bankId,
            fileNo: accountData.fileNo,
          },
        },
        update: accountData,
        create: accountData,
      });
      accounts.push(account);
    }

    logger.info(`Created ${accounts.length} sample accounts`);

    // Create assignments
    await prisma.assignment.upsert({
      where: {
        accountId_agentId: {
          accountId: accounts[0].id,
          agentId: agentProfile1.id,
        },
      },
      update: {},
      create: {
        accountId: accounts[0].id,
        agentId: agentProfile1.id,
        isActive: true,
      },
    });

    await prisma.assignment.upsert({
      where: {
        accountId_agentId: {
          accountId: accounts[1].id,
          agentId: agentProfile1.id,
        },
      },
      update: {},
      create: {
        accountId: accounts[1].id,
        agentId: agentProfile1.id,
        isActive: true,
      },
    });

    await prisma.assignment.upsert({
      where: {
        accountId_agentId: {
          accountId: accounts[2].id,
          agentId: agentProfile2.id,
        },
      },
      update: {},
      create: {
        accountId: accounts[2].id,
        agentId: agentProfile2.id,
        isActive: true,
      },
    });

    await prisma.assignment.upsert({
      where: {
        accountId_agentId: {
          accountId: accounts[3].id,
          agentId: agentProfile2.id,
        },
      },
      update: {},
      create: {
        accountId: accounts[3].id,
        agentId: agentProfile2.id,
        isActive: true,
      },
    });

    logger.info('Created account assignments');

    // Create sample updates
    await prisma.update.create({
      data: {
        accountId: accounts[0].id,
        userId: agent1.id,
        visitType: 'PHONE',
        visitDate: new Date('2024-02-01T10:00:00Z'),
        remarks: 'Contacted customer. He promised to pay 10,000 BDT by next week.',
        ptpAmount: 10000,
        ptpDate: new Date('2024-02-08'),
      },
    });

    await prisma.update.create({
      data: {
        accountId: accounts[1].id,
        userId: agent1.id,
        visitType: 'FIELD',
        visitDate: new Date('2024-02-03T14:00:00Z'),
        remarks: 'Visited customer at home. Family facing financial difficulty. Negotiated partial payment.',
        address: 'Plot 15, Block C, Bashundhara, Dhaka (Verified)',
        gpsLocation: { lat: 23.8223, lng: 90.4252 },
        ptpAmount: 5000,
        ptpDate: new Date('2024-02-10'),
      },
    });

    // Create sample collections
    await prisma.collection.create({
      data: {
        accountId: accounts[0].id,
        submittedBy: agent1.id,
        type: 'BKASH',
        amount: 10000,
        collectionDate: new Date('2024-02-08T16:30:00Z'),
        txnId: 'BKA2024020812345',
        status: 'APPROVED',
        verifiedBy: admin.id,
        verifiedAt: new Date('2024-02-08T18:00:00Z'),
        isMatched: true,
        matchedAt: new Date('2024-02-08T16:35:00Z'),
        matchSource: 'webhook',
      },
    });

    await prisma.collection.create({
      data: {
        accountId: accounts[1].id,
        submittedBy: agent1.id,
        type: 'CASH',
        amount: 5000,
        collectionDate: new Date('2024-02-10T11:00:00Z'),
        cashReceipt: 'CASH-2024-001',
        status: 'PENDING',
      },
    });

    logger.info('Created sample updates and collections');

    // Create sample alerts
    await prisma.alert.create({
      data: {
        type: 'SLA_BREACH',
        title: 'Deposit SLA Breach',
        description: 'Cash collection not deposited within 48 hours',
        severity: 'WARNING',
        accountId: accounts[1].id,
        agentId: agentProfile1.id,
        data: {
          collectionId: 'pending-collection-id',
          hoursOverdue: 72,
        },
      },
    });

    await prisma.alert.create({
      data: {
        type: 'MISSED_PTP',
        title: 'Missed PTP Follow-up',
        description: 'Customer missed promised payment date',
        severity: 'ERROR',
        accountId: accounts[0].id,
        agentId: agentProfile1.id,
        data: {
          ptpDate: '2024-02-08',
          daysMissed: 3,
        },
      },
    });

    logger.info('Created sample alerts');

    // Refresh materialized view
    await prisma.$executeRaw`REFRESH MATERIALIZED VIEW dashboard_metrics;`;

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      logger.info('Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

export default main;
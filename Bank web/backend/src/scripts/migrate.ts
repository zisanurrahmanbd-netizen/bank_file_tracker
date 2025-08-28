import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Starting database migration...');

    // The schema is defined in prisma/schema.prisma
    // This script can be used for custom migrations if needed
    
    // Example: Create custom indexes
    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_allocation_date 
      ON accounts(allocation_date) WHERE allocation_date IS NOT NULL;
    `;

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_expiry_date 
      ON accounts(expiry_date) WHERE expiry_date IS NOT NULL;
    `;

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_status_bank 
      ON accounts(status_stage, bank_id);
    `;

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_date_status 
      ON collections(collection_date, status);
    `;

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_updates_account_date 
      ON updates(account_id, visit_date);
    `;

    await prisma.$executeRaw`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_logs_resource_action 
      ON event_logs(resource, action, created_at);
    `;

    // Create custom functions for full-text search
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION accounts_search_vector(account accounts)
      RETURNS tsvector AS $$
      BEGIN
        RETURN to_tsvector('english', 
          COALESCE(account.file_no, '') || ' ' ||
          COALESCE(account.client_name, '') || ' ' ||
          COALESCE(account.contact_phone, '') || ' ' ||
          COALESCE(account.contact_phone2, '') || ' ' ||
          COALESCE(account.address, '')
        );
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `;

    // Create materialized view for dashboard metrics
    await prisma.$executeRaw`
      CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_metrics AS
      SELECT 
        b.id as bank_id,
        b.name as bank_name,
        COUNT(a.id) as total_accounts,
        SUM(a.outstanding_amount) as total_outstanding,
        SUM(a.overdue_amount) as total_overdue,
        SUM(CASE WHEN c.status = 'APPROVED' THEN c.amount ELSE 0 END) as total_collected,
        COUNT(CASE WHEN a.status_stage = 'New' THEN 1 END) as pending_accounts,
        COUNT(CASE WHEN c.status = 'PENDING' THEN 1 END) as pending_collections,
        NOW() as last_updated
      FROM banks b
      LEFT JOIN accounts a ON a.bank_id = b.id
      LEFT JOIN collections c ON c.account_id = a.id
      WHERE b.is_active = true
      GROUP BY b.id, b.name;
    `;

    // Create unique index on materialized view
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_metrics_bank_id_idx 
      ON dashboard_metrics(bank_id);
    `;

    // Create trigger to refresh materialized view
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
      RETURNS trigger AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Create triggers for automatic refresh
    await prisma.$executeRaw`
      DROP TRIGGER IF EXISTS refresh_metrics_on_collection ON collections;
      CREATE TRIGGER refresh_metrics_on_collection
        AFTER INSERT OR UPDATE OR DELETE ON collections
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_dashboard_metrics();
    `;

    await prisma.$executeRaw`
      DROP TRIGGER IF EXISTS refresh_metrics_on_account ON accounts;
      CREATE TRIGGER refresh_metrics_on_account
        AFTER INSERT OR UPDATE OR DELETE ON accounts
        FOR EACH STATEMENT
        EXECUTE FUNCTION refresh_dashboard_metrics();
    `;

    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export default main;
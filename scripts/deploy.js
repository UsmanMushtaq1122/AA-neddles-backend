#!/usr/bin/env node

/**
 * Pre-deployment script: runs Prisma migrations before starting the app
 */

const { execSync } = require('child_process');

console.log('Running Prisma migrations...');

try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('✓ Migrations completed successfully');
} catch (error) {
  console.error('✗ Migration failed:', error.message);
  process.exit(1);
}


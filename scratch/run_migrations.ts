import { migrate } from '../apps/api/src/db/migrate.js';

async function run() {
  try {
    console.log('Starting migrations...');
    await migrate();
    console.log('Migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();

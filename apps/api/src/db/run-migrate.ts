import { migrate } from './migrate.js';
import { sql } from './client.js';

await migrate();
await sql.end();
console.log('Migrations completed');

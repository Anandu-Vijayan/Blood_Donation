import { migrate } from './migrate.js';
import { prisma } from './prisma.js';

await migrate();
await prisma.$disconnect();
console.log('Migrations completed');

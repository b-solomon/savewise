import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const paths = [
  '/etc/secrets/.env',
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env')
];

let loaded = false;
for (const p of paths) {
  if (fs.existsSync(p)) {
    console.log(`🟢 Loading environment variables from: ${p}`);
    dotenv.config({ path: p });
    loaded = true;
  }
}

if (!loaded) {
  dotenv.config();
  console.log('🟡 Dotenv completed default load.');
}

console.log('=== ENVIRONMENT DIAGNOSTICS ===');
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
console.log('PORT:', process.env.PORT);
console.log('===============================');


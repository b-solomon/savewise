import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const paths = [
  '/etc/secrets/.env',
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env')
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

if (process.env.NODE_ENV !== 'production') {
  console.log('=== ENVIRONMENT DIAGNOSTICS ===');
  console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
  console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);
  console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
  console.log('ENCRYPTION_MASTER_KEY present:', !!process.env.ENCRYPTION_MASTER_KEY);
  console.log('PORT:', process.env.PORT);
  console.log('===============================');
}


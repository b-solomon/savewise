import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const paths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  '/etc/secrets/.env'
];

let loaded = false;
for (const p of paths) {
  if (fs.existsSync(p)) {
    console.log(`🟢 Loaded environment variables from: ${p}`);
    dotenv.config({ path: p });
    loaded = true;
    break;
  }
}

if (!loaded) {
  dotenv.config();
  console.log('🟡 Dotenv completed default load.');
}

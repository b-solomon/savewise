import pg from 'pg';

const regions = ['ap-south-1', 'us-east-1', 'ap-southeast-1'];

async function testPooler() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.yrlvrlhtdbiqvbajmnki:B9Bes2biC1ZOIWvM@${host}:6543/postgres`;
    console.log(`Checking pooler in ${region}...`);
    try {
      const pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });
      const res = await pool.query('SELECT NOW()');
      console.log(`✅ SUCCESS! Project is active on region: ${region}`);
      console.log(`Use connection string: ${connectionString}`);
      pool.end();
      break;
    } catch (err) {
      console.log(`❌ Failed in ${region}:`, err.message);
    }
  }
}

testPooler();

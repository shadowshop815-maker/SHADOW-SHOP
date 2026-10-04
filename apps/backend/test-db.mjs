import { Client } from 'pg';

const url = 'postgresql://postgres.vcabnqnmkeusesbtdlqh:SHADOWSHOP%408587@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString: url });

async function test() {
  try {
    await client.connect();
    console.log('Connected to 6543 successfully!');
    await client.end();
  } catch (e) {
    console.error('Failed to connect to 6543:', e.message);
  }
}

test();

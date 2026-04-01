
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*');

  if (error) {
    console.error('Error fetching app_settings:', error.message);
    return;
  }

  console.log('App Settings Content:');
  console.log(JSON.stringify(data, null, 2));
}

checkConfig();

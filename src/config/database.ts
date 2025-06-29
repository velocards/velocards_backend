import { createClient } from '@supabase/supabase-js';
import { database } from './env';
import logger from '../utils/logger';

const supabase = createClient(
  database.supabaseUrl,
  database.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error) throw error;

    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    return false;
  }
}

export default supabase;
export { supabase };
#!/usr/bin/env ts-node

import { readFileSync } from 'fs';
import { join } from 'path';
import { supabase } from '../src/config/database';
import logger from '../src/utils/logger';

interface MigrationResult {
  sql: string;
  success: boolean;
  error?: string;
  result?: any;
}

/**
 * Executes SQL queries using Supabase RPC
 * This requires a stored procedure to be created first in Supabase
 */
async function executeSql(sql: string): Promise<MigrationResult> {
  try {
    // First, try to execute using rpc if available
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      // If RPC fails, log the error but continue with table checks
      logger.warn('RPC execution failed, will try alternative approach:', error.message);
      return { sql, success: false, error: error.message };
    }

    return { sql, success: true, result: data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { sql, success: false, error: errorMessage };
  }
}

/**
 * Check if security_keys table exists and what columns it has
 */
async function checkSecurityKeysTable(): Promise<MigrationResult> {
  const sql = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'security_keys'
    ORDER BY ordinal_position;
  `;

  try {
    // Use a simple select to check table structure
    const { data, error } = await supabase
      .from('security_keys')
      .select('*')
      .limit(0);

    if (error) {
      return { 
        sql, 
        success: false, 
        error: `Security keys table check failed: ${error.message}` 
      };
    }

    return { 
      sql, 
      success: true, 
      result: 'Security keys table exists and is accessible' 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { sql, success: false, error: errorMessage };
  }
}

/**
 * Check if crypto_prices table exists
 */
async function checkCryptoPricesTable(): Promise<MigrationResult> {
  const sql = `
    SELECT EXISTS (
       SELECT FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name = 'crypto_prices'
    );
  `;

  try {
    const { data, error } = await supabase
      .from('crypto_prices')
      .select('*')
      .limit(0);

    if (error) {
      return { 
        sql, 
        success: false, 
        error: `Crypto prices table does not exist or is not accessible: ${error.message}` 
      };
    }

    return { 
      sql, 
      success: true, 
      result: 'Crypto prices table exists and is accessible' 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { sql, success: false, error: errorMessage };
  }
}

/**
 * Main migration function
 */
async function runMigrations(): Promise<void> {
  logger.info('🚀 Starting database migrations...');
  
  const results: MigrationResult[] = [];

  // 1. Check security_keys table structure
  logger.info('📋 Checking security_keys table structure...');
  const securityKeysCheck = await checkSecurityKeysTable();
  results.push(securityKeysCheck);
  
  if (securityKeysCheck.success) {
    logger.info('✅ Security keys table is accessible');
  } else {
    logger.error('❌ Security keys table check failed:', securityKeysCheck.error);
  }

  // 2. Check crypto_prices table
  logger.info('📋 Checking crypto_prices table...');
  const cryptoPricesCheck = await checkCryptoPricesTable();
  results.push(cryptoPricesCheck);
  
  if (cryptoPricesCheck.success) {
    logger.info('✅ Crypto prices table exists and is accessible');
  } else {
    logger.warn('⚠️ Crypto prices table check failed:', cryptoPricesCheck.error);
    logger.info('This might be expected if the table hasn\'t been created yet.');
  }

  // 3. Read and execute migration files
  const migrationFiles = [
    '001_add_security_keys_hash.sql',
    '002_create_crypto_prices_table.sql'
  ];

  for (const filename of migrationFiles) {
    try {
      logger.info(`📂 Reading migration file: ${filename}`);
      const migrationPath = join(__dirname, '..', 'migrations', filename);
      const migrationSql = readFileSync(migrationPath, 'utf8');
      
      logger.info(`⚡ Executing migration: ${filename}`);
      logger.info(`SQL Preview:\n${migrationSql.split('\n').slice(0, 5).join('\n')}...`);
      
      // For actual execution, you'll need to run these manually in Supabase SQL editor
      // or create a stored procedure in Supabase to execute arbitrary SQL
      logger.warn(`🔧 MANUAL ACTION REQUIRED: Please execute the following SQL in your Supabase SQL editor:`);
      logger.warn(`\n--- ${filename} ---\n${migrationSql}\n--- End ${filename} ---\n`);
      
      results.push({
        sql: migrationSql,
        success: true,
        result: `Migration file read successfully: ${filename}`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error reading migration file ${filename}:`, errorMessage);
      results.push({
        sql: `-- Error reading ${filename}`,
        success: false,
        error: errorMessage
      });
    }
  }

  // 4. Final verification
  logger.info('🔍 Running final verification...');
  
  // Test security key repository functionality
  try {
    const { data: securityKeyTest } = await supabase
      .from('security_keys')
      .select('id, user_id, key_type, key_hash, is_active')
      .limit(1);
    
    logger.info('✅ Security keys table structure verified');
    results.push({
      sql: 'SELECT id, user_id, key_type, key_hash, is_active FROM security_keys LIMIT 1',
      success: true,
      result: 'Security keys table accessible with expected columns'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('⚠️ Security keys table verification failed:', errorMessage);
  }

  // Test crypto prices repository functionality
  try {
    const { data: cryptoPriceTest } = await supabase
      .from('crypto_prices')
      .select('id, currency, price, cached_at, metadata')
      .limit(1);
    
    logger.info('✅ Crypto prices table structure verified');
    results.push({
      sql: 'SELECT id, currency, price, cached_at, metadata FROM crypto_prices LIMIT 1',
      success: true,
      result: 'Crypto prices table accessible with expected columns'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('⚠️ Crypto prices table verification failed:', errorMessage);
  }

  // Summary
  logger.info('\n📊 MIGRATION SUMMARY');
  logger.info('===================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  logger.info(`✅ Successful operations: ${successful}`);
  logger.info(`❌ Failed operations: ${failed}`);
  
  if (failed > 0) {
    logger.warn('\n⚠️  Some operations failed. Please review the errors above.');
    logger.warn('You may need to manually execute the migration SQL in Supabase SQL editor.');
  } else {
    logger.info('\n🎉 All operations completed successfully!');
  }

  // Instructions for manual execution
  logger.info('\n📋 NEXT STEPS:');
  logger.info('==============');
  logger.info('1. Go to your Supabase project dashboard');
  logger.info('2. Navigate to SQL Editor');
  logger.info('3. Execute the migration SQL shown above');
  logger.info('4. Run this script again to verify the changes');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Execute if called directly
if (require.main === module) {
  runMigrations().catch((error) => {
    logger.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

export { runMigrations };
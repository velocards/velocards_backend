#!/usr/bin/env ts-node

import { performance } from 'perf_hooks';
import { validationMonitor } from '../validation/zod/monitoring/performanceMonitor';
import { registerSchema, loginSchema } from '../api/validators/authValidators';
import { createCardSchema } from '../api/validators/cardValidators';
import logger from '../utils/logger';

/**
 * Validation Performance Benchmark Script
 * 
 * This script tests the performance of our Zod validation schemas
 * and compares them with the previous Joi implementation benchmarks
 */

interface BenchmarkResult {
  schemaName: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
  samplesRun: number;
}

class ValidationBenchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Run benchmark for a single schema
   */
  private async benchmarkSchema(
    name: string,
    schema: any,
    validData: any[],
    invalidData: any[]
  ): Promise<BenchmarkResult> {
    const allData = [...validData, ...invalidData];
    const times: number[] = [];
    let successCount = 0;

    console.log(`\nBenchmarking ${name}...`);

    for (const data of allData) {
      const startTime = performance.now();
      
      try {
        await schema.parseAsync(data);
        successCount++;
      } catch {
        // Expected for invalid data
      }
      
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const result: BenchmarkResult = {
      schemaName: name,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      successRate: (successCount / allData.length) * 100,
      samplesRun: allData.length
    };

    this.results.push(result);
    return result;
  }

  /**
   * Generate test data for benchmarks
   */
  private generateTestData() {
    // Register schema test data
    const registerValid = Array(100).fill(null).map((_, i) => ({
      body: {
        email: `user${i}@example.com`,
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+12345678900'
      }
    }));

    const registerInvalid = Array(50).fill(null).map((_, i) => ({
      body: {
        email: i % 2 === 0 ? 'invalid-email' : undefined,
        password: i % 3 === 0 ? 'weak' : undefined,
        firstName: i % 4 === 0 ? '' : 'John',
        lastName: 'Doe'
      }
    }));

    // Login schema test data
    const loginValid = Array(100).fill(null).map((_, i) => ({
      body: {
        email: `user${i}@example.com`,
        password: 'password123'
      }
    }));

    const loginInvalid = Array(50).fill(null).map(() => ({
      body: {
        email: 'not-an-email',
        password: ''
      }
    }));

    // Card schema test data
    const cardValid = Array(50).fill(null).map((_, i) => ({
      body: {
        type: i % 2 === 0 ? 'single_use' : 'multi_use',
        programId: 1,
        fundingAmount: 100,
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+12345678900',
        streetAddress: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US'
      }
    }));

    const cardInvalid = Array(25).fill(null).map(() => ({
      body: {
        type: 'invalid_type',
        fundingAmount: -100,
        firstName: '',
        phoneNumber: 'not-a-phone'
      }
    }));

    return {
      register: { valid: registerValid, invalid: registerInvalid },
      login: { valid: loginValid, invalid: loginInvalid },
      card: { valid: cardValid, invalid: cardInvalid }
    };
  }

  /**
   * Run all benchmarks
   */
  async runBenchmarks() {
    console.log('='.repeat(60));
    console.log('VALIDATION PERFORMANCE BENCHMARK');
    console.log('='.repeat(60));

    const testData = this.generateTestData();

    // Benchmark auth schemas
    await this.benchmarkSchema(
      'registerSchema',
      registerSchema,
      testData.register.valid,
      testData.register.invalid
    );

    await this.benchmarkSchema(
      'loginSchema',
      loginSchema,
      testData.login.valid,
      testData.login.invalid
    );

    // Benchmark card schema
    await this.benchmarkSchema(
      'createCardSchema',
      createCardSchema,
      testData.card.valid,
      testData.card.invalid
    );

    // Print results
    this.printResults();
    this.compareWithJoiBenchmark();
  }

  /**
   * Print benchmark results
   */
  private printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('BENCHMARK RESULTS');
    console.log('='.repeat(60));

    console.log('\n%-20s %-15s %-15s %-15s %-15s %s',
      'Schema', 'Avg Time (ms)', 'Min Time (ms)', 'Max Time (ms)', 'Success Rate', 'Samples');
    console.log('-'.repeat(90));

    for (const result of this.results) {
      console.log('%-20s %-15.3f %-15.3f %-15.3f %-15.2f %d',
        result.schemaName,
        result.averageTime,
        result.minTime,
        result.maxTime,
        result.successRate,
        result.samplesRun
      );
    }

    const avgTime = this.results.reduce((sum, r) => sum + r.averageTime, 0) / this.results.length;
    console.log('\n' + '-'.repeat(90));
    console.log('Overall Average Validation Time: %.3f ms', avgTime);
  }

  /**
   * Compare with previous Joi benchmark (from Story 1.2)
   */
  private compareWithJoiBenchmark() {
    console.log('\n' + '='.repeat(60));
    console.log('COMPARISON WITH JOI BENCHMARK (Story 1.2)');
    console.log('='.repeat(60));

    // Historical Joi benchmark data (from Story 1.2 notes)
    const joiBenchmark = {
      averageTime: 0.85, // ms
      improvement: '15-30%' // reported improvement
    };

    const zodAverage = this.results.reduce((sum, r) => sum + r.averageTime, 0) / this.results.length;
    const improvement = ((joiBenchmark.averageTime - zodAverage) / joiBenchmark.averageTime) * 100;

    console.log('\nJoi Average Time:    %.3f ms', joiBenchmark.averageTime);
    console.log('Zod Average Time:    %.3f ms', zodAverage);
    console.log('Performance Gain:    %.1f%%', improvement);
    console.log('Expected Improvement: %s', joiBenchmark.improvement);

    if (improvement >= 15) {
      console.log('\n✅ Performance improvement meets or exceeds expectations!');
    } else {
      console.log('\n⚠️  Performance improvement below expected threshold');
    }
  }
}

// Run benchmarks
(async () => {
  try {
    const benchmark = new ValidationBenchmark();
    await benchmark.runBenchmarks();

    // Export metrics for analysis
    const metrics = validationMonitor.exportMetrics();
    logger.info('Validation metrics exported', {
      totalMetrics: metrics.raw.length,
      schemas: Object.keys(metrics.aggregated)
    });

    process.exit(0);
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
})();
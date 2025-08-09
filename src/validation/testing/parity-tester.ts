import { ZodSchema } from 'zod';
import Joi from 'joi';

export interface ValidationResult {
  isValid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  value?: any;
}

export interface ParityTestResult {
  input: any;
  zodResult: ValidationResult;
  joiResult: ValidationResult;
  isEquivalent: boolean;
  discrepancies?: Array<{
    type: 'validity' | 'error_message' | 'error_path' | 'value';
    description: string;
    zodValue: any;
    joiValue: any;
  }>;
}

export interface ParityTestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: ParityTestResult[];
  summary: {
    validityMismatches: number;
    errorMessageMismatches: number;
    errorPathMismatches: number;
    valueMismatches: number;
  };
}

export class ParityTester {
  /**
   * Validates data using Zod schema
   */
  private validateWithZod(schema: ZodSchema, data: any): ValidationResult {
    try {
      const result = schema.parse(data);
      return {
        isValid: true,
        value: result
      };
    } catch (error: any) {
      const errors = error.errors?.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message
      })) || [];
      
      return {
        isValid: false,
        errors
      };
    }
  }

  /**
   * Validates data using Joi schema
   */
  private validateWithJoi(schema: Joi.Schema, data: any): ValidationResult {
    const result = schema.validate(data, { 
      abortEarly: false,
      stripUnknown: false,
      convert: true
    });

    if (result.error) {
      const errors = result.error.details.map(detail => ({
        path: detail.path.join('.'),
        message: detail.message
      }));

      return {
        isValid: false,
        errors
      };
    }

    return {
      isValid: true,
      value: result.value
    };
  }

  /**
   * Compare two validation results for equivalence
   */
  private compareResults(
    input: any,
    zodResult: ValidationResult,
    joiResult: ValidationResult
  ): ParityTestResult {
    const discrepancies: NonNullable<ParityTestResult['discrepancies']> = [];

    // Check validity match
    if (zodResult.isValid !== joiResult.isValid) {
      discrepancies.push({
        type: 'validity',
        description: 'Validation results differ in validity',
        zodValue: zodResult.isValid,
        joiValue: joiResult.isValid
      });
    }

    // Compare errors if both have them
    if (zodResult.errors && joiResult.errors) {
      const zodErrorMap = new Map(
        zodResult.errors.map(e => [e.path || 'root', e.message])
      );
      const joiErrorMap = new Map(
        joiResult.errors.map(e => [e.path || 'root', e.message])
      );

      // Check for path mismatches
      const allPaths = new Set([...zodErrorMap.keys(), ...joiErrorMap.keys()]);
      for (const path of allPaths) {
        if (zodErrorMap.has(path) && !joiErrorMap.has(path)) {
          discrepancies.push({
            type: 'error_path',
            description: `Zod has error at path "${path}" but Joi doesn't`,
            zodValue: zodErrorMap.get(path),
            joiValue: undefined
          });
        } else if (!zodErrorMap.has(path) && joiErrorMap.has(path)) {
          discrepancies.push({
            type: 'error_path',
            description: `Joi has error at path "${path}" but Zod doesn't`,
            zodValue: undefined,
            joiValue: joiErrorMap.get(path)
          });
        } else if (zodErrorMap.get(path) !== joiErrorMap.get(path)) {
          // Different error messages for same path
          discrepancies.push({
            type: 'error_message',
            description: `Different error messages at path "${path}"`,
            zodValue: zodErrorMap.get(path),
            joiValue: joiErrorMap.get(path)
          });
        }
      }
    }

    // Compare values if both are valid
    if (zodResult.isValid && joiResult.isValid && zodResult.value && joiResult.value) {
      const zodJson = JSON.stringify(zodResult.value, null, 2);
      const joiJson = JSON.stringify(joiResult.value, null, 2);
      
      if (zodJson !== joiJson) {
        discrepancies.push({
          type: 'value',
          description: 'Transformed values differ',
          zodValue: zodResult.value,
          joiValue: joiResult.value
        });
      }
    }

    const result: ParityTestResult = {
      input,
      zodResult,
      joiResult,
      isEquivalent: discrepancies.length === 0
    };
    
    if (discrepancies.length > 0) {
      result.discrepancies = discrepancies;
    }
    
    return result;
  }

  /**
   * Test a single input against both schemas
   */
  public testSingle(
    zodSchema: ZodSchema,
    joiSchema: Joi.Schema,
    input: any
  ): ParityTestResult {
    const zodResult = this.validateWithZod(zodSchema, input);
    const joiResult = this.validateWithJoi(joiSchema, input);
    
    return this.compareResults(input, zodResult, joiResult);
  }

  /**
   * Test multiple inputs against both schemas
   */
  public testMultiple(
    zodSchema: ZodSchema,
    joiSchema: Joi.Schema,
    inputs: any[]
  ): ParityTestReport {
    const results: ParityTestResult[] = [];
    const summary = {
      validityMismatches: 0,
      errorMessageMismatches: 0,
      errorPathMismatches: 0,
      valueMismatches: 0
    };

    for (const input of inputs) {
      const result = this.testSingle(zodSchema, joiSchema, input);
      results.push(result);

      if (result.discrepancies) {
        for (const discrepancy of result.discrepancies) {
          switch (discrepancy.type) {
            case 'validity':
              summary.validityMismatches++;
              break;
            case 'error_message':
              summary.errorMessageMismatches++;
              break;
            case 'error_path':
              summary.errorPathMismatches++;
              break;
            case 'value':
              summary.valueMismatches++;
              break;
          }
        }
      }
    }

    const passedTests = results.filter(r => r.isEquivalent).length;

    return {
      totalTests: inputs.length,
      passedTests,
      failedTests: inputs.length - passedTests,
      results,
      summary
    };
  }

  /**
   * Generate a detailed report of discrepancies
   */
  public generateReport(report: ParityTestReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('VALIDATION PARITY TEST REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    
    lines.push('SUMMARY:');
    lines.push(`  Total Tests: ${report.totalTests}`);
    lines.push(`  Passed: ${report.passedTests} (${(report.passedTests / report.totalTests * 100).toFixed(1)}%)`);
    lines.push(`  Failed: ${report.failedTests} (${(report.failedTests / report.totalTests * 100).toFixed(1)}%)`);
    lines.push('');
    
    lines.push('DISCREPANCY TYPES:');
    lines.push(`  Validity Mismatches: ${report.summary.validityMismatches}`);
    lines.push(`  Error Message Mismatches: ${report.summary.errorMessageMismatches}`);
    lines.push(`  Error Path Mismatches: ${report.summary.errorPathMismatches}`);
    lines.push(`  Value Mismatches: ${report.summary.valueMismatches}`);
    lines.push('');
    
    if (report.failedTests > 0) {
      lines.push('FAILED TEST DETAILS:');
      lines.push('-'.repeat(80));
      
      report.results
        .filter(r => !r.isEquivalent)
        .forEach((result, index) => {
          lines.push(`\nTest ${index + 1}:`);
          lines.push(`Input: ${JSON.stringify(result.input, null, 2)}`);
          lines.push('');
          
          if (result.discrepancies) {
            lines.push('Discrepancies:');
            result.discrepancies.forEach(d => {
              lines.push(`  - Type: ${d.type}`);
              lines.push(`    Description: ${d.description}`);
              lines.push(`    Zod: ${JSON.stringify(d.zodValue)}`);
              lines.push(`    Joi: ${JSON.stringify(d.joiValue)}`);
            });
          }
        });
    }
    
    lines.push('');
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }
}

// Export singleton instance
export const parityTester = new ParityTester();
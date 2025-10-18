#!/usr/bin/env node

/**
 * Validation Script for File Upload Fix
 * Verifies that the browser testing file upload issue has been resolved
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'https://123ad-performance.launchpulse.ai';

class FileUploadValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    console.log(`[${timestamp}] ${emoji} ${message}`);
  }

  test(name, fn) {
    try {
      fn();
      this.results.passed.push(name);
      this.log('success', name);
      return true;
    } catch (error) {
      this.results.failed.push({ name, error: error.message });
      this.log('error', `${name}: ${error.message}`);
      return false;
    }
  }

  async runValidation() {
    console.log('\n='.repeat(80));
    console.log('FILE UPLOAD FIX VALIDATION');
    console.log('='.repeat(80) + '\n');

    // Test 1: Check if dummy_upload.csv exists in root
    this.test('Test 1: dummy_upload.csv exists in /app', () => {
      const filePath = '/app/dummy_upload.csv';
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
    });

    // Test 2: Check if dummy_upload.csv exists in backend/public
    this.test('Test 2: dummy_upload.csv exists in /app/backend/public', () => {
      const filePath = '/app/backend/public/dummy_upload.csv';
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
    });

    // Test 3: Verify file content is valid CSV
    this.test('Test 3: dummy_upload.csv contains valid CSV data', () => {
      const filePath = '/app/dummy_upload.csv';
      const content = fs.readFileSync(filePath, 'utf8');
      
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header and one data row');
      }
      
      const header = lines[0];
      const expectedColumns = ['campaign_name', 'impressions', 'clicks', 'spend', 'conversions', 'date'];
      
      for (const col of expectedColumns) {
        if (!header.includes(col)) {
          throw new Error(`Missing expected column: ${col}`);
        }
      }
    });

    // Test 4: Check if file is accessible via HTTP
    await this.test('Test 4: dummy_upload.csv is accessible via HTTP', async () => {
      try {
        const response = await axios.get(`${BASE_URL}/dummy_upload.csv`, {
          timeout: 10000,
          validateStatus: (status) => status === 200
        });
        
        if (!response.data) {
          throw new Error('No data received from HTTP request');
        }
        
        if (typeof response.data === 'string' && response.data.includes('campaign_name')) {
          // Success
        } else {
          throw new Error('Response does not contain expected CSV data');
        }
      } catch (error) {
        if (error.response?.status === 404) {
          throw new Error('File not found via HTTP (404)');
        }
        throw error;
      }
    });

    // Test 5: Verify upload wizard route exists
    await this.test('Test 5: Upload wizard route is accessible', async () => {
      try {
        const response = await axios.get(`${BASE_URL}/`, {
          timeout: 10000,
          headers: { 'Accept': 'text/html' }
        });
        
        if (response.status !== 200) {
          throw new Error(`Unexpected status: ${response.status}`);
        }
      } catch (error) {
        throw new Error(`Failed to access upload wizard: ${error.message}`);
      }
    });

    // Test 6: Check UV_UploadWizard.tsx has been updated
    this.test('Test 6: UV_UploadWizard.tsx contains improved file input', () => {
      const filePath = '/app/vitereact/src/components/views/UV_UploadWizard.tsx';
      if (!fs.existsSync(filePath)) {
        throw new Error('UV_UploadWizard.tsx not found');
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for the improved file input
      if (!content.includes('opacity-0')) {
        throw new Error('File input does not have opacity-0 class');
      }
      
      if (!content.includes('cursor-pointer')) {
        throw new Error('File input does not have cursor-pointer class');
      }
      
      if (!content.includes('absolute inset-0')) {
        throw new Error('File input is not positioned absolutely');
      }
    });

    // Test 7: Verify test helper functions exist
    this.test('Test 7: Test helper functions are defined in UV_UploadWizard.tsx', () => {
      const filePath = '/app/vitereact/src/components/views/UV_UploadWizard.tsx';
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (!content.includes('__testHelpers')) {
        throw new Error('__testHelpers not found');
      }
      
      if (!content.includes('selectTestFile')) {
        throw new Error('selectTestFile helper not found');
      }
      
      if (!content.includes('getCurrentStep')) {
        throw new Error('getCurrentStep helper not found');
      }
      
      if (!content.includes('hasValidFiles')) {
        throw new Error('hasValidFiles helper not found');
      }
    });

    // Test 8: Verify file input element IDs
    this.test('Test 8: File input has correct IDs and attributes', () => {
      const filePath = '/app/vitereact/src/components/views/UV_UploadWizard.tsx';
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (!content.includes('id="file-upload-input"')) {
        throw new Error('File input missing id="file-upload-input"');
      }
      
      if (!content.includes('data-testid="file-upload-input"')) {
        throw new Error('File input missing data-testid');
      }
      
      if (!content.includes('accept=".csv,.xlsx"')) {
        throw new Error('File input missing accept attribute');
      }
    });

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.results.passed.length + this.results.failed.length}`);
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
    
    if (this.results.failed.length > 0) {
      console.log('\nFailed Tests:');
      this.results.failed.forEach(({ name, error }) => {
        console.log(`  - ${name}`);
        console.log(`    Error: ${error}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (this.results.failed.length === 0) {
      console.log('✅ ALL VALIDATIONS PASSED!');
      console.log('\nThe file upload fix has been successfully implemented.');
      console.log('\nNext Steps:');
      console.log('1. Re-run browser tests with the updated file path: /app/dummy_upload.csv');
      console.log('2. Or use the HTTP URL: ' + BASE_URL + '/dummy_upload.csv');
      console.log('3. Refer to BROWSER_TESTING_FILE_UPLOAD_SOLUTION.md for detailed testing instructions');
    } else {
      console.log('❌ SOME VALIDATIONS FAILED');
      console.log('\nPlease review the failed tests above and fix any issues.');
    }
    
    console.log('='.repeat(80) + '\n');
    
    return this.results.failed.length === 0;
  }
}

// Run validation
async function main() {
  const validator = new FileUploadValidator();
  const success = await validator.runValidation();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(2);
  });
}

module.exports = FileUploadValidator;

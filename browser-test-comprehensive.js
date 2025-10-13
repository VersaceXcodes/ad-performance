#!/usr/bin/env node

/**
 * Comprehensive Browser Testing Validation Script
 * Tests all aspects of the application that could cause browser testing failures
 */

const axios = require('axios');

const BASE_URL = 'https://123ad-performance.launchpulse.ai';
const TIMEOUT = 30000;

// Configure axios for testing
axios.defaults.timeout = TIMEOUT;
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.common['Content-Type'] = 'application/json';
axios.defaults.headers.common['X-Browser-Test'] = 'true';
axios.defaults.headers.common['X-Test-Mode'] = 'browser-testing';
axios.defaults.headers.common['X-Automation'] = 'true';
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/91.0.4472.124 Safari/537.36';

class BrowserTestValidator {
  constructor() {
    this.results = {
      total_tests: 0,
      passed_tests: 0,
      failed_tests: 0,
      warnings: 0,
      test_results: [],
      recommendations: []
    };
    this.startTime = Date.now();
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    console.log(logEntry);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async runTest(name, testFn) {
    this.results.total_tests++;
    this.log('info', `Running test: ${name}`);
    
    try {
      const startTime = Date.now();
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.passed_tests++;
      this.results.test_results.push({
        name,
        status: 'PASS',
        duration_ms: duration,
        message: result.message || 'Test passed',
        details: result.details || null
      });
      
      this.log('info', `✅ ${name} - PASSED (${duration}ms)`);
      return true;
      
    } catch (error) {
      const duration = Date.now() - this.startTime;
      this.results.failed_tests++;
      this.results.test_results.push({
        name,
        status: 'FAIL',
        duration_ms: duration,
        error: error.message,
        details: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null
      });
      
      this.log('error', `❌ ${name} - FAILED`, { error: error.message });
      return false;
    }
  }

  async testBasicConnectivity() {
    return this.runTest('Basic Connectivity', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      
      if (!response.data) {
        throw new Error('No response data received');
      }
      
      if (response.data.status !== 'healthy') {
        throw new Error(`Health check failed: ${response.data.status}`);
      }
      
      return {
        message: 'Server is responding and healthy',
        details: {
          status: response.data.status,
          response_time: response.data.response_time_ms,
          database: response.data.database
        }
      };
    });
  }

  async testAPIEndpoints() {
    return this.runTest('API Endpoints', async () => {
      const endpoints = [
        '/api/health',
        '/api/status',
        '/api/debug',
        '/api/test/connectivity',
        '/api/test/browser'
      ];
      
      const results = {};
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(`${BASE_URL}${endpoint}`);
          results[endpoint] = {
            status: response.status,
            success: response.data?.success !== false,
            response_time: response.headers['x-response-time'] || 'unknown'
          };
        } catch (error) {
          results[endpoint] = {
            status: error.response?.status || 'ERROR',
            success: false,
            error: error.message
          };
        }
      }
      
      const failedEndpoints = Object.entries(results).filter(([_, result]) => !result.success);
      if (failedEndpoints.length > 0) {
        throw new Error(`Failed endpoints: ${failedEndpoints.map(([endpoint]) => endpoint).join(', ')}`);
      }
      
      return {
        message: `All ${endpoints.length} API endpoints are working`,
        details: results
      };
    });
  }

  async testCORSHeaders() {
    return this.runTest('CORS Headers', async () => {
      const response = await axios.options(`${BASE_URL}/api/health`, {
        headers: {
          'Origin': 'https://browser-test.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
      });
      
      const corsHeaders = {
        'access-control-allow-origin': response.headers['access-control-allow-origin'],
        'access-control-allow-methods': response.headers['access-control-allow-methods'],
        'access-control-allow-headers': response.headers['access-control-allow-headers'],
        'access-control-allow-credentials': response.headers['access-control-allow-credentials']
      };
      
      if (!corsHeaders['access-control-allow-origin']) {
        throw new Error('Missing Access-Control-Allow-Origin header');
      }
      
      return {
        message: 'CORS headers are properly configured',
        details: corsHeaders
      };
    });
  }

  async testStaticFileServing() {
    return this.runTest('Static File Serving', async () => {
      const response = await axios.get(`${BASE_URL}/`, {
        headers: { 'Accept': 'text/html' },
        timeout: 15000
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      if (!response.data.includes('<!doctype html>')) {
        throw new Error('Response does not appear to be HTML');
      }
      
      if (!response.data.includes('Vite + React') && !response.data.includes('PulseDeck')) {
        this.results.warnings++;
        this.results.recommendations.push('Frontend title may not be properly configured');
      }
      
      return {
        message: 'Static files are being served correctly',
        details: {
          content_type: response.headers['content-type'],
          content_length: response.headers['content-length'],
          has_scripts: response.data.includes('<script'),
          has_stylesheets: response.data.includes('<link rel="stylesheet"')
        }
      };
    });
  }

  async testAuthenticationEndpoints() {
    return this.runTest('Authentication Endpoints', async () => {
      // Test invalid login (should return 400, not 500)
      try {
        await axios.post(`${BASE_URL}/api/auth/login`, {
          email: 'nonexistent@test.com',
          password: 'wrongpassword'
        });
        throw new Error('Login should have failed');
      } catch (error) {
        if (error.response?.status !== 400) {
          throw new Error(`Unexpected login error status: ${error.response?.status || 'unknown'}`);
        }
        
        if (!error.response.data || typeof error.response.data !== 'object') {
          throw new Error('Login error response is not JSON');
        }
      }
      
      // Test registration validation
      try {
        await axios.post(`${BASE_URL}/api/auth/register`, {
          email: 'invalid-email',
          password: 'short',
          name: ''
        });
        throw new Error('Registration should have failed validation');
      } catch (error) {
        if (error.response?.status !== 400) {
          throw new Error(`Unexpected registration error status: ${error.response?.status || 'unknown'}`);
        }
      }
      
      return {
        message: 'Authentication endpoints handle errors correctly',
        details: {
          login_endpoint: 'Returns proper error responses',
          register_endpoint: 'Validates input correctly'
        }
      };
    });
  }

  async testDatabaseConnectivity() {
    return this.runTest('Database Connectivity', async () => {
      const response = await axios.get(`${BASE_URL}/api/test/browser`);
      
      if (!response.data?.tests?.database_connection) {
        throw new Error('Database test not found in browser test response');
      }
      
      const dbTest = response.data.tests.database_connection;
      if (dbTest.status !== 'pass') {
        throw new Error(`Database test failed: ${dbTest.message}`);
      }
      
      return {
        message: 'Database is connected and responding',
        details: {
          status: dbTest.status,
          message: dbTest.message,
          query_time: dbTest.details?.query_time_ms
        }
      };
    });
  }

  async testErrorHandling() {
    return this.runTest('Error Handling', async () => {
      // Test 404 endpoint
      try {
        await axios.get(`${BASE_URL}/api/nonexistent-endpoint`);
        throw new Error('404 endpoint should have failed');
      } catch (error) {
        if (error.response?.status !== 404) {
          throw new Error(`Expected 404, got: ${error.response?.status || 'unknown'}`);
        }
        
        // Should still return JSON
        if (!error.response.data || typeof error.response.data !== 'object') {
          throw new Error('404 response is not JSON');
        }
      }
      
      return {
        message: 'Error handling returns proper JSON responses',
        details: {
          '404_handling': 'Returns JSON error response',
          'content_type': 'application/json'
        }
      };
    });
  }

  async testBrowserSpecificFeatures() {
    return this.runTest('Browser-Specific Features', async () => {
      const response = await axios.get(`${BASE_URL}/api/test/browser`);
      
      if (!response.data.browser_test_mode) {
        throw new Error('Browser test mode not detected');
      }
      
      // Check for browser test headers
      if (!response.headers['x-browser-test']) {
        this.results.warnings++;
        this.results.recommendations.push('Consider adding browser test identification headers');
      }
      
      const tests = response.data.tests || {};
      const failedTests = Object.entries(tests).filter(([_, test]) => test.status === 'fail');
      
      if (failedTests.length > 0) {
        throw new Error(`Browser tests failed: ${failedTests.map(([name]) => name).join(', ')}`);
      }
      
      return {
        message: 'Browser-specific features are working correctly',
        details: {
          browser_test_mode: response.data.browser_test_mode,
          test_results: Object.keys(tests).length,
          server_detection: response.headers['x-browser-test'] || 'not detected'
        }
      };
    });
  }

  async testPerformance() {
    return this.runTest('Performance', async () => {
      const testUrls = [
        `${BASE_URL}/health`,
        `${BASE_URL}/api/health`,
        `${BASE_URL}/api/status`
      ];
      
      const performanceResults = {};
      
      for (const url of testUrls) {
        const startTime = Date.now();
        const response = await axios.get(url);
        const duration = Date.now() - startTime;
        
        performanceResults[url] = {
          response_time_ms: duration,
          status: response.status,
          content_length: response.headers['content-length'] || 'unknown'
        };
        
        if (duration > 5000) {
          this.results.warnings++;
          this.results.recommendations.push(`${url} is responding slowly (${duration}ms)`);
        }
      }
      
      const avgResponseTime = Object.values(performanceResults)
        .reduce((sum, result) => sum + result.response_time_ms, 0) / testUrls.length;
      
      return {
        message: `Average response time: ${Math.round(avgResponseTime)}ms`,
        details: performanceResults
      };
    });
  }

  async runAllTests() {
    this.log('info', 'Starting comprehensive browser testing validation');
    this.log('info', `Target URL: ${BASE_URL}`);
    
    // Run all tests
    await this.testBasicConnectivity();
    await this.testAPIEndpoints();
    await this.testCORSHeaders();
    await this.testStaticFileServing();
    await this.testAuthenticationEndpoints();
    await this.testDatabaseConnectivity();
    await this.testErrorHandling();
    await this.testBrowserSpecificFeatures();
    await this.testPerformance();
    
    // Generate summary
    const duration = Date.now() - this.startTime;
    
    this.log('info', '='.repeat(80));
    this.log('info', 'TEST SUMMARY');
    this.log('info', '='.repeat(80));
    this.log('info', `Total Tests: ${this.results.total_tests}`);
    this.log('info', `Passed: ${this.results.passed_tests}`);
    this.log('info', `Failed: ${this.results.failed_tests}`);
    this.log('info', `Warnings: ${this.results.warnings}`);
    this.log('info', `Duration: ${duration}ms`);
    
    if (this.results.failed_tests > 0) {
      this.log('error', '\nFAILED TESTS:');
      this.results.test_results
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          this.log('error', `  - ${test.name}: ${test.error}`);
        });
    }
    
    if (this.results.recommendations.length > 0) {
      this.log('info', '\nRECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, i) => {
        this.log('info', `  ${i + 1}. ${rec}`);
      });
    }
    
    const success = this.results.failed_tests === 0;
    this.log(success ? 'info' : 'error', 
      success ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
    );
    
    // Return detailed results
    return {
      success,
      summary: this.results,
      duration_ms: duration
    };
  }
}

// Run the tests
async function main() {
  const validator = new BrowserTestValidator();
  
  try {
    const results = await validator.runAllTests();
    
    // Write results to file
    const fs = require('fs');
    const resultsFile = '/app/browser-test-results.json';
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\nDetailed results written to: ${resultsFile}`);
    
    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);
    
  } catch (error) {
    console.error('Critical error during testing:', error.message);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

module.exports = BrowserTestValidator;
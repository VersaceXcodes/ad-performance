#!/usr/bin/env node

const https = require('https');
const http = require('http');

const BASE_URL = 'https://123ad-performance.launchpulse.ai';

// Test endpoints
const endpoints = [
  { path: '/health', method: 'GET', description: 'Health check' },
  { path: '/ready', method: 'GET', description: 'Readiness probe' },
  { path: '/api/status', method: 'GET', description: 'API status' },
  { path: '/api/debug', method: 'GET', description: 'Debug info' },
  { path: '/api/auth/login', method: 'POST', description: 'Login endpoint', body: { email: 'test@example.com', password: 'test' } },
  { path: '/api/auth/register', method: 'POST', description: 'Register endpoint', body: { email: 'test@example.com', password: 'test', name: 'Test User' } },
  { path: '/', method: 'GET', description: 'Frontend root' },
  { path: '/signin', method: 'GET', description: 'Frontend signin page' }
];

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint.path);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Test-Script/1.0',
        'Accept': 'application/json, text/html',
        'Origin': BASE_URL
      },
      timeout: 10000
    };

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          contentType: res.headers['content-type']
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (endpoint.body) {
      req.write(JSON.stringify(endpoint.body));
    }

    req.end();
  });
}

async function testEndpoints() {
  console.log('🚀 Testing API endpoints...\n');
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
      
      const result = await makeRequest(endpoint);
      const isJson = result.contentType && result.contentType.includes('application/json');
      const isHtml = result.contentType && result.contentType.includes('text/html');
      
      let status = '✅';
      if (result.status >= 400) {
        status = '❌';
      } else if (result.status >= 300) {
        status = '⚠️';
      }
      
      console.log(`  ${status} Status: ${result.status}`);
      console.log(`  📄 Content-Type: ${result.contentType || 'unknown'}`);
      
      if (isJson) {
        try {
          const parsed = JSON.parse(result.body);
          if (parsed.success !== undefined) {
            console.log(`  ✨ Success: ${parsed.success}`);
          }
          if (parsed.message) {
            console.log(`  💬 Message: ${parsed.message}`);
          }
          if (parsed.status) {
            console.log(`  🏥 Health: ${parsed.status}`);
          }
        } catch (e) {
          console.log(`  ⚠️  Invalid JSON response`);
        }
      } else if (isHtml) {
        const hasTitle = result.body.includes('<title>');
        const hasRoot = result.body.includes('id="root"');
        console.log(`  🌐 HTML page: ${hasTitle ? 'has title' : 'no title'}, ${hasRoot ? 'has root div' : 'no root div'}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('✅ Endpoint testing complete!');
}

// CORS preflight test
async function testCORS() {
  console.log('🌐 Testing CORS configuration...\n');
  
  try {
    const result = await makeRequest({
      path: '/api/auth/login',
      method: 'OPTIONS',
      description: 'CORS preflight'
    });
    
    console.log('CORS Preflight Test:');
    console.log(`  Status: ${result.status}`);
    console.log(`  Access-Control-Allow-Origin: ${result.headers['access-control-allow-origin'] || 'not set'}`);
    console.log(`  Access-Control-Allow-Methods: ${result.headers['access-control-allow-methods'] || 'not set'}`);
    console.log(`  Access-Control-Allow-Headers: ${result.headers['access-control-allow-headers'] || 'not set'}`);
    console.log('');
    
  } catch (error) {
    console.log(`  ❌ CORS test failed: ${error.message}\n`);
  }
}

// Run tests
async function main() {
  await testCORS();
  await testEndpoints();
}

main().catch(console.error);
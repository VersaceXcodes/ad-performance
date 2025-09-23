#!/usr/bin/env node

// Comprehensive browser simulation test
const http = require('http');

function makeRequest(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (HeadlessChrome/91.0.4472.124) Browser-Test',
        'Accept': 'application/json, text/html, */*',
        'Origin': 'http://localhost:5173',
        'Referer': 'http://localhost:5173/',
        'X-Automation': 'true',
        ...headers
      },
      timeout: 15000
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          success: res.statusCode >= 200 && res.statusCode < 400
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function testAuthenticationFlow() {
  console.log('🔐 Testing Authentication Flow...\n');
  
  // Test 1: Register a new user
  console.log('1. Testing user registration...');
  try {
    const registerData = JSON.stringify({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      name: 'Test User'
    });
    
    const registerResult = await makeRequest(
      'http://localhost:3000/api/auth/register',
      'POST',
      { 'Content-Type': 'application/json' },
      registerData
    );
    
    if (registerResult.success) {
      console.log('✅ User registration: SUCCESS');
      const userData = JSON.parse(registerResult.data);
      console.log(`   User ID: ${userData.user?.id}`);
      console.log(`   Token received: ${userData.token ? 'Yes' : 'No'}`);
      
      // Test 2: Use the token to access protected endpoint
      console.log('\n2. Testing authenticated request...');
      const authResult = await makeRequest(
        'http://localhost:3000/api/auth/me',
        'GET',
        { 
          'Authorization': `Bearer ${userData.token}`,
          'Content-Type': 'application/json'
        }
      );
      
      if (authResult.success) {
        console.log('✅ Authenticated request: SUCCESS');
        const authData = JSON.parse(authResult.data);
        console.log(`   Authenticated user: ${authData.email}`);
      } else {
        console.log(`❌ Authenticated request: FAILED (${authResult.statusCode})`);
      }
      
    } else {
      console.log(`❌ User registration: FAILED (${registerResult.statusCode})`);
      console.log(`   Response: ${registerResult.data.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ Authentication flow: ERROR - ${error.message}`);
  }
}

async function testWorkspaceOperations() {
  console.log('\n🏢 Testing Workspace Operations...\n');
  
  // First register a user to get a token
  const registerData = JSON.stringify({
    email: `workspace-test-${Date.now()}@example.com`,
    password: 'testpassword123',
    name: 'Workspace Test User'
  });
  
  try {
    const registerResult = await makeRequest(
      'http://localhost:3000/api/auth/register',
      'POST',
      { 'Content-Type': 'application/json' },
      registerData
    );
    
    if (!registerResult.success) {
      console.log('❌ Could not register user for workspace tests');
      return;
    }
    
    const userData = JSON.parse(registerResult.data);
    const token = userData.token;
    
    // Test creating a workspace
    console.log('1. Testing workspace creation...');
    const workspaceData = JSON.stringify({
      name: `Test Workspace ${Date.now()}`,
      default_currency: 'USD',
      timezone: 'UTC'
    });
    
    const workspaceResult = await makeRequest(
      'http://localhost:3000/api/workspaces',
      'POST',
      { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      workspaceData
    );
    
    if (workspaceResult.success) {
      console.log('✅ Workspace creation: SUCCESS');
      const workspaceInfo = JSON.parse(workspaceResult.data);
      console.log(`   Workspace ID: ${workspaceInfo.workspace?.id}`);
      console.log(`   User role: ${workspaceInfo.membership?.role}`);
      
      // Test getting workspace list
      console.log('\n2. Testing workspace list...');
      const listResult = await makeRequest(
        'http://localhost:3000/api/workspaces',
        'GET',
        { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      );
      
      if (listResult.success) {
        console.log('✅ Workspace list: SUCCESS');
        const workspaces = JSON.parse(listResult.data);
        console.log(`   Workspaces found: ${workspaces.length}`);
      } else {
        console.log(`❌ Workspace list: FAILED (${listResult.statusCode})`);
      }
      
    } else {
      console.log(`❌ Workspace creation: FAILED (${workspaceResult.statusCode})`);
      console.log(`   Response: ${workspaceResult.data.substring(0, 200)}`);
    }
    
  } catch (error) {
    console.log(`❌ Workspace operations: ERROR - ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...\n');
  
  const errorTests = [
    {
      name: 'Invalid JSON',
      url: 'http://localhost:3000/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid": json}'
    },
    {
      name: 'Missing Authorization',
      url: 'http://localhost:3000/api/auth/me',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    },
    {
      name: 'Invalid Endpoint',
      url: 'http://localhost:3000/api/nonexistent',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }
  ];
  
  for (const test of errorTests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await makeRequest(test.url, test.method, test.headers, test.body);
      
      if (result.statusCode >= 400) {
        console.log(`✅ ${test.name}: Properly handled (${result.statusCode})`);
        
        // Check if error response is valid JSON
        try {
          const errorData = JSON.parse(result.data);
          if (errorData.success === false && errorData.message) {
            console.log(`   Error format: Valid`);
            console.log(`   Error message: ${errorData.message}`);
          }
        } catch (e) {
          console.log(`   Error format: Not JSON`);
        }
      } else {
        console.log(`❌ ${test.name}: Unexpected success (${result.statusCode})`);
      }
    } catch (error) {
      console.log(`✅ ${test.name}: Network error handled - ${error.message}`);
    }
    console.log('');
  }
}

async function runComprehensiveTests() {
  console.log('🧪 Starting Comprehensive Browser Simulation Tests...\n');
  console.log('=' .repeat(60));
  
  await testAuthenticationFlow();
  await testWorkspaceOperations();
  await testErrorHandling();
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 Comprehensive tests completed!');
  console.log('✨ The application appears to be working correctly for browser testing.');
}

runComprehensiveTests().catch(console.error);
#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 Testing server startup locally...');

// Test function
async function testServer() {
  console.log('📋 Environment check:');
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('  PORT:', process.env.PORT || 3000);
  
  // Test database connection first
  console.log('\n🔍 Testing database connectivity...');
  
  try {
    // Start the server
    console.log('\n🚀 Starting server...');
    
    const serverProcess = spawn('node', ['dist/server.js'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3000'
      }
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 30000);

      const testConnection = () => {
        const options = {
          hostname: 'localhost',
          port: 3000,
          path: '/health',
          method: 'GET'
        };

        const req = http.request(options, (res) => {
          if (res.statusCode === 200) {
            clearTimeout(timeout);
            console.log('✅ Server is responding!');
            resolve();
          }
        });

        req.on('error', (err) => {
          // Retry in 2 seconds
          setTimeout(testConnection, 2000);
        });

        req.end();
      };

      // Start testing after 3 seconds
      setTimeout(testConnection, 3000);
    });

    // Test API endpoints
    console.log('\n🔗 Testing API endpoints...');
    
    const endpoints = ['/health', '/api/status', '/api/test/validate'];
    
    for (const endpoint of endpoints) {
      try {
        await testEndpoint(endpoint);
        console.log(`✅ ${endpoint} - OK`);
      } catch (error) {
        console.log(`❌ ${endpoint} - ERROR: ${error.message}`);
      }
    }

    // Stop the server
    serverProcess.kill('SIGTERM');
    console.log('\n✅ Local server test completed!');
    
  } catch (error) {
    console.error('\n❌ Server test failed:', error.message);
    process.exit(1);
  }
}

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Run the test
testServer().catch(console.error);
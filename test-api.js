#!/usr/bin/env node

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'https://123ad-performance.launchpulse.ai';

async function testAPI() {
  console.log('Testing API connectivity...');
  console.log('API Base URL:', API_BASE_URL);
  
  try {
    // Test health endpoint
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'API-Test/1.0'
      }
    });
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test API status endpoint
    console.log('\n2. Testing API status endpoint...');
    const statusResponse = await axios.get(`${API_BASE_URL}/api/status`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'API-Test/1.0'
      }
    });
    console.log('✅ API status check passed:', statusResponse.data);
    
    // Test CORS preflight
    console.log('\n3. Testing CORS preflight...');
    const corsResponse = await axios.options(`${API_BASE_URL}/api/status`, {
      timeout: 10000,
      headers: {
        'Origin': 'https://123ad-performance.launchpulse.ai',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
      }
    });
    console.log('✅ CORS preflight passed');
    
    // Test invalid endpoint (should return 404 with JSON)
    console.log('\n4. Testing invalid API endpoint...');
    try {
      await axios.get(`${API_BASE_URL}/api/nonexistent`, {
        timeout: 10000
      });
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ 404 handling works correctly:', error.response.data);
      } else {
        throw error;
      }
    }
    
    console.log('\n🎉 All API tests passed!');
    
  } catch (error) {
    console.error('\n❌ API test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('Network error - no response received');
      console.error('Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testAPI();
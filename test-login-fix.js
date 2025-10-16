#!/usr/bin/env node

const axios = require('axios');

async function testInvalidLogin() {
  console.log('Testing invalid login credentials...');
  
  try {
    const response = await axios.post('https://123ad-performance.launchpulse.ai/api/auth/login', {
      email: 'invalid@test.com',
      password: 'wrongpassword'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('❌ Login should have failed but succeeded:', response.status);
    console.log('Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log('✅ Login correctly failed with status:', error.response.status);
      console.log('Error response:', error.response.data);
      
      if (error.response.status === 400 && 
          error.response.data.message && 
          error.response.data.message.includes('Invalid email or password')) {
        console.log('✅ Error message is correctly displayed');
      } else {
        console.log('❌ Error message format is incorrect');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

testInvalidLogin();
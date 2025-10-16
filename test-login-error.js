#!/usr/bin/env node

const axios = require('axios');

async function testLoginError() {
  console.log('Testing login error handling...');
  
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'invalid@test.com',
      password: 'wrongpassword'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      validateStatus: (status) => status < 400
    });
    
    console.log('❌ ERROR: Should have received an error response');
    console.log('Response:', response.data);
    
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ SUCCESS: Received correct 400 error response');
      console.log('Error message:', error.response.data.message);
      
      if (error.response.data.message === 'Invalid email or password') {
        console.log('✅ SUCCESS: Error message is correct');
        process.exit(0);
      } else {
        console.log('❌ ERROR: Wrong error message');
        console.log('Expected: "Invalid email or password"');
        console.log('Actual:', error.response.data.message);
        process.exit(1);
      }
    } else {
      console.log('❌ ERROR: Unexpected error');
      console.log('Status:', error.response?.status);
      console.log('Data:', error.response?.data);
      console.log('Message:', error.message);
      process.exit(1);
    }
  }
}

testLoginError();
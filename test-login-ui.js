#!/usr/bin/env node

const { chromium } = require('playwright');

async function testLoginErrorDisplay() {
  console.log('Testing login error display in browser...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the login page
    await page.goto('https://123ad-performance.launchpulse.ai/signin');
    
    // Wait for the page to load
    await page.waitForSelector('input[name="email"]');
    
    // Fill in invalid credentials
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for the error message to appear
    await page.waitForSelector('[role="alert"]', { timeout: 10000 });
    
    // Check if error message is displayed
    const errorElement = await page.$('[role="alert"]');
    const errorText = await errorElement.textContent();
    
    console.log('✅ Error message displayed:', errorText);
    
    if (errorText.includes('Invalid email or password')) {
      console.log('✅ Error message content is correct');
    } else {
      console.log('❌ Error message content is incorrect:', errorText);
    }
    
    // Check if error message is visible (not hidden by CSS)
    const isVisible = await errorElement.isVisible();
    if (isVisible) {
      console.log('✅ Error message is visible to user');
    } else {
      console.log('❌ Error message is not visible');
    }
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'login-error-display.png', fullPage: false });
    console.log('📸 Screenshot saved as login-error-display.png');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testLoginErrorDisplay();
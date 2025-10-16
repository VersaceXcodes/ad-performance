#!/usr/bin/env node

const { chromium } = require('playwright');

async function testLoginErrorDisplay() {
  console.log('Testing login error display in browser...');
  
  const browser = await chromium.launch({ headless: false }); // Use headed mode to debug
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the login page
    await page.goto('https://123ad-performance.launchpulse.ai/signin');
    
    // Wait for the page to load
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });
    console.log('✅ Login page loaded');
    
    // Fill in invalid credentials
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    console.log('✅ Invalid credentials entered');
    
    // Submit the form
    await page.click('button[type="submit"]');
    console.log('✅ Form submitted');
    
    // Wait a bit for the response
    await page.waitForTimeout(3000);
    
    // Check for any error element (not just role="alert")
    const errorSelectors = [
      '[role="alert"]',
      '.bg-red-50',
      '.text-red-800',
      '.border-red-200'
    ];
    
    let errorFound = false;
    let errorText = '';
    
    for (const selector of errorSelectors) {
      try {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const isVisible = await errorElement.isVisible();
          if (isVisible) {
            errorText = await errorElement.textContent();
            errorFound = true;
            console.log(`✅ Error found with selector ${selector}:`, errorText);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!errorFound) {
      // Check page content for any error text
      const pageContent = await page.content();
      if (pageContent.includes('Invalid email or password')) {
        console.log('✅ Error message found in page content but may not be visible');
        errorFound = true;
        errorText = 'Invalid email or password';
      }
    }
    
    if (errorFound && errorText.includes('Invalid email or password')) {
      console.log('✅ Error message content is correct');
    } else {
      console.log('❌ Error message not found or incorrect');
      console.log('Page URL:', page.url());
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'login-error-debug.png', fullPage: true });
      console.log('📸 Debug screenshot saved as login-error-debug.png');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testLoginErrorDisplay();
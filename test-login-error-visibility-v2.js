const { chromium } = require('playwright');

async function testLoginErrorVisibility() {
  console.log('🔍 Testing Login Error Message Visibility...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    await page.goto('https://123ad-performance.launchpulse.ai');
    await page.waitForLoadState('networkidle');
    
    console.log('📱 Landing page loaded, looking for Sign in link...');
    
    // Look for the "Sign in" link and click it
    const signInLink = page.locator('a:has-text("Sign in"), button:has-text("Sign in")');
    
    if (await signInLink.isVisible()) {
      console.log('✅ Found Sign in link, clicking...');
      await signInLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try navigating directly to sign-in page
      console.log('🔍 No Sign in link found, trying direct navigation...');
      await page.goto('https://123ad-performance.launchpulse.ai/signin');
      await page.waitForLoadState('networkidle');
    }
    
    console.log('📱 Sign-in page loaded, looking for login form...');
    
    // Wait for and find the login form
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Find email and password inputs
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = await page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
    const submitButton = await page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login"), button:has-text("Log")').first();
    
    if (!await emailInput.isVisible() || !await passwordInput.isVisible()) {
      throw new Error('Login form inputs not found');
    }
    
    console.log('✅ Login form found, filling with invalid credentials...');
    
    // Fill in invalid credentials
    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');
    
    // Take screenshot before submission
    await page.screenshot({ path: 'before-login-attempt.png' });
    
    console.log('🚀 Submitting invalid credentials...');
    
    // Submit the form
    await submitButton.click();
    
    // Wait for potential error message to appear
    await page.waitForTimeout(3000); // Wait 3 seconds for error to display
    
    // Look for error messages in various possible locations
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '.error',
      '.alert-error',
      '.text-red-500',
      '.text-destructive',
      '[role="alert"]',
      '.toast-error',
      '.notification-error'
    ];
    
    let errorFound = false;
    let errorText = '';
    
    for (const selector of errorSelectors) {
      const errorElement = page.locator(selector);
      if (await errorElement.isVisible()) {
        errorText = await errorElement.textContent();
        if (errorText && errorText.trim()) {
          errorFound = true;
          console.log(`✅ Error message found with selector "${selector}": "${errorText.trim()}"`);
          break;
        }
      }
    }
    
    // If no specific error selector found, look for any text containing "error", "invalid", "failed", etc.
    if (!errorFound) {
      const pageText = await page.textContent('body');
      const errorKeywords = ['invalid', 'error', 'failed', 'incorrect', 'wrong', 'not found'];
      
      for (const keyword of errorKeywords) {
        if (pageText.toLowerCase().includes(keyword)) {
          console.log(`⚠️  Found error keyword "${keyword}" in page content`);
          errorFound = true;
          break;
        }
      }
    }
    
    // Take screenshot after submission
    await page.screenshot({ path: 'after-login-attempt.png' });
    
    // Check network requests for the login API call
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/auth/login') || response.url().includes('/login')) {
        responses.push(response);
        console.log(`🌐 Login API response: ${response.status()} ${response.url()}`);
      }
    });
    
    await page.waitForTimeout(2000); // Wait a bit more to catch any delayed responses
    
    if (responses.length > 0) {
      const loginResponse = responses[0];
      try {
        const responseData = await loginResponse.json();
        console.log(`📡 Login API response data:`, responseData);
        
        if (responseData.success === false && responseData.message) {
          console.log(`✅ API correctly returned error: "${responseData.message}"`);
        }
      } catch (e) {
        console.log(`⚠️  Could not parse login response as JSON`);
      }
    }
    
    if (errorFound) {
      console.log('✅ SUCCESS: Error message is visible to users');
    } else {
      console.log('❌ FAILURE: No error message detected on the page');
      console.log('🔍 Page content after login attempt:');
      const bodyText = await page.textContent('body');
      console.log(bodyText.substring(0, 500) + '...');
    }
    
    return errorFound;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testLoginErrorVisibility().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 LOGIN ERROR VISIBILITY TEST: PASSED');
    console.log('   Error messages are properly displayed to users');
  } else {
    console.log('💥 LOGIN ERROR VISIBILITY TEST: FAILED');
    console.log('   Error messages are NOT visible to users');
  }
  console.log('='.repeat(50));
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});
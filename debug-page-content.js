const { chromium } = require('playwright');

async function debugPageContent() {
  console.log('🔍 Debugging page content...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to the application
    await page.goto('https://123ad-performance.launchpulse.ai');
    await page.waitForLoadState('networkidle');
    
    console.log('📱 Page loaded successfully');
    
    // Get page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    
    // Get page content
    const bodyContent = await page.textContent('body');
    console.log(`📝 Page content (first 1000 chars):`);
    console.log(bodyContent.substring(0, 1000));
    
    // Look for any input elements
    const inputs = await page.locator('input').all();
    console.log(`🔍 Found ${inputs.length} input elements`);
    
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`  Input ${i + 1}: type="${type}" name="${name}" placeholder="${placeholder}"`);
    }
    
    // Look for any buttons
    const buttons = await page.locator('button').all();
    console.log(`🔘 Found ${buttons.length} button elements`);
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      console.log(`  Button ${i + 1}: text="${text?.trim()}" type="${type}"`);
    }
    
    // Look for forms
    const forms = await page.locator('form').all();
    console.log(`📋 Found ${forms.length} form elements`);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-page-content.png' });
    console.log('📸 Screenshot saved as debug-page-content.png');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugPageContent();
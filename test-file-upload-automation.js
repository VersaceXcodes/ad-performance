/**
 * Browser Testing Script: File Upload Automation
 * 
 * This script demonstrates how to test the file upload interface
 * using the exposed test helpers. Run this in browser DevTools console
 * or integrate into your automated testing framework.
 */

async function testFileUploadFlow() {
  console.log('🧪 Starting File Upload Test Flow\n');

  try {
    // Step 1: Verify test helpers are available
    console.log('Step 1: Checking test helpers availability...');
    if (typeof window.__testHelpers === 'undefined') {
      throw new Error('Test helpers not available. Are you on the upload wizard page?');
    }
    console.log('✅ Test helpers available\n');

    // Step 2: Select a test file
    console.log('Step 2: Selecting test file...');
    const testCSVContent = `campaign_name,impressions,clicks,spend,conversions,date
Summer Sale 2024,10000,500,250.00,25,2024-01-15
Winter Promo 2024,15000,750,375.50,40,2024-01-16
Spring Campaign,8000,400,200.00,20,2024-01-17`;

    const fileSelected = window.__testHelpers.selectTestFile('test-campaign-data.csv', testCSVContent);
    if (!fileSelected) {
      throw new Error('Failed to select test file');
    }
    
    // Verify file was added
    const hasValidFiles = window.__testHelpers.hasValidFiles();
    console.log(`✅ File selected: ${hasValidFiles ? 'Yes' : 'No'}\n`);
    
    if (!hasValidFiles) {
      throw new Error('File validation failed');
    }

    // Step 3: Navigate to platform selection
    console.log('Step 3: Navigating to platform selection...');
    const canProceed = window.__testHelpers.canContinue();
    console.log(`   Can proceed: ${canProceed}`);
    
    const stepChanged = window.__testHelpers.proceedToStep(2);
    if (!stepChanged) {
      throw new Error('Failed to proceed to platform selection');
    }
    
    const currentStep = window.__testHelpers.getCurrentStep();
    console.log(`✅ Current step: ${currentStep}\n`);

    // Step 4: Select platform
    console.log('Step 4: Selecting platform (Facebook)...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for UI update
    
    const platformSelected = window.__testHelpers.selectPlatform('facebook');
    if (!platformSelected) {
      throw new Error('Failed to select platform');
    }
    
    const selectedPlatform = window.__testHelpers.getSelectedPlatform();
    console.log(`✅ Platform selected: ${selectedPlatform}\n`);

    // Step 5: Navigate to configuration
    console.log('Step 5: Navigating to configuration...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for UI update
    
    const configStepReached = window.__testHelpers.proceedToStep(3);
    if (!configStepReached) {
      throw new Error('Failed to reach configuration step');
    }
    console.log(`✅ Configuration step reached\n`);

    // Step 6: Check for mapping template options
    console.log('Step 6: Checking for mapping template options...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for templates to load
    
    const mappingTemplateSection = document.querySelector('[name="mapping_template"]');
    const hasMappingTemplates = mappingTemplateSection !== null;
    console.log(`✅ Mapping template options visible: ${hasMappingTemplates ? 'Yes' : 'No'}\n`);

    // Step 7: Start upload
    console.log('Step 7: Starting upload...');
    const uploadStarted = await window.__testHelpers.startUpload();
    if (!uploadStarted) {
      throw new Error('Failed to start upload');
    }
    console.log('✅ Upload initiated\n');

    // Step 8: Monitor upload progress
    console.log('Step 8: Monitoring upload progress...');
    
    const monitorUpload = () => {
      return new Promise((resolve, reject) => {
        let checkCount = 0;
        const maxChecks = 30; // 30 checks * 2 seconds = 60 seconds max
        
        const interval = setInterval(() => {
          checkCount++;
          const state = window.__testHelpers.getUploadState();
          
          console.log(`   Progress: ${state.progress?.progress_percentage || 0}% | Status: ${state.uploadJob?.status || 'unknown'}`);
          
          if (state.uploadJob?.status === 'completed') {
            clearInterval(interval);
            console.log('\n✅ Upload completed successfully!\n');
            resolve(state);
          } else if (state.uploadJob?.status === 'failed') {
            clearInterval(interval);
            reject(new Error(`Upload failed: ${state.uploadJob?.error_text || 'Unknown error'}`));
          } else if (checkCount >= maxChecks) {
            clearInterval(interval);
            reject(new Error('Upload timeout - took longer than expected'));
          }
        }, 2000);
      });
    };

    const finalState = await monitorUpload();

    // Step 9: Display results
    console.log('📊 Upload Results:');
    console.log(`   Filename: ${finalState.uploadJob?.original_filename || 'N/A'}`);
    console.log(`   Platform: ${finalState.platform}`);
    console.log(`   Total Rows: ${finalState.uploadJob?.rows_total || 0}`);
    console.log(`   Successful: ${finalState.uploadJob?.rows_success || 0}`);
    console.log(`   Errors: ${finalState.uploadJob?.rows_error || 0}`);
    console.log(`   Progress: ${finalState.progress?.progress_percentage || 0}%`);
    console.log(`   Status: ${finalState.uploadJob?.status || 'unknown'}`);

    console.log('\n✅ TEST PASSED: File upload flow completed successfully!\n');
    
    return {
      success: true,
      state: finalState
    };

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nError details:', error);
    
    // Capture current state for debugging
    if (typeof window.__testHelpers !== 'undefined') {
      const debugState = window.__testHelpers.getUploadState();
      console.error('\nCurrent state at failure:', debugState);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick test function for individual steps
 */
function quickTest() {
  console.log('🔍 Quick State Check:');
  console.log('   Helpers available:', typeof window.__testHelpers !== 'undefined');
  
  if (typeof window.__testHelpers !== 'undefined') {
    const state = window.__testHelpers.getUploadState();
    console.log('   Current step:', state.step);
    console.log('   Has files:', state.hasFiles);
    console.log('   Platform:', state.platform || 'None');
    console.log('   Can continue:', window.__testHelpers.canContinue());
    console.log('   Upload job:', state.uploadJob ? 'Yes' : 'No');
  }
}

/**
 * Reset function to start fresh
 */
function resetWizard() {
  console.log('🔄 Resetting wizard...');
  
  if (typeof window.__testHelpers !== 'undefined') {
    // Navigate back to step 1
    window.__testHelpers.proceedToStep(1);
    
    // Reload page to clear state
    window.location.reload();
  } else {
    console.log('❌ Test helpers not available');
  }
}

// Export functions for use in console
if (typeof window !== 'undefined') {
  window.testFileUpload = testFileUploadFlow;
  window.quickTest = quickTest;
  window.resetWizard = resetWizard;
  
  console.log('📦 Test functions loaded:');
  console.log('   - testFileUpload()  : Run complete upload test');
  console.log('   - quickTest()       : Check current state');
  console.log('   - resetWizard()     : Reset and reload');
}

// Instructions
console.log('\n📖 Usage Instructions:');
console.log('1. Navigate to: https://123ad-performance.launchpulse.ai/w/workspace_001/upload');
console.log('2. Open browser DevTools console');
console.log('3. Paste this script and press Enter');
console.log('4. Run: await testFileUpload()');
console.log('');

// Auto-run if on the correct page
if (typeof window !== 'undefined' && window.location.pathname.includes('/upload')) {
  console.log('✨ Upload wizard page detected!');
  console.log('💡 Run "await testFileUpload()" to start the test\n');
}

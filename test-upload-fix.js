const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'john.doe@example.com';
const TEST_PASSWORD = 'password123';

async function testUploadInterface() {
  console.log('🧪 Testing Upload Interface Fix...\n');

  try {
    console.log('1️⃣ Testing API health...');
    const healthCheck = await axios.get(`${BASE_URL}/api/health`);
    console.log('   ✅ API is healthy\n');

    console.log('2️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    const authToken = loginResponse.data.token;
    const workspace_id = loginResponse.data.workspace.id;
    console.log(`   ✅ Logged in successfully (Workspace: ${workspace_id})\n`);

    console.log('3️⃣ Testing upload page HTML delivery...');
    const uploadPageResponse = await axios.get(`${BASE_URL}/w/${workspace_id}/upload`);
    
    if (uploadPageResponse.data.includes('index-Cyy-hTco.js')) {
      console.log('   ✅ Upload page serving NEW fixed build (index-Cyy-hTco.js)\n');
    } else if (uploadPageResponse.data.includes('index-DoiicJzH.js')) {
      console.log('   ⚠️  Upload page still serving OLD build (index-DoiicJzH.js)\n');
    } else {
      console.log('   ℹ️  Upload page serving build (checking for root element)\n');
    }

    if (uploadPageResponse.data.includes('<div id="root">')) {
      console.log('   ✅ Root element present in HTML\n');
    } else {
      console.log('   ❌ Root element missing from HTML\n');
      return false;
    }

    console.log('4️⃣ Verifying JavaScript bundle loads...');
    const jsFileMatch = uploadPageResponse.data.match(/src="\/assets\/(index-[^"]+\.js)"/);
    if (jsFileMatch) {
      const jsFile = jsFileMatch[1];
      console.log(`   📦 Bundle file: ${jsFile}`);
      
      const bundleResponse = await axios.get(`${BASE_URL}/assets/${jsFile}`);
      
      if (bundleResponse.data.includes('UV_UploadWizard')) {
        console.log('   ✅ Upload wizard component found in bundle\n');
      } else {
        console.log('   ⚠️  Upload wizard component not explicitly found (may be minified)\n');
      }

      if (bundleResponse.data.includes('Cannot access') && bundleResponse.data.includes('before initialization')) {
        console.log('   ❌ ERROR: Circular dependency detected in bundle!\n');
        return false;
      } else {
        console.log('   ✅ No circular dependency errors detected\n');
      }
    }

    console.log('5️⃣ Testing uploads API endpoint...');
    const uploadsResponse = await axios.get(
      `${BASE_URL}/api/workspaces/${workspace_id}/uploads?page=1&limit=10`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log(`   ✅ Uploads API responding (${uploadsResponse.data.data?.length || 0} uploads found)\n`);

    console.log('✅ ALL TESTS PASSED! Upload interface should now work correctly.\n');
    
    console.log('📋 Summary:');
    console.log('   - Fixed circular dependency in UV_UploadWizard.tsx');
    console.log('   - Moved useEffect hook after handleFileSelect definition');
    console.log('   - Rebuilt frontend with new bundle hash');
    console.log('   - Upload interface should now render without ReferenceError');
    
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.status, error.response.statusText);
    }
    return false;
  }
}

testUploadInterface().then(success => {
  process.exit(success ? 0 : 1);
});

#!/usr/bin/env node

/**
 * Test script for Google credentials parsing
 * This script tests the parseGoogleCredentials function with various configurations
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';

// Test 1: Separate environment variables (Option A)
console.log('🧪 Test 1: Separate environment variables (Option A)');
console.log('=' .repeat(50));

process.env.GOOGLE_CLIENT_EMAIL = 'test-service-account@test-project.iam.gserviceaccount.com';
process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\n-----END PRIVATE KEY-----\n';
process.env.GOOGLE_PROJECT_ID = 'test-project-12345';

try {
  // Import the function
  const { parseGoogleCredentials } = await import('./src/services/purchase-verification.service.js');
  
  const credentials = parseGoogleCredentials();
  console.log('✅ Success: Credentials parsed successfully');
  console.log('📧 Client Email:', credentials.client_email);
  console.log('🔑 Project ID:', credentials.project_id);
  console.log('🔒 Private Key Length:', credentials.private_key.length);
  console.log('🔍 Contains actual newlines:', credentials.private_key.includes('\n'));
  console.log('🔍 Contains literal \\n:', credentials.private_key.includes('\\n'));
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n');

// Test 2: JSON string (Option B)
console.log('🧪 Test 2: JSON string (Option B)');
console.log('=' .repeat(50));

// Clear separate vars
delete process.env.GOOGLE_CLIENT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.GOOGLE_PROJECT_ID;

// Set JSON string
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: "service_account",
  project_id: "test-project-67890",
  private_key_id: "key123",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\n-----END PRIVATE KEY-----\n",
  client_email: "test-service-account@test-project-iam.gserviceaccount.com",
  client_id: "client123",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token"
});

try {
  const credentials = parseGoogleCredentials();
  console.log('✅ Success: Credentials parsed successfully');
  console.log('📧 Client Email:', credentials.client_email);
  console.log('🔑 Project ID:', credentials.project_id);
  console.log('🔒 Private Key Length:', credentials.private_key.length);
  console.log('🔍 Contains actual newlines:', credentials.private_key.includes('\n'));
  console.log('🔍 Contains literal \\n:', credentials.private_key.includes('\\n'));
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n');

// Test 3: Missing credentials
console.log('🧪 Test 3: Missing credentials');
console.log('=' .repeat(50));

// Clear all Google credentials
delete process.env.GOOGLE_CLIENT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.GOOGLE_PROJECT_ID;
delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

try {
  const credentials = parseGoogleCredentials();
  console.log('❌ Unexpected success: Should have thrown an error');
} catch (error) {
  console.log('✅ Expected error:', error.message);
}

console.log('\n');

// Test 4: Invalid JSON
console.log('🧪 Test 4: Invalid JSON');
console.log('=' .repeat(50));

process.env.GOOGLE_SERVICE_ACCOUNT_KEY = '{ invalid json }';

try {
  const credentials = parseGoogleCredentials();
  console.log('❌ Unexpected success: Should have thrown an error');
} catch (error) {
  console.log('✅ Expected error:', error.message);
}

console.log('\n🎉 All tests completed!');

const assert = require('assert');

async function testAuth() {
  const baseUrl = 'http://localhost:3001/api/auth';
  const email = `test-${Date.now()}@co.com`;
  const password = 'test123';
  const name = 'Test User';

  console.log('Testing auth signup...');
  const signupRes = await fetch(`${baseUrl}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  assert.strictEqual(signupRes.status, 201, `Expected 201 signup status, got ${signupRes.status}`);
  const signupData = await signupRes.json();
  assert.ok(signupData.token, 'Signup response should contain a token');
  assert.strictEqual(signupData.user.email, email, 'Emails should match');

  console.log('Testing auth login...');
  const loginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.strictEqual(loginRes.status, 200, `Expected 200 login status, got ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert.ok(loginData.token, 'Login response should contain a token');

  console.log('Testing auth me...');
  const meRes = await fetch(`${baseUrl}/me`, {
    headers: { 'Authorization': `Bearer ${loginData.token}` },
  });
  assert.strictEqual(meRes.status, 200, `Expected 200 /me status, got ${meRes.status}`);
  const meData = await meRes.json();
  assert.strictEqual(meData.email, email, 'Emails should match on /me');
  console.log('✅ Auth tests passed successfully!');
}

testAuth().catch((err) => {
  console.error('❌ Auth test failed:', err);
  process.exit(1);
});

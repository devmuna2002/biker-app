const axios = require('axios');
const API_URL = 'http://127.0.0.1:3003';

async function testFlow() {
    const timestamp = Date.now();
    const testUser = {
        name: 'Auto Test User',
        email: `test.${timestamp}@biker.local`,
        password: 'password123',
        role: 'customer',
        city: 'Harare',
        country: 'Zimbabwe',
        countryCode: 'zw'
    };

    console.log('1. Testing Registration...');
    try {
        const regRes = await axios.post(`${API_URL}/api/auth/register`, testUser);
        console.log('✅ Registration Success:', regRes.data.success);

        const loginEmail = `test.${timestamp}@biker.local`;
        console.log(`2. Testing Login with ${loginEmail}...`);

        const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
            email: loginEmail,
            password: 'password123'
        });
        console.log('✅ Login Success:', loginRes.data.success);
        console.log('Token received:', loginRes.data.data.accessToken.substring(0, 20) + '...');

    } catch (err) {
        console.error('❌ Flow Failed:', err.response?.data || err.message);
    }
}

testFlow();

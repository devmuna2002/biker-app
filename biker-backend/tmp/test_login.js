const http = require('http');

function post(url, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const u = new URL(url);
        const opts = {
            hostname: u.hostname,
            port: u.port || 3003,
            path: u.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };
        const req = http.request(opts, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log('=== Testing backend login ===\n');

    // Test 1: health check
    const health = await post('http://localhost:3003/api/auth/health', {}).catch(e => ({ error: e.message }));
    console.log('Health:', JSON.stringify(health, null, 2));

    // Test 2: login with synthetic biker email
    const login1 = await post('http://localhost:3003/api/auth/login', {
        email: 'driver.1@biker.local',
        password: 'password123'
    }).catch(e => ({ error: e.message }));
    console.log('\nLogin (driver.1@biker.local / password123):', JSON.stringify(login1, null, 2));

    // Test 3: login with a common test account
    const login2 = await post('http://localhost:3003/api/auth/login', {
        email: 'driver.test@biker.local',
        password: 'test123456'
    }).catch(e => ({ error: e.message }));
    console.log('\nLogin (driver.test@biker.local / test123456):', JSON.stringify(login2, null, 2));

    // Test 4: register a fresh biker account
    const reg = await post('http://localhost:3003/api/auth/register', {
        name: 'Test Biker',
        email: `driver.testbiker${Date.now()}@biker.local`,
        password: 'password123',
        role: 'driver',
        vehicleType: 'bike',
        vehicleDetails: 'Test Bike'
    }).catch(e => ({ error: e.message }));
    console.log('\nRegister new driver:', JSON.stringify(reg?.body?.success !== undefined ? { success: reg.body.success, message: reg.body.message, hasToken: !!reg.body?.data?.accessToken } : reg, null, 2));
}

run().catch(console.error);

/**
 * Full debug diagnostic — run with: node tmp/debug.js
 * Tests all critical endpoints and reports status.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http = require('http');

const BASE = 'http://localhost:3003';
let TOKEN = null;

function req(method, path, body, auth) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: 3003,
            path, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(auth && TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
            },
        };
        const r = http.request(opts, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw.slice(0, 200) }); }
            });
        });
        r.on('error', e => resolve({ error: e.message }));
        if (data) r.write(data);
        r.end();
    });
}

function ok(val) { return val ? '✅' : '❌'; }
function log(label, result, check) {
    const pass = check(result);
    console.log(`${ok(pass)} ${label}`);
    if (!pass) console.log(`   → ${JSON.stringify(result?.body || result).slice(0, 300)}`);
    return pass;
}

async function run() {
    console.log('═══════════════════════════════════════════');
    console.log(' BIKER APP — BACKEND DIAGNOSTIC');
    console.log('═══════════════════════════════════════════\n');

    // 1. Health
    const health = await req('GET', '/api/auth/health', null, false);
    log('Backend reachable + health', health, r => r.body?.success === true);

    // 2. Login as biker
    const login = await req('POST', '/api/auth/login', { email: 'driver.1@biker.local', password: 'password123' }, false);
    const loginOk = log('Login (driver.1@biker.local)', login, r => r.body?.success === true);
    if (loginOk) {
        TOKEN = login.body.data.accessToken;
        const user = login.body.data.user;
        console.log(`   → Logged in as: ${user.name} | role: ${user.role} | id: ${user.id}`);
    } else {
        console.log('   Cannot continue auth-protected tests without token.\n');
    }

    console.log('');

    // 3. Auth-protected: GET /api/users/me
    const me = await req('GET', '/api/users/me', null, true);
    log('GET /api/users/me', me, r => r.body?.success === true);

    // 4. PATCH /api/users/me (profile update)
    const patch = await req('PATCH', '/api/users/me', { name: 'Test Biker 1', phone: '+1234567890', city: 'Nairobi', country: 'Kenya', countryCode: 'ke' }, true);
    log('PATCH /api/users/me (profile save)', patch, r => r.body?.success === true);

    // 5. Driver me
    const driverMe = await req('GET', '/api/driver/me', null, true);
    log('GET /api/driver/me', driverMe, r => r.status === 200 || r.body?.success !== false);

    // 6. Set online
    const online = await req('PATCH', '/api/driver/online', { online: true }, true);
    log('PATCH /api/driver/online (go online)', online, r => r.body?.success !== undefined);
    if (online.body?.success === false) console.log(`   → ${online.body.message}`);

    // 7. Set offline
    await req('PATCH', '/api/driver/online', { online: false }, true);

    console.log('');

    // 8. Subscriptions
    const userId = login.body?.data?.user?.id;
    if (userId) {
        const subs = await req('GET', `/api/payments/biker/${userId}/subscriptions`, null, true);
        log('GET /api/payments/biker/:id/subscriptions', subs, r => r.status < 400);
        console.log(`   → ${Array.isArray(r => r) ? subs.body.length : JSON.stringify(subs.body).slice(0, 100)}`);

        const fees = await req('GET', `/api/payments/biker/${userId}/fees`, null, true);
        log('GET /api/payments/biker/:id/fees', fees, r => r.status < 400);

        // Stripe intent
        const intent = await req('POST', '/api/payments/stripe/create-intent', {
            amountCents: 500, currency: 'usd', subscriptionType: 'weekly', bikerId: String(userId)
        }, true);
        log('POST /api/payments/stripe/create-intent', intent, r => r.body?.success === true);
        if (intent.body?.success) {
            const d = intent.body.data;
            console.log(`   → paymentIntentId: ${d.paymentIntentId} | simulated: ${d.simulated}`);
        }

        // PayPal order
        const pp = await req('POST', '/api/payments/paypal/create-order', {
            amountCents: 500, currency: 'USD', subscriptionType: 'weekly'
        }, true);
        log('POST /api/payments/paypal/create-order', pp, r => r.body?.success === true);
        if (pp.body?.success) {
            console.log(`   → orderId: ${pp.body.data.orderId} | simulated: ${pp.body.data.simulated}`);
        }
    }

    console.log('');

    // 9. Plans
    const plans = await req('GET', '/api/payments/plans', null, false);
    log('GET /api/payments/plans (public)', plans, r => Array.isArray(r.body) && r.body.length > 0);

    // 10. Calls
    if (userId) {
        const calls = await req('GET', `/api/calls/biker/${userId}`, null, true);
        log('GET /api/calls/biker/:id', calls, r => r.status < 400);
    }

    // 11. Location / nearby providers
    const providers = await req('GET', '/api/location/nearby-providers?lat=-1.286389&lng=36.817223&kind=school&radiusM=3000&limit=5', null, false);
    log('GET /api/location/nearby-providers?kind=school', providers, r => r.status < 400);
    if (providers.body?.data?.providers) {
        console.log(`   → Found ${providers.body.data.providers.length} schools`);
    }

    // 12. Dashboard init
    const dash = await req('GET', '/api/dashboard/init?lat=-1.286389&lng=36.817223&radiusKm=5', null, true);
    log('GET /api/dashboard/init', dash, r => r.status < 400);

    console.log('\n═══════════════════════════════════════════');
    console.log(' Done.');
    console.log('═══════════════════════════════════════════\n');
}

run().catch(console.error);

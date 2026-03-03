-- Complete Bike Delivery Platform Schema
-- Migration 002: Full schema with rides, fees, subscriptions, locations, and payments

-- ============================================================
-- USERS TABLE (Customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    country VARCHAR(100),
    city VARCHAR(100),
    country_code VARCHAR(5),
    role VARCHAR(50) DEFAULT 'customer', -- customer, driver, admin
    wallet_balance_cents INT DEFAULT 0,
    wallet_currency VARCHAR(8) DEFAULT 'USD',
    rating FLOAT DEFAULT 5.0,
    photo TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active', -- active, suspended
    disabled_at TIMESTAMP,
    service_area_radius_km FLOAT DEFAULT 5.0,
    last_known_location GEOMETRY(Point, 4326),
    service_area_center GEOMETRY(Point, 4326),
    last_known_at TIMESTAMP,
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_known_location ON users USING GIST(last_known_location);

-- ============================================================
-- BIKERS TABLE (Drivers/Delivery Personnel)
-- ============================================================
CREATE TABLE IF NOT EXISTS bikers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL, -- bike, courier, cargo
    vehicle_number VARCHAR(50),
    vehicle_details TEXT,
    profile_photo_url TEXT,
    
    -- Payment Methods
    payment_method_preference VARCHAR(50), -- cash, mobile_money, paypal
    mobile_money_number VARCHAR(50),
    paypal_email VARCHAR(255),
    
    -- Subscription
    subscription_status VARCHAR(50) DEFAULT 'inactive', -- active, inactive
    subscription_expiry_date DATE,
    
    -- Online Status
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    current_destination VARCHAR(255),
    
    -- Verification
    verification_status VARCHAR(50) DEFAULT 'pending', -- pending, verified, rejected
    has_intercity_permit BOOLEAN DEFAULT FALSE,
    is_courier_active BOOLEAN DEFAULT FALSE,
    
    -- Service Capabilities
    service_capabilities JSONB,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, suspended
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bikers_user_id ON bikers(user_id);
CREATE INDEX idx_bikers_status ON bikers(status);
CREATE INDEX idx_bikers_verification_status ON bikers(verification_status);
CREATE INDEX idx_bikers_is_online ON bikers(is_online);

-- ============================================================
-- BIKER LOCATIONS (Live Tracking - for showing bikers on map)
-- ============================================================
CREATE TABLE IF NOT EXISTS biker_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biker_id UUID NOT NULL REFERENCES bikers(id) ON DELETE CASCADE,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    location GEOMETRY(Point, 4326),
    heading FLOAT, -- Direction in degrees (0-360)
    speed FLOAT, -- Speed in m/s
    accuracy FLOAT, -- Accuracy in meters
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_biker_locations_biker_id ON biker_locations(biker_id);
CREATE INDEX idx_biker_locations_location ON biker_locations USING GIST(location);
CREATE INDEX idx_biker_locations_updated_at ON biker_locations(updated_at DESC);

-- ============================================================
-- RIDES TABLE (Orders mapped to Rides terminology)
-- ============================================================
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES users(id),
    biker_id UUID REFERENCES bikers(id),
    
    -- Pickup Details
    pickup_address VARCHAR(500),
    pickup_lat FLOAT,
    pickup_lng FLOAT,
    pickup_location GEOMETRY(Point, 4326),
    
    -- Dropoff Details
    dropoff_address VARCHAR(500),
    dropoff_lat FLOAT,
    dropoff_lng FLOAT,
    dropoff_location GEOMETRY(Point, 4326),
    
    -- Ride Details
    distance_km FLOAT,
    fare_amount INT, -- in cents
    platform_fee INT, -- in cents
    currency VARCHAR(8) DEFAULT 'USD',
    
    -- Payment
    payment_method VARCHAR(50), -- cash, mobile_money, paypal
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    
    -- Service Type
    service_type VARCHAR(50) DEFAULT 'courier', -- bike, courier, cargo
    package_description TEXT,
    
    -- Status
    ride_status VARCHAR(50) DEFAULT 'requested', -- requested, accepted, started, completed, cancelled
    
    -- Timestamps
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rides_customer_id ON rides(customer_id);
CREATE INDEX idx_rides_biker_id ON rides(biker_id);
CREATE INDEX idx_rides_status ON rides(ride_status);
CREATE INDEX idx_rides_payment_status ON rides(payment_status);
CREATE INDEX idx_rides_created_at ON rides(created_at DESC);
CREATE INDEX idx_rides_pickup_location ON rides USING GIST(pickup_location);
CREATE INDEX idx_rides_dropoff_location ON rides USING GIST(dropoff_location);

-- ============================================================
-- BIKER FEES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS biker_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biker_id UUID NOT NULL REFERENCES bikers(id),
    ride_id UUID NOT NULL REFERENCES rides(id),
    
    fee_amount INT NOT NULL, -- in cents
    currency VARCHAR(8) DEFAULT 'USD',
    
    -- Status
    fee_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, disputed
    
    due_date DATE,
    paid_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_biker_fees_biker_id ON biker_fees(biker_id);
CREATE INDEX idx_biker_fees_ride_id ON biker_fees(ride_id);
CREATE INDEX idx_biker_fees_status ON biker_fees(fee_status);
CREATE INDEX idx_biker_fees_created_at ON biker_fees(created_at DESC);

-- ============================================================
-- BIKER SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS biker_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biker_id UUID NOT NULL REFERENCES bikers(id),
    
    subscription_type VARCHAR(50) NOT NULL, -- weekly, monthly
    amount INT NOT NULL, -- in cents
    currency VARCHAR(8) DEFAULT 'USD',
    
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    
    -- Payment Provider
    payment_provider VARCHAR(50), -- stripe, paypal, mobile_money
    provider_subscription_id VARCHAR(255),
    
    -- Status
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, expired, cancelled
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_biker_subscriptions_biker_id ON biker_subscriptions(biker_id);
CREATE INDEX idx_biker_subscriptions_status ON biker_subscriptions(subscription_status);
CREATE INDEX idx_biker_subscriptions_expiry_date ON biker_subscriptions(expiry_date);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    biker_id UUID REFERENCES bikers(id),
    customer_id UUID REFERENCES users(id),
    ride_id UUID REFERENCES rides(id),
    
    amount INT NOT NULL, -- in cents
    currency VARCHAR(8) DEFAULT 'USD',
    
    payment_type VARCHAR(50) NOT NULL, -- subscription, fee_payment, ride_payment
    provider VARCHAR(50) NOT NULL, -- stripe, paypal, mobile_money, cash
    provider_payment_id VARCHAR(255),
    
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_biker_id ON payments(biker_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_ride_id ON payments(ride_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ============================================================
-- TRACKING SESSION (for ride tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id),
    biker_id UUID NOT NULL REFERENCES bikers(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    
    tracking_status VARCHAR(50) DEFAULT 'active', -- active, ended
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracking_sessions_ride_id ON tracking_sessions(ride_id);
CREATE INDEX idx_tracking_sessions_biker_id ON tracking_sessions(biker_id);
CREATE INDEX idx_tracking_sessions_customer_id ON tracking_sessions(customer_id);

-- ============================================================
-- TRACKING LOGS (for detailed location history)
-- ============================================================
CREATE TABLE IF NOT EXISTS tracking_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES tracking_sessions(id),
    biker_id UUID REFERENCES bikers(id),
    
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    location GEOMETRY(Point, 4326),
    
    speed_mps FLOAT,
    heading_deg FLOAT,
    accuracy_m FLOAT,
    
    is_suspected_spoof BOOLEAN DEFAULT FALSE,
    
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracking_logs_session_id ON tracking_logs(session_id);
CREATE INDEX idx_tracking_logs_biker_id ON tracking_logs(biker_id);
CREATE INDEX idx_tracking_logs_location ON tracking_logs USING GIST(location);

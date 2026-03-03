-- =====================================================
-- BIKER APP DATABASE SCHEMA (inDrive-style)
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE (Customers)
-- =====================================================
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    profile_image TEXT,
    status VARCHAR(20) DEFAULT 'active',
    fcm_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RIDERS TABLE
-- =====================================================
CREATE TABLE riders (
    rider_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    profile_image TEXT,
    
    -- Document info
    id_document VARCHAR(255),
    id_document_verified BOOLEAN DEFAULT FALSE,
    bike_plate VARCHAR(20),
    bike_model VARCHAR(100),
    bike_color VARCHAR(50),
    vehicle_type VARCHAR(50) DEFAULT 'motorcycle',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT FALSE,
    
    -- Rating & Stats
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_trips INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,2) DEFAULT 100.00,
    
    -- Location (last known)
    last_latitude DECIMAL(10,8),
    last_longitude DECIMAL(11,8),
    last_location_update TIMESTAMP,
    
    fcm_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TRIPS TABLE (Core Trip Module)
-- =====================================================
CREATE TABLE trips (
    trip_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User references
    customer_id UUID REFERENCES customers(customer_id),
    rider_id UUID REFERENCES riders(rider_id),
    
    -- Locations
    pickup_location_name TEXT,
    pickup_address TEXT,
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    
    dropoff_location_name TEXT,
    dropoff_address TEXT,
    dropoff_latitude DECIMAL(10,8) NOT NULL,
    dropoff_longitude DECIMAL(11,8) NOT NULL,
    
    -- Route data (from OSRM)
    route_polyline TEXT,
    calculated_distance_km DECIMAL(10,2),
    estimated_duration_min INTEGER,
    
    -- Pricing (inDrive-style negotiation)
    customer_offer DECIMAL(10,2),
    rider_offer DECIMAL(10,2),
    min_fare DECIMAL(10,2),
    final_price DECIMAL(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'requested',
    -- requested, accepted, started, completed, cancelled
    
    -- Timestamps
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by VARCHAR(20),
    cancellation_reason TEXT,
    
    -- Rating
    customer_rating INTEGER,
    customer_review TEXT,
    rider_rating INTEGER,
    rider_review TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WALLETS TABLE
-- =====================================================
CREATE TABLE wallets (
    wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    -- user_type: customer, rider, admin
    
    balance DECIMAL(12,2) DEFAULT 0.00,
    pending_balance DECIMAL(12,2) DEFAULT 0.00,
    total_earned DECIMAL(12,2) DEFAULT 0.00,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, user_type)
);

-- =====================================================
-- WALLET TRANSACTIONS
-- =====================================================
CREATE TABLE wallet_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(wallet_id),
    trip_id UUID REFERENCES trips(trip_id),
    
    type VARCHAR(20) NOT NULL,
    -- deposit, withdraw, trip_earning, trip_payment, commission, refund
    
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(12,2),
    balance_after DECIMAL(12,2),
    
    description TEXT,
    reference_id VARCHAR(255),
    
    status VARCHAR(20) DEFAULT 'completed',
    -- pending, completed, failed
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WITHDRAWAL REQUESTS
-- =====================================================
CREATE TABLE withdrawals (
    withdrawal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(wallet_id),
    
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_details JSONB,
    
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, processing, completed, rejected
    
    processed_at TIMESTAMP,
    rejection_reason TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RIDER LOCATIONS (Live Tracking)
-- =====================================================
CREATE TABLE rider_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID REFERENCES riders(rider_id) UNIQUE,
    
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    heading DECIMAL(5,2),
    speed DECIMAL(6,2),
    accuracy DECIMAL(6,2),
    
    battery_level INTEGER,
    is_online BOOLEAN DEFAULT FALSE,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NEGOTIATIONS (inDrive-style)
-- =====================================================
CREATE TABLE negotiations (
    negotiation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(trip_id),
    rider_id UUID REFERENCES riders(rider_id),
    
    offer_amount DECIMAL(10,2) NOT NULL,
    offer_type VARCHAR(20) DEFAULT 'rider',
    -- customer, rider
    
    status VARCHAR(20) DEFAULT 'pending',
    -- pending, accepted, rejected, counter, expired
    
    response_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB,
    
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- =====================================================
-- ADMIN USERS
-- =====================================================
CREATE TABLE admins (
    admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    role VARCHAR(50) DEFAULT 'admin',
    -- super_admin, admin, moderator
    
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TRIP DISPUTES
-- =====================================================
CREATE TABLE trip_disputes (
    dispute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(trip_id),
    reported_by UUID NOT NULL,
    reported_by_type VARCHAR(20) NOT NULL,
    
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    evidence_urls TEXT[],
    
    status VARCHAR(20) DEFAULT 'open',
    -- open, investigating, resolved, closed
    
    resolved_by UUID,
    resolution TEXT,
    resolved_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_trips_customer ON trips(customer_id);
CREATE INDEX idx_trips_rider ON trips(rider_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_created ON trips(created_at DESC);

CREATE INDEX idx_riders_status ON riders(status);
CREATE INDEX idx_riders_online ON riders(is_online, is_available);
CREATE INDEX idx_riders_location ON rider_locations(latitude, longitude);

CREATE INDEX idx_wallet_user ON wallets(user_id, user_type);
CREATE INDEX idx_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_transactions_trip ON wallet_transactions(trip_id);

CREATE INDEX idx_notifications_user ON notifications(user_id, user_type, is_read);

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create admin wallet (user_id = 1 for system admin)
-- Note: We'll use UUIDs, so this is just a placeholder pattern
INSERT INTO admins (username, email, password_hash, role)
VALUES ('admin', 'admin@bikerapp.com', '$2a$10$placeholder', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Default pricing configuration
CREATE TABLE IF NOT EXISTS pricing_config (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_fee DECIMAL(10,2) DEFAULT 1.00,
    per_km_rate DECIMAL(10,2) DEFAULT 0.35,
    per_minute_rate DECIMAL(10,2) DEFAULT 0.05,
    minimum_fare DECIMAL(10,2) DEFAULT 1.00,
    commission_rate DECIMAL(5,2) DEFAULT 15.00,
    
    vehicle_type VARCHAR(50) DEFAULT 'motorcycle',
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pricing_config (base_fee, per_km_rate, per_minute_rate, minimum_fare, commission_rate)
VALUES (1.00, 0.35, 0.05, 1.00, 15.00)
ON CONFLICT DO NOTHING;

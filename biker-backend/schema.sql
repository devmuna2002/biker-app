-- Database Schema for Bike Delivery Platform Stage 1

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID,
    pickup_lat FLOAT NOT NULL,
    pickup_lng FLOAT NOT NULL,
    dropoff_lat FLOAT NOT NULL,
    dropoff_lng FLOAT NOT NULL,
    item_description TEXT,
    preferred_delivery_time TIMESTAMP,
    delivery_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, picked_up, delivered, cancelled
    assigned_rider_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Riders Table
CREATE TABLE IF NOT EXISTS riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    current_lat FLOAT,
    current_lng FLOAT,
    capacity INT DEFAULT 1,
    active_orders INT DEFAULT 0,
    rating FLOAT DEFAULT 5.0,
    availability_status BOOLEAN DEFAULT TRUE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deliveries Log
CREATE TABLE IF NOT EXISTS deliveries_log (
    id SERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    pickup_time TIMESTAMP,
    delivery_time TIMESTAMP,
    actual_eta INT, -- In minutes
    delay_minutes INT DEFAULT 0
);

-- AI Recommendations Log
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id SERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    ranked_riders JSONB, -- List of riders with their individual scores
    selected_rider UUID REFERENCES riders(id),
    confidence_score FLOAT,
    time_saved_minutes FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data for Testing (Optional)
-- INSERT INTO riders (id, current_lat, current_lng, capacity, active_orders, rating, availability_status) 
-- VALUES (gen_random_uuid(), 40.7128, -74.0060, 2, 0, 4.8, TRUE);

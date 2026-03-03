#!/bin/bash

# Test registration endpoint
echo "Testing registration endpoint..."

curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "customer"
  }'

echo ""
echo "---"
echo "Testing registration as driver..."

curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Driver",
    "email": "driver@example.com",
    "password": "password123",
    "role": "driver",
    "vehicleType": "bike",
    "vehicleDetails": "Honda CB500"
  }'

echo ""
echo "---"
echo "Testing auth health check..."

curl -X GET http://localhost:3003/api/auth/health

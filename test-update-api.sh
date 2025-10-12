#!/bin/bash

# Test script for resident update API
# This script tests the update endpoint with various scenarios

echo "==================================="
echo "Testing Resident Update API"
echo "==================================="
echo ""

# Test 1: Update with valid mobile number
echo "Test 1: Valid mobile number update"
curl -X PUT http://localhost:3000/api/residents/RES001 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=test" \
  -d '{"mobileNumber": "9876543210"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq . || echo "Response not JSON"
echo ""

# Test 2: Update with null mobile number
echo "Test 2: Null mobile number"
curl -X PUT http://localhost:3000/api/residents/RES001 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=test" \
  -d '{"mobileNumber": null}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq . || echo "Response not JSON"
echo ""

# Test 3: Update with empty string mobile number
echo "Test 3: Empty string mobile number"
curl -X PUT http://localhost:3000/api/residents/RES001 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=test" \
  -d '{"mobileNumber": ""}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq . || echo "Response not JSON"
echo ""

# Test 4: Update with valid health ID
echo "Test 4: Valid health ID"
curl -X PUT http://localhost:3000/api/residents/RES001 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=test" \
  -d '{"healthId": "HEALTH123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq . || echo "Response not JSON"
echo ""

# Test 5: Update both fields
echo "Test 5: Update both fields"
curl -X PUT http://localhost:3000/api/residents/RES001 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=test" \
  -d '{"mobileNumber": "9876543210", "healthId": "HEALTH123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq . || echo "Response not JSON"
echo ""

echo "==================================="
echo "Tests completed"
echo "==================================="


#!/bin/bash

# WhatsApp Webhook Verification Test Script
# This script tests the webhook verification endpoint

echo "🔧 WhatsApp Webhook Verification Tester"
echo "========================================"
echo ""

# Configuration
read -p "Enter your Supabase project URL (e.g., https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Enter your VERIFY_TOKEN: " VERIFY_TOKEN

# Remove trailing slash from URL
SUPABASE_URL=${SUPABASE_URL%/}

# Webhook URL
WEBHOOK_URL="${SUPABASE_URL}/functions/v1/whatsapp-webhook"

echo ""
echo "Testing webhook at: $WEBHOOK_URL"
echo ""

# Test 1: Valid verification request
echo "Test 1: Valid verification request"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123456")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "Response body: $BODY"
echo "HTTP status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] && [ "$BODY" = "test123456" ]; then
    echo "✅ PASS: Webhook verification successful!"
else
    echo "❌ FAIL: Expected 200 with 'test123456', got $HTTP_CODE with '$BODY'"
fi

echo ""

# Test 2: Invalid token
echo "Test 2: Invalid verify token"
echo "----------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test123456")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "Response body: $BODY"
echo "HTTP status: $HTTP_CODE"

if [ "$HTTP_CODE" = "403" ]; then
    echo "✅ PASS: Correctly rejected invalid token"
else
    echo "❌ FAIL: Expected 403, got $HTTP_CODE"
fi

echo ""

# Test 3: Missing parameters
echo "Test 3: Missing challenge parameter"
echo "-----------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "Response body: $BODY"
echo "HTTP status: $HTTP_CODE"

if [ "$HTTP_CODE" = "400" ]; then
    echo "✅ PASS: Correctly rejected missing parameter"
else
    echo "❌ FAIL: Expected 400, got $HTTP_CODE"
fi

echo ""
echo "========================================"
echo "Test Summary:"
echo "- If Test 1 passes, your webhook is configured correctly"
echo "- If Test 1 fails with 403, check your VERIFY_TOKEN secret"
echo "- If Test 1 fails with 500, VERIFY_TOKEN is not set in Supabase"
echo ""
echo "Next steps:"
echo "1. Check Supabase logs: supabase functions logs whatsapp-webhook"
echo "2. Verify secrets: supabase secrets list"
echo "3. Set token if needed: supabase secrets set WHATSAPP_VERIFY_TOKEN=your_token"
echo "========================================"

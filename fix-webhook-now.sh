#!/bin/bash

# Emergency fix script for WhatsApp webhook
# This redeploys the function WITHOUT JWT verification so Facebook can connect

echo "=================================================="
echo "WhatsApp Webhook Emergency Fix"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo "Install: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}Step 1: Linking to project tedkkwqlcoilopcrxkdl${NC}"
supabase link --project-ref tedkkwqlcoilopcrxkdl

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to link project${NC}"
    echo "You may need to login first: supabase login"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 2: Checking if function exists${NC}"

# Check which function to deploy
if [ -d "supabase/functions/whatsapp-webhook" ]; then
    FUNCTION_NAME="whatsapp-webhook"
elif [ -d "supabase/functions/clever-api" ]; then
    FUNCTION_NAME="clever-api"
else
    echo -e "${RED}✗ No webhook function found${NC}"
    echo "Available functions:"
    ls -1 supabase/functions/
    exit 1
fi

echo -e "${GREEN}Found function: $FUNCTION_NAME${NC}"

echo ""
echo -e "${YELLOW}Step 3: Setting secrets (if not already set)${NC}"
echo "Checking current secrets..."
supabase secrets list

echo ""
read -p "Do you need to set WHATSAPP_VERIFY_TOKEN? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your WHATSAPP_VERIFY_TOKEN: " VERIFY_TOKEN
    supabase secrets set WHATSAPP_VERIFY_TOKEN="$VERIFY_TOKEN"
fi

echo ""
read -p "Do you need to set WHATSAPP_TOKEN? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your WHATSAPP_TOKEN: " WHATSAPP_TOKEN
    supabase secrets set WHATSAPP_TOKEN="$WHATSAPP_TOKEN"
fi

echo ""
echo -e "${GREEN}Step 4: Deploying function WITHOUT JWT verification${NC}"
echo "This allows Facebook to connect without authentication"
echo ""
echo "Running: supabase functions deploy $FUNCTION_NAME --no-verify-jwt"
echo ""

supabase functions deploy "$FUNCTION_NAME" --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=================================================="
    echo "✓ SUCCESS! Function deployed"
    echo "==================================================${NC}"
    echo ""
    echo "Your webhook URL for Facebook:"
    echo ""
    echo -e "${YELLOW}https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/$FUNCTION_NAME${NC}"
    echo ""
    echo "Testing webhook..."
    echo ""

    # Test the webhook
    RESPONSE=$(curl -s "https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/$FUNCTION_NAME?hub.mode=subscribe&hub.verify_token=test&hub.challenge=WORKING" -w "\nHTTP_CODE:%{http_code}")
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

    echo "HTTP Status: $HTTP_CODE"
    echo "Response: $BODY"
    echo ""

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "403" ]; then
        echo -e "${GREEN}✓ Function is responding! (No more 401 errors)${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Go to Facebook Developer Console"
        echo "2. WhatsApp → Configuration → Webhook"
        echo "3. Enter:"
        echo "   Callback URL: https://tedkkwqlcoilopcrxkdl.supabase.co/functions/v1/$FUNCTION_NAME"
        echo "   Verify Token: [Your WHATSAPP_VERIFY_TOKEN]"
        echo "4. Click 'Verify and Save'"
    else
        echo -e "${YELLOW}⚠ Function deployed but got HTTP $HTTP_CODE${NC}"
        echo "Check logs: supabase functions logs $FUNCTION_NAME"
    fi
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo ""
echo "=================================================="

#!/bin/bash

# WhatsApp Webhook Setup Verification Script
# This script helps verify that your WhatsApp webhook is properly configured

echo "=================================================="
echo "WhatsApp Webhook Setup Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Step 1: Check if Supabase CLI is installed
echo "Step 1: Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
    print_status 0 "Supabase CLI is installed"
    SUPABASE_VERSION=$(supabase --version)
    echo "  Version: $SUPABASE_VERSION"
else
    print_status 1 "Supabase CLI is not installed"
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo "  or"
    echo "  brew install supabase/tap/supabase"
    exit 1
fi
echo ""

# Step 2: Check if logged in
echo "Step 2: Checking Supabase login status..."
if supabase projects list &> /dev/null; then
    print_status 0 "Logged in to Supabase"
else
    print_status 1 "Not logged in to Supabase"
    echo ""
    echo "Login with:"
    echo "  supabase login"
    exit 1
fi
echo ""

# Step 3: Check if linked to project
echo "Step 3: Checking project link..."
if [ -f "supabase/config.toml" ]; then
    PROJECT_ID=$(grep 'project_id' supabase/config.toml | cut -d '"' -f 2)
    print_status 0 "Project linked: $PROJECT_ID"
    WEBHOOK_URL="https://${PROJECT_ID}.supabase.co/functions/v1/whatsapp-webhook"
    echo "  Webhook URL: $WEBHOOK_URL"
else
    print_status 1 "Project not linked"
    echo ""
    echo "Link project with:"
    echo "  supabase link --project-ref YOUR_PROJECT_ID"
    exit 1
fi
echo ""

# Step 4: Check if function exists
echo "Step 4: Checking if edge function exists..."
if [ -f "supabase/functions/whatsapp-webhook/index.ts" ]; then
    print_status 0 "Edge function file exists"
else
    print_status 1 "Edge function file not found"
    exit 1
fi
echo ""

# Step 5: List deployed functions
echo "Step 5: Checking deployed functions..."
echo "Fetching list of deployed functions..."
DEPLOYED_FUNCTIONS=$(supabase functions list 2>&1)

if echo "$DEPLOYED_FUNCTIONS" | grep -q "whatsapp-webhook"; then
    print_status 0 "whatsapp-webhook is deployed"
else
    print_status 1 "whatsapp-webhook is NOT deployed"
    echo ""
    echo "Deploy it with:"
    echo "  supabase functions deploy whatsapp-webhook"
    echo ""
    read -p "Deploy now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deploying..."
        supabase functions deploy whatsapp-webhook
        if [ $? -eq 0 ]; then
            print_status 0 "Deployment successful"
        else
            print_status 1 "Deployment failed"
            exit 1
        fi
    else
        echo "Skipping deployment. Please deploy manually."
        exit 1
    fi
fi
echo ""

# Step 6: Check secrets
echo "Step 6: Checking Supabase secrets..."
echo "Fetching secrets list..."
SECRETS=$(supabase secrets list 2>&1)

echo ""
echo "Current secrets:"
echo "$SECRETS"
echo ""

# Check for required secrets
REQUIRED_SECRETS=("WHATSAPP_TOKEN" "WHATSAPP_VERIFY_TOKEN" "SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY")
MISSING_SECRETS=()

for SECRET in "${REQUIRED_SECRETS[@]}"; do
    # Also check for VERIFY_TOKEN as alternative
    if echo "$SECRETS" | grep -q "$SECRET" || [ "$SECRET" = "WHATSAPP_VERIFY_TOKEN" ] && echo "$SECRETS" | grep -q "VERIFY_TOKEN"; then
        print_status 0 "$SECRET is set"
    else
        print_status 1 "$SECRET is NOT set"
        MISSING_SECRETS+=("$SECRET")
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo ""
    print_warning "Missing secrets detected!"
    echo ""
    echo "Set them with:"
    for SECRET in "${MISSING_SECRETS[@]}"; do
        echo "  supabase secrets set $SECRET=your_value_here"
    done
    echo ""
    echo "After setting secrets, you MUST redeploy:"
    echo "  supabase functions deploy whatsapp-webhook"
    echo ""
fi
echo ""

# Step 7: Test webhook
echo "Step 7: Testing webhook verification..."
echo ""
echo "To test the webhook, you need to provide your VERIFY_TOKEN."
echo ""
read -p "Enter your WHATSAPP_VERIFY_TOKEN (or press Enter to skip): " VERIFY_TOKEN

if [ -z "$VERIFY_TOKEN" ]; then
    print_warning "Skipping webhook test. Test manually with:"
    echo ""
    echo "  curl \"$WEBHOOK_URL?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=TEST123\""
    echo ""
    echo "Expected response: TEST123"
else
    echo ""
    echo "Testing webhook with token: $VERIFY_TOKEN"
    echo ""
    RESPONSE=$(curl -s "$WEBHOOK_URL?hub.mode=subscribe&hub.verify_token=$VERIFY_TOKEN&hub.challenge=TEST123" 2>&1)

    if [ "$RESPONSE" = "TEST123" ]; then
        print_status 0 "Webhook verification successful!"
        echo "  Response: $RESPONSE"
    else
        print_status 1 "Webhook verification failed"
        echo "  Response: $RESPONSE"
        echo ""
        echo "Possible issues:"
        echo "  - Token mismatch (verify token is incorrect)"
        echo "  - WHATSAPP_VERIFY_TOKEN not set in Supabase secrets"
        echo "  - Function not deployed properly"
        echo ""
        echo "Check logs with:"
        echo "  supabase functions logs whatsapp-webhook --limit 20"
    fi
fi

echo ""
echo "=================================================="
echo "Setup Summary"
echo "=================================================="
echo ""
echo "Your webhook URL for Facebook:"
echo "  $WEBHOOK_URL"
echo ""
echo "Configure in Facebook/Meta:"
echo "  1. Go to https://developers.facebook.com/apps/"
echo "  2. Select your WhatsApp app"
echo "  3. Click WhatsApp → Configuration"
echo "  4. Under Webhook, click Edit"
echo "  5. Enter callback URL and verify token"
echo "  6. Click 'Verify and Save'"
echo ""
echo "Subscribe to webhook fields:"
echo "  ✓ messages"
echo "  ✓ messaging_postbacks"
echo ""
echo "=================================================="
echo ""

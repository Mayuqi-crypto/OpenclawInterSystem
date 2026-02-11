#!/bin/bash
# send-message.sh - Send a message to another agent
# Usage: ./send-message.sh <target-ip> <port> <token> <message>

if [ $# -lt 4 ]; then
    echo "Usage: $0 <target-ip> <port> <token> <message>"
    echo "Example: $0 10.0.0.1 18789 abc123 'Hello from script!'"
    exit 1
fi

TARGET_IP="$1"
TARGET_PORT="$2"
TARGET_TOKEN="$3"
MESSAGE="$4"

# Escape quotes in message
MESSAGE_ESCAPED=$(echo "$MESSAGE" | sed 's/"/\\"/g')

response=$(curl -sS -X POST "http://${TARGET_IP}:${TARGET_PORT}/tools/invoke" \
    -H "Authorization: Bearer ${TARGET_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
        \"tool\": \"sessions_send\",
        \"args\": {
            \"sessionKey\": \"agent:main:main\",
            \"message\": \"${MESSAGE_ESCAPED}\"
        }
    }")

# Check if successful
if echo "$response" | grep -q '"ok":true'; then
    echo "✓ Message sent successfully"
    # Extract reply if present
    reply=$(echo "$response" | grep -o '"reply":"[^"]*"' | sed 's/"reply":"//;s/"$//')
    if [ -n "$reply" ]; then
        echo "Reply: $reply"
    fi
else
    echo "✗ Failed to send message"
    echo "$response"
    exit 1
fi

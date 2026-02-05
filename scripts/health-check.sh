#!/bin/bash
# health-check.sh - Check connectivity to all agents
# Usage: ./health-check.sh [agents-file]

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  OIS Health Check"
echo "  $(date)"
echo "========================================"
echo ""

# Example agent list - replace with your actual agents
# Format: NAME|IP|PORT|TOKEN
AGENTS=(
    "Agent-A|10.x.x.x|18789|your-token-here"
    "Agent-B|10.x.x.x|18783|your-token-here"
)

check_agent() {
    local name=$1
    local ip=$2
    local port=$3
    local token=$4
    
    # Try to invoke a simple tool
    response=$(curl -s -w "\n%{http_code}" --connect-timeout 5 \
        -X POST "http://${ip}:${port}/tools/invoke" \
        -H "Authorization: Bearer ${token}" \
        -H "Content-Type: application/json" \
        -d '{"tool": "session_status", "args": {"_": true}}' 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} $name ($ip:$port) - Online"
        return 0
    elif [ "$http_code" = "401" ]; then
        echo -e "${YELLOW}!${NC} $name ($ip:$port) - Auth failed (check token)"
        return 1
    elif [ "$http_code" = "000" ]; then
        echo -e "${RED}✗${NC} $name ($ip:$port) - Unreachable"
        return 1
    else
        echo -e "${RED}✗${NC} $name ($ip:$port) - HTTP $http_code"
        return 1
    fi
}

online=0
offline=0

for agent in "${AGENTS[@]}"; do
    IFS='|' read -r name ip port token <<< "$agent"
    if check_agent "$name" "$ip" "$port" "$token"; then
        ((online++))
    else
        ((offline++))
    fi
done

echo ""
echo "========================================"
echo "  Summary: ${online} online, ${offline} offline"
echo "========================================"

if [ $offline -gt 0 ]; then
    exit 1
fi
exit 0

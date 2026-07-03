#!/bin/bash
# install.sh — one-line installer for claude-monitor
# Usage: curl -fsSL https://your-server.com/install.sh | bash -s -- --server https://your-server.com --key SECRET

set -e

SERVER=""
KEY=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --server) SERVER="$2"; shift ;;
    --key)    KEY="$2";    shift ;;
    *) echo "Unknown param: $1"; exit 1 ;;
  esac
  shift
done

if [ -z "$SERVER" ] || [ -z "$KEY" ]; then
  echo "Usage: curl -fsSL .../install.sh | bash -s -- --server <url> --key <key>"
  exit 1
fi

echo ""
echo "📦 Installing claude-monitor..."

# Check Node 18+
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required. Install from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18+ required (found $NODE_MAJOR)"
  exit 1
fi

# Install the package globally
npm install -g claude-monitor --silent

# Run init (identity detection + service installation happens here)
claude-monitor init --server "$SERVER" --key "$KEY"

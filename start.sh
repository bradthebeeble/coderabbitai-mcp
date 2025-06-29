#!/bin/bash

# CodeRabbit MCP Server Startup Script
# This script ensures the server is properly built and started

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the project directory
cd "$SCRIPT_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Ensure the project is built
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "Building project..."
    npm run build
fi

# Start the server
exec node dist/index.js "$@"
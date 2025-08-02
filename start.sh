#!/bin/bash

echo "🌪️  New Zealand Wind Farm Analysis"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Environment file created successfully!"
    echo "🌐 Using Open-Meteo API (free, no API key required)"
    echo ""
fi

echo "✅ Environment configured"
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🚀 Starting server..."
echo "🌐 Open http://localhost:3000 in your browser"
echo "⏹️  Press Ctrl+C to stop"
echo ""

npm start 
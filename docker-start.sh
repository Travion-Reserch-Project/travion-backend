#!/bin/bash

# Docker + Infisical Quick Start Script (Secure Version)
# Uses Infisical CLI - No credential files needed!

set -e

echo "🐳 Travion Backend - Docker + Infisical (Secure)"
echo "================================================"
echo ""

# Check if Infisical CLI is installed
if ! command -v infisical &> /dev/null; then
    echo "⚠️  Infisical CLI not found!"
    echo ""
    echo "Install it first:"
    echo "  macOS:   brew install infisical/get-cli/infisical"
    echo "  Linux:   curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | sudo -E bash"
    echo "           sudo apt-get update && apt-get install -y infisical"
    echo ""
    echo "After installing, run: infisical login"
    exit 1
fi

# Check if logged in to Infisical
if ! infisical token &> /dev/null; then
    echo "⚠️  Not logged in to Infisical!"
    echo ""
    echo "Please login first:"
    echo "  infisical login"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

# Ask which environment
echo "Select Infisical environment:"
echo ""
echo "1) dev (Development)"
echo "2) staging (Staging)"
echo "3) prod (Production)"
echo ""
read -p "Enter choice [1-3]: " env_choice

case $env_choice in
    1)
        INFISICAL_ENV="dev"
        ;;
    2)
        INFISICAL_ENV="staging"
        ;;
    3)
        INFISICAL_ENV="prod"
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

# Ask which command to run
echo ""
echo "What would you like to do?"
echo ""
echo "1) Start services (docker-compose up)"
echo "2) Start in background (docker-compose up -d)"
echo "3) View logs (docker-compose logs -f)"
echo "4) Stop services (docker-compose down)"
echo "5) Rebuild and start (docker-compose up --build)"
echo "6) Clean everything (docker-compose down -v)"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting services with Infisical ($INFISICAL_ENV)..."
        infisical run --env=$INFISICAL_ENV -- docker-compose up
        ;;
    2)
        echo ""
        echo "🚀 Starting services in background with Infisical ($INFISICAL_ENV)..."
        infisical run --env=$INFISICAL_ENV -- docker-compose up -d
        echo ""
        echo "✅ Services started!"
        echo "View logs: docker-compose logs -f backend"
        echo "Stop: docker-compose down"
        ;;
    3)
        echo ""
        echo "📋 Viewing logs (Ctrl+C to exit)..."
        docker-compose logs -f backend
        ;;
    4)
        echo ""
        echo "🛑 Stopping services..."
        docker-compose down
        echo "✅ Services stopped!"
        ;;
    5)
        echo ""
        echo "🔨 Rebuilding and starting with Infisical ($INFISICAL_ENV)..."
        infisical run --env=$INFISICAL_ENV -- docker-compose up --build
        ;;
    6)
        echo ""
        echo "⚠️  This will remove all containers, networks, and volumes!"
        read -p "Are you sure? [y/N]: " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            docker-compose down -v
            echo "✅ Cleaned up!"
        else
            echo "Cancelled."
        fi
        ;;
    *)
        echo "Invalid choice!"
        exit 1
        ;;
esac

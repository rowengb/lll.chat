#!/bin/bash

echo "🚀 Setting up T3 Chat Clone..."

# Copy environment file
if [ ! -f .env.local ]; then
  echo "📋 Copying .env.example to .env.local..."
  cp .env.example .env.local
else
  echo "✅ .env.local already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm prisma generate

# Setup database
echo "🗄️ Setting up database..."
pnpm migrate

# Seed database
echo "🌱 Seeding database..."
pnpm db:seed

echo "✅ Setup complete! You can now run:"
echo "   pnpm dev      (for mock mode)"
echo "   pnpm dev:real (for real AI/auth)" 
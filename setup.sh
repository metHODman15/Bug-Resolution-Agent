#!/bin/bash

# Setup script for Salesforce Debug Agent Extension
# Run this after cloning the repository

set -e

echo "======================================"
echo "Salesforce Debug Agent - Setup"
echo "======================================"
echo ""

# Check Node.js
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v16 or higher."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version too old. Need v16+, found v$NODE_VERSION"
    echo "   Download from: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js $(node -v) found"
echo ""

# Check npm
echo "Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm."
    exit 1
fi
echo "✓ npm $(npm -v) found"
echo ""

# Check Salesforce CLI (optional but recommended)
echo "Checking Salesforce CLI..."
if ! command -v sf &> /dev/null; then
    echo "⚠️  Salesforce CLI not found. You'll need it to run investigations."
    echo "   Install with: npm install -g @salesforce/cli"
    echo "   Continuing setup anyway..."
else
    echo "✓ Salesforce CLI $(sf --version | head -n1) found"
fi
echo ""

# Install dependencies
echo "Installing npm dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Compile TypeScript
echo "Compiling TypeScript..."
npm run compile
if [ $? -eq 0 ]; then
    echo "✓ Compilation successful"
else
    echo "❌ Compilation failed. Check for errors above."
    exit 1
fi
echo ""

# Create runtime directories
echo "Creating runtime directories..."
mkdir -p runtime/agent_workspace/logs
mkdir -p runtime/agent_workspace/findings
mkdir -p runtime/agent_workspace/plans
mkdir -p runtime/agent_workspace/web
mkdir -p runtime/agent_workspace/md
mkdir -p runtime/Reports
mkdir -p runtime/scripts/soql
mkdir -p runtime/scripts/apex
echo "✓ Runtime directories created"
echo ""

# Run linter
echo "Running ESLint..."
npm run lint
if [ $? -eq 0 ]; then
    echo "✓ No linting errors"
else
    echo "⚠️  Linting warnings/errors found. Review above."
fi
echo ""

echo "======================================"
echo "Setup Complete! 🎉"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Open this folder in VS Code"
echo "2. Press F5 to launch extension in debug mode"
echo "3. In the new VS Code window, run:"
echo "   - Command: 'SF Debug: Configure Anthropic API Key'"
echo "   - Command: 'SF Debug: Start New Investigation'"
echo ""
echo "Documentation:"
echo "- README.md - Getting started guide"
echo "- docs/AGENTS.md - Architecture overview"
echo "- docs/security.md - Security details"
echo "- docs/troubleshooting.md - Common issues"
echo ""
echo "Need help? Check docs/troubleshooting.md"
echo ""

#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Models Migration Script${NC}"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "convex" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Function to export models from dev
export_from_dev() {
    echo -e "${YELLOW}📤 Exporting models from dev environment...${NC}"
    
    # Set dev environment
    export CONVEX_DEPLOYMENT="dev:your-dev-deployment-name"
    
    # Export models using Convex CLI
    npx convex run migrateModels:exportModelsData > models-export.json
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Models exported successfully to models-export.json${NC}"
    else
        echo -e "${RED}❌ Failed to export models from dev${NC}"
        exit 1
    fi
}

# Function to import models to prod
import_to_prod() {
    echo -e "${YELLOW}📥 Importing models to production environment...${NC}"
    
    # Check if export file exists
    if [ ! -f "models-export.json" ]; then
        echo -e "${RED}❌ Error: models-export.json not found. Run export first.${NC}"
        exit 1
    fi
    
    # Set prod environment (assuming it's already in .env.local)
    # Extract models array from the export file
    models_data=$(cat models-export.json | jq '.models')
    
    # Save just the models array to a temp file
    echo "$models_data" > temp-models.json
    
    # Import using Convex CLI with the models data
    echo -e "${BLUE}🔄 Running import mutation...${NC}"
    npx convex run migrateModels:importModelsData --arg models="$(cat temp-models.json)"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Models imported successfully to production${NC}"
        rm temp-models.json
    else
        echo -e "${RED}❌ Failed to import models to production${NC}"
        rm temp-models.json
        exit 1
    fi
}

# Function to use existing seed function
use_seed_function() {
    echo -e "${YELLOW}🌱 Using existing seed function...${NC}"
    
    echo -e "${BLUE}Choose which seed function to use:${NC}"
    echo "1. seedModels (basic seed)"
    echo "2. updateModelsWithCorrectData (comprehensive seed)"
    echo "3. updateModelCapabilitiesAndSubtitles (capabilities update)"
    
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            npx convex run models:seedModels
            ;;
        2)
            npx convex run models:updateModelsWithCorrectData
            ;;
        3)
            npx convex run models:updateModelCapabilitiesAndSubtitles
            ;;
        *)
            echo -e "${RED}❌ Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Seed function completed successfully${NC}"
    else
        echo -e "${RED}❌ Seed function failed${NC}"
        exit 1
    fi
}

# Main menu
echo -e "${BLUE}Choose an option:${NC}"
echo "1. Export models from dev environment"
echo "2. Import models to production environment"
echo "3. Full migration (export from dev + import to prod)"
echo "4. Use existing seed functions"
echo "5. Exit"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        export_from_dev
        ;;
    2)
        import_to_prod
        ;;
    3)
        export_from_dev
        import_to_prod
        ;;
    4)
        use_seed_function
        ;;
    5)
        echo -e "${BLUE}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}🎉 Operation completed!${NC}" 
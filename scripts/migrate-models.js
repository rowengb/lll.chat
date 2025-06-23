#!/usr/bin/env node

const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
const path = require('path');

// Configuration
const DEV_URL = process.env.DEV_CONVEX_URL || 'https://your-dev-deployment.convex.cloud';
const PROD_URL = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://confident-vole-667.convex.cloud';

async function exportModels() {
  console.log('🔄 Connecting to dev environment...');
  const devClient = new ConvexHttpClient(DEV_URL);
  
  try {
    // Get all models from dev
    const models = await devClient.query("models:getModels");
    
    console.log(`📊 Found ${models.length} models in dev environment`);
    
    // Save to file
    const exportPath = path.join(__dirname, 'models-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(models, null, 2));
    
    console.log(`💾 Models exported to ${exportPath}`);
    return models;
  } catch (error) {
    console.error('❌ Error exporting models:', error);
    throw error;
  }
}

async function importModels(models) {
  console.log('🔄 Connecting to production environment...');
  const prodClient = new ConvexHttpClient(PROD_URL);
  
  try {
    console.log('🗑️  Clearing existing models in production...');
    // First, get all existing models to delete them
    const existingModels = await prodClient.query("models:getModels");
    
    for (const model of existingModels) {
      await prodClient.mutation("models:deleteModel", { _id: model._id });
    }
    
    console.log(`🗑️  Deleted ${existingModels.length} existing models`);
    
    console.log('📥 Importing models to production...');
    
    // Import new models
    for (const model of models) {
      // Remove the _id and _creationTime fields as they're auto-generated
      const { _id, _creationTime, ...modelData } = model;
      
      await prodClient.mutation("models:addModel", modelData);
    }
    
    console.log(`✅ Successfully imported ${models.length} models to production`);
  } catch (error) {
    console.error('❌ Error importing models:', error);
    throw error;
  }
}

async function migrateModels() {
  try {
    console.log('🚀 Starting models migration from dev to production...');
    
    // Check if we have an export file already
    const exportPath = path.join(__dirname, 'models-export.json');
    let models;
    
    if (fs.existsSync(exportPath) && process.argv.includes('--use-existing')) {
      console.log('📂 Using existing export file...');
      models = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    } else {
      models = await exportModels();
    }
    
    await importModels(models);
    
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateModels();
}

module.exports = { exportModels, importModels, migrateModels }; 
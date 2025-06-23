#!/usr/bin/env node

const { ConvexHttpClient } = require("convex/browser");
const fs = require('fs');
const path = require('path');

// Configuration - use environment variables or defaults
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_DEPLOYMENT_URL;

if (!CONVEX_URL) {
  console.error('❌ CONVEX_URL not found. Set NEXT_PUBLIC_CONVEX_URL or CONVEX_DEPLOYMENT_URL environment variable');
  process.exit(1);
}

async function updateModelsFromBackup() {
  try {
    console.log('🚀 Starting models update from backup file...');
    
    // Read the backup file
    const backupPath = path.join(__dirname, '..', 'dev-models-backup.json');
    
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup file not found at: ${backupPath}`);
      process.exit(1);
    }
    
    console.log('📂 Reading backup file...');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    if (!backupData.models || !Array.isArray(backupData.models)) {
      console.error('❌ Invalid backup file format. Expected { models: [...] }');
      process.exit(1);
    }
    
    console.log(`📊 Found ${backupData.models.length} models in backup file`);
    
    // Connect to Convex
    console.log('🔄 Connecting to Convex...');
    const client = new ConvexHttpClient(CONVEX_URL);
    
    // Prepare models for insertion (remove any extra fields that aren't in schema)
    const modelsToInsert = backupData.models.map(model => ({
      id: model.id,
      name: model.name,
      displayNameTop: model.displayNameTop,
      displayNameBottom: model.displayNameBottom,
      description: model.description,
      subtitle: model.subtitle,
      provider: model.provider,
      apiUrl: model.apiUrl,
      openrouterModelId: model.openrouterModelId,
      capabilities: model.capabilities || [],
      isFavorite: model.isFavorite,
      isActive: model.isActive,
      order: model.order,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      costPer1kTokens: model.costPer1kTokens,
    }));
    
    console.log('🔄 Running migration...');
    const result = await client.mutation("models:migrateModelsFromBackup", {
      models: modelsToInsert
    });
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`   - Deleted: ${result.deletedCount} existing models`);
    console.log(`   - Inserted: ${result.insertedCount} new models`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  updateModelsFromBackup();
}

module.exports = { updateModelsFromBackup }; 
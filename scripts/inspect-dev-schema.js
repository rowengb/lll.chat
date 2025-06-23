#!/usr/bin/env node

const { ConvexHttpClient } = require("convex/browser");

const DEV_URL = 'https://pleasant-partridge-218.convex.cloud';
const PROD_URL = 'https://confident-vole-667.convex.cloud';

async function inspectSchemas() {
  try {
    console.log('🔍 Inspecting dev and prod schemas...\n');
    
    // Check dev environment
    console.log('📊 DEV Environment:');
    const devClient = new ConvexHttpClient(DEV_URL);
    const devModels = await devClient.query("models:getModels");
    
    if (devModels.length > 0) {
      const devSample = devModels[0];
      console.log(`   Sample model: ${devSample.name}`);
      console.log(`   Available fields:`, Object.keys(devSample).sort());
    }
    
    console.log('\n📊 PROD Environment:');
    const prodClient = new ConvexHttpClient(PROD_URL);
    const prodModels = await prodClient.query("models:getModels");
    
    if (prodModels.length > 0) {
      const prodSample = prodModels[0];
      console.log(`   Sample model: ${prodSample.name}`);
      console.log(`   Available fields:`, Object.keys(prodSample).sort());
    }
    
    // Compare schemas
    if (devModels.length > 0 && prodModels.length > 0) {
      const devFields = new Set(Object.keys(devModels[0]));
      const prodFields = new Set(Object.keys(prodModels[0]));
      
      const missingInDev = [...prodFields].filter(f => !devFields.has(f));
      const extraInDev = [...devFields].filter(f => !prodFields.has(f));
      
      console.log('\n🔍 Schema Comparison:');
      if (missingInDev.length > 0) {
        console.log(`   ❌ Missing in dev: ${missingInDev.join(', ')}`);
      }
      if (extraInDev.length > 0) {
        console.log(`   ➕ Extra in dev: ${extraInDev.join(', ')}`);
      }
      if (missingInDev.length === 0 && extraInDev.length === 0) {
        console.log(`   ✅ Schemas are identical!`);
      }
    }
    
  } catch (error) {
    console.error('❌ Inspection failed:', error);
  }
}

inspectSchemas(); 
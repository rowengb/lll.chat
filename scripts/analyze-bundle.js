#!/usr/bin/env node

/**
 * 📊 HYPERSPEED BUNDLE ANALYZER
 * Identifies performance bottlenecks and optimization opportunities
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 HYPERSPEED BUNDLE ANALYZER');
console.log('================================');

// Analysis functions
function analyzePackageJson() {
  console.log('\n📦 DEPENDENCY ANALYSIS:');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const heavyDeps = [
    '@clerk/nextjs',
    '@trpc/client',
    '@trpc/react-query',
    'lucide-react',
    'framer-motion'
  ];

  console.log('Heavy dependencies detected:');
  heavyDeps.forEach(dep => {
    if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
      console.log(`  ⚠️  ${dep}`);
    }
  });
}

function analyzeComponents() {
  console.log('\n🧩 COMPONENT ANALYSIS:');
  const componentsDir = path.join(__dirname, '../src/components');
  
  function getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  function walkDirectory(dir, files = []) {
    const dirFiles = fs.readdirSync(dir);
    
    dirFiles.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDirectory(filePath, files);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        files.push({
          path: filePath,
          size: getFileSize(filePath),
          name: file
        });
      }
    });
    
    return files;
  }

  const files = walkDirectory(componentsDir);
  const largeFiles = files
    .filter(f => f.size > 5000) // > 5KB
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  console.log('Largest components (candidates for code splitting):');
  largeFiles.forEach(file => {
    const sizeKB = (file.size / 1024).toFixed(1);
    console.log(`  📄 ${file.name}: ${sizeKB}KB`);
  });
}

function suggestOptimizations() {
  console.log('\n⚡ OPTIMIZATION SUGGESTIONS:');
  
  const optimizations = [
    {
      title: 'Dynamic Imports',
      description: 'Use React.lazy() for large components',
      impact: 'HIGH',
      code: `const HeavyComponent = React.lazy(() => import('./HeavyComponent'));`
    },
    {
      title: 'Tree Shaking',
      description: 'Import only what you need from libraries',
      impact: 'MEDIUM',
      code: `import { Button } from '@/components/ui/button'; // ✅ Good\nimport * as UI from '@/components/ui'; // ❌ Bad`
    },
    {
      title: 'Bundle Splitting',
      description: 'Split vendor and app code',
      impact: 'HIGH',
      code: `// next.config.js\noptimization: {\n  splitChunks: {\n    chunks: 'all',\n    cacheGroups: {\n      vendor: {\n        test: /[\\\\/]node_modules[\\\\/]/,\n        name: 'vendors',\n        chunks: 'all'\n      }\n    }\n  }\n}`
    }
  ];

  optimizations.forEach(opt => {
    console.log(`\n🎯 ${opt.title} (${opt.impact} IMPACT):`);
    console.log(`   ${opt.description}`);
    console.log(`   Example:\n${opt.code.split('\n').map(line => `   ${line}`).join('\n')}`);
  });
}

function checkPerformanceAPI() {
  console.log('\n📊 PERFORMANCE API CHECK:');
  
  const performanceScript = `
// Add this to _app.tsx for real-time monitoring
if (typeof window !== 'undefined') {
  // Monitor bundle loading
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.name.includes('_next/static')) {
        console.log(\`📦 \${entry.name}: \${entry.duration}ms\`);
      }
    });
  });
  observer.observe({ entryTypes: ['resource'] });
}`;

  console.log('Real-time bundle monitoring:');
  console.log(performanceScript);
}

// Run analysis
analyzePackageJson();
analyzeComponents();
suggestOptimizations();
checkPerformanceAPI();

console.log('\n🚀 HYPERSPEED ANALYSIS COMPLETE!');
console.log('Run: npm run build && npm run analyze for detailed webpack analysis'); 
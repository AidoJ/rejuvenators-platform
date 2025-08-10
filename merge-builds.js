import fs from 'fs';
import path from 'path';

// Simple build merger for Netlify deployment
console.log('🔄 Merging builds...');

try {
  // Create dist directory if it doesn't exist
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }

  // Copy booking platform to root of dist (main site)
  if (fs.existsSync('booking')) {
    console.log('📋 Copying booking platform to root...');
    copyFolderSync('booking', 'dist');
  }

  // Copy admin build to dist/admin subfolder
  if (fs.existsSync('admin/dist')) {
    console.log('👥 Copying admin panel to /admin...');
    if (!fs.existsSync('dist/admin')) {
      fs.mkdirSync('dist/admin');
    }
    copyFolderSync('admin/dist', 'dist/admin');
  }

  console.log('✅ Build merge complete!');
  console.log('📁 Booking platform: / (root)');
  console.log('📁 Admin panel: /admin');

} catch (error) {
  console.error('❌ Build merge failed:', error);
  process.exit(1);
}

// Helper function to copy folders recursively
function copyFolderSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source folder ${src} doesn't exist, skipping...`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);

  items.forEach(item => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

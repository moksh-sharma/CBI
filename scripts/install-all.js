/**
 * Cross-platform installation script
 * Handles paths with spaces on Windows
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Installing dependencies for all packages...\n');

try {
  console.log('📦 Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: __dirname + '/..' });
  
  console.log('\n📦 Installing backend dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..', 'backend') });
  
  console.log('\n📦 Installing frontend dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..', 'frontend') });
  
  console.log('\n✅ All dependencies installed successfully!');
} catch (error) {
  console.error('\n❌ Installation failed:', error.message);
  process.exit(1);
}

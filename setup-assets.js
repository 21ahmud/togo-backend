// setup-assets.js
// Run this script to create the necessary directories and placeholder images

const fs = require('fs');
const path = require('path');

// Create directories
const directories = [
  'uploads',
  'assets',
  'images',
  'public',
  'public/images'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`📁 Directory already exists: ${dir}`);
  }
});

// Create a simple SVG placeholder for the logo
const logoSVG = `<svg width="100" height="50" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#4f46e5"/>
  <text x="50%" y="50%" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dy=".3em">TOGO</text>
</svg>`;

// Save the logo
const logoPath = path.join(__dirname, 'public/images/logo.svg');
fs.writeFileSync(logoPath, logoSVG);
console.log('✅ Created placeholder logo: public/images/logo.svg');

// Create a simple favicon
const faviconPath = path.join(__dirname, 'public/favicon.ico');
if (!fs.existsSync(faviconPath)) {
  // Create a minimal favicon (this would be better as a proper .ico file)
  fs.writeFileSync(faviconPath, '');
  console.log('✅ Created placeholder favicon');
}

console.log('\n🎉 Asset setup complete!');
console.log('💡 Remember to:');
console.log('   1. Replace logo.svg with your actual logo');
console.log('   2. Add proper favicon.ico file');
console.log('   3. Update image paths in your frontend code');
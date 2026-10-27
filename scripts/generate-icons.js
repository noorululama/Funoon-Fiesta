/**
 * Multi-Resolution Web & PWA Icon Generator Script
 * 
 * Generates all favicon, apple-touch-icon, and PWA icon resolutions
 * from public/icon-source.png.
 * 
 * Run with: npm run generate-icons
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pwaSizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512];
const rootDir = path.join(__dirname, '..');
const sourceImage = path.join(rootDir, 'public/icon-source.png');
const publicDir = path.join(rootDir, 'public');
const appDir = path.join(rootDir, 'src/app');

// Also sync with Desktop copy if it exists
const desktopCopy = 'C:/Users/thash/Desktop/Funoon-Fiesta2026 - Copy';

function createIco(pngBuffers, sizes) {
  const numImages = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images

  const dirSize = 16;
  const entries = [];
  let offset = 6 + (dirSize * numImages);

  for (let i = 0; i < numImages; i++) {
    const entry = Buffer.alloc(16);
    const size = sizes[i];
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(pngBuffers[i].length, 8); // Image size
    entry.writeUInt32LE(offset, 12); // Image offset
    entries.push(entry);
    offset += pngBuffers[i].length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

async function generateIcons() {
  try {
    if (!fs.existsSync(sourceImage)) {
      console.error(`Source image not found: ${sourceImage}`);
      return;
    }

    console.log('🚀 Generating multi-resolution web & PWA icons...');

    // 1. Generate standard PWA icons
    for (const size of pwaSizes) {
      const outputPath = path.join(publicDir, `icon-${size}x${size}.png`);
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated public/icon-${size}x${size}.png`);
    }

    // 2. Generate standard favicons (16, 32, 48)
    for (const size of [16, 32, 48]) {
      const outputPath = path.join(publicDir, `favicon-${size}x${size}.png`);
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated public/favicon-${size}x${size}.png`);
    }

    // 3. Generate Apple Touch Icons (180x180)
    const appleTouchIconPath = path.join(publicDir, 'apple-touch-icon.png');
    const appleTouchPrecomposedPath = path.join(publicDir, 'apple-touch-icon-precomposed.png');
    await sharp(sourceImage)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(appleTouchIconPath);
    fs.copyFileSync(appleTouchIconPath, appleTouchPrecomposedPath);
    console.log('✓ Generated public/apple-touch-icon.png & precomposed');

    // 4. Generate Next.js App Router icons (src/app/icon.png & apple-icon.png)
    await sharp(sourceImage)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(appDir, 'icon.png'));
    await sharp(sourceImage)
      .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(appDir, 'apple-icon.png'));
    console.log('✓ Generated src/app/icon.png & src/app/apple-icon.png');

    // 5. Generate multi-resolution ICO file (16, 32, 48)
    const p16 = await sharp(sourceImage).resize(16, 16).png().toBuffer();
    const p32 = await sharp(sourceImage).resize(32, 32).png().toBuffer();
    const p48 = await sharp(sourceImage).resize(48, 48).png().toBuffer();
    const icoBuffer = createIco([p16, p32, p48], [16, 32, 48]);

    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
    fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);
    console.log('✓ Generated public/favicon.ico & src/app/favicon.ico');

    // 6. Update festlogo.png
    await sharp(sourceImage)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(publicDir, 'festlogo.png'));
    console.log('✓ Generated public/festlogo.png');

    // 7. Sync with Desktop copy if it exists
    if (fs.existsSync(desktopCopy)) {
      console.log('Syncing icons with Desktop copy...');
      const desktopPublic = path.join(desktopCopy, 'public');
      const desktopApp = path.join(desktopCopy, 'src/app');

      if (fs.existsSync(desktopPublic)) {
        for (const size of pwaSizes) {
          fs.copyFileSync(path.join(publicDir, `icon-${size}x${size}.png`), path.join(desktopPublic, `icon-${size}x${size}.png`));
        }
        for (const size of [16, 32, 48]) {
          fs.copyFileSync(path.join(publicDir, `favicon-${size}x${size}.png`), path.join(desktopPublic, `favicon-${size}x${size}.png`));
        }
        fs.copyFileSync(path.join(publicDir, 'apple-touch-icon.png'), path.join(desktopPublic, 'apple-touch-icon.png'));
        fs.copyFileSync(path.join(publicDir, 'apple-touch-icon-precomposed.png'), path.join(desktopPublic, 'apple-touch-icon-precomposed.png'));
        fs.copyFileSync(path.join(publicDir, 'favicon.ico'), path.join(desktopPublic, 'favicon.ico'));
        fs.copyFileSync(path.join(publicDir, 'festlogo.png'), path.join(desktopPublic, 'festlogo.png'));
      }
      if (fs.existsSync(desktopApp)) {
        fs.copyFileSync(path.join(appDir, 'favicon.ico'), path.join(desktopApp, 'favicon.ico'));
        fs.copyFileSync(path.join(appDir, 'icon.png'), path.join(desktopApp, 'icon.png'));
        fs.copyFileSync(path.join(appDir, 'apple-icon.png'), path.join(desktopApp, 'apple-icon.png'));
      }
      console.log('✓ Synced with Desktop copy successfully');
    }

    console.log('\n🎉 All icons generated successfully across all resolutions!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();

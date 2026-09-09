const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const root = path.resolve(__dirname, '..');
const input = path.join(root, 'icon.png');
const output = path.join(root, 'icon.ico');

async function main() {
  if (!fs.existsSync(input)) {
    throw new Error(`Missing source icon: ${input}`);
  }

  const png = fs.readFileSync(input);
  if (png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('icon.png is not a valid PNG file.');
  }

  const ico = await pngToIco(input);
  if (!Buffer.isBuffer(ico) || ico.length < 6 || ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) {
    throw new Error('png-to-ico did not produce a valid ICO file.');
  }

  fs.writeFileSync(output, ico);
  console.log(`Generated valid Windows ICO: ${path.relative(root, output)} (${ico.length} bytes)`);
}

main().catch((error) => {
  console.error(`Icon generation failed: ${error.message}`);
  process.exit(1);
});

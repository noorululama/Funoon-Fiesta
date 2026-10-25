const fs = require('fs');

let paths = '';
const width = 1920;
const height = 1080;
const count = 55;
const step = width / count;

for (let i = 0; i <= count + 2; i++) {
  const baseX = i * step - 20;
  const p1x = (baseX + Math.sin(i * 0.7 + 0.5) * 22).toFixed(1);
  const p2x = (baseX - Math.sin(i * 0.5 + 1.2) * 28).toFixed(1);
  const p3x = (baseX + Math.cos(i * 0.6 + 2.1) * 30).toFixed(1);
  const p4x = (baseX - Math.sin(i * 0.8 + 0.9) * 25).toFixed(1);
  const p5x = (baseX + Math.sin(i * 0.4 + 3.1) * 26).toFixed(1);

  const d = `M ${baseX} 0 C ${p1x} 180, ${p2x} 360, ${p3x} 540 S ${p4x} 900, ${p5x} 1080`;
  paths += `  <path d="${d}" fill="none" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" />\n`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" width="100%" height="100%">
${paths}</svg>`;

fs.writeFileSync('public/img/hero/wavy-pattern.svg', svg);
console.log('Successfully generated public/img/hero/wavy-pattern.svg');

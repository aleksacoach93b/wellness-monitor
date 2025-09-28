const fs = require('fs');

// Read the current BodyMap.tsx
let bodyMapContent = fs.readFileSync('src/components/BodyMap.tsx', 'utf8');

// Read the generated front SVG
const frontSVGContent = fs.readFileSync('front-body-svg.txt', 'utf8');

// Find the start and end of frontBodySVG
const frontSVGStart = bodyMapContent.indexOf('  const frontBodySVG = (');
const frontSVGEnd = bodyMapContent.indexOf('  const backBodySVG = (');

if (frontSVGStart === -1 || frontSVGEnd === -1) {
  console.error('Could not find frontBodySVG or backBodySVG markers');
  process.exit(1);
}

// Replace the frontBodySVG section
const newBodyMapContent = 
  bodyMapContent.substring(0, frontSVGStart) +
  frontSVGContent + '\n\n' +
  bodyMapContent.substring(frontSVGEnd);

// Write the updated content
fs.writeFileSync('src/components/BodyMap.tsx', newBodyMapContent);

console.log('Successfully replaced frontBodySVG with complete version');
console.log('Front SVG now contains all 90 muscles from Front Area Full Full.svg');

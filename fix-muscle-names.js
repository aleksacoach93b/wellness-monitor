const fs = require('fs');

// Read the original SVG file to get the correct muscle names
const frontSvgContent = fs.readFileSync('public/Front Area Full Full.svg', 'utf8');
const backSvgContent = fs.readFileSync('public/Back Body Full app.svg', 'utf8');

// Extract muscle names from both SVG files
const extractMuscleNames = (svgContent) => {
  const muscleNames = {};
  const pathRegex = /<path[^>]*id="([^"]*)"[^>]*title="([^"]*)"[^>]*>/g;
  let match;
  
  while ((match = pathRegex.exec(svgContent)) !== null) {
    const id = match[1];
    const title = match[2];
    muscleNames[id] = title;
  }
  
  return muscleNames;
};

const frontMuscleNames = extractMuscleNames(frontSvgContent);
const backMuscleNames = extractMuscleNames(backSvgContent);

console.log('Front muscle names found:', Object.keys(frontMuscleNames).length);
console.log('Back muscle names found:', Object.keys(backMuscleNames).length);

// Read the current BodyMap component
let bodyMapContent = fs.readFileSync('src/components/BodyMap.tsx', 'utf8');

// Replace data-title attributes with correct muscle names
// For front body (path-4 to path-94)
for (let i = 4; i <= 94; i++) {
  const pathId = `PATH ${i}`;
  const correctName = frontMuscleNames[pathId];
  
  if (correctName) {
    // Find and replace the data-title for this path
    const regex = new RegExp(`(id="path-${i}"[^>]*data-title=")[^"]*(")`, 'g');
    bodyMapContent = bodyMapContent.replace(regex, `$1${correctName}$2`);
    console.log(`Replaced path-${i} with: ${correctName}`);
  }
}

// For back body (path-5 to path-74)
for (let i = 5; i <= 74; i++) {
  const pathId = `PATH ${i}`;
  const correctName = backMuscleNames[pathId];
  
  if (correctName) {
    // Find and replace the data-title for this path
    const regex = new RegExp(`(id="[^"]*"[^>]*data-title=")[^"]*(")`, 'g');
    // We need to be more specific for back body paths
    const backPathRegex = new RegExp(`(id="[^"]*"[^>]*data-title=")[^"]*(".*onClick.*path-${i})`, 'g');
    bodyMapContent = bodyMapContent.replace(backPathRegex, `$1${correctName}$2`);
    console.log(`Replaced back path-${i} with: ${correctName}`);
  }
}

// Write the updated content back to the file
fs.writeFileSync('src/components/BodyMap.tsx', bodyMapContent);

console.log('Muscle names have been updated in BodyMap.tsx');

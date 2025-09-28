const fs = require('fs');

// Read the front SVG
const frontSvg = fs.readFileSync('public/Front Area Full Full.svg', 'utf8');

// Extract all path elements from the SVG
const pathMatches = frontSvg.match(/<path[^>]*>/g) || [];
console.log('Found', pathMatches.length, 'path elements in front SVG');

// Generate React components for each path
const reactPaths = pathMatches.map((path, index) => {
  // Extract id, title, and d attributes
  const idMatch = path.match(/id="([^"]*)"/);
  const titleMatch = path.match(/title="([^"]*)"/);
  const dMatch = path.match(/d="([^"]*)"/);
  
  if (!idMatch || !dMatch) return null;
  
  const id = idMatch[1];
  const title = titleMatch ? titleMatch[1] : id;
  const d = dMatch[1];
  
  // Convert id to camelCase for React
  const reactId = id.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  
  return `            {/* ${title} */}
            <path 
              id="${reactId}"
              className="body-area"
              fill={getAreaColor('${reactId}')}
              stroke="#374151" 
              strokeWidth="1"
              d="${d}"
              title="${title}"
              onClick={(e) => handleAreaClick('${reactId}', e)}
            />`;
}).filter(Boolean);

console.log('Generated', reactPaths.length, 'React path components');

// Create the complete frontBodySVG
const frontBodySVGContent = `  const frontBodySVG = (
    <svg 
      width="400" 
      height="600" 
      viewBox="0 0 595.276 841.89" 
      xmlns="http://www.w3.org/2000/svg"
      className="max-w-full h-auto"
    >
      <defs>
        <style>
          {\`
            .body-area { cursor: pointer; transition: opacity 0.2s; }
            .body-area:hover { opacity: 0.7; }
            .cls-1 { fill: #707070; }
            .cls-2 { fill: #bebdbe; }
            .cls-3 { fill: #3f3f3f; }
          \`}
        </style>
      </defs>
      
      {/* Front Body - Individual Muscle Regions */}
      <g>
        <g id="G_1">
          <g id="Sloy_1">
            <g id="Posterior_Body">
${reactPaths.join('\n\n')}
            </g>
          </g>
        </g>
      </g>
    </svg>
  )`;

// Save to file
fs.writeFileSync('front-body-svg.txt', frontBodySVGContent);
console.log('Saved complete frontBodySVG to front-body-svg.txt');

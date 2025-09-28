const fs = require('fs');

// Read the current BodyMap component
let bodyMapContent = fs.readFileSync('src/components/BodyMap.tsx', 'utf8');

// Create a mapping of back body IDs to muscle names
const backBodyMapping = {
  'back-head': 'Back Head',
  'left-foot': 'Left Foot',
  'left-gluteus-maximus': 'Left Gluteus Maximus',
  'left-back-trap': 'Left Back Trap',
  'left-infraspinatus': 'Left Infraspinatus',
  'left-back-shoulder': 'Left Back Shoulder',
  'left-teres-major': 'Left Teres Major',
  'left-triceps': 'Left Triceps',
  'left-latisimus-dorsi': 'Left Latisimus Dorsi',
  'left-back-hip': 'Left Back Hip',
  'left-adductor-back': 'Left Adductor Back',
  'left-vastus-lateralis-quad': 'Left Vastus Lateralis Quad',
  'left-bflh': 'Left BFlh',
  'left-semimembranosus': 'Left Semimembranosus',
  'left-lateral-gastrocs': 'Left Lateral Gastrocs',
  'left-medial-gastrocs': 'Left Medial Gastrocs',
  'left-heel': 'Left Heel',
  'left-achilles': 'Left Achilles',
  'left-semitendinosus': 'Left Semitendinosus',
  'left-elbow': 'Left Elbow',
  'left-back-forearm': 'Left Back Forearm',
  'left-gluteus-medius': 'Left Gluteus Medius',
  'left-lower-back': 'Left Lower Back',
  'left-back-upper-trap': 'Left Back Upper Trap',
  'left-back-hand': 'Left Back Hand',
  'left-back-5th-finger': 'Left Back 5th Finger',
  'left-back-4th-finger': 'Left Back 4th Finger',
  'left-back-3rd-finger': 'Left Back 3rd Finger',
  'left-back-2nd-finger': 'Left Back 2nd Finger',
  'left-back-1st-finger': 'Left Back 1st Finger',
  'right-foot': 'Right Foot',
  'right-gluteus-maximus': 'Right Gluteus Maximus',
  'right-back-trap': 'Right Back Trap',
  'right-infraspinatus': 'Right Infraspinatus',
  'right-back-shoulder': 'Right Back Shoulder',
  'right-teres-major': 'Right Teres Major',
  'right-triceps': 'Right Triceps',
  'right-lattisimus-dorsi': 'Right Lattisimus Dorsi',
  'right-back-hip': 'Right Back Hip',
  'right-adductor-back': 'Right Adductor Back',
  'right-vastus-lateralis-quad': 'Right Vastus Lateralis Quad',
  'right-bflh': 'Right BFlh',
  'right-semimembranosus': 'Right Semimembranosus',
  'right-lateral-gastrocs': 'Right Lateral Gastrocs',
  'right-medial-gastrocs': 'Right Medial Gastrocs',
  'right-heel': 'Right Heel',
  'right-achilles': 'Right Achilles',
  'right-semitendinosus': 'Right Semitendinosus',
  'right-elbow': 'Right Elbow',
  'right-back-forearm': 'Right Back Forearm',
  'right-gluteus-medius': 'Right Gluteus Medius',
  'right-lower-back': 'Right Lower Back',
  'right-back-upper-trap': 'Right Back Upper Trap',
  'right-back-hand': 'Right Back Hand',
  'right-back-5th-finger': 'Right Back 5th Finger',
  'right-back-4th-finger': 'Right Back 4th Finger',
  'right-back-3rd-finger': 'Right Back 3rd Finger',
  'right-back-2nd-finger': 'Right Back 2nd Finger',
  'right-back-1st-finger': 'Right Back 1st Finger'
};

// Add data-title attributes to back body paths
for (const [kebabId, muscleName] of Object.entries(backBodyMapping)) {
  // Find the path element with this ID and add data-title attribute
  const regex = new RegExp(`(id="${kebabId}"[^>]*)(onClick=)`, 'g');
  bodyMapContent = bodyMapContent.replace(regex, `$1data-title="${muscleName}" $2`);
  console.log(`Added data-title="${muscleName}" to ${kebabId}`);
}

// Write the updated content back to the file
fs.writeFileSync('src/components/BodyMap.tsx', bodyMapContent);

console.log('Data-title attributes have been added to back body paths in BodyMap.tsx');

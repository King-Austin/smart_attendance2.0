const fs = require('fs');
const content = fs.readFileSync('src/data/mockData.ts', 'utf8');
const lines = content.split('\n');
const newLines = [];
let lastCode = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const codeMatch = line.match(/code: "([A-Z]{3} \d{3})"/);
  if (codeMatch) lastCode = codeMatch[1];
  
  if (line.trim().startsWith('lecturer:')) {
    const isOdd = parseInt(lastCode.slice(-1)) % 2 !== 0;
    const sem = isOdd ? 'First Semester' : 'Second Semester';
    newLines.push(line.replace('lecturer:', `semester: "${sem}",\n    lecturer:`));
  } else {
    newLines.push(line);
  }
}
fs.writeFileSync('src/data/mockData.ts', newLines.join('\n'));

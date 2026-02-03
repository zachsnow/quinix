const fs = require('fs');
const file = process.argv[2] || 'CPU.1637022553151.11666.cpuprofile';
const profile = JSON.parse(fs.readFileSync(file, 'utf-8'));

// Aggregate by function
const funcHits = new Map();
for (const node of profile.nodes) {
  const cf = node.callFrame;
  const name = cf.functionName || '(anonymous)';
  const url = cf.url || '(native)';
  const line = cf.lineNumber;
  const key = name + ' @ ' + url + ':' + line;
  funcHits.set(key, (funcHits.get(key) || 0) + (node.hitCount || 0));
}

// Sort and display top 25
const sorted = [...funcHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
const totalHits = sorted.reduce((a, b) => a + b[1], 0);

console.log('Top functions by sample count:\n');
for (const [func, hits] of sorted) {
  const pct = ((hits / totalHits) * 100).toFixed(1);
  console.log(hits.toString().padStart(5) + '  ' + pct.padStart(5) + '%  ' + func);
}

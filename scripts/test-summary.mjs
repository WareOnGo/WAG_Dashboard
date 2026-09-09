import fs from 'node:fs';

const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const tests = read('test-results/results.json');
const coverage = read('coverage/coverage-summary.json')?.total;
console.log('## Frontend validation\n');
if (tests) {
  console.log(`Tests: **${tests.numPassedTests} passed**, **${tests.numFailedTests} failed**, **${tests.numPendingTests} skipped**.\n`);
} else {
  console.log('No test report was produced. Check the installation and lint steps.\n');
}
if (coverage) {
  console.log('| Coverage | Percentage |\n| --- | ---: |');
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    console.log(`| ${metric} | ${coverage[metric].pct}% |`);
  }
}
console.log('\nJUnit results and HTML coverage are available in the test-results artifact when generated.');

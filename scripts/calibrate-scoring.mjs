import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesPath = path.join(__dirname, '../src/domain/scoringCalibrationExamples.json');
const examples = JSON.parse(await readFile(examplesPath, 'utf8'));

const baseUrl = process.env.CALIBRATION_BASE_URL || 'http://localhost:4321';
const difficulty = process.env.CALIBRATION_DIFFICULTY || 'undergrad';
const maxCases = Number(process.env.CALIBRATION_MAX_CASES || examples.length);
const selectedExamples = examples.slice(0, maxCases);

function withinTolerance(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

async function evaluateExample(example) {
  const response = await fetch(`${baseUrl}/api/evaluate-response`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      topic: example.topic,
      response: example.response,
      difficulty,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

console.log(`Scoring calibration against ${baseUrl} at ${difficulty} difficulty`);
console.log(`Running ${selectedExamples.length} calibration examples`);

const results = [];
for (const example of selectedExamples) {
  try {
    const evaluation = await evaluateExample(example);
    const semanticDistance = evaluation.scores?.semanticDistance;
    const relevance = evaluation.scores?.relevanceQuality;
    const semanticDistanceOk = withinTolerance(
      semanticDistance,
      example.semanticDistance,
      example.semanticDistanceTolerance
    );
    const relevanceOk = withinTolerance(
      relevance,
      example.relevance,
      example.relevanceTolerance
    );
    const passed = semanticDistanceOk && relevanceOk;

    results.push({
      example,
      semanticDistance,
      relevance,
      total: evaluation.scores?.total,
      passed,
    });

    console.log(
      `${passed ? 'PASS' : 'FAIL'} ${example.topic} -> ${example.response}: ` +
      `distance ${semanticDistance} expected ${example.semanticDistance} +/- ${example.semanticDistanceTolerance}, ` +
      `relevance ${relevance} expected ${example.relevance} +/- ${example.relevanceTolerance}, ` +
      `total ${evaluation.scores?.total}`
    );
  } catch (error) {
    results.push({ example, passed: false, error });
    console.log(`ERROR ${example.topic} -> ${example.response}: ${error.message}`);
  }
}

const failures = results.filter(result => !result.passed);
const scoredResults = results.filter(result => !result.error);
const distanceValues = scoredResults.map(result => result.semanticDistance);
const relevanceValues = scoredResults.map(result => result.relevance);

if (scoredResults.length > 0) {
  console.log('');
  console.log(
    `Observed distance range: ${Math.min(...distanceValues)}-${Math.max(...distanceValues)}`
  );
  console.log(
    `Observed relevance range: ${Math.min(...relevanceValues)}-${Math.max(...relevanceValues)}`
  );
}

console.log('');
console.log(`${results.length - failures.length}/${results.length} calibration examples passed`);

if (failures.length > 0) {
  console.log('');
  console.log('Start the app with `npm run dev` and make sure model credentials are configured.');
  process.exit(1);
}

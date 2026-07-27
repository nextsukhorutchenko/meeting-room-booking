import {selectImpactedTests} from '../e2e/impact-map';

async function readStandardInput(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks)
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
}

async function main(): Promise<void> {
  const changedPaths = process.argv.length > 2 ?
    process.argv.slice(2) :
    await readStandardInput();
  const decision = selectImpactedTests(changedPaths);
  const output = decision.mode === 'selected' ?
    {
      mode: decision.mode,
      tags: decision.tags,
      grep: decision.tags.join('|'),
      reasons: decision.reasons,
    } :
    decision;

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Could not select impacted tests: ${message}`);
  process.exitCode = 1;
});

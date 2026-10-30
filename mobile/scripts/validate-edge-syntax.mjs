import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(process.cwd(), '..', 'supabase', 'functions');
const functions = ['liveness-challenge', 'enroll-face', 'verify-attendance', 'session-actions'];
const shared = ['_shared/on-device-liveness.ts'];
let failed = false;

for (const name of [...functions.map((item) => `${item}/index.ts`), ...shared]) {
  const file = path.join(root, name);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) {
    failed = true;
    for (const diagnostic of source.parseDiagnostics) console.error(`${name}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  } else console.log(`Parsed ${name}`);
}

if (failed) process.exit(1);

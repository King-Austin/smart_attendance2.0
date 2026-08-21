import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(process.cwd(), '..', 'supabase', 'functions');
const functions = ['liveness-challenge', 'enroll-face', 'verify-attendance', 'session-actions'];
let failed = false;

for (const name of functions) {
  const file = path.join(root, name, 'index.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) {
    failed = true;
    for (const diagnostic of source.parseDiagnostics) console.error(`${name}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  } else console.log(`Parsed ${name}`);
}

if (failed) process.exit(1);

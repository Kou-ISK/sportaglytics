import fs from 'node:fs';
import path from 'node:path';
import { isBuiltin } from 'node:module';
import ts from 'typescript';

// electron-builder excludes node_modules. Main must use packaged relative
// modules, Electron or Node builtins; renderer/preload dependencies are bundled.
const failures = [];
const inspect = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(file);
      continue;
    }
    if (!file.endsWith('.js')) continue;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const check = (value) => {
      if (!value || !ts.isStringLiteral(value)) return;
      const specifier = value.text;
      if (
        !specifier.startsWith('.') &&
        specifier !== 'electron' &&
        !isBuiltin(specifier)
      )
        failures.push(`${file}: unpackaged runtime dependency '${specifier}'`);
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        check(node.moduleSpecifier);
      if (
        ts.isCallExpression(node) &&
        ((ts.isIdentifier(node.expression) &&
          node.expression.text === 'require') ||
          node.expression.kind === ts.SyntaxKind.ImportKeyword)
      )
        check(node.arguments[0]);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
};

if (!fs.existsSync('build/electron/src/main.js'))
  throw new Error(
    'Build Electron main before checking its runtime dependencies.',
  );
inspect('build/electron');
inspect('build/src');
if (failures.length) throw new Error(failures.join('\n'));
console.log('Electron packaged runtime dependency check passed');

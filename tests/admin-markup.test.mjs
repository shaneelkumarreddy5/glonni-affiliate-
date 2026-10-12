import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const adminRoot = fileURLToPath(new URL('../app/admin/', import.meta.url));

function tsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(file) : file.endsWith('.tsx') ? [file] : [];
  });
}

test('admin pages use valid, non-nested main landmarks', () => {
  const violations = [];

  for (const file of tsxFiles(adminRoot)) {
    const sourceText = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function visit(node, insideMain = false) {
      if (ts.isJsxElement(node)) {
        const tag = node.openingElement.tagName.getText(source);
        const className = node.openingElement.attributes.properties.find(
          (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'className',
        );
        const isAdminShell = className?.initializer?.getText(source).includes('admin-v2');

        if (tag === 'main' && insideMain) violations.push(`${file}: nested <main>`);
        if (isAdminShell && tag !== 'div') violations.push(`${file}: admin shell should use <div>`);

        ts.forEachChild(node, (child) => visit(child, insideMain || tag === 'main'));
        return;
      }

      ts.forEachChild(node, (child) => visit(child, insideMain));
    }

    visit(source);
  }

  assert.deepEqual(violations, []);
});

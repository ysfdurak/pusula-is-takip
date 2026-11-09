// App.jsx içindeki büyük ekran bloklarını ayrı bileşenlere taşır (davranış değişmez).
// Her blok, App kapsamından kullandığı değerleri ortak bağlamdan (AppContext) alır.
// Kullanım: node tools/migration/extract-screens.mjs src/App.jsx
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prettier = await import('prettier');

const appPath = process.argv[2];
const srcDir = dirname(appPath);
const SPECS = [
  { test: (c) => c === "page === 'dashboard' || page === 'mine'", name: 'BoardsPage', file: 'screens/BoardsPage.jsx', doc: 'Benim panom ve Ekip panosu' },
  { test: (c) => c === "page === 'tasks'", name: 'TaskListPage', file: 'screens/TaskListPage.jsx', doc: 'İş listesi: pano, liste, filtreler, toplu işlem' },
  { test: (c) => c === "page === 'team'", name: 'TeamPage', file: 'screens/TeamPage.jsx', doc: 'Ekipler ve kişiler' },
  { test: (c) => c === "page === 'notifications'", name: 'NotificationsPage', file: 'screens/NotificationsPage.jsx', doc: 'Bildirimler' },
  { test: (c) => c === "page === 'settings'", name: 'SettingsPage', file: 'screens/SettingsPage.jsx', doc: 'Ayarlar: tercihler, e-posta, bildirim kuralları, termin kuralları' },
  { test: (c) => c === "['projects', 'decisions', 'blockers'].includes(page)", name: 'RecordsPage', file: 'screens/RecordsPage.jsx', doc: 'Projeler, kararlar ve engeller' },
  { test: (c) => c === 'selectedTask', name: 'TaskDrawer', file: 'screens/TaskDrawer.jsx', doc: 'İş ayrıntısı çekmecesi' },
  { test: (c) => c === 'modal', name: 'ModalHost', file: 'screens/ModalHost.jsx', doc: 'Tüm formlar ve pencereler (yeni iş, revizyon, engel, üye…)' },
];

const code = readFileSync(appPath, 'utf8');
const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
let appPath_;
traverse(ast, { FunctionDeclaration(p) { if (p.node.id.name === 'App') { appPath_ = p; p.stop(); } } });
const appScope = appPath_.scope;
const programScope = appPath_.scope.getProgramParent();

// İçe aktarma eşlemesi: yerel ad → { kaynak, içe aktarılan ad }
const imports = new Map();
for (const s of ast.program.body) if (t.isImportDeclaration(s)) for (const sp of s.specifiers) imports.set(sp.local.name, { source: s.source.value, imported: sp.imported?.name || 'default' });

const found = [];
appPath_.traverse({
  JSXExpressionContainer(p) {
    const e = p.node.expression;
    if (!t.isLogicalExpression(e, { operator: '&&' })) return;
    const cond = generate(e.left).code;
    const spec = SPECS.find((s) => s.test(cond));
    if (!spec || found.some((f) => f.spec === spec)) return;
    if (!t.isJSXElement(e.right) && !t.isJSXFragment(e.right)) throw new Error('JSX değil: ' + cond);
    found.push({ spec, path: p.get('expression.right') });
  },
});
if (found.length !== SPECS.length) throw new Error('Bulunamayan blok: ' + SPECS.filter((s) => !found.some((f) => f.spec === s)).map((s) => s.name));

const contextVars = new Set();
for (const f of found) {
  const ctx = new Set();
  const mod = new Set();
  f.path.traverse({
    'Identifier|JSXIdentifier'(p) {
      const n = p.node.name;
      if (p.isJSXIdentifier()) {
        if (p.parentPath.isJSXAttribute() || p.parentPath.isJSXClosingElement()) return;
        if (p.parentPath.isJSXMemberExpression() && p.key === 'property') return;
        if (p.parentPath.isJSXOpeningElement() && /^[a-z]/.test(n)) return;
      } else if (!p.isReferencedIdentifier() && !(p.parentPath.isAssignmentExpression() && p.key === 'left')) return;
      const b = p.scope.getBinding(n);
      if (!b) return;
      if (b.scope === appScope) ctx.add(n);
      else if (b.scope === programScope) mod.add(n);
    },
  });
  // Bağlamdan gelen değerlere atama yapılmamalı (yeniden atama App'i etkilemez)
  f.path.traverse({ AssignmentExpression(p) { if (t.isIdentifier(p.node.left) && ctx.has(p.node.left.name)) throw new Error(`${f.spec.name}: ${p.node.left.name} atanıyor`); } });
  f.ctx = [...ctx].sort();
  f.mod = [...mod].sort();
  f.ctx.forEach((v) => contextVars.add(v));
  const unknownTop = f.mod.filter((m) => !imports.has(m));
  if (unknownTop.length) throw new Error(`${f.spec.name}: App.jsx üst düzey tanımları kullanıyor: ${unknownTop}`);
}

// Bileşen dosyalarını yaz
for (const f of found) {
  const file = join(srcDir, f.spec.file);
  const bySource = new Map();
  for (const m of f.mod) {
    const { source, imported } = imports.get(m);
    const rel = source.startsWith('.') ? (() => { let r = relative(dirname(file), join(srcDir, source)).replace(/\\/g, '/'); return r.startsWith('.') ? r : './' + r; })() : source;
    if (!bySource.has(rel)) bySource.set(rel, []);
    bySource.get(rel).push(imported === m ? m : imported === 'default' ? `default as ${m}` : `${imported} as ${m}`);
  }
  const ctxImport = (() => { let r = relative(dirname(file), join(srcDir, 'AppContext.js')).replace(/\\/g, '/'); return r.startsWith('.') ? r : './' + r; })();
  const lines = [`// ${f.spec.doc}. App.jsx'ten ayrıldı; değerleri AppContext üzerinden alır.`];
  for (const [src, names] of [...bySource].sort()) lines.push(`import { ${names.sort().join(', ')} } from '${src}';`);
  lines.push(`import { useApp } from '${ctxImport}';`);
  const jsx = generate(f.path.node, { jsescOption: { minimal: true } }).code;
  const body = `\nexport function ${f.spec.name}() {\n  const { ${f.ctx.join(', ')} } = useApp();\n  return (${jsx});\n}\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await prettier.format(lines.join('\n') + '\n' + body, { parser: 'babel', printWidth: 110, singleQuote: true }));
  f.path.replaceWith(t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier(f.spec.name), [], true), null, [], true));
}

// App: bağlam nesnesi ve sağlayıcı
const mainReturn = appPath_.node.body.body.filter((s) => t.isReturnStatement(s)).pop();
const ctxDecl = t.variableDeclaration('const', [t.variableDeclarator(t.identifier('appContext'),
  t.objectExpression([...contextVars].sort().map((v) => t.objectProperty(t.identifier(v), t.identifier(v), false, true))))]);
appPath_.node.body.body.splice(appPath_.node.body.body.indexOf(mainReturn), 0, ctxDecl);
const provider = t.jsxMemberExpression(t.jsxIdentifier('AppContext'), t.jsxIdentifier('Provider'));
mainReturn.argument = t.jsxElement(
  t.jsxOpeningElement(provider, [t.jsxAttribute(t.jsxIdentifier('value'), t.jsxExpressionContainer(t.identifier('appContext')))]),
  t.jsxClosingElement(provider), [t.isJSXElement(mainReturn.argument) || t.isJSXFragment(mainReturn.argument) ? mainReturn.argument : t.jsxExpressionContainer(mainReturn.argument)], false);

// İçe aktarmalar: yeni bileşenler + AppContext; artık kullanılmayanları sil
ast.program.body.unshift(
  ...found.map((f) => t.importDeclaration([t.importSpecifier(t.identifier(f.spec.name), t.identifier(f.spec.name))], t.stringLiteral('./' + f.spec.file))),
  t.importDeclaration([t.importSpecifier(t.identifier('AppContext'), t.identifier('AppContext'))], t.stringLiteral('./AppContext.js')),
);
traverse.cache.clear?.();
traverse(ast, { Program(p) { p.scope.crawl(); } });
traverse(ast, {
  ImportDeclaration(p) {
    p.node.specifiers = p.node.specifiers.filter((sp) => { const b = p.scope.getBinding(sp.local.name); return b && b.referencePaths.length > 0; });
    if (!p.node.specifiers.length) p.remove();
  },
});
writeFileSync(appPath, await prettier.format(generate(ast, { jsescOption: { minimal: true } }).code, { parser: 'babel', printWidth: 110, singleQuote: true }));
writeFileSync(join(srcDir, 'AppContext.js'), `// App bileşeninin durumunu ve işlevlerini ekran bileşenlerine taşıyan bağlam.\nimport { createContext, useContext } from 'react';\n\nexport const AppContext = createContext(null);\nexport const useApp = () => useContext(AppContext);\n`);
console.log(found.map((f) => `${f.spec.name}: ${f.ctx.length} bağlam değeri, ${f.mod.length} içe aktarma`).join('\n'));
console.log('bağlamdaki toplam değer:', contextVars.size);

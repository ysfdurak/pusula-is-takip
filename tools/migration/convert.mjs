// Derlenmiş Pusula paketinden (src/app.bundle.js) uygulama kodunu çıkarır,
// kütüphane bağlantılarını npm import'larına çevirir ve jsx() çağrılarını JSX'e dönüştürür.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const bundlePath = process.argv[2];
const outPath = process.argv[3];
const src = readFileSync(bundlePath, 'utf8');
const full = parse(src, { sourceType: 'script' });
const body = full.program.body[0].expression.callee.body.body;
const appStart = body.findIndex((s) => s.type === 'VariableDeclaration' && s.declarations.some((d) => d.id.name === 'fn'));

// 1) Uygulama kısmını ayrı bir program olarak al
const appCode = body.slice(appStart).map((s) => src.slice(s.start, s.end)).join('\n');

// 2) Kütüphane eşlemeleri
const icons = JSON.parse(readFileSync(new URL('./icons.json', import.meta.url), 'utf8'));
const pascal = (n) => n.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const iconMap = Object.fromEntries(icons.map((i) => [i.v, pascal(i.name) + 'Icon']));
const zodMap = { G: 'string', on: 'number', sn: 'boolean', cn: 'array', ln: 'object', un: 'enum', dn: 'preprocess' };

const ast = parse(appCode, { sourceType: 'module' });
const reactNames = new Set();
let usesCreateRoot = false;
let leftoverJsx = false;

// jsx-runtime (q/qn) ve react-dom/client (fn) tanımlarını kaldır
const dropDeclarators = new Set(['fn', 'q', 'qn']);
traverse(ast, {
  VariableDeclarator(p) {
    if (p.parentPath.parentPath.isProgram() && dropDeclarators.has(p.node.id.name)) p.remove();
  },
  FunctionDeclaration(p) {
    if (p.parentPath.isProgram() && dropDeclarators.has(p.node.id.name)) p.remove();
  },
});

// jsx-runtime modülü başka isimle (ör. Kn/qn içindeki iç fonksiyonlar) gelmiş olabilir: q tanımını bulan ifade
const isQ = (n) => t.isIdentifier(n, { name: 'q' });
const isJsxCallee = (c) =>
  (t.isSequenceExpression(c) && c.expressions.length === 2 && t.isNumericLiteral(c.expressions[0], { value: 0 }) &&
    t.isMemberExpression(c.expressions[1]) && isQ(c.expressions[1].object) &&
    ['jsx', 'jsxs'].includes(c.expressions[1].property.name)) ||
  (t.isMemberExpression(c) && isQ(c.object) && ['jsx', 'jsxs'].includes(c.property.name));
const calleeKind = (c) => (t.isSequenceExpression(c) ? c.expressions[1].property.name : c.property.name);

// Küçük harfle başlayan bileşen değişkenleri JSX'te HTML etiketi sanılır: büyük harfli isme çevir
{
  const toRename = new Map();
  traverse(ast, {
    CallExpression(p) {
      if (!isJsxCallee(p.node.callee)) return;
      const a = p.node.arguments[0];
      if (!t.isIdentifier(a) || !/^[a-z_]/.test(a.name) || iconMap[a.name]) return;
      const b = p.scope.getBinding(a.name);
      if (b) toRename.set(b, a.name);
    },
  });
  for (const [b, name] of toRename) {
    let n = 'C' + name[0].toUpperCase() + name.slice(1);
    while (b.scope.hasBinding(n) || b.scope.getProgramParent().hasBinding(n)) n += '_';
    b.scope.rename(name, n);
  }
  console.log('bileşen değişkeni yeniden adlandırıldı:', toRename.size);
}

function jsxName(typeNode) {
  if (t.isStringLiteral(typeNode)) return t.jsxIdentifier(typeNode.value);
  if (t.isTemplateLiteral(typeNode) && typeNode.expressions.length === 0) return t.jsxIdentifier(typeNode.quasis[0].value.cooked);
  if (t.isIdentifier(typeNode)) return t.jsxIdentifier(typeNode.name);
  if (t.isMemberExpression(typeNode) && isQ(typeNode.object) && typeNode.property.name === 'Fragment') return 'FRAGMENT';
  if (t.isMemberExpression(typeNode) && t.isIdentifier(typeNode.object) && t.isIdentifier(typeNode.property))
    return t.jsxMemberExpression(t.jsxIdentifier(typeNode.object.name), t.jsxIdentifier(typeNode.property.name));
  return null;
}
const plainString = (n) =>
  t.isStringLiteral(n) ? n.value : t.isTemplateLiteral(n) && n.expressions.length === 0 ? n.quasis[0].value.cooked : null;
const safeText = (s) => s.length > 0 && !/[{}<>\n\r]/.test(s) && s === s.trim() && !/\s{2,}/.test(s) && !/&/.test(s);

function childNode(n) {
  if (t.isJSXElement(n) || t.isJSXFragment(n)) return n;
  const s = plainString(n);
  if (s !== null && safeText(s)) return t.jsxText(s);
  if (s !== null) return t.jsxExpressionContainer(t.stringLiteral(s));
  return t.jsxExpressionContainer(n);
}

function toJSX(call) {
  const kind = calleeKind(call.callee);
  const [typeNode, propsNode, keyNode] = call.arguments;
  const name = jsxName(typeNode);
  if (!name || (propsNode && !t.isObjectExpression(propsNode))) return null;
  const attrs = [];
  let children = [];
  for (const prop of propsNode ? propsNode.properties : []) {
    if (t.isSpreadElement(prop)) { attrs.push(t.jsxSpreadAttribute(prop.argument)); continue; }
    if (!t.isObjectProperty(prop) || prop.computed) return null;
    const key = t.isIdentifier(prop.key) ? prop.key.name : t.isStringLiteral(prop.key) ? prop.key.value : null;
    if (key === null) return null;
    if (key === 'children') {
      if (kind === 'jsxs' && t.isArrayExpression(prop.value)) {
        if (prop.value.elements.some((e) => !e || t.isSpreadElement(e))) return null;
        children = prop.value.elements.map(childNode);
      } else children = [childNode(prop.value)];
      continue;
    }
    const s = plainString(prop.value);
    const value = s !== null && !/["\n\r\\]/.test(s) ? t.stringLiteral(s) : t.jsxExpressionContainer(prop.value);
    attrs.push(t.jsxAttribute(t.jsxIdentifier(key), value));
  }
  // jsxs + tek çocuk ya da jsx + dizi gibi semantik farkları koru
  if (kind === 'jsxs' && children.length === 1 && !(propsNode.properties.find((p) => p.key?.name === 'children')?.value?.type === 'ArrayExpression')) return null;
  if (keyNode) attrs.push(t.jsxAttribute(t.jsxIdentifier('key'), t.jsxExpressionContainer(keyNode)));
  if (name === 'FRAGMENT') {
    if (attrs.length === 0) return t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), children);
    return t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('Fragment'), attrs, children.length === 0), children.length ? t.jsxClosingElement(t.jsxIdentifier('Fragment')) : null, children, children.length === 0);
  }
  const selfClosing = children.length === 0;
  return t.jsxElement(t.jsxOpeningElement(name, attrs, selfClosing), selfClosing ? null : t.jsxClosingElement(name), children, selfClosing);
}

let needFragment = false;
traverse(ast, {
  CallExpression: {
    exit(p) {
      const { node } = p;
      // (0,S.useState)(...) → useState(...)
      if (t.isSequenceExpression(node.callee) && node.callee.expressions.length === 2 && t.isNumericLiteral(node.callee.expressions[0], { value: 0 })) {
        const m = node.callee.expressions[1];
        if (t.isMemberExpression(m) && t.isIdentifier(m.object, { name: 'S' })) { reactNames.add(m.property.name); node.callee = t.identifier(m.property.name); return; }
        if (t.isMemberExpression(m) && t.isIdentifier(m.object, { name: 'fn' })) { usesCreateRoot = true; node.callee = t.identifier(m.property.name); return; }
      }
      if (isJsxCallee(node.callee)) {
        const j = toJSX(node);
        if (j) { if (t.isJSXElement(j) && j.openingElement.name.name === 'Fragment') needFragment = true; p.replaceWith(j); }
        else leftoverJsx = true;
      }
    },
  },
  MemberExpression(p) {
    if (t.isIdentifier(p.node.object, { name: 'S' }) && !p.node.computed) { reactNames.add(p.node.property.name); p.replaceWith(t.identifier(p.node.property.name)); }
  },
});

// 3) İkon ve zod bağlamalarını yeniden adlandır
traverse(ast, {
  Identifier(p) {
    if (!p.isReferencedIdentifier()) return;
    if (p.scope.hasBinding(p.node.name)) return; // yerel gölgeleme
    if (iconMap[p.node.name]) { p.node.name = iconMap[p.node.name]; return; }
    if (zodMap[p.node.name]) { p.replaceWith(t.memberExpression(t.identifier('z'), t.identifier(zodMap[p.node.name]))); }
  },
  JSXIdentifier(p) {
    if (iconMap[p.node.name] && !p.scope.hasBinding(p.node.name)) p.node.name = iconMap[p.node.name];
  },
});

// 4) Okunabilirlik: !0/!1/void 0, ifadesiz şablon dizeleri
traverse(ast, {
  UnaryExpression(p) {
    const { node } = p;
    if (node.operator === '!' && t.isNumericLiteral(node.argument)) p.replaceWith(t.booleanLiteral(!node.argument.value));
    else if (node.operator === 'void' && t.isNumericLiteral(node.argument, { value: 0 })) p.replaceWith(t.identifier('undefined'));
  },
  TemplateLiteral(p) {
    if (p.node.expressions.length === 0 && !p.parentPath.isTaggedTemplateExpression()) p.replaceWith(t.stringLiteral(p.node.quasis[0].value.cooked));
  },
});

// 5) Serbest değişken kontrolü: tanımsız kalan isim olmamalı
const usedIcons = new Set(Object.values(iconMap));
const free = new Set();
traverse(ast, {
  'Identifier|JSXIdentifier'(p) {
    const n = p.node.name;
    if (p.isJSXIdentifier()) { if (!/^[A-Z]/.test(n) || p.parentPath.isJSXAttribute() || p.parentPath.isJSXMemberExpression() && p.key === 'property') return; }
    else if (!p.isReferencedIdentifier()) return;
    if (p.scope.hasBinding(n) || reactNames.has(n) || usedIcons.has(n) || n === 'z' || n === 'createRoot' || n === 'Fragment' || n in globalThis || ['undefined','structuredClone','localStorage','document','window','navigator','crypto','location','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','__REACT_DEVTOOLS_GLOBAL_HOOK__','URLSearchParams','Blob','URL','Intl','FileReader'].includes(n)) return;
    free.add(n);
  },
});

const iconImports = [...new Set(Object.values(iconMap))].filter((n) => appCodeUses(n)).sort();
function appCodeUses(name) { let used = false; traverse(ast, { 'Identifier|JSXIdentifier'(p) { if (p.node.name === name) { used = true; p.stop(); } } }); return used; }
const header = [
  `import { ${[...reactNames, ...(needFragment ? ['Fragment'] : [])].sort().join(', ')} } from 'react';`,
  usesCreateRoot ? `import { createRoot } from 'react-dom/client';` : '',
  `import { z } from 'zod';`,
  `import { ${iconImports.join(', ')} } from 'lucide-react';`,
].filter(Boolean).join('\n');

const out = header + '\n\n' + generate(ast, { retainLines: false, jsescOption: { minimal: true } }).code + '\n';
writeFileSync(outPath, out);
console.log('react:', [...reactNames].join(','));
console.log('icons:', iconImports.length, 'leftover jsx calls:', leftoverJsx, 'free identifiers:', [...free].join(' ') || 'yok');
console.log('bytes', out.length);

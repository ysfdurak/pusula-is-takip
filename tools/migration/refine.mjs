// Dönüştürülmüş tek dosyayı (app.raw.jsx) okunabilir modüllere çevirir:
// güvenli yeniden adlandırma, props ve setter isimleri, modüllere bölme, import/export üretimi.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, relative, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prettier = await import('prettier');

const [inPath, namesPath, outDir] = process.argv.slice(2);
const names = JSON.parse(readFileSync(namesPath, 'utf8'));
const ast = parse(readFileSync(inPath, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
const stats = { renamed: 0, skipped: [] };

// 1) (0, X)(...) → X(...)
traverse(ast, {
  CallExpression(p) {
    const c = p.node.callee;
    if (t.isSequenceExpression(c) && c.expressions.length === 2 && t.isNumericLiteral(c.expressions[0], { value: 0 }) && t.isIdentifier(c.expressions[1])) p.node.callee = c.expressions[1];
  },
});

// 2) Çok değişkenli üst düzey tanımları ayır
ast.program.body = ast.program.body.flatMap((s) =>
  t.isVariableDeclaration(s) && s.declarations.length > 1 ? s.declarations.map((d) => t.variableDeclaration(s.kind, [d])) : [s]);

// 3) Modül etiketleri (özgün isimlerle, yeniden adlandırmadan önce)
const declNames = (s) => t.isFunctionDeclaration(s) ? [s.id.name] : t.isVariableDeclaration(s) ? s.declarations.map((d) => d.id.name) : [];
{
  let current = null; let idx = 0;
  const ranges = names.modules;
  for (const s of ast.program.body) {
    if (t.isImportDeclaration(s)) continue;
    const dn = declNames(s);
    if (idx < ranges.length && dn.includes(ranges[idx][1])) { current = ranges[idx]; idx++; }
    s._module = current ? current[0] : 'MISSING';
    if (t.isExpressionStatement(s)) s._module = 'main.jsx';
  }
  if (idx !== ranges.length) throw new Error('Modül aralığı bulunamadı: ' + ranges[idx][1]);
}
// yeniden parse etmeden scope'ları tazele
traverse.cache.clear?.();
let programPath;
traverse(ast, { Program(p) { programPath = p; p.scope.crawl(); } });

// Güvenli yeniden adlandırma: yeni isim, referans noktalarında başka bir bağlamayı gölgelememeli
function safeRename(binding, newName) {
  const old = binding.identifier.name;
  if (old === newName) return true;
  const scope = binding.scope;
  if (scope.hasOwnBinding(newName)) return fail();
  for (const ref of [binding.path, ...binding.referencePaths, ...binding.constantViolations]) {
    const b = ref.scope.getBinding(newName);
    if (b && b !== binding) return fail();
  }
  // binding kapsamındaki dış referanslar (aynı isimde) yakalanmamalı
  let clash = false;
  scope.path.traverse({
    'Identifier|JSXIdentifier'(p) {
      if (p.node.name !== newName) return;
      if (p.isJSXIdentifier() && (p.parentPath.isJSXAttribute() || (p.parentPath.isJSXMemberExpression() && p.key === 'property'))) return;
      if (p.isIdentifier() && !p.isReferencedIdentifier() && !p.isBindingIdentifier()) return;
      const b = p.scope.getBinding(newName);
      if (!b || !isInside(b.scope, scope)) { clash = true; p.stop(); }
    },
  });
  if (clash) return fail();
  scope.rename(old, newName);
  stats.renamed++;
  return true;
  function fail() { stats.skipped.push(`${old}→${newName}`); return false; }
}
function isInside(inner, outer) { for (let s = inner; s; s = s.parent) if (s === outer) return true; return false; }
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// 4) Üst düzey isimler
for (const [from, to] of Object.entries(names.top)) {
  const b = programPath.scope.getBinding(from);
  if (!b) { stats.skipped.push(`top ${from} yok`); continue; }
  safeRename(b, to);
}

// 5) Fonksiyon içi isimler + useState setter'ları
function renameStatePairs(fnPath, map) {
  const pairs = [];
  for (const [name, b] of Object.entries(fnPath.scope.bindings)) {
    if (b.path.isVariableDeclarator() && t.isArrayPattern(b.path.node.id)) {
      const els = b.path.node.id.elements;
      if (els[0]?.name === name && els[1] && t.isCallExpression(b.path.node.init) && t.isIdentifier(b.path.node.init.callee, { name: 'useState' })) pairs.push([name, els[1].name]);
    }
  }
  const named = new Set();
  // fonksiyonun kendi kapsamı + iç blok kapsamları (iç fonksiyonlar hariç), kaynak sırasına göre
  const own = (from) => {
    const found = [];
    const add = (sc) => { const b = sc.getOwnBinding(from); if (b) found.push(b); };
    add(fnPath.scope);
    fnPath.traverse({ Scope(sp) { if (sp.scope.getFunctionParent() === fnPath.scope && sp.scope !== fnPath.scope) add(sp.scope); }, Function(fp) { fp.skip(); } });
    return found.sort((x, y) => x.identifier.start - y.identifier.start);
  };
  for (const [from, to] of Object.entries(map)) {
    const targets = Array.isArray(to) ? to : [to];
    own(from).slice(0, targets.length).forEach((b, i) => { if (targets[i] && safeRename(b, targets[i])) named.add(targets[i]); });
  }
  for (const [, setter] of pairs) {
    const decl = fnPath.scope.getBinding(setter).path.node.id.elements[0].name;
    if (!named.has(decl)) continue; // durum adı verilmemiş
    const b = fnPath.scope.getBinding(setter);
    if (b) safeRename(b, 'set' + cap(decl));
  }
}
// 6) Props yapı bozma: { state: e } → { state }
function renameProps(fnPath) {
  const param = fnPath.node.params[0];
  if (!t.isObjectPattern(param)) return;
  for (const prop of param.properties) {
    if (!t.isObjectProperty(prop) || prop.computed || !t.isIdentifier(prop.key)) continue;
    const valueId = t.isAssignmentPattern(prop.value) ? prop.value.left : prop.value;
    if (!t.isIdentifier(valueId) || valueId.name === prop.key.name) continue;
    const b = fnPath.scope.getBinding(valueId.name);
    if (b && safeRename(b, prop.key.name)) prop.shorthand = true;
  }
}
traverse(ast, {
  'FunctionDeclaration|ArrowFunctionExpression|FunctionExpression'(p) {
    renameProps(p);
    const fname = p.node.id?.name;
    renameStatePairs(p, (fname && names.locals[fname]) || {});
  },
});
// shorthand işaretini, anahtar ve değer aynı olan tüm nesne desenlerine uygula
traverse(ast, { ObjectProperty(p) { const v = t.isAssignmentPattern(p.node.value) ? p.node.value.left : p.node.value; if (!p.node.computed && t.isIdentifier(p.node.key) && t.isIdentifier(v) && v.name === p.node.key.name) p.node.shorthand = true; } });
programPath.scope.crawl();

// 6b) Küçültmeyi geri alma: ifade-komutları, virgüllü ifadeler, çok değişkenli tanımlar
const toStatements = (expr) => {
  if (t.isIdentifier(expr, { name: 'undefined' }) || t.isLiteral(expr)) return [];
  if (t.isSequenceExpression(expr)) return expr.expressions.flatMap(toStatements);
  if (t.isLogicalExpression(expr) && (expr.operator === '&&' || expr.operator === '||'))
    return [t.ifStatement(expr.operator === '&&' ? expr.left : negate(expr.left), block(toStatements(expr.right)))];
  if (t.isConditionalExpression(expr))
    return [t.ifStatement(expr.test, block(toStatements(expr.consequent)), block(toStatements(expr.alternate)))];
  return [t.expressionStatement(expr)];
};
const negate = (e) => (t.isUnaryExpression(e, { operator: '!' }) ? e.argument : t.unaryExpression('!', e));
const block = (stmts) => t.blockStatement(stmts);
let unmin = 0;
for (let pass = 0; pass < 3; pass++) traverse(ast, {
  ExpressionStatement(p) {
    const e = p.node.expression;
    if (t.isSequenceExpression(e) || (t.isLogicalExpression(e) && ['&&', '||'].includes(e.operator)) || t.isConditionalExpression(e)) {
      if (p.parentPath.isProgram() && !t.isSequenceExpression(e)) return;
      const stmts = toStatements(e);
      if (stmts.length === 1 && t.isExpressionStatement(stmts[0]) && stmts[0].expression === e) return;
      if (p.parentPath.isBlockStatement() || p.parentPath.isProgram() || p.parentPath.isSwitchCase()) p.replaceWithMultiple(stmts); else p.replaceWith(block(stmts));
      unmin++;
    }
  },
  ReturnStatement(p) {
    const a = p.node.argument;
    if (t.isSequenceExpression(a) && (p.parentPath.isBlockStatement() || p.parentPath.isSwitchCase())) {
      const last = a.expressions[a.expressions.length - 1];
      p.replaceWithMultiple([...a.expressions.slice(0, -1).flatMap(toStatements), t.returnStatement(last)]);
      unmin++;
    }
  },
  VariableDeclaration(p) {
    if (p.node.declarations.length > 1 && (p.parentPath.isBlockStatement() || p.parentPath.isProgram()) && !p.parentPath.isForStatement?.()) {
      p.replaceWithMultiple(p.node.declarations.map((d) => t.variableDeclaration(p.node.kind, [d])));
      unmin++;
    }
  },
  IfStatement(p) { // if (a) b; else c;  gövdelerini blokla
    for (const k of ['consequent', 'alternate']) { const n = p.node[k]; if (n && !t.isBlockStatement(n) && !t.isIfStatement(n)) p.node[k] = block([n]); }
    if (p.node.alternate && t.isBlockStatement(p.node.alternate) && p.node.alternate.body.length === 0) p.node.alternate = null;
  },
});
programPath.scope.crawl();

// 6c) Dizi geri çağrılarındaki parametreler
const SINGULAR = { tasks: 'task', members: 'member', teams: 'team', projects: 'project', blockers: 'blocker', decisions: 'decision', templates: 'template', comments: 'comment', notifications: 'notification', checklist: 'step', assignees: 'email', watchers: 'email', leads: 'email', workspaces: 'space', activities: 'activity', times: 'entry', timeEntries: 'entry', depends: 'dependencyId', relatedTeamIds: 'teamId', details: 'detail', conflicts: 'conflict', items: 'item', workload: 'row', upcoming: 'day', columns: 'column', options: 'option', people: 'person', changes: 'change', records: 'record', events: 'event' };
const ITER = new Set(['filter', 'map', 'some', 'every', 'find', 'findIndex', 'forEach', 'flatMap', 'findLast']);
let cbNamed = 0;
traverse(ast, {
  'ArrowFunctionExpression|FunctionExpression'(p) {
    const call = p.parentPath;
    if (!call.isCallExpression() || call.node.arguments[0] !== p.node || !t.isMemberExpression(call.node.callee)) return;
    const method = call.node.callee.property.name;
    let obj = call.node.callee.object;
    while (t.isCallExpression(obj) && t.isMemberExpression(obj.callee) && ['filter', 'slice', 'sort', 'concat', 'reverse'].includes(obj.callee.property.name)) obj = obj.callee.object;
    const coll = t.isMemberExpression(obj) && !obj.computed ? obj.property.name : t.isIdentifier(obj) ? obj.name : null;
    const params = p.node.params;
    const rename = (param, name) => { if (t.isIdentifier(param) && param.name.length <= 2) { const b = p.scope.getBinding(param.name); if (b && safeRename(b, name)) cbNamed++; } };
    if (ITER.has(method) && coll && SINGULAR[coll]) { rename(params[0], SINGULAR[coll]); if (method !== 'filter') rename(params[1], 'index'); }
    else if (method === 'sort') { rename(params[0], 'a'); rename(params[1], 'b'); }
    else if (method === 'reduce') { rename(params[0], 'sum'); if (coll && SINGULAR[coll]) rename(params[1], SINGULAR[coll]); }
  },
});
programPath.scope.crawl();
console.log('küçültme geri alındı:', unmin, '| geri çağrı parametresi:', cbNamed);

// 6d) Bağlamdan isim: catch, olay parametreleri, find/filter ve çağrı sonuçları
let ctxNamed = 0;
const short = (n) => /^[a-zA-Z$_]{1,2}$/.test(n);
const tryNames = (b, candidates) => { for (const c of candidates) if (c && safeRename(b, c)) { ctxNamed++; return true; } return false; };
traverse(ast, {
  CatchClause(p) { const prm = p.node.param; if (t.isIdentifier(prm) && short(prm.name)) tryNames(p.scope.getBinding(prm.name), ['err', 'saveError', 'requestError']); },
  'ArrowFunctionExpression|FunctionExpression|FunctionDeclaration'(p) {
    const prm = p.node.params[0];
    if (!t.isIdentifier(prm) || !short(prm.name)) return;
    const b = p.scope.getBinding(prm.name);
    if (!b || !b.referencePaths.length) return;
    const eventProps = new Set(['target', 'currentTarget', 'preventDefault', 'stopPropagation', 'key', 'shiftKey', 'ctrlKey', 'metaKey', 'dataTransfer', 'clientX', 'clientY', 'relatedTarget', 'nativeEvent']);
    if (b.referencePaths.every((r) => r.parentPath.isMemberExpression({ object: r.node }) && eventProps.has(r.parentPath.node.property.name))) tryNames(b, ['event', 'evt']);
  },
  VariableDeclarator(p) {
    if (!t.isIdentifier(p.node.id) || !short(p.node.id.name) || !p.node.init) return;
    const b = p.scope.getBinding(p.node.id.name);
    if (!b) return;
    let init = p.node.init;
    if (t.isAwaitExpression(init)) init = init.argument;
    if (t.isCallExpression(init) && t.isMemberExpression(init.callee) && !init.callee.computed) {
      const m = init.callee.property.name; let obj = init.callee.object;
      const coll = t.isMemberExpression(obj) && !obj.computed ? obj.property.name : t.isIdentifier(obj) ? obj.name : null;
      if (coll && SINGULAR[coll] && ['find', 'findLast'].includes(m)) { tryNames(b, [SINGULAR[coll], 'found' + cap(SINGULAR[coll]), 'current' + cap(SINGULAR[coll])]); return; }
      if (coll && SINGULAR[coll] && m === 'filter') { tryNames(b, ['matching' + cap(coll), 'filtered' + cap(coll)]); return; }
      if (coll && SINGULAR[coll] && m === 'findIndex') { tryNames(b, [SINGULAR[coll] + 'Index']); return; }
    }
    if (t.isCallExpression(init) && t.isIdentifier(init.callee)) {
      const mm = init.callee.name.match(/^(?:build|create|fetch|load|get|compute|apply|validate|parse|normalize)([A-Z]\w*)$/);
      if (mm) { const base = mm[1][0].toLowerCase() + mm[1].slice(1); tryNames(b, [base, 'next' + mm[1], base + 'Result']); return; }
      if (init.callee.name === 'structuredClone') { tryNames(b, ['copy', 'draft']); return; }
    }
    if (t.isNewExpression(init) && t.isIdentifier(init.callee, { name: 'FormData' })) tryNames(b, ['form', 'formData']);
  },
});
programPath.scope.crawl();
console.log('bağlamdan isim:', ctxNamed);

// 6e) Çağrı yerlerinden parametre adı, çoğuldan tekil, Object.entries çiftleri
const singularOf = (name) => {
  if (!name) return null;
  if (SINGULAR[name]) return SINGULAR[name];
  const m = name.match(/([A-Z]?[a-z]+)$/); if (!m) return null;
  const w = m[1].toLowerCase();
  if (SINGULAR[w]) return SINGULAR[w];
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ss|us)$/.test(w) || w.length < 4) return null;
  if (/s$/.test(w)) return w.slice(0, -1);
  return null;
};
const argName = (a) => t.isIdentifier(a) ? a.name : t.isMemberExpression(a) && !a.computed ? a.property.name : null;
const RESERVED = new Set(['default', 'class', 'function', 'new', 'delete', 'case', 'in', 'of', 'do', 'if', 'for', 'var', 'let', 'const', 'this', 'return', 'switch', 'with', 'yield', 'await', 'enum', 'export', 'import', 'super', 'void', 'typeof', 'true', 'false', 'null', 'undefined', 'length', 'current', 'id', 'value']);
let inferred = 0;
for (let round = 0; round < 2; round++) traverse(ast, {
  'FunctionDeclaration|VariableDeclarator'(p) {
    const fnNode = p.isFunctionDeclaration() ? p.node : (t.isArrowFunctionExpression(p.node.init) || t.isFunctionExpression(p.node.init)) ? p.node.init : null;
    if (!fnNode) return;
    const id = p.isFunctionDeclaration() ? p.node.id : p.node.id;
    if (!t.isIdentifier(id)) return;
    const fb = p.scope.getBinding(id.name) || p.parentPath.scope.getBinding(id.name);
    if (!fb) return;
    const fnPath = p.isFunctionDeclaration() ? p : p.get('init');
    fnNode.params.forEach((prm, i) => {
      const target = t.isAssignmentPattern(prm) ? prm.left : prm;
      if (!t.isIdentifier(target) || !short(target.name)) return;
      const counts = new Map();
      for (const r of fb.referencePaths) {
        if (!r.parentPath.isCallExpression({ callee: r.node })) continue;
        const n = argName(r.parentPath.node.arguments[i]);
        if (n && !short(n) && !RESERVED.has(n) && /^[a-z]/.test(n)) counts.set(n, (counts.get(n) || 0) + 1);
      }
      const best = [...counts].sort((a, b) => b[1] - a[1])[0];
      if (!best) return;
      const b = fnPath.scope.getBinding(target.name);
      if (b && b.scope === fnPath.scope && safeRename(b, best[0])) inferred++;
    });
  },
});
programPath.scope.crawl();
traverse(ast, {
  'ArrowFunctionExpression|FunctionExpression'(p) {
    const call = p.parentPath;
    if (!call.isCallExpression() || call.node.arguments[0] !== p.node || !t.isMemberExpression(call.node.callee)) return;
    const method = call.node.callee.property.name;
    if (!['filter', 'map', 'some', 'every', 'find', 'findIndex', 'forEach', 'flatMap', 'reduce'].includes(method)) return;
    let obj = call.node.callee.object;
    while (t.isCallExpression(obj) && t.isMemberExpression(obj.callee) && ['filter', 'slice', 'sort', 'concat', 'reverse'].includes(obj.callee.property.name)) obj = obj.callee.object;
    const prm = method === 'reduce' ? p.node.params[1] : p.node.params[0];
    // Object.entries(x).map(([e, t]) => …)
    if (t.isCallExpression(obj) && t.isMemberExpression(obj.callee) && t.isIdentifier(obj.callee.object, { name: 'Object' }) && obj.callee.property.name === 'entries' && t.isArrayPattern(prm)) {
      const [k, v] = prm.elements;
      if (t.isIdentifier(k) && short(k.name) && safeRename(p.scope.getBinding(k.name), 'key')) inferred++;
      if (t.isIdentifier(v) && short(v.name) && safeRename(p.scope.getBinding(v.name), 'value')) inferred++;
      return;
    }
    if (!t.isIdentifier(prm) || !short(prm.name)) return;
    const s = singularOf(argName(obj));
    if (s && !RESERVED.has(s) && safeRename(p.scope.getBinding(prm.name), s)) inferred++;
  },
});
programPath.scope.crawl();
console.log('çıkarımla isim:', inferred);

// 6f) Alan erişiminden tür tahmini ve kimlik kümeleri
const SIGNATURES = [
  ['notification', ['recipient', 'read_at']], ['entry', ['started', 'seconds', 'ended']],
  ['blocker', ['resolved', 'owner']], ['blocker', ['resolved']], ['step', ['done', 'text']],
  ['member', ['email', 'role']], ['member', ['email', 'active']], ['member', ['email', 'department']],
  ['team', ['members', 'leads']], ['team', ['leads']], ['team', ['workTypes']],
  ['task', ['assignees']], ['task', ['status', 'dueAt']], ['task', ['dueAt']], ['task', ['status']], ['task', ['checklist']],
  ['task', ['waitingReason']], ['project', ['goal']], ['template', ['task', 'name']], ['comment', ['body', 'author']],
  ['activity', ['field', 'before']], ['space', ['revision']],
];
let typed = 0;
traverse(ast, {
  Scope(p) {
    for (const [name, b] of Object.entries(p.scope.bindings)) {
      if (b.scope !== p.scope || !short(name) || ['a', 'b'].includes(name)) continue;
      // kimlik kümeleri: new Set(xs.map(x => x.id))
      if (b.path.isVariableDeclarator() && t.isNewExpression(b.path.node.init) && t.isIdentifier(b.path.node.init.callee) && ['Set', 'Map'].includes(b.path.node.init.callee.name)) {
        const arg = b.path.node.init.arguments[0];
        if (arg && t.isCallExpression(arg) && t.isMemberExpression(arg.callee)) {
          const coll = singularOf(argName(arg.callee.object));
          const body = arg.arguments[0]?.body;
          const field = t.isMemberExpression(body) && !body.computed ? body.property.name : t.isArrayExpression(body) ? 'byId' : null;
          if (coll && field) { if (tryNames(b, [field === 'byId' ? coll + 'ById' : coll + cap(field) + 's', coll + 'Set'])) typed++; continue; }
        }
        if (tryNames(b, [b.path.node.init.callee.name === 'Set' ? 'seen' : 'lookup'])) typed++;
        continue;
      }
      const props = new Set();
      for (const r of b.referencePaths) if (r.parentPath.isMemberExpression({ object: r.node }) && !r.parentPath.node.computed) props.add(r.parentPath.node.property.name);
      if (!props.size) continue;
      const hit = SIGNATURES.find(([, req]) => req.every((k) => props.has(k)));
      if (hit && tryNames(b, [hit[0], 'other' + cap(hit[0]), hit[0] + 'Item', 'current' + cap(hit[0])])) typed++;
    }
  },
});
programPath.scope.crawl();
console.log('alan erişiminden isim:', typed);
// for (let x of xs) → tekil isim
let loops = 0;
traverse(ast, {
  ForOfStatement(p) {
    const d = p.node.left; if (!t.isVariableDeclaration(d) || !t.isIdentifier(d.declarations[0].id)) return;
    const name = d.declarations[0].id.name; if (!short(name)) return;
    let right = p.node.right;
    if (t.isArrayExpression(right) && right.elements.length) right = t.isSpreadElement(right.elements[0]) ? right.elements[0].argument : right.elements[0];
    if (t.isNewExpression(right) && t.isIdentifier(right.callee, { name: 'Set' })) right = right.arguments[0];
    while (t.isCallExpression(right) && t.isMemberExpression(right.callee) && ['filter', 'slice', 'sort'].includes(right.callee.property.name)) right = right.callee.object;
    const s = singularOf(argName(right));
    const b = p.scope.getBinding(name);
    if (s && b && tryNames(b, [s, 'each' + cap(s)])) loops++;
  },
});
programPath.scope.crawl();
console.log('döngü değişkeni:', loops);

// 7) Modüllere böl
const external = new Map(); // bağlama adı → {source, imported}
for (const s of ast.program.body) if (t.isImportDeclaration(s)) for (const sp of s.specifiers) external.set(sp.local.name, { source: s.source.value, imported: sp.imported?.name || 'default' });
const topOf = (p) => { while (p.parentPath && !p.parentPath.isProgram()) p = p.parentPath; return p.node; };
const modules = new Map();
const declModule = new Map();
for (const s of ast.program.body) {
  if (t.isImportDeclaration(s)) continue;
  if (!modules.has(s._module)) modules.set(s._module, { stmts: [], imports: new Map(), external: new Map(), exports: new Set() });
  modules.get(s._module).stmts.push(s);
  for (const n of declNames(s)) declModule.set(n, s._module);
}
for (const [name, b] of Object.entries(programPath.scope.bindings)) {
  for (const ref of b.referencePaths) {
    const st = topOf(ref); const user = st._module;
    if (!user) continue;
    if (external.has(name)) { modules.get(user).external.set(name, external.get(name)); continue; }
    const owner = declModule.get(name);
    if (owner && owner !== user) { modules.get(user).imports.set(name, owner); modules.get(owner).exports.add(name); }
  }
}
// döngü kontrolü
const graph = new Map([...modules].map(([m, v]) => [m, new Set(v.imports.values())]));
const cycles = [];
const visit = (m, stack) => { if (stack.includes(m)) { cycles.push([...stack.slice(stack.indexOf(m)), m].join(' → ')); return; } for (const d of graph.get(m) || []) visit(d, [...stack, m]); };
for (const m of graph.keys()) visit(m, []);

rmSync(outDir, { recursive: true, force: true });
const relImport = (from, to) => { let r = relative(dirname(from), to).replace(/\\/g, '/'); if (!r.startsWith('.')) r = './' + r; return r; };
const extOrder = ['react', 'react-dom/client', 'zod', 'lucide-react'];
for (const [file, mod] of modules) {
  const lines = [];
  const bySource = new Map();
  for (const [local, { source, imported }] of mod.external) { if (!bySource.has(source)) bySource.set(source, []); bySource.get(source).push(imported === local ? local : `${imported} as ${local}`); }
  for (const src of [...bySource.keys()].sort((a, b) => extOrder.indexOf(a) - extOrder.indexOf(b))) lines.push(`import { ${bySource.get(src).sort().join(', ')} } from '${src}';`);
  const internal = new Map();
  for (const [name, owner] of mod.imports) { if (!internal.has(owner)) internal.set(owner, []); internal.get(owner).push(name); }
  for (const owner of [...internal.keys()].sort()) lines.push(`import { ${internal.get(owner).sort().join(', ')} } from '${relImport(file, owner).replace(/\.(jsx|js)$/, '.$1')}';`);
  if (file === 'main.jsx') lines.unshift(`import './styles.css';`);
  const body = mod.stmts.map((s) => {
    if (t.isVariableDeclaration(s)) {
      const b = programPath.scope.getBinding(s.declarations[0].id.name);
      if (b && b.constantViolations.length === 0) s.kind = 'const'; else if (s.kind === 'var') s.kind = 'let';
    }
    const code = generate(s, { jsescOption: { minimal: true } }).code;
    return declNames(s).some((n) => mod.exports.has(n)) ? 'export ' + code : code;
  });
  let code = lines.join('\n') + '\n\n' + body.join('\n\n') + '\n';
  code = await prettier.format(code, { parser: 'babel', printWidth: 110, singleQuote: true });
  const out = join(outDir, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
}
console.log('yeniden adlandırılan:', stats.renamed, '| atlanan:', stats.skipped.length, stats.skipped.slice(0, 40).join(' '));
console.log('modüller:', modules.size, '| döngü:', cycles.length ? [...new Set(cycles)].join('; ') : 'yok');

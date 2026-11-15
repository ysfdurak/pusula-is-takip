// Çeviri araçlarının ortak kısmı: kaynak kodu (JS/JSX) ayrıştırır ve çevrilebilir metinleri anahtarlarıyla bulur.
// Anahtar biçimi (sözlükte de aynısı):
//   dizgi      → değerin kendisi
//   JSX metni  → boşlukları tek boşluğa indirilmiş, kırpılmış metin
//   şablon     → `a ${x} b ${y}` → "a {0} b {1}"
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';
import * as walk from 'acorn-walk';

const Parser = acorn.Parser.extend(jsx());
export const parse = (code) => Parser.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });

const base = { ...walk.base };
base.JSXElement = (n, st, c) => { c(n.openingElement, st); n.children.forEach((ch) => c(ch, st)); };
base.JSXFragment = (n, st, c) => n.children.forEach((ch) => c(ch, st));
base.JSXOpeningElement = (n, st, c) => n.attributes.forEach((a) => c(a, st));
base.JSXAttribute = (n, st, c) => { if (n.value) c(n.value, st); };
base.JSXSpreadAttribute = (n, st, c) => c(n.argument, st, 'Expression');
base.JSXExpressionContainer = (n, st, c) => { if (n.expression.type !== 'JSXEmptyExpression') c(n.expression, st, 'Expression'); };
for (const k of ['JSXText', 'JSXEmptyExpression', 'JSXIdentifier', 'JSXMemberExpression', 'JSXNamespacedName', 'JSXClosingElement', 'JSXOpeningFragment', 'JSXClosingFragment']) base[k] = () => {};

// Metnin hemen önünde sayı olabilecek bir ifade var mı? Desteklenen biçimler:
//   {n} görev · {n}{' görev'} · {n}<em>görev</em> · <strong>{n}</strong><small>açık görev</small>
// Yalnızca yan etkisiz ifadeler (değişken, x.length, a || 0 gibi) iki kez yazılabildiği için onlar seçilir.
const PURE = /^(Identifier|MemberExpression|LogicalExpression|ConditionalExpression|BinaryExpression)$/;
// Math.ceil(x), Number(x) gibi saf çağrılar da kabul edilir
const pure = (e) => PURE.test(e.type) || (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && e.callee.object.type === 'Identifier' && e.callee.object.name === 'Math') || (e.type === 'CallExpression' && e.callee.type === 'Identifier' && e.callee.name === 'Number');
const blank = (c) => c.type === 'JSXText' && !c.value.trim();
function prevSibling(list, node) {
  for (let i = list.indexOf(node) - 1; i >= 0; i--) if (!blank(list[i])) return list[i];
  return null;
}
function countExpr(c) {
  if (!c) return null;
  if (c.type === 'JSXExpressionContainer') return pure(c.expression) ? c.expression : null;
  if (c.type === 'JSXElement') {
    const kids = c.children.filter((k) => !blank(k));
    return kids.length === 1 ? countExpr(kids[0]) : null;
  }
  return null;
}
function countBefore(n, anc) {
  const par = anc[anc.length - 2];
  if (!par || !par.children) return null;
  const prev = prevSibling(par.children, n);
  if (prev) return prev.type === 'JSXExpressionContainer' ? countExpr(prev) : null;
  // Metin bir öğenin tek içeriği: öğenin önündeki kardeşe bak
  const gp = anc[anc.length - 3];
  if (par.type === 'JSXElement' && par.children.filter((k) => !blank(k)).length === 1 && gp && gp.children) return countExpr(prevSibling(gp.children, par));
  return null;
}

export const TR = /[çğıöşüÇĞİÖŞÜ]/;
/** Doğal dil metni mi (Türkçe arayüz metni olma ihtimali)? Yalnızca çıkarma için; dönüştürme sözlüğe bakar. */
export function isNatural(t) {
  const s = String(t).trim();
  if (!s || !/[A-Za-zçğıöşüÇĞİÖŞÜ]{2,}/.test(s)) return false;
  if (/^(https?:|data:|mailto:|\/\/|\.\/|\.\.\/|\/)/.test(s)) return false;
  if (/^[a-z]+([A-Z][a-z0-9]*)+$/.test(s)) return false;
  if (/^[\w.-]+\.(js|jsx|css|png|svg|webp|jpg|json|html|xlsx|pdf)$/.test(s)) return false;
  if (TR.test(s)) return true;
  if (/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(s)) return true;
  if (/[a-zçğıöşü]{2,} [a-zçğıöşü]{2,}/.test(s)) return true;
  return false;
}

const tplKey = (n) => n.quasis.map((q, i) => (i ? '{' + (i - 1) + '}' : '') + (q.value.cooked ?? q.value.raw)).join('');
const jsxKey = (v) => v.replace(/\s+/g, ' ').trim();

/**
 * Kaynaktaki aday metinleri bulur.
 * @returns {Array<{kind:'str'|'jsxattr'|'jsxtext'|'tpl', key:string, node:any}>}
 */
export function candidates(code) {
  const ast = parse(code);
  const out = [];
  walk.fullAncestor(ast, (n, st, anc) => {
    const parent = anc[anc.length - 2];
    if (n.type === 'Literal' && typeof n.value === 'string') {
      if (!parent) return;
      if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === n && !parent.computed) return;
      if (/Import|Export/.test(parent.type)) return;
      if (parent.type === 'ExpressionStatement' && parent.directive) return;
      out.push({ kind: parent.type === 'JSXAttribute' ? 'jsxattr' : 'str', key: n.value, node: n, prev: parent.type === 'JSXExpressionContainer' ? countBefore(parent, anc.slice(0, -1)) : parent.type === 'BinaryExpression' && parent.operator === '+' && parent.right === n && pure(parent.left) ? parent.left : null });
    } else if (n.type === 'JSXText') {
      const key = jsxKey(n.value);
      if (key) out.push({ kind: 'jsxtext', key, node: n, prev: countBefore(n, anc) });
    } else if (n.type === 'TemplateLiteral') {
      if (parent && parent.type === 'TaggedTemplateExpression') return;
      out.push({ kind: 'tpl', key: tplKey(n), node: n });
    }
  }, base);
  return out;
}

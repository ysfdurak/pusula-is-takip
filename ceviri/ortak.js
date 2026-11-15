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
      out.push({ kind: parent.type === 'JSXAttribute' ? 'jsxattr' : 'str', key: n.value, node: n });
    } else if (n.type === 'JSXText') {
      const key = jsxKey(n.value);
      if (key) out.push({ kind: 'jsxtext', key, node: n });
    } else if (n.type === 'TemplateLiteral') {
      if (parent && parent.type === 'TaggedTemplateExpression') return;
      out.push({ kind: 'tpl', key: tplKey(n), node: n });
    }
  }, base);
  return out;
}

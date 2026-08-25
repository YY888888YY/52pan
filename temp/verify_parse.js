
const parser = require('D:\\Users\\LDY\\Downloads\\down_52pojie_cn\\node_modules\\@babel\\parser');
const fs = require('fs');
const files = ['D:\\Users\\LDY\\Downloads\\down_52pojie_cn\\src/App.vue', 'D:\\Users\\LDY\\Downloads\\down_52pojie_cn\\src/components/FilePath.vue'];
let ok = true;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { console.log('NO SCRIPT TAG: ' + f); ok = false; continue; }
  try {
    parser.parse(m[1], { sourceType: 'module', plugins: ['jsx', 'optionalChaining', 'classProperties'] });
    console.log('OK: ' + f);
  } catch (e) {
    ok = false;
    console.log('FAIL: ' + f + ' -> ' + e.message);
  }
}
process.exit(ok ? 0 : 1);

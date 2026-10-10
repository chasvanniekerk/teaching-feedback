import fs from 'node:fs';
import vm from 'node:vm';

const files = fs.readdirSync('.').filter(f => f.endsWith('.html')).sort();
const existing = new Set(files);
const bases = [...new Set(files.map(f => f.replace(/-(nl|es)\.html$/, '.html')))];
const errors = [];
function check(ok, message) {
  if (!ok) errors.push(message);
}

for (const base of bases) {
  const stem = base.replace(/\.html$/, '');
  for (const lang of ['en', 'nl', 'es']) {
    const filename = stem + (lang === 'en' ? '' : '-'+lang)+'.html';
    check(existing.has(filename), 'Missing translation: '+filename);
  }
}
check(bases.length === 16, 'Expected 16 page groups, found '+bases.length);
check(files.length === 48, 'Expected 48 pages, found '+files.length);

for (const filename of files) {
  const html = fs.readFileSync(filename, 'utf8');
  const lang = filename.endsWith('-nl.html') ? 'nl' :
    filename.endsWith('-es.html') ? 'es' : 'en';
  const declared = html.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1];
  check(declared === lang, filename+': expected html lang='+lang+', found '+declared);
  check(html.includes('didactics-language.js'), filename+': missing selector script');
  check((html.match(/<script\b/gi)||[]).length === (html.match(/<\/script>/gi)||[]).length,
    filename+': script element count mismatch');
  let match, n=0;
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((match=scripts.exec(html))) {
    n++;
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    try { new vm.Script(match[2], {filename:filename+'#script'+n}); }
    catch (err) { errors.push(filename+': invalid JavaScript '+n+': '+err.message); }
  }
  const links = /\bhref=["']([^"'#?]+\.html)(?:[?#][^"']*)?["']/gi;
  while ((match=links.exec(html))) {
    const target=match[1];
    if (!/^(https?:)?\/\//.test(target) && !target.startsWith('/'))
      check(existing.has(target), filename+': dead HTML link '+target);
  }
  if (/^survey(?:-(?:nl|es))?\.html$/.test(filename)) {
    check(html.includes('Array(33).fill(null)'), filename+': Teacher360 count changed');
    check(html.includes("API+'responses'"), filename+': response endpoint changed');
    check(html.includes('Self-assessment'), filename+': missing canonical group label');
  }
  if (/^sparks-knowledge-quiz(?:-(?:nl|es))?\.html$/.test(filename)) {
    const count=(html.match(/,"c":[0-3],"f":/g)||[]).length ||
                (html.match(/,c:[0-3],f:/g)||[]).length;
    check(count===12,filename+': expected 12 scored quiz questions, got '+count);
  }
  if (/^sparks-preference-survey(?:-(?:nl|es))?\.html$/.test(filename))
    check(html.includes('length:20'), filename+': missing 20-response array');
}
const navigation=fs.readFileSync('didactics-language.js','utf8');
check(navigation.includes('location.search+location.hash'),
  'Language switching must preserve query parameters and anchors');
check(!/localStorage|sessionStorage|document\.cookie/i.test(navigation),
  'Language selector must not persist tracking data');
try {new vm.Script(navigation, {filename:'didactics-language.js'});}
catch (err) {errors.push('Language selector: '+err.message);}
console.log('Audited '+files.length+' pages across '+bases.length+' groups.');
if (errors.length) {
  for(const err of errors) console.error('FAIL:',err);
  process.exitCode=1;
} else console.log('PASS: language coverage, links, inline scripts and key questionnaire invariants.');

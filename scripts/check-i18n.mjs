import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const files = fs.readdirSync('.').filter(f => f.endsWith('.html')).sort();
const all = new Set(files);
const bases = [...new Set(files.map(f => f.replace(/-(nl|es)\.html$/, '.html')))];
const errors = [];
function check(ok, message) { if (!ok) errors.push(message); }
for (const base of bases) {
  const stem = base.replace(/\.html$/, '');
  for (const lang of ['en','nl','es']) {
    const filename = stem + (lang === 'en' ? '' : '-'+lang)+'.html';
    check(all.has(filename), 'Missing translation: ' + filename);
  }
}
check(bases.length === 16, 'Expected 16 unique page groups, got '+bases.length);
for (const filename of files) {
  const html = fs.readFileSync(filename,'utf8');
  const lang = filename.endsWith('-nl.html') ? 'nl' : filename.endsWith('-es.html') ? 'es' : 'en';
  check(new RegExp('<html\\b[^>]*\\blang=["\\\']'+lang+'["\\\']','i').test(html), filename+': invalid or absent html[lang]');
  check(html.includes('didactics-language.js'), filename+': missing language navigation script');
  const opens = (html.match(/<script\\b/gi)||[]).length;
  const closes = (html.match(/<\\/script>/gi)||[]).length;
  check(opens===closes, filename+': unbalanced script tags');
  const pattern = /<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi;
  let script, i=0;
  while((script=pattern.exec(html))) {
    i++;
    if (/\\bsrc\\s*=/.test(script[1]) || !script[2].trim()) continue;
    try { new vm.Script(script[2],{ filename:filename+'#inline-'+i }); }
    catch(err) { errors.push(filename+': JavaScript syntax error in script '+i+': '+err.message); }
  }
  const links = /\\bhref=["']([^"'#?]+\\.html)(?:[?#][^"']*)?["']/gi;
  let link;
  while((link=links.exec(html))) {
    const target = link[1];
    if (/^https?:\\/\\//.test(target)) continue;
    check(all.has(target), filename+': broken page link to '+target);
  }
  if (filename.startsWith('survey') && !filename.startsWith('survey-') || /^survey-(?:nl|es)\\.html$/.test(filename)) {
    check(html.includes('Array(33).fill(null)'),filename+': Teacher360 33-question count changed');
    check(html.includes("API+'responses'"),filename+': Teacher360 responses endpoint changed');
    check(html.includes('Self-assessment'),filename+': canonical self-assessment grouping missing');
  }
  if (filename.startsWith('sparks-knowledge-quiz')) {
    check((html.match(/,"c":[0-3],"f":/g)||[]).length===12 || (html.match(/,c:[0-3],f:/g)||[]).length===12, filename+': quiz must contain 12 scored questions');
  }
  if (filename.startsWith('sparks-preference-survey')) {
    check(html.includes('length:20'), filename+': SPARKS 20-situation questionnaire changed');
  }
}
const nav=fs.readFileSync('didactics-language.js','utf8');
check(nav.includes('location.search+location.hash'), 'Language changes must preserve survey/dashboard URL tokens and anchors');
check(!/localStorage|sessionStorage|document\\.cookie/i.test(nav), 'Language navigation must not create persistent storage or cookies');
try {new vm.Script(nav,{filename:'didactics-language.js'});}catch(err){errors.push('Language selector syntax: '+err.message);}
console.log('Checked '+files.length+' HTML pages, '+bases.length+' languages groups and inline JavaScript syntax.');
if(errors.length) {console.error(errors.join('\\n'));process.exitCode=1;}
else console.log('PASS: file existence, language attributes, selector inclusion, relative HTML links, script balance, JavaScript syntax and questionnaire invariants.');

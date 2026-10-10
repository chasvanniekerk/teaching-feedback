import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const mime = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let name=pathname==='/'?'index.html':pathname.slice(1);
  if (name.includes('..')) {res.writeHead(400);res.end();return;}
  const file=path.join(root,name);
  if(!fs.existsSync(file)) {res.writeHead(404);res.end('missing '+name);return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const codes=Array.from({length:12},(_,i)=>'wl'+String(i+1).padStart(2,'0'));
const values=Object.fromEntries(codes.map(k=>[k,5]));
const dashboardData=[
 {id:null,expires_at:'2030-12-31T00:00:00Z'},
 {id:'r1',respondent_group:'Student – Year 1',response_count:1,created_at:'2026-10-10T00:00:00Z',...values}
];
const fakeSurvey={id:'test-survey-id',survey_code:'TESTCODE',dashboard_key:'TESTKEY',expires_at:'2030-12-31T00:00:00Z'};
let postedResponses=[];
await page.route('https://dzyeybyfeymvsrxpqrqh.supabase.co/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.includes('/functions/v1/')) return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  if(u.pathname.endsWith('/surveys')) return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify([fakeSurvey])});
  if(u.pathname.includes('/surveys')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([fakeSurvey])});
  if(u.pathname.endsWith('/responses')) {
    postedResponses.push(JSON.parse(route.request().postData()||'{}'));
    return route.fulfill({status:201,contentType:'application/json',body:'{}'});
  }
  if(u.pathname.includes('dashboard_results')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboardData)});
  if(u.pathname.includes('feedback_summary')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([])});
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
});
await page.route('https://cdn.jsdelivr.net/**',async route=>{
  return route.fulfill({status:200,contentType:'application/javascript',
    body:'window.Chart=class Chart {constructor(){}}; window.XLSX={utils:{book_new:()=>({}),book_append_sheet:()=>{},aoa_to_sheet:()=>({})},writeFile:()=>{}};'});
});
const fileNames=fs.readdirSync(root).filter(f=>f.endsWith('.html')).sort();
assert.equal(fileNames.length,48);
const names=new Set(fileNames);
const baseNames=[...new Set(fileNames.map(x=>x.replace(/-(nl|es)\.html$/,'.html')))];
for(const base of baseNames) for(const lang of ['en','nl','es'])
  assert(names.has(base.replace('.html',(lang==='en'?'':'-'+lang)+'.html')));
for(const file of fileNames) {
  const response=await page.goto(origin+'/'+file,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200,file+' HTTP status');
  await page.locator('nav.didactics-language').waitFor({state:'attached'});
  const links=await page.locator('nav.didactics-language a').evaluateAll(as=>as.map(a=>({label:a.textContent.trim(),url:new URL(a.href).pathname.split('/').pop()})));
  assert.deepEqual(links.map(x=>x.label),['EN','NL','ES'],file+' selector labels');
  const stem=file.replace(/-(nl|es)\.html$/,'.html').replace(/\.html$/,'');
  for(let i=0;i<3;i++){
    const lang=['en','nl','es'][i];
    assert.equal(links[i].url,stem+(lang==='en'?'':'-'+lang)+'.html',file+' equivalent translation');
  }
  assert.equal(await page.locator('html').getAttribute('lang'),file.endsWith('-nl.html')?'nl':file.endsWith('-es.html')?'es':'en');
}
console.log('PASS: 48 real browser loads; language selector, links and HTML lang');

for(const lang of ['en','nl','es']) {
  const suffix=lang==='en'?'':'-'+lang;
  const surveyFile='survey'+suffix+'.html';
  await page.goto(origin+'/'+surveyFile+'?s=TESTCODE',{waitUntil:'domcontentloaded'});
  const href=await page.locator('nav.didactics-language a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
  assert(href.every(v=>v.includes('?s=TESTCODE')),surveyFile+' must preserve survey code');
  await page.locator('#g').selectOption('Student – Year 1');
  await page.locator('button[onclick="start()"]').click();
  await page.locator('.item').first().waitFor();
  for(let n=0;n<33;n++) {
    for(let rank=1;rank<=4;rank++)
      await page.locator('.item').nth(rank-1).locator('.ball[data-rank="'+rank+'"]').click();
    await page.locator('button[onclick="next()"]').click();
  }
  await page.locator('#r').waitFor({state:'visible'});
  assert(postedResponses.some(r=>r.respondent_group==='Student – Year 1'),surveyFile+' canonical group not preserved');
  const latest=postedResponses.at(-1);
  assert(latest && latest.raw_answers && (Array.isArray(latest.raw_answers)||typeof latest.raw_answers==='object'),surveyFile+' raw scoring responses missing');
  console.log('PASS: '+surveyFile+' 33 questions, 132 rankings, submission using mocked Supabase');
}
for(const lang of ['en','nl','es']) {
  const s=lang==='en'?'':'-'+lang;
  await page.goto(origin+'/create'+s+'.html',{waitUntil:'domcontentloaded'});
  await page.locator('button[onclick="make()"]').click();
  await page.locator('#ready').waitFor({state:'visible'});
  const survey=await page.locator('a#survey').getAttribute('href');
  const dash=await page.locator('a#dash').getAttribute('href');
  assert(survey.includes('survey'+s+'.html?s=TESTCODE'),'creation survey link '+lang);
  assert(dash.includes('dashboard'+s+'.html?k=TESTKEY'),'creation dashboard link '+lang);
  console.log('PASS: '+lang+' create page localized private links');
  await page.goto(origin+'/dashboard'+s+'.html?k=TESTKEY',{waitUntil:'domcontentloaded'});
  await page.locator('#table table').waitFor({state:'attached'});
  const hrefs=await page.locator('nav.didactics-language a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
  assert(hrefs.every(v=>v.includes('?k=TESTKEY')),'dashboard must retain private token '+lang);
  assert((await page.locator('#table td').count())>0,'dashboard data '+lang);
  console.log('PASS: '+lang+' dashboard display with mocked private results');
}
for(const lang of ['en','nl','es']) {
  const s=lang==='en'?'':'-'+lang;
  await page.goto(origin+'/sparks-knowledge-quiz'+s+'.html',{waitUntil:'domcontentloaded'});
  for(let i=0;i<12;i++) {
    await page.locator('#answers .answer').first().click();
    await page.locator('#next').click();
  }
  await page.locator('#result').waitFor({state:'visible'});
  assert((await page.locator('#score').textContent()).match(/12/),'quiz score summary '+lang);
  console.log('PASS: '+lang+' SPARKS 12-question knowledge quiz');
  await page.goto(origin+'/sparks-preference-survey'+s+'.html',{waitUntil:'domcontentloaded'});
  await page.locator('#start').click();
  for(let i=0;i<20;i++) await page.locator('#next').click();
  await page.locator('#results').waitFor({state:'visible'});
  console.log('PASS: '+lang+' SPARKS 20-question preference survey');
  await page.goto(origin+'/sparks-lesson-designer'+s+'.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#rows .row').count(),3,'default lesson blocks '+lang);
  await page.locator('#add').click();
  assert.equal(await page.locator('#rows .row').count(),4,'adding lesson block '+lang);
  await page.locator('#clear').click();
  assert.equal(await page.locator('#rows .row').count(),0,'clearing lesson '+lang);
  console.log('PASS: '+lang+' lesson designer editing and cleanup');
}
assert.deepEqual(errors,[],'Browser console errors: '+errors.join('; '));
console.log('PASS: no uncaught errors, no real database writes, all translated functions tested');
await browser.close();
await new Promise(resolve=>server.close(resolve));

/* DidacticsLab language navigation. Purely client-side; no storage, cookies or requests. */
(function () {
  'use strict';
  const languages = ['en','nl','es'];
  const available = {
    'index':['en','nl','es'], 'about':['en','nl','es'],
    'knowledge':['en','nl','es'], 'tools':['en','nl','es'],
    'create':['en','nl','es'], 'survey':['en','nl','es'],
    'dashboard':['en','nl','es'], 'results':['en','nl','es'],
    'sparks-preference-survey':['en','nl','es'],
    'sparks-students':['en','nl','es'],
    'applying-sparks':['en','nl','es'], 'learning-preferences':['en','nl','es'],
    'learning-situations':['en','nl','es'], 'sparks-knowledge-quiz':['en','nl','es'],
    'sparks-learning-preferences':['en','nl','es'], 'sparks-lesson-designer':['en','nl','es']
  };
  const filename = location.pathname.split('/').pop() || 'index.html';
  const base = filename.replace(/-(nl|es)\.html$/,'.html').replace(/\.html$/,'');
  const current = filename.endsWith('-nl.html') ? 'nl' : filename.endsWith('-es.html') ? 'es' : 'en';
  const entries = available[base];
  if (!entries) return;
  const header = document.querySelector('.navin') || document.querySelector('header .wrap') || document.querySelector('header');
  const existing = header && header.querySelector('.lang, .didactics-language, nav[aria-label="Language"], nav[aria-label="Idioma"], nav[aria-label="Taal"]');
  if (existing) existing.remove();
  // Remove legacy single-language label left beside some SPARKS navigation headers.
  if (header) for (const node of header.querySelectorAll('span')) {
    if (node.textContent.trim()==='EN' && node.children.length===0) node.remove();
  }
  const nav = document.createElement('nav');
  nav.className = 'didactics-language';
  nav.setAttribute('aria-label', current==='nl'?'Taal':current==='es'?'Idioma':'Language');
  nav.style.cssText='display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-left:auto;font:600 14px Arial,sans-serif';
  for (const lang of languages) {
    const target = base + (lang==='en'?'':'-'+lang) + '.html';
    const exists = entries.includes(lang);
    const a = document.createElement('a');
    a.textContent = lang.toUpperCase();
    // Keep private Teacher360 codes and deep links when changing language.
    // Do not persist questionnaire answers, survey data or private keys in browser storage.
    a.href = (exists ? target : 'index'+(lang==='en'?'':'-'+lang)+'.html') + (exists ? location.search+location.hash : '');
    a.title = exists ? ({en:'English',nl:'Nederlands',es:'Español'}[lang]) : ({en:'Open English homepage (translation pending)',nl:'Open Nederlandse startpagina (vertaling volgt)',es:'Abrir la página de inicio en español (traducción pendiente)'}[lang]);
    if (lang===current) {a.setAttribute('aria-current','page');a.style.cssText='color:#255fa8;text-decoration:underline;text-underline-offset:3px'}
    else a.style.cssText='color:#46515c;text-decoration:none';
    if (lang !== 'en') {
      const divider = document.createElement('span');
      divider.textContent = '|';
      divider.setAttribute('aria-hidden','true');
      divider.style.color = '#8b98a4';
      nav.appendChild(divider);
    }
    nav.appendChild(a);
  }
  if (header) header.appendChild(nav);
  else {
    nav.style.cssText+=';position:relative;background:#fff;padding:10px 18px;justify-content:flex-end;border-bottom:1px solid #ddd';
    document.body.insertBefore(nav,document.body.firstChild);
  }
})();
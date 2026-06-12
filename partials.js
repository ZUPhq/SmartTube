/* ===== smarttube — partials.js: nav + footer dintr-o singură sursă =====
   Injectează nav-ul (cu search + meniu mobil) la începutul body și footer-ul
   înaintea scripturilor. Se încarcă ÎNAINTE de app.js, care leagă evenimentele. */
(function(){
  'use strict';

  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var active = {
    'cursuri.html': 'cursuri', 'curs.html': 'cursuri',
    'instructori.html': 'instructori', 'curs-nou.html': 'instructori', 'dashboard.html': 'instructori',
    'asistenta.html': 'asistenta',
    'despre.html': 'despre'
  }[page] || '';
  var on = function(k){ return active === k ? ' active' : ''; };
  var cur = function(k){ return active === k ? ' aria-current="page"' : ''; };

  var NAV_HTML =
'<nav class="nav">\n' +
'  <div class="nav-in">\n' +
'    <a href="index.html" class="brand"><img class="brand-logo brand-logo-dark" src="media/logos/logo%20smartube%20alb.svg" alt="smarttube"><img class="brand-logo brand-logo-light" src="media/logos/smarttube-logo.png" alt="smarttube"></a>\n' +
'    <div class="nav-search" id="navSearchBar">\n' +
'      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5" stroke-linecap="round"/></svg>\n' +
'      <input type="text" id="navSearchInput" placeholder="Caută cursuri, instructori, pagini…" autocomplete="off" aria-label="Caută pe smarttube" />\n' +
'      <button class="nav-search-x" id="navSearchX" type="button" aria-label="Închide căutarea"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>\n' +
'    </div>\n' +
'    <div class="nav-ic">\n' +
'      <button class="nav-ic-btn" id="searchBtn" type="button" aria-label="Caută"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5" stroke-linecap="round"/></svg></button>\n' +
'      <a href="cont.html" aria-label="Cont"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke-linecap="round"/></svg></a>\n' +
'      <button class="theme-toggle" id="themeBtn" type="button" role="switch" aria-label="Comută tema"><span class="tt-knob"><svg class="tt-moon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.7 6.7 0 0 0 9.8 9.8z"/></svg><svg class="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4"/></svg></span></button>\n' +
'      <button class="burger" id="burger" aria-label="Meniu" aria-expanded="false" aria-controls="mmenu"><span></span><span></span><span></span></button>\n' +
'    </div>\n' +
'  </div>\n' +
'</nav>\n' +
'<div class="navsearch" id="navSearch">\n' +
'  <div class="navsearch-in">\n' +
'    <div class="navsearch-results" id="navSearchResults" aria-live="polite"></div>\n' +
'  </div>\n' +
'</div>\n' +
'<div class="mmenu" id="mmenu">\n' +
'  <div class="mmenu-in">\n' +
'    <a class="mm-item' + on('cursuri') + '" href="cursuri.html"' + cur('cursuri') + '>\n' +
'      <span class="mm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 9.2l4 2.8-4 2.8z" fill="currentColor" stroke="none"/></svg></span>\n' +
'      <span class="mm-label">Cursuri</span>\n' +
'    </a>\n' +
'    <a class="mm-item' + on('instructori') + '" href="instructori.html"' + cur('instructori') + '>\n' +
'      <span class="mm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.6 19.5c.6-3 2.9-4.6 5.4-4.6s4.8 1.6 5.4 4.6"/><path d="M16.5 5.2a3 3 0 0 1 0 5.8"/><path d="M18.8 19.5c-.3-2-1.2-3.4-2.6-4.2"/></svg></span>\n' +
'      <span class="mm-label">Instructori</span>\n' +
'    </a>\n' +
'    <a class="mm-item' + on('asistenta') + '" href="asistenta.html"' + cur('asistenta') + '>\n' +
'      <span class="mm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.8-5.1A7.5 7.5 0 1 1 21 11.5z"/></svg></span>\n' +
'      <span class="mm-label">Asistență</span>\n' +
'    </a>\n' +
'    <a class="mm-item' + on('despre') + '" href="despre.html"' + cur('despre') + '>\n' +
'      <span class="mm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg></span>\n' +
'      <span class="mm-label">Despre noi</span>\n' +
'    </a>\n' +
'    <div class="mm-foot">\n' +
'      <div class="mm-theme">\n' +
'        <span>Temă</span>\n' +
'        <button class="theme-toggle" type="button" role="switch" aria-label="Comută tema"><span class="tt-knob"><svg class="tt-moon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.7 6.7 0 0 0 9.8 9.8z"/></svg><svg class="tt-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4"/></svg></span></button>\n' +
'      </div>\n' +
'      <a href="cont.html" class="mm-acc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke-linecap="round"/></svg>Contul meu</a>\n' +
'      <a href="cursuri.html" class="btn btn-mint">Vezi cursurile</a>\n' +
'    </div>\n' +
'  </div>\n' +
'</div>';

  var FOOTER_HTML =
'<footer class="footer">\n' +
'  <div class="footer-in">\n' +
'    <div class="footer-fine">\n' +
'      <p>Prețurile cursurilor sunt stabilite de fiecare instructor și pot varia. Plată unică per curs — fără abonament.</p>\n' +
'      <p>Certificatul de absolvire este emis după finalizarea proiectului final al cursului. smarttube este un marketplace de cursuri online.</p>\n' +
'    </div>\n' +
'    <div class="footer-cols">\n' +
'      <div class="footer-col"><h4>Explorează</h4>\n' +
'        <a href="cursuri.html">Toate cursurile</a><a href="cursuri.html#programare">Programare</a>\n' +
'        <a href="cursuri.html#design">Design</a><a href="cursuri.html#business">Business</a>\n' +
'        <a href="cursuri.html#video">Foto &amp; Video</a><a href="cursuri.html#muzica">Muzică</a>\n' +
'        <a href="cursuri.html#dezvoltare">Dezvoltare personală</a></div>\n' +
'      <div class="footer-col"><h4>Pentru studenți</h4>\n' +
'        <a href="asistenta.html#faq-plata">Cum funcționează</a><a href="asistenta.html#faq-certificat">Certificate</a>\n' +
'        <a href="asistenta.html#faq-acces">Acces pe viață</a><a href="asistenta.html#faq">Întrebări frecvente</a></div>\n' +
'      <div class="footer-col"><h4>Pentru instructori</h4>\n' +
'        <a href="instructori.html#preda">Devino instructor</a><a href="instructori.html">Instructorii noștri</a>\n' +
'        <a href="curs-nou.html">Publică un curs</a><a href="dashboard.html">Dashboard instructor</a></div>\n' +
'      <div class="footer-col"><h4>smarttube</h4>\n' +
'        <a href="despre.html">Despre noi</a><a href="despre.html#contact">Contact</a>\n' +
'        <a href="cont.html">Contul meu</a></div>\n' +
'      <div class="footer-col"><h4>Asistență</h4>\n' +
'        <a href="asistenta.html">Centru de ajutor</a><a href="cont.html">Autentificare</a>\n' +
'        <a href="termeni.html">Termeni</a><a href="confidentialitate.html">Confidențialitate</a></div>\n' +
'    </div>\n' +
'    <div class="footer-bottom">\n' +
'      <span>Copyright © 2026 smarttube SRL. Toate drepturile rezervate.</span>\n' +
'      <span class="legal"><span>România</span><a href="termeni.html">Termeni</a><a href="confidentialitate.html">Confidențialitate</a><a href="confidentialitate.html#cookies">Cookie-uri</a></span>\n' +
'    </div>\n' +
'  </div>\n' +
'</footer>';

  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  /* footer-ul intră chiar înaintea blocului de scripturi (tag-ul curent) */
  var here = document.currentScript;
  if(here) here.insertAdjacentHTML('beforebegin', FOOTER_HTML);
  else document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
})();

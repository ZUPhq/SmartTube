/* ===== smarttube — shared app.js ===== */
(function(){
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var hasDB = typeof window.DB !== 'undefined';

  /* ---- normalizare pentru căutare: litere mici, fără diacritice ---- */
  var norm = function(s){ return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  /* ---- mesaje de stare în formulare: .form-note cu clase err/ok ---- */
  var setNote = function(el, msg, kind){
    if(!el) return;
    el.classList.remove('err', 'ok');
    if(kind) el.classList.add(kind);
    el.textContent = msg;
  };

  /* ---- theme (light/dark) toggle ---- */
  var getTheme = function(){
    try{ return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; }catch(e){ return 'dark'; }
  };
  var applyTheme = function(t){
    if(t === 'light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
  };
  applyTheme(getTheme());
  var themeBtns = [].slice.call(document.querySelectorAll('.theme-toggle'));
  var syncThemeLabel = function(t){
    themeBtns.forEach(function(b){ b.setAttribute('aria-label', t === 'light' ? 'Comută pe temă întunecată' : 'Comută pe temă luminoasă'); });
  };
  syncThemeLabel(getTheme());
  themeBtns.forEach(function(b){
    b.addEventListener('click', function(){
      var t = getTheme() === 'light' ? 'dark' : 'light';
      try{ localStorage.setItem('theme', t); }catch(e){}
      applyTheme(t);
      syncThemeLabel(t);
    });
  });

  /* ---- nav scroll glass ---- */
  var nav = document.querySelector('.nav');
  if(nav){
    var updateNav = function(){ nav.classList.toggle('scrolled', scrollY > 10); };
    addEventListener('scroll', updateNav, {passive:true});
    updateNav();
  }

  /* ---- nav menu (dropdown on desktop, full-screen on mobile) ---- */
  var burger = document.getElementById('burger');
  var mmenu = document.getElementById('mmenu');
  if(burger && mmenu){
    var setMenu = function(open){
      mmenu.classList.toggle('open', open);
      burger.classList.toggle('on', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(open && innerWidth <= 833) document.body.style.overflow = 'hidden';
      else if(!openDialogs) document.body.style.overflow = '';
    };
    burger.addEventListener('click', function(e){
      e.stopPropagation();
      setMenu(!mmenu.classList.contains('open'));
    });
    mmenu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ setMenu(false); });
    });
    document.addEventListener('click', function(e){
      if(mmenu.classList.contains('open') && !mmenu.contains(e.target) && !burger.contains(e.target)){
        setMenu(false);
      }
    });
    addEventListener('keydown', function(e){ if(e.key === 'Escape') setMenu(false); });
    addEventListener('resize', function(){
      if(openDialogs) return;   // dialogul deschis își păstrează scroll lock-ul
      document.body.style.overflow = (mmenu.classList.contains('open') && innerWidth <= 833) ? 'hidden' : '';
    });
  }

  /* ---- nav: stare cont (avatar cu inițiale când ești logat) ---- */
  var navProfile = null;
  if(hasDB){
    DB.getProfile().then(function(p){
      if(!p) return;
      navProfile = p;
      var ini = DB.esc(DB.initials(p.name));
      var contLink = document.querySelector('.nav-ic a[aria-label="Cont"]');
      if(contLink) contLink.innerHTML = '<span class="nav-av">' + ini + '</span>';
      var mmAcc = document.querySelector('.mm-acc');
      if(mmAcc) mmAcc.innerHTML = '<span class="nav-av">' + ini + '</span>Contul meu';
      var mmCta = document.querySelector('.mm-foot .btn-mint');
      if(mmCta){ mmCta.textContent = 'Cursurile mele'; mmCta.href = 'cont.html'; }
      /* logat: logo-ul duce la dashboard, așa că adăugăm „Acasă" în meniu spre pagina principală
         (?home dezactivează redirect-ul, altfel te-ar trimite înapoi pe dashboard) */
      var mmenuIn = document.querySelector('.mmenu-in');
      if(mmenuIn && !document.getElementById('mmHome')){
        mmenuIn.insertAdjacentHTML('afterbegin',
          '<a class="mm-item" id="mmHome" href="index.html?home">' +
          '<span class="mm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></span>' +
          '<span class="mm-label">Acasă</span></a>');
        if(mmenu) document.getElementById('mmHome').addEventListener('click', function(){ if(typeof setMenu === 'function') setMenu(false); });
      }
    }).catch(function(){});
  }

  /* ---- global search (nav) — courses (live din DB), instructors, pages ---- */
  var searchBtn = document.getElementById('searchBtn');
  var navSearch = document.getElementById('navSearch');
  var nsInput = document.getElementById('navSearchInput');
  var nsResults = document.getElementById('navSearchResults');
  var nsX = document.getElementById('navSearchX');
  var navSearchBar = document.getElementById('navSearchBar');
  if(searchBtn && navSearch && nsInput && nsResults && navSearchBar){
    if(matchMedia('(max-width:600px)').matches) nsInput.placeholder = 'Caută…';
    var NS_ICON = {
      curs:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 9.2l4 2.8-4 2.8z" fill="currentColor" stroke="none"/></svg>',
      instructor:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3-5.6 7-5.6s7 2 7 5.6"/></svg>',
      pagina:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></svg>'
    };
    var NS_LABEL = { curs:'Curs', instructor:'Instructor', pagina:'Pagină' };
    var NS_DATA = [
      {t:'Cursuri', s:'Catalogul complet', u:'cursuri.html', y:'pagina', k:'catalog toate cursurile'},
      {t:'Instructori', s:'Cine te învață', u:'instructori.html', y:'pagina', k:'instructori profesori'},
      {t:'Devino instructor', s:'Predă pe smarttube', u:'instructori.html#preda', y:'pagina', k:'devino instructor preda venit'},
      {t:'Dashboard instructor', s:'Vânzări, accesări, promovare', u:'dashboard.html', y:'pagina', k:'dashboard vanzari statistici instructor'},
      {t:'Publică un curs', s:'Wizard de creare curs', u:'curs-nou.html', y:'pagina', k:'publica curs nou wizard creeaza'},
      {t:'Asistență', s:'Întrebări și suport', u:'asistenta.html', y:'pagina', k:'asistenta suport ajutor faq intrebari'},
      {t:'Despre noi', s:'Cine suntem', u:'despre.html', y:'pagina', k:'despre noi companie echipa fondatori'},
      {t:'Contact', s:'Scrie-ne un mesaj', u:'despre.html#contact', y:'pagina', k:'contact mesaj scrie-ne'},
      {t:'Contul meu', s:'Autentificare & cont nou', u:'cont.html', y:'pagina', k:'cont login autentificare inregistrare cursurile mele'}
    ];
    var nsIndex = function(it){ it._n = norm(it.t + ' ' + it.s + ' ' + (it.k || '')); return it; };
    NS_DATA.forEach(nsIndex);
    /* cursurile vin live din DB, ca să apară și cele publicate prin wizard */
    var nsCourses = [], nsCoursesLoaded = false;
    var nsLoadCourses = function(){
      if(nsCoursesLoaded || !hasDB) return;
      nsCoursesLoaded = true;
      DB.publishedCourses().then(function(cs){
        var items = cs.map(function(c){
          return nsIndex({
            t:c.title, s:(DB.CATS[c.category] || '') + ' · ' + c.instructor_name,
            u:'curs.html?id=' + c.id + '&src=search', y:'curs', k:c.category
          });
        });
        /* instructorii vin tot din DB — click duce la cursurile lor în catalog */
        var seen = {};
        cs.forEach(function(c){
          if(!c.instructor_name || seen[c.instructor_name]) return;
          seen[c.instructor_name] = 1;
          items.push(nsIndex({
            t:c.instructor_name, s:'Instructor · ' + (DB.CATS[c.category] || ''),
            u:'cursuri.html?q=' + encodeURIComponent(c.instructor_name), y:'instructor', k:'instructor'
          }));
        });
        nsCourses = items;
        if(navSearchBar.classList.contains('on')) nsRender(nsInput.value);
      }).catch(function(){ nsCoursesLoaded = false; });
    };
    var nsEsc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
    var nsRender = function(raw){
      var q = norm(raw).trim();
      if(!q){ navSearch.classList.remove('open'); nsResults.innerHTML = ''; return; }
      var toks = q.split(/\s+/);
      var hits = nsCourses.concat(NS_DATA).filter(function(it){ return toks.every(function(tk){ return it._n.indexOf(tk) > -1; }); }).slice(0, 8);
      navSearch.classList.add('open');
      if(!hits.length){ nsResults.innerHTML = '<div class="ns-empty">Niciun rezultat. Încearcă alt termen.</div>'; return; }
      nsResults.innerHTML = hits.map(function(it){
        return '<a class="ns-item" href="' + it.u + '"><span class="ns-ic">' + (NS_ICON[it.y] || '') +
          '</span><span class="ns-tx"><b>' + nsEsc(it.t) + '</b><span>' + nsEsc(it.s) +
          '</span></span><span class="ns-type">' + (NS_LABEL[it.y] || '') + '</span></a>';
      }).join('');
    };
    var nsOpen = function(){
      navSearchBar.classList.add('on');
      document.body.classList.add('searching');
      nsLoadCourses();
      nsRender(nsInput.value);
      setTimeout(function(){ nsInput.focus(); }, 30);
    };
    var nsClose = function(){
      navSearchBar.classList.remove('on');
      navSearch.classList.remove('open');
      document.body.classList.remove('searching');
      nsInput.value = '';
      nsResults.innerHTML = '';
    };
    searchBtn.addEventListener('click', function(e){ e.stopPropagation(); if(navSearchBar.classList.contains('on')) nsClose(); else nsOpen(); });
    if(nsX) nsX.addEventListener('click', nsClose);
    nsInput.addEventListener('input', function(){ nsRender(nsInput.value); });
    nsInput.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ var f = nsResults.querySelector('.ns-item'); if(f) f.click(); } });
    nsResults.addEventListener('click', function(e){ if(e.target.closest('.ns-item')) nsClose(); });
    document.addEventListener('click', function(e){ if(navSearchBar.classList.contains('on') && !navSearch.contains(e.target) && !navSearchBar.contains(e.target) && !searchBtn.contains(e.target)) nsClose(); });
    addEventListener('keydown', function(e){ if(e.key === 'Escape' && navSearchBar.classList.contains('on')) nsClose(); });
    /* preîncărcăm indexul de căutare când browserul are timp liber */
    if('requestIdleCallback' in window) requestIdleCallback(nsLoadCourses);
    else setTimeout(nsLoadCourses, 2500);
  }

  /* ---- scroll reveal (stagger per batch de intersecție — viewport-relative) ---- */
  var revealIO = new IntersectionObserver(function(es){
    var batch = 0;
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target;
      if(!reduce){
        el.style.transitionDelay = Math.min(batch++ * 60, 420) + 'ms';
        el.addEventListener('transitionend', function h(){
          el.style.transitionDelay = '';
          el.removeEventListener('transitionend', h);
        });
      }
      el.classList.add('in');
      revealIO.unobserve(el);
    });
  }, {threshold:.14, rootMargin:'0px 0px -8% 0px'});
  var revealify = function(root){
    [].forEach.call(root.querySelectorAll('.reveal:not(.in)'), function(el){ revealIO.observe(el); });
    if(root !== document && root.classList && root.classList.contains('reveal') && !root.classList.contains('in')) revealIO.observe(root);
  };
  revealify(document);

  /* ---- parallax + scroll-zoom (home) ---- */
  var parEls = [].slice.call(document.querySelectorAll('[data-par]'));
  var scaleEls = [].slice.call(document.querySelectorAll('[data-scale]'));
  if((parEls.length || scaleEls.length) && !reduce){
    var ticking = false;
    var frame = function(){
      var vh = innerHeight;
      parEls.forEach(function(el){
        var r = el.getBoundingClientRect();
        var p = (r.top + r.height/2 - vh/2) / vh;
        el.style.transform = 'translateY(' + (p*parseFloat(el.dataset.par)).toFixed(1) + 'px)';
      });
      scaleEls.forEach(function(el){
        var r = el.getBoundingClientRect();
        var p = (vh - r.top) / (vh*0.9 + r.height);
        p = Math.max(0, Math.min(1, p));
        var mob = innerWidth <= 833;
        var lo = mob ? 0.94 : 0.9, hi = mob ? 1.06 : 1.1;
        el.style.transform = 'scale(' + (lo + p*(hi-lo)).toFixed(3) + ')';
      });
      ticking = false;
    };
    var onScroll = function(){ if(!ticking){ ticking = true; requestAnimationFrame(frame); } };
    addEventListener('scroll', onScroll, {passive:true});
    addEventListener('resize', onScroll);
    frame();
  }

  /* ---- hero zoom: cardul video crește pe scroll; fundal interactiv (spotlight mint la cursor) ---- */
  var heroZoom = document.getElementById('heroZoom');
  var hzStage = heroZoom && heroZoom.querySelector('.hz-stage');
  var hzFrame = document.getElementById('hzFrame');
  var hzHead = document.getElementById('hzHead');
  var heroVideo = document.getElementById('heroVideo');
  var heroPlay = document.getElementById('heroPlay');
  if(heroZoom && hzFrame){
    var hzMobile = innerWidth <= 833;
    var hzMotion = function(){ return innerWidth > 833 && !reduce; };
    var clh = function(v){ return v < 0 ? 0 : v > 1 ? 1 : v; };
    var lerph = function(a, b, t){ return a + (b - a) * t; };
    var eoch = function(p){ p = clh(p); return 1 - Math.pow(1 - p, 3); };   // easeOutCubic
    var vidStarted = false;
    var startVid = function(){
      if(vidStarted || !heroVideo) return;
      vidStarted = true;
      var pr = heroVideo.play(); if(pr && pr.catch) pr.catch(function(){});
    };

    /* SCRUB în 3 faze (sincronizat cu „curtain"-ul CSS = ultimii 100vh de scroll):
         1) GROW  (q 0 → .30): cardul (ancorat jos, DEASUPRA textului) crește scale .66 → 1 și URCĂ
            peste text, acoperindu-l. Videoul pornește la primul scroll; textul dispare după ce e acoperit.
         2) HOLD  (q .30 → .50): cardul rămâne BLOCAT la full size (sticky + fără translate) — pauza cerută.
         3) SLIDE (q .50 → 1): cardul alunecă în jos, iar secțiunea următoare (margin-top:-100vh)
            urcă opac peste el. Înălțimea hero-ului (300vh) e aleasă ca HOLD-ul să fie ÎNAINTE de zona curtain. */
    var GROW = 0.30, HOLD = 0.50;
    var hzScrub = function(){
      if(!hzMotion()){ hzFrame.style.transform = ''; if(hzHead){ hzHead.style.opacity = ''; } return; }
      var top = heroZoom.getBoundingClientRect().top;
      var span = heroZoom.offsetHeight - innerHeight;
      var q = span > 0 ? clh(-top / span) : 0;
      var gT = eoch(q / GROW);                          // creștere .66 → 1 (urcă peste text); gT=1 și pe HOLD
      var sT = eoch((q - HOLD) / (1 - HOLD));           // alunecare în jos — abia DUPĂ pauză (q > HOLD)
      var ty = sT * innerHeight * 0.30;
      hzFrame.style.transform = 'translateY(' + ty.toFixed(1) + 'px) scale(' + lerph(0.66, 1, gT).toFixed(4) + ')';
      if(hzHead){
        /* rămâne la opacitate plină cât e acoperit de video, apoi dispare (invizibil, deja sub video) */
        hzHead.style.opacity = (1 - clh((q - 0.21) / 0.05)).toFixed(3);
      }
      if(q > 0.04) startVid();
    };

    /* fundalul hero e acum stratul GLOBAL „lacul cunoașterii" (#lakeFx) din spatele întregului site — vezi modulul de la finalul fișierului */

    if(hzMotion()){
      var hzTick = false;
      addEventListener('scroll', function(){ if(!hzTick){ hzTick = true; requestAnimationFrame(function(){ hzScrub(); hzTick = false; }); } }, {passive:true});
      hzScrub();
    } else if(!hzMobile){
      startVid();   // desktop reduced-motion: cardul e deja plin → pornim videoul direct
    }
    /* pe mobil rămâne posterul + butonul play (fără autoplay, economie de date) */

    addEventListener('resize', function(){
      hzMobile = innerWidth <= 833;
      hzScrub();   // tratează ambele cazuri (scrub pe desktop / reset pe static)
    });

    /* play (pe card) → fullscreen nativ cu sunet; la ieșire revine pe mut */
    if(heroPlay && heroVideo){
      heroPlay.addEventListener('click', function(e){
        e.preventDefault();
        try{ heroVideo.muted = false; heroVideo.controls = true; }catch(_){}
        var req = heroVideo.requestFullscreen || heroVideo.webkitRequestFullscreen;
        if(req){ try{ var fr = req.call(heroVideo); if(fr && fr.catch) fr.catch(function(){}); }catch(_){} }
        else if(heroVideo.webkitEnterFullscreen){ try{ heroVideo.webkitEnterFullscreen(); }catch(_){} }
        var pr = heroVideo.play();
        if(pr && pr.catch) pr.catch(function(){ try{ heroVideo.muted = true; heroVideo.play(); }catch(e2){} });
      });
      var hzRestore = function(){ try{ heroVideo.controls = false; heroVideo.muted = true; }catch(e){} };
      document.addEventListener('fullscreenchange', function(){ if(!document.fullscreenElement) hzRestore(); });
      document.addEventListener('webkitfullscreenchange', function(){ if(!document.webkitFullscreenElement) hzRestore(); });
      heroVideo.addEventListener('webkitendfullscreen', hzRestore);
    }
  }

  /* ---- courses carousel: cele mai accesate cursuri din ultimele 7 zile ---- */
  var carTrack = document.getElementById('carTrack');
  var carView = carTrack && carTrack.parentElement;
  if(carTrack && carView && hasDB){
    carTrack.innerHTML = new Array(5).join('<div class="ccard skeleton sk-card" aria-hidden="true"></div>');
    DB.popularCourses(6).then(function(cs){
      if(!cs.length) throw new Error('no courses');
      carTrack.innerHTML = cs.map(function(c){ return courseCardHTML(c, 'front_page'); }).join('');
      /* fără tilt 3D pe cardurile din carusel: pe un track care driftează, transformul de hover
         se bate cu mișcarea și pare că sare. Tilt-ul rămâne pe grilele statice (catalog etc.) */
      initCarousel();
    }).catch(function(){
      var sec = document.getElementById('populare');
      if(sec) sec.style.display = 'none';
    });
  }
  function initCarousel(){
    var carOriginals = [].slice.call(carTrack.children);
    var carSetW = carTrack.scrollWidth;            // width of one original set
    var carFill = function(){
      if(carSetW <= 0){ carSetW = carTrack.scrollWidth; return; }
      var need = carView.clientWidth + carSetW * 2, guard = 0;
      while(carTrack.scrollWidth < need && guard++ < 40){
        carOriginals.forEach(function(n){
          var c = n.cloneNode(true);
          c.setAttribute('aria-hidden','true'); c.setAttribute('tabindex','-1');
          carTrack.appendChild(c);
        });
      }
    };
    carFill();

    /* accesibil din tastatură: focusabil + săgeți; drift-ul se oprește doar cât e focusat din tastatură
       (la hover cu mouse-ul NU îngheață — userul îl poate trage/derula liber) */
    var carFocus = false;
    carView.setAttribute('tabindex', '0');
    carView.setAttribute('role', 'region');
    carView.setAttribute('aria-label', 'Cursuri populare — navighează cu săgețile stânga și dreapta');
    carView.addEventListener('focus', function(){ carFocus = true; });
    carView.addEventListener('blur', function(){ carFocus = false; });

    var carPos = 0, carVel = 0, carDragging = false, carLastT = null;
    var carAuto = reduce ? 0 : 0.035;              // px per ms, drifts left
    var carWrap = function(){
      if(carSetW <= 0) return;
      carPos = carPos % carSetW;
      if(carPos > 0) carPos -= carSetW;
    };
    var carRender = function(){ carTrack.style.transform = 'translate3d(' + carPos.toFixed(2) + 'px,0,0)'; };
    var carTick = function(t){
      var dt = carLastT == null ? 16 : Math.min(64, t - carLastT); carLastT = t;
      if(!carDragging){
        carPos -= (carFocus ? 0 : carAuto) * dt;
        carPos += carVel;
        carVel *= 0.92; if(Math.abs(carVel) < 0.02) carVel = 0;
        carWrap(); carRender();
      }
      requestAnimationFrame(carTick);
    };
    requestAnimationFrame(carTick);

    var carSX = 0, carSP = 0, carLX = 0, carMoved = false;
    carView.addEventListener('pointerdown', function(e){
      carDragging = true; carMoved = false; carSX = carLX = e.clientX; carSP = carPos; carVel = 0;
      try{ carView.setPointerCapture(e.pointerId); }catch(_){}
      carView.classList.add('grabbing');
    });
    carView.addEventListener('pointermove', function(e){
      if(!carDragging) return;
      var dx = e.clientX - carSX;
      if(Math.abs(dx) > 4) carMoved = true;
      carPos = carSP + dx; carWrap(); carRender();
      carVel = e.clientX - carLX; carLX = e.clientX;
    });
    var carEnd = function(){ if(carDragging){ carDragging = false; carView.classList.remove('grabbing'); } };
    carView.addEventListener('pointerup', carEnd);
    carView.addEventListener('pointercancel', carEnd);
    carView.addEventListener('click', function(e){ if(carMoved){ e.preventDefault(); e.stopPropagation(); } }, true);
    carView.addEventListener('wheel', function(e){
      if(Math.abs(e.deltaX) > Math.abs(e.deltaY)){ e.preventDefault(); carPos -= e.deltaX; carVel = 0; carWrap(); carRender(); }
    }, {passive:false});
    carView.addEventListener('keydown', function(e){
      if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      if(reduce){
        carPos += e.key === 'ArrowLeft' ? 324 : -324;   // lățimea unui card + gap
        carVel = 0; carWrap(); carRender();
        return;
      }
      carVel += e.key === 'ArrowLeft' ? 28 : -28;       // impuls prin inerția existentă ≈ un card
    });
    var carFillT = null;
    addEventListener('resize', function(){
      clearTimeout(carFillT);
      carFillT = setTimeout(carFill, 250);
    });
  }

  /* ---- homepage: cifre reale + recenzii reale (social proof onest, pe idle) ---- */
  var homeStats = document.getElementById('homeStats');
  if(homeStats && hasDB){
    var renderHomeStats = function(){
      Promise.all([DB.publishedCourses(), DB.instructorStats()]).then(function(r){
        var nCourses = r[0].length;
        var nInstr = r[1].length;
        var nStudents = r[1].reduce(function(s, i){ return s + (Number(i.students_count) || 0); }, 0);
        if(!nCourses || !nInstr) return;   // niciodată cifre goale pe homepage
        homeStats.style.display = '';
        var hio = new IntersectionObserver(function(es){
          if(es.some(function(e){ return e.isIntersecting; })){
            hio.disconnect();
            countUp(document.getElementById('homeStatCourses'), nCourses);
            countUp(document.getElementById('homeStatInstructors'), nInstr);
            countUp(document.getElementById('homeStatStudents'), nStudents);
          }
        }, {threshold:.3});
        hio.observe(homeStats);
      }).catch(function(){});
    };
    if('requestIdleCallback' in window) requestIdleCallback(renderHomeStats);
    else setTimeout(renderHomeStats, 1200);
  }
  var homeReviews = document.getElementById('homeReviews');
  if(homeReviews && hasDB && DB.recentReviews){
    var renderHomeReviews = function(){
      DB.recentReviews(6).then(function(rs){
        if(rs.length < 3){ homeReviews.remove(); return; }
        var rGrid = document.getElementById('homeReviewsGrid');
        rGrid.innerHTML = rs.slice(0, 6).map(function(r){
          return '<div class="review"><div class="stars">' + new Array((r.rating || 0) + 1).join('★') + '</div>' +
            '<p>„' + DB.esc(r.comment) + '"</p>' +
            '<div class="who"><span class="av" aria-hidden="true">' + DB.esc(DB.initials(r.author_name)) + '</span>' +
            '<div><b>' + DB.esc(r.author_name) + '</b><span>Student</span></div></div>' +
            '<a class="link" href="curs.html?id=' + r.courses.id + '&src=front_page">' + DB.esc(r.courses.title) + '</a></div>';
        }).join('');
        homeReviews.style.display = '';
        tiltify(rGrid);
        [].forEach.call(rGrid.children, function(el){ el.classList.add('reveal'); });
        revealify(homeReviews);
      }).catch(function(){ homeReviews.remove(); });
    };
    if('requestIdleCallback' in window) requestIdleCallback(renderHomeReviews);
    else setTimeout(renderHomeReviews, 1200);
  }

  /* ---- card de curs (markup identic cu cel static) ---- */
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
  var courseCardHTML = function(c, src){
    var rate = c.rating != null
      ? '<span class="cc-rate">' + STAR_SVG + DB.fmtRating(c.rating) + ' <em>(' + DB.esc(c.rating_count) + ')</em></span>'
      : '<span class="cc-rate cc-new">Nou</span>';
    var cov = DB.coverUrl(c);     // prima poză din galerie → copertă; altfel gradientul
    return '<a class="ccard" href="curs.html?id=' + c.id + (src ? '&src=' + src : '') + '"' +
      ' data-cat="' + DB.esc(c.category) + '"' +
      ' data-price="' + (Number(c.price) || 0) + '" data-rating="' + (c.rating == null ? -1 : Number(c.rating)) + '"' +
      ' data-pop="' + (Number(c.rating_count) || 0) + '" data-created="' + DB.esc(c.created_at || '') + '"' +
      ' data-search="' + DB.esc((c.title + ' ' + c.instructor_name + ' ' + (DB.CATS[c.category] || '')).toLowerCase()) + '">' +
      '<div class="cc-thumb ' + DB.esc(c.thumb_style) + (cov ? ' has-img' : '') + '"' +
      (cov ? ' style="background-image:url(\'' + cov.replace(/'/g, '%27') + '\')"' : '') + '><span class="cc-tag">' + DB.esc(DB.CAT_SHORT[c.category] || '') + '</span>' +
      '<span class="cc-dur">' + DB.fmtDur(c.total_minutes) + '</span><span class="cc-play">' + PLAY_SVG + '</span></div>' +
      '<div class="cc-body"><div class="cc-cat">' + DB.esc(DB.CATS[c.category] || '') + '</div>' +
      '<h3 class="cc-ttl">' + DB.esc(c.title) + '</h3>' +
      '<div class="cc-by"><span class="av">' + DB.esc(c.instructor_initials) + '</span><span>' + DB.esc(c.instructor_name) + '</span></div>' +
      '<div class="cc-foot">' + rate + '<span class="cc-price">' + DB.fmtPrice(c.price) + '</span></div></div></a>';
  };

  /* ---- 3d card tilt (pointer:fine only) ---- */
  var tiltify = function(root){
    if(matchMedia('(pointer:coarse)').matches) return;
    root.querySelectorAll('.ccard,.card:not(.no-tilt),.inst-card,.review,.stat-card').forEach(function(card){
      if(card._tilt) return;
      card._tilt = true;
      card.addEventListener('mouseenter',function(){
        card.style.transition='box-shadow .3s';
      });
      card.addEventListener('mousemove',function(e){
        var r=card.getBoundingClientRect();
        var x=((e.clientX-r.left)/r.width-.5)*2;
        var y=((e.clientY-r.top)/r.height-.5)*2;
        card.style.transform='perspective(700px) rotateX('+(-y*7)+'deg) rotateY('+(x*7)+'deg) translateY(-4px) scale(1.015)';
      });
      card.addEventListener('mouseleave',function(){
        card.style.transition='transform .5s cubic-bezier(.2,.7,.2,1),box-shadow .3s';
        card.style.transform='';
      });
    });
  };
  tiltify(document);

  /* ---- count-up pentru statistici reale (instant la prefers-reduced-motion) ---- */
  var countUp = function(el, target, fmt){
    fmt = fmt || function(n){ return String(Math.round(n)); };
    if(!el) return;
    if(reduce || !(target > 0)){ el.textContent = fmt(target); return; }
    var t0 = performance.now(), DUR = 800;
    var step = function(t){
      var p = Math.min(1, (t - t0) / DUR);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if(p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---- catalog: render din DB + filtre ---- */
  var grid = document.getElementById('catalogGrid');
  if(grid && hasDB){
    var chips = document.querySelectorAll('.chip');
    var search = document.getElementById('catalogSearch');
    var empty = document.getElementById('catalogEmpty');
    grid.innerHTML = new Array(7).join('<div class="ccard skeleton sk-card" aria-hidden="true"></div>');
    DB.publishedCourses().then(function(cs){
      grid.innerHTML = cs.map(function(c){ return courseCardHTML(c, 'catalog'); }).join('');
      tiltify(grid);
      [].forEach.call(grid.children, function(el){ el.classList.add('reveal'); });
      revealify(grid);
      var cards = [].slice.call(grid.querySelectorAll('.ccard'));
      var apply = function(cat){
        var q = norm(search && search.value || '').trim();
        var shown = 0;
        cards.forEach(function(c){
          var okCat = (cat==='all') || (c.dataset.cat===cat);
          var okQ = !q || norm(c.dataset.search).indexOf(q) > -1;
          var show = okCat && okQ;
          c.style.display = show ? '' : 'none';
          if(show) shown++;
        });
        if(empty) empty.style.display = shown ? 'none' : 'block';
      };
      var current = 'all';
      chips.forEach(function(ch){
        ch.setAttribute('aria-pressed', ch.classList.contains('on') ? 'true' : 'false');
        ch.addEventListener('click', function(){
          chips.forEach(function(x){ x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
          ch.classList.add('on');
          ch.setAttribute('aria-pressed', 'true');
          current = ch.dataset.filter;
          apply(current);
        });
      });
      var searchT = null;
      if(search) search.addEventListener('input', function(){
        clearTimeout(searchT);
        searchT = setTimeout(function(){ apply(current); }, 150);
      });
      /* sortare */
      var sortSel = document.getElementById('catalogSort');
      var sorters = {
        popular:function(a, b){ return (+b.dataset.pop) - (+a.dataset.pop); },
        nou:function(a, b){ return (b.dataset.created || '').localeCompare(a.dataset.created || ''); },
        rating:function(a, b){ return (+b.dataset.rating) - (+a.dataset.rating); },
        'pret-asc':function(a, b){ return (+a.dataset.price) - (+b.dataset.price); },
        'pret-desc':function(a, b){ return (+b.dataset.price) - (+a.dataset.price); }
      };
      if(sortSel) sortSel.addEventListener('change', function(){
        cards.sort(sorters[sortSel.value] || sorters.popular).forEach(function(el){ grid.appendChild(el); });
      });
      /* număr real de cursuri în intro */
      var lead = document.getElementById('catalogLead');
      if(lead && cs.length){
        lead.textContent = cs.length + (cs.length >= 20 ? ' de' : '') +
          ' cursuri de la practicieni, din orice domeniu. Plată unică, acces pe viață.';
      }
      /* preselect: ?q=NumeInstructor (din cardurile de instructori) sau #hash de categorie */
      var qParam = new URLSearchParams(location.search).get('q');
      if(qParam && search){ search.value = qParam; apply(current); }
      var applyHashChip = function(){
        var h = (location.hash || '').replace('#','');
        if(!h) return;
        var match = document.querySelector('.chip[data-filter="'+h+'"]');
        if(match) match.click();
      };
      applyHashChip();
      /* linkurile de categorie din footer funcționează și când ești deja în catalog */
      addEventListener('hashchange', applyHashChip);
    }).catch(function(){
      grid.innerHTML = '<p class="empty" style="display:block">Nu am putut încărca acum cursurile. Reîncearcă în câteva momente.</p>';
    });
  }

  /* ---- despre: cifre live (cursuri publicate + instructori activi), cu count-up la intrarea în viewport ---- */
  var statCoursesEl = document.getElementById('statCourses');
  if(statCoursesEl && hasDB){
    var statsVisible = new Promise(function(res){
      var sio = new IntersectionObserver(function(es){
        if(es.some(function(e){ return e.isIntersecting; })){ sio.disconnect(); res(); }
      }, {threshold:.3});
      sio.observe(statCoursesEl);
    });
    Promise.all([
      DB.publishedCourses(),
      DB.instructorStats().catch(function(){ return []; }),
      statsVisible
    ]).then(function(r){
      var cs = r[0];
      countUp(statCoursesEl, cs.length);
      var instr = {};
      cs.forEach(function(c){ if(c.instructor_name) instr[c.instructor_name] = 1; });
      var si = document.getElementById('statInstructors');
      if(si) countUp(si, Object.keys(instr).length);
      var ss = document.getElementById('statStudents');
      if(ss) countUp(ss, r[1].reduce(function(s, i){ return s + (Number(i.students_count) || 0); }, 0));
    }).catch(function(){});
  }

  /* ---- pagina instructori: carduri din DB, cu statistici reale; click → catalog filtrat ---- */
  var instGrid = document.getElementById('instGrid');
  if(instGrid && hasDB){
    instGrid.innerHTML = new Array(7).join('<div class="inst-card skeleton sk-inst" aria-hidden="true"></div>');
    DB.instructorStats().then(function(list){
      if(!list.length){
        instGrid.innerHTML = '<p class="empty span-all" style="display:block">Încă niciun instructor cu cursuri publicate.</p>';
        return;
      }
      var instLead = document.getElementById('instLead');
      if(instLead && list.length >= 2){
        instLead.textContent = list.length + ' instructori predau acum pe smarttube — fiecare e practician în domeniul lui.';
      }
      var fmtK = function(n){ return n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString('ro-RO') + 'k' : String(n); };
      instGrid.innerHTML = list.map(function(i){
        var cats = (i.categories || []).map(function(k){ return DB.CAT_SHORT[k] || k; }).join(' · ');
        var first = (i.instructor_name || '').split(' ')[0];
        return '<a class="inst-card" href="cursuri.html?q=' + encodeURIComponent(i.instructor_name) + '"' +
          ' aria-label="Vezi cursurile publicate de ' + DB.esc(i.instructor_name) + '">' +
          '<div class="inst-top"><span class="av" aria-hidden="true">' + DB.esc(i.instructor_initials || DB.initials(i.instructor_name)) + '</span>' +
          '<div><h3>' + DB.esc(i.instructor_name) + '</h3><div class="role">' + DB.esc(cats) + '</div></div></div>' +
          '<p>Practician pe smarttube — vezi toate cursurile publicate de ' + DB.esc(first) + '.</p>' +
          '<div class="inst-stats">' +
          '<div><b>' + i.courses_count + '</b><span>' + (Number(i.courses_count) === 1 ? 'curs' : 'cursuri') + '</span></div>' +
          '<div><b>' + fmtK(Number(i.students_count)) + '</b><span>studenți</span></div>' +
          '<div><b>' + (i.avg_rating != null ? DB.fmtRating(i.avg_rating) : '—') + '</b><span>rating</span></div>' +
          '</div></a>';
      }).join('');
      tiltify(instGrid);
      [].forEach.call(instGrid.children, function(el){ el.classList.add('reveal'); });
      revealify(instGrid);
    }).catch(function(){
      instGrid.innerHTML = '<p class="empty span-all" style="display:block">Nu am putut încărca instructorii. Reîncarcă pagina.</p>';
    });
  }

  /* ---- accordions (faq + curriculum) — delegate, conținutul poate fi dinamic ---- */
  document.querySelectorAll('.faq-item .faq-q').forEach(function(b){
    b.setAttribute('aria-expanded', b.closest('.faq-item').classList.contains('open') ? 'true' : 'false');
  });
  document.addEventListener('click', function(e){
    var q = e.target.closest('.faq-q');
    if(q){
      var item = q.closest('.faq-item');
      var open = item.classList.contains('open');
      item.parentElement.querySelectorAll('.faq-item').forEach(function(i){
        i.classList.remove('open');
        var b = i.querySelector('.faq-q');
        if(b) b.setAttribute('aria-expanded', 'false');
      });
      if(!open){ item.classList.add('open'); q.setAttribute('aria-expanded', 'true'); }
      return;
    }
    var h = e.target.closest('.mod-head');
    if(h){
      var mod = h.closest('.module');
      mod.classList.toggle('open');
      h.setAttribute('aria-expanded', mod.classList.contains('open') ? 'true' : 'false');
    }
  });

  /* ---- FAQ: deschidere din hash (#faq-…) + căutare inline ---- */
  var faqOpenFromHash = function(){
    var id = (location.hash || '').replace('#', '');
    if(!id) return;
    var item = document.getElementById(id);
    if(!item || !item.classList.contains('faq-item')) return;
    item.parentElement.querySelectorAll('.faq-item').forEach(function(i){
      i.classList.toggle('open', i === item);
      var b = i.querySelector('.faq-q');
      if(b) b.setAttribute('aria-expanded', i === item ? 'true' : 'false');
    });
  };
  if(document.querySelector('.faq-item')){
    faqOpenFromHash();
    addEventListener('hashchange', faqOpenFromHash);
  }
  var faqSearch = document.getElementById('faqSearch');
  if(faqSearch){
    var faqItems = [].slice.call(document.querySelectorAll('.faq-item'));
    var faqEmpty = document.getElementById('faqEmpty');
    faqItems.forEach(function(i){ i._n = norm(i.textContent); });
    faqSearch.addEventListener('input', function(){
      var q = norm(faqSearch.value).trim();
      var shown = 0;
      faqItems.forEach(function(i){
        var ok = !q || i._n.indexOf(q) > -1;
        i.style.display = ok ? '' : 'none';
        if(ok) shown++;
      });
      if(faqEmpty) faqEmpty.style.display = shown ? 'none' : 'block';
    });
  }

  /* ---- dialoguri accesibile: role, focus trap, scroll lock, focus înapoi ---- */
  var openDialogs = 0;
  var dialogify = function(modal, labelId){
    if(!modal) return;
    var card = modal.querySelector('.modal-card');
    if(!card) return;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    if(labelId) card.setAttribute('aria-labelledby', labelId);
    var lastFocus = null, wasOpen = false;
    var trap = function(e){
      if(e.key !== 'Tab') return;
      var els = [].slice.call(card.querySelectorAll(
        'a[href],button:not([disabled]),video,input,select,textarea,[tabindex]:not([tabindex="-1"])'
      )).filter(function(el){ return el.offsetParent !== null; });
      if(!els.length) return;
      var first = els[0], last = els[els.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    };
    new MutationObserver(function(){
      var open = modal.classList.contains('open');
      if(open === wasOpen) return;
      wasOpen = open;
      if(open){
        lastFocus = document.activeElement;
        openDialogs++;
        document.body.style.overflow = 'hidden';
        modal.addEventListener('keydown', trap);
        setTimeout(function(){
          var f = card.querySelector('button:not([disabled]),a[href],input,select,textarea');
          if(f) f.focus();
        }, 40);
      }else{
        openDialogs = Math.max(0, openDialogs - 1);
        if(!openDialogs) document.body.style.overflow = '';
        modal.removeEventListener('keydown', trap);
        if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(err){}
      }
    }).observe(modal, {attributes:true, attributeFilter:['class']});
  };

  /* ---- account tabs ---- */
  var authTabs = document.querySelectorAll('.auth-tab');
  if(authTabs.length){
    authTabs.forEach(function(t){
      t.addEventListener('click', function(){
        authTabs.forEach(function(x){ x.classList.remove('on'); });
        t.classList.add('on');
        document.querySelectorAll('.auth-pane').forEach(function(p){
          p.classList.toggle('on', p.dataset.pane === t.dataset.tab);
        });
      });
    });
  }

  /* ---- demo forms: prevent real submit ---- */
  document.querySelectorAll('form[data-demo]').forEach(function(f){
    f.addEventListener('submit', function(e){
      e.preventDefault();
      setNote(f.querySelector('.form-note'), 'Mulțumim! Acesta este un demo — formularul nu trimite date reale.', 'ok');
    });
  });

  /* ---- mesaje de eroare auth, pe românește ---- */
  var authMsg = function(err){
    var m = (err && err.message) || '';
    if(m.indexOf('Invalid login credentials') > -1) return 'Email sau parolă greșite.';
    if(m.indexOf('already registered') > -1) return 'Există deja un cont cu acest email.';
    if(m.indexOf('at least 6 characters') > -1) return 'Parola trebuie să aibă minim 6 caractere.';
    if(m.indexOf('valid email') > -1 || m.indexOf('invalid format') > -1) return 'Adresa de email nu pare validă.';
    if(m.indexOf('Email not confirmed') > -1) return 'Contul nu e confirmat încă — verifică-ți emailul.';
    if(m.indexOf('rate limit') > -1 || m.indexOf('rate_limit') > -1) return 'Prea multe încercări — așteaptă puțin și reîncearcă.';
    return m || 'Ceva nu a mers. Reîncearcă.';
  };
  var safeRedirect = function(raw){
    if(!raw) return null;
    raw = decodeURIComponent(raw);
    if(raw.indexOf('//') > -1 || raw.indexOf(':') > -1 || raw[0] === '/') return null;
    return raw;
  };

  /* ---- pagina de cont: auth + hub (cursurile mele / profil) ---- */
  var authView = document.getElementById('authView');
  var hubView = document.getElementById('hubView');
  if(authView && hubView && hasDB){
    var qs = new URLSearchParams(location.search);
    var redirect = safeRedirect(qs.get('redirect'));
    var contHead = document.getElementById('contHead');

    var showAuth = function(){ authView.style.display = ''; hubView.style.display = 'none'; };
    var showHub = function(p){
      authView.style.display = 'none'; hubView.style.display = '';
      var first = p.name.split(' ')[0] || 'cursant';
      if(contHead){
        contHead.querySelector('.h1').textContent = 'Salut, ' + first + '.';
        contHead.querySelector('.lead').textContent = p.is_instructor
          ? 'Cursurile tale, panoul de instructor și contul — toate într-un singur loc.'
          : 'Continuă de unde ai rămas, descoperă cursuri noi și gestionează-ți contul.';
      }
      document.getElementById('hubName').textContent = p.name;
      document.getElementById('hubEmail').textContent = p.email;
      var roleEl = document.getElementById('hubRole');
      if(roleEl) roleEl.textContent = p.is_instructor ? 'Instructor' : 'Student';

      /* panou instructor proeminent (sus) + cardul de cont secundar */
      var panel = document.getElementById('instPanel');
      var instr = document.getElementById('hubInstr');
      if(p.is_instructor){
        if(panel){
          panel.innerHTML = '<div class="card no-tilt inst-panel">' +
            '<div class="inst-panel-main"><p class="eyebrow">Panoul tău de instructor</p>' +
            '<h2 class="h3">Cursurile și vânzările tale</h2>' +
            '<p id="instPanelSub">Vezi accesări, vânzări și încasări în timp real.</p></div>' +
            '<div class="inst-panel-cta"><a class="btn btn-mint" href="dashboard.html">Deschide dashboard-ul</a>' +
            '<a class="btn btn-ghost" href="curs-nou.html">Curs nou</a></div></div>';
          DB.myCourses().then(function(cs){
            var pub = cs.filter(function(c){ return c.status === 'published'; }).length;
            var sub = document.getElementById('instPanelSub');
            if(sub && cs.length){
              sub.textContent = cs.length + (cs.length === 1 ? ' curs' : ' cursuri') + ' (' + pub +
                ' publicate) · accesări, vânzări și încasări în timp real.';
            }
          }).catch(function(){});
        }
        if(instr) instr.innerHTML = '<h3>Mod instructor activ</h3>' +
          '<p>Predai pe smarttube. Gestionează-ți cursurile din panoul de sus sau publică unul nou.</p>' +
          '<div class="hub-cta"><a class="btn btn-ghost" href="curs-nou.html">Publică un curs</a></div>';
      }else{
        if(panel) panel.innerHTML = '';
        if(instr){
          instr.innerHTML = '<h3>Predă pe smarttube</h3><p>Transformă ce știi într-un venit. Activează modul instructor și publică primul tău curs.</p>' +
            '<div class="hub-cta"><button class="btn btn-mint" id="becomeInstr" type="button">Devino instructor</button></div>';
          var b = document.getElementById('becomeInstr');
          if(b) b.addEventListener('click', function(){
            b.disabled = true; b.textContent = 'Se activează…';
            DB.becomeInstructor().then(function(){ location.href = 'dashboard.html'; })
              .catch(function(){ b.disabled = false; b.textContent = 'Devino instructor'; });
          });
        }
      }

      var box = document.getElementById('myCourses');
      var emptyBox = document.getElementById('myCoursesEmpty');
      var myTitle = document.getElementById('myCoursesTitle');
      box.innerHTML = new Array(4).join('<div class="ccard skeleton sk-card" aria-hidden="true"></div>');
      DB.myPurchases().then(function(ps){
        var courses = ps.map(function(x){ return x.courses; }).filter(Boolean);
        if(!courses.length){
          if(myTitle) myTitle.textContent = 'Începe să înveți';
          emptyBox.style.display = ''; box.style.display = 'none'; box.innerHTML = '';
          /* recomandări ca punct de plecare */
          DB.popularCourses(3).then(function(cs){
            var rec = document.getElementById('myCoursesRec');
            if(!rec || !cs.length) return;
            rec.style.display = '';
            var recGrid = document.getElementById('myCoursesRecGrid');
            recGrid.innerHTML = cs.map(function(c){ return courseCardHTML(c, 'front_page'); }).join('');
            tiltify(recGrid);
            [].forEach.call(recGrid.children, function(el){ el.classList.add('reveal'); });
            revealify(recGrid);
          }).catch(function(){});
          return;
        }
        if(myTitle) myTitle.textContent = courses.length === 1 ? 'Cursul tău' : 'Cursurile mele';
        box.innerHTML = courses.map(function(c){ return courseCardHTML(c, ''); }).join('');
        tiltify(box);
        [].forEach.call(box.children, function(el){ el.classList.add('reveal'); });
        revealify(box);
      }).catch(function(){
        box.innerHTML = '<p class="empty span-all" style="display:block">Nu am putut încărca cursurile tale. Reîncarcă pagina.</p>';
      });
    };

    DB.getProfile().then(function(p){
      if(p && redirect){ location.replace(redirect); return; }
      if(p) showHub(p); else showAuth();
    }).catch(showAuth);

    var loginForm = document.getElementById('loginForm');
    var registerForm = document.getElementById('registerForm');
    var noteOf = function(f){ return f.querySelector('.form-note'); };
    if(loginForm) loginForm.addEventListener('submit', function(e){
      e.preventDefault();
      var note = noteOf(loginForm);
      setNote(note, 'Se verifică…');
      DB.signIn(loginForm.email.value.trim(), loginForm.password.value).then(function(r){
        if(r.error){ setNote(note, authMsg(r.error), 'err'); return; }
        location.href = redirect || 'cont.html';
      });
    });
    if(registerForm) registerForm.addEventListener('submit', function(e){
      e.preventDefault();
      var note = noteOf(registerForm);
      setNote(note, 'Se creează contul…');
      DB.signUp(registerForm.name.value.trim(), registerForm.email.value.trim(), registerForm.password.value).then(function(r){
        if(r.error){ setNote(note, authMsg(r.error), 'err'); return; }
        if(r.data.session){ location.href = redirect || 'cont.html'; return; }
        setNote(note, 'Cont creat! Ți-am trimis un email de confirmare — apasă linkul din el, apoi intră în cont.', 'ok');
      });
    });
    var logoutBtn = document.getElementById('hubLogout');
    if(logoutBtn) logoutBtn.addEventListener('click', function(){
      var done = function(){ location.href = 'cont.html'; };
      DB.signOut().then(done, done);
    });
  }

  /* ---- pagina de curs: render din DB + cumpărare + tracking surse ---- */
  var coursePage = document.getElementById('coursePage');
  if(coursePage && hasDB){
    var cq = new URLSearchParams(location.search);
    var courseId = cq.get('id');
    if(!courseId){ location.replace('cursuri.html'); }
    else DB.getCourse(courseId).then(function(c){
      if(!c){ location.replace('cursuri.html'); return; }
      document.title = c.title + ' — smarttube';
      var metaDesc = document.querySelector('meta[name="description"]');
      if(metaDesc && c.subtitle) metaDesc.setAttribute('content', c.subtitle);
      var catLink = document.getElementById('cCatLink');
      catLink.textContent = DB.CATS[c.category] || c.category || '';
      catLink.href = 'cursuri.html#' + c.category;
      document.getElementById('cLevel').textContent = c.level;
      document.getElementById('cTitle').textContent = c.title;
      document.getElementById('cLead').textContent = c.subtitle;
      document.getElementById('cInstAv').textContent = c.instructor_initials;
      document.getElementById('cInstName').textContent = c.instructor_name;
      var rateEl = document.getElementById('cRate');
      if(c.rating != null){
        rateEl.innerHTML = '★★★★★ ' + DB.fmtRating(c.rating) +
          ' <span class="rate-n">(' + c.rating_count + ' recenzii)</span>';
      }else{
        rateEl.textContent = 'Curs nou pe smarttube';
      }
      var when = new Date(c.created_at);
      var months = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'];
      document.getElementById('cUpdated').textContent = 'Actualizat ' + months[when.getMonth()] + ' ' + when.getFullYear();

      /* coperta cursului: galerie (poze + video) tip eMAG dacă instructorul a adăugat media; altfel gradient */
      var gThumb = /^g[123]$/.test(c.thumb_style) ? c.thumb_style : 'g1';
      var sideHero = document.querySelector('#coursePage aside .sc-hero');
      if(sideHero) sideHero.classList.add(gThumb);   // cardul lateral rămâne pe gradient
      var cover = document.getElementById('cCover');
      var screenEl = cover && cover.parentElement;   // .screen (ramă glass)
      var media = (c.gallery || []).filter(function(it){ return it && it.p && (it.t === 'img' || it.t === 'vid'); });
      if(cover && screenEl && media.length){
        cover.classList.remove('sc-hero');
        cover.classList.add('cgal-main');
        var setMain = function(it){
          if(it.t === 'vid'){
            cover.innerHTML = '<div class="cgal-vidwrap"><video src="' + DB.esc(DB.mediaUrl(it.p)) + '" playsinline preload="metadata"></video>' +
              '<button class="cgal-play" type="button" aria-label="Redă videoul">' + PLAY_SVG + '</button></div>';
            var v = cover.querySelector('video'), pb = cover.querySelector('.cgal-play');
            pb.addEventListener('click', function(){
              v.controls = true; pb.style.display = 'none';
              var pr = v.play(); if(pr && pr.catch) pr.catch(function(){});
            });
          }else{
            cover.innerHTML = '<img class="cgal-img" src="' + DB.esc(DB.mediaUrl(it.p)) + '" alt="' + DB.esc(c.title) + '" />';
          }
        };
        setMain(media[0]);
        var thumbs = document.createElement('div');
        thumbs.className = 'cgal-thumbs';
        media.forEach(function(it, i){
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'cgal-thumb' + (i === 0 ? ' on' : '');
          b.setAttribute('aria-label', (it.t === 'vid' ? 'Video ' : 'Imagine ') + (i + 1));
          b.innerHTML = it.t === 'vid'
            ? '<video src="' + DB.esc(DB.mediaUrl(it.p)) + '" muted playsinline preload="metadata"></video><span class="tvb">' + PLAY_SVG + '</span>'
            : '<img src="' + DB.esc(DB.mediaUrl(it.p)) + '" alt="" />';
          b.addEventListener('click', function(){
            setMain(it);
            [].forEach.call(thumbs.children, function(x){ x.classList.remove('on'); });
            b.classList.add('on');
          });
          thumbs.appendChild(b);
        });
        screenEl.insertAdjacentElement('afterend', thumbs);
      }else if(cover){
        cover.classList.add(gThumb);
        cover.innerHTML = '<span class="cc-tag">' + DB.esc(DB.CAT_SHORT[c.category] || '') + '</span>' +
          '<span class="cc-dur">' + DB.fmtDur(c.total_minutes) + '</span>';
      }

      var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
      document.getElementById('cLearn').innerHTML = (c.what_you_learn || []).map(function(x){
        return '<li>' + check + DB.esc(x) + '</li>';
      }).join('');

      var plus = '<span class="mod-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>';
      var lessonCount = 0, totalMin = 0;
      document.getElementById('cCurriculum').innerHTML = (c.course_modules || []).map(function(m, i){
        var mins = 0;
        var rows = (m.lessons || []).map(function(l){
          lessonCount++; mins += l.duration_min;
          var hasVid = !!l.video_path;
          return '<div class="lesson' + (hasVid ? ' has-video' : '') + '"' +
            (hasVid ? ' data-video="' + DB.esc(l.video_path) + '" data-vtitle="' + DB.esc(l.title) + '"' : '') + '>' +
            PLAY_SVG + DB.esc(l.title) + (hasVid ? '<span class="vtag">video</span>' : '') +
            '<span class="dur">' + (l.duration_min < 10 ? '0' : '') + l.duration_min + ':00</span></div>';
        }).join('');
        totalMin += mins;
        return '<div class="module' + (i === 0 ? ' open' : '') + '">' +
          '<button class="mod-head" aria-expanded="' + (i === 0 ? 'true' : 'false') + '"><span>' + (i + 1) + ' · ' + DB.esc(m.title) +
          ' <span class="meta">— ' + (m.lessons || []).length + ' lecții · ' + DB.fmtDur(mins) + '</span></span>' +
          plus + '</button><div class="mod-body"><div>' + rows + '</div></div></div>';
      }).join('');

      /* facts row: cifrele cursului dintr-o privire (după calculul curriculum-ului) */
      var facts = document.getElementById('cFacts');
      if(facts){
        document.getElementById('cfLessons').textContent = lessonCount;
        document.getElementById('cfDur').textContent = DB.fmtDur(totalMin || c.total_minutes);
        document.getElementById('cfLevel').textContent = c.level || '—';
        document.getElementById('cfModules').textContent = (c.course_modules || []).length;
        facts.style.display = '';
      }

      document.getElementById('cInstCard').innerHTML =
        '<div class="inst-top"><span class="av">' + DB.esc(c.instructor_initials) + '</span>' +
        '<div><h3>' + DB.esc(c.instructor_name) + '</h3><div class="role">' + DB.esc(DB.CATS[c.category] || '') + '</div></div></div>' +
        '<p>' + DB.esc(c.description) + '</p>';

      /* ===== recenzii: sumar + histogramă pe stele, sortare/filtrare/căutare, editare proprie (stil eMAG, temă smarttube) ===== */
      var rvList = document.getElementById('cReviews');
      var rvEmpty = document.getElementById('cReviewsEmpty');
      var rvSummary = document.getElementById('cRevSummary');
      var rvControls = document.getElementById('cRevControls');
      var rvComposer = document.getElementById('cRevComposer');
      var rvCount = document.getElementById('cRevCount');
      var RWORD = {5:'Excelent', 4:'Foarte bun', 3:'Bun', 2:'Slab', 1:'Foarte slab'};
      var RMON = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','noi','dec'];
      var revDate = function(iso){ var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.getDate() + ' ' + RMON[d.getMonth()] + ' ' + d.getFullYear(); };
      var starBar = function(val){ return '<span class="rstars" style="--pct:' + (Math.max(0, Math.min(5, val)) / 5 * 100).toFixed(1) + '%"><i></i></span>'; };
      var dotsSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>';
      var verSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
      var clampR = function(x){ return Math.max(1, Math.min(5, x | 0)); };

      var allRv = [], myId = null, isBuyer = false, starFilter = 0, sortKey = 'new', searchQ = '', controlsBuilt = false;

      var paintSummary = function(){
        var n = allRv.length;
        rvCount.textContent = n ? '(' + n + (n === 1 ? ' recenzie)' : ' recenzii)') : '';
        if(!n){ rvSummary.style.display = 'none'; return; }
        var sum = 0, buckets = [0,0,0,0,0];
        allRv.forEach(function(r){ var k = clampR(r.rating); sum += k; buckets[k - 1]++; });
        var avg = sum / n, rows = '';
        for(var s = 5; s >= 1; s--){
          var cnt = buckets[s - 1], pct = n ? cnt / n * 100 : 0;
          rows += '<button type="button" class="rv-hrow' + (starFilter === s ? ' on' : '') + '" data-star="' + s + '" aria-pressed="' + (starFilter === s) + '">' +
            '<span class="rv-hlabel">' + s + ' <em>★</em></span>' +
            '<span class="rv-htrack"><span class="rv-hfill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
            '<span class="rv-hcount">' + cnt + '</span></button>';
        }
        rvSummary.style.display = '';
        rvSummary.innerHTML =
          '<div class="rv-avg"><div class="rv-avgnum">' + DB.fmtRating(Math.round(avg * 100) / 100) + '</div>' +
          starBar(avg) + '<div class="rv-avgn">' + n + (n === 1 ? ' recenzie' : ' recenzii') + '</div></div>' +
          '<div class="rv-hist">' + rows + '</div>';
      };

      var rowHTML = function(r){
        var mine = !!(myId && r.user_id === myId);
        var title = (r.title && r.title.trim()) || RWORD[clampR(r.rating)] || '';
        return '<div class="rv-item' + (mine ? ' mine' : '') + '">' +
          '<span class="av rv-ava" aria-hidden="true">' + DB.esc(DB.initials(r.author_name)) + '</span>' +
          '<div class="rv-main">' +
            '<div class="rv-head"><b class="rv-name">' + DB.esc(r.author_name || 'Student') + '</b>' +
            (mine ? '<span class="rv-you">recenzia ta</span>' : '') +
            '<span class="rv-date">' + revDate(r.created_at) + '</span>' +
            (mine ? '<div class="rv-menu"><button type="button" class="rv-dots" aria-label="Opțiuni recenzie" aria-haspopup="true">' + dotsSvg + '</button>' +
              '<div class="rv-pop" hidden><button type="button" data-act="edit">Editează</button><button type="button" data-act="del">Șterge</button></div></div>' : '') +
            '</div>' +
            '<div class="rv-tline">' + starBar(r.rating) + '<b class="rv-title">' + DB.esc(title) + '</b>' +
              '<span class="rv-badge">' + verSvg + 'Cumpărător verificat</span></div>' +
            (r.comment ? '<p class="rv-text">' + DB.esc(r.comment) + '</p>' : '') +
          '</div></div>';
      };

      var paintList = function(){
        var items = allRv.slice();
        if(starFilter) items = items.filter(function(r){ return clampR(r.rating) === starFilter; });
        if(searchQ){
          var q = searchQ.toLowerCase();
          items = items.filter(function(r){ return ((r.comment || '') + ' ' + (r.title || '') + ' ' + (r.author_name || '')).toLowerCase().indexOf(q) !== -1; });
        }
        items.sort(function(a, b){
          if(sortKey === 'old') return new Date(a.created_at) - new Date(b.created_at);
          if(sortKey === 'hi') return (b.rating - a.rating) || (new Date(b.created_at) - new Date(a.created_at));
          if(sortKey === 'lo') return (a.rating - b.rating) || (new Date(b.created_at) - new Date(a.created_at));
          return new Date(b.created_at) - new Date(a.created_at);
        });
        if(myId){   // recenzia proprie sus, pentru vizibilitate
          var own = items.filter(function(r){ return r.user_id === myId; });
          if(own.length) items = own.concat(items.filter(function(r){ return r.user_id !== myId; }));
        }
        if(!items.length){
          rvList.innerHTML = '';
          rvEmpty.style.display = 'block';
          rvEmpty.textContent = allRv.length ? 'Nicio recenzie nu se potrivește filtrelor.' : 'Încă nicio recenzie pentru acest curs.';
          return;
        }
        rvEmpty.style.display = 'none';
        rvList.innerHTML = items.map(rowHTML).join('');
      };

      var updateChip = function(){
        var chip = document.getElementById('rvChip');
        if(!chip) return;
        chip.innerHTML = starFilter ? '<button type="button" class="rv-chip" id="rvClear">Doar ' + starFilter + '★ <span aria-hidden="true">✕</span></button>' : '';
        var clr = document.getElementById('rvClear');
        if(clr) clr.addEventListener('click', function(){ starFilter = 0; paintSummary(); updateChip(); paintList(); });
      };

      var buildControls = function(){
        controlsBuilt = true;
        rvControls.style.display = '';
        rvControls.innerHTML =
          '<div class="rv-sortwrap"><span class="rv-sortlbl">Sortează</span>' +
          '<select id="rvSort" class="rv-select" aria-label="Sortează recenziile">' +
            '<option value="new">Cele mai noi</option><option value="old">Cele mai vechi</option>' +
            '<option value="hi">Nota: mare → mică</option><option value="lo">Nota: mică → mare</option></select></div>' +
          '<span class="rv-chipwrap" id="rvChip"></span>' +
          '<div class="rv-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg>' +
          '<input type="search" id="rvSearch" placeholder="Caută în recenzii…" aria-label="Caută în recenzii" /></div>';
        var sel = rvControls.querySelector('#rvSort'); sel.value = sortKey;
        sel.addEventListener('change', function(){ sortKey = this.value; paintList(); });
        var srch = rvControls.querySelector('#rvSearch'); srch.value = searchQ;
        srch.addEventListener('input', function(){ searchQ = this.value.trim(); paintList(); });
      };

      var buildComposer = function(mine){
        if(!rvComposer) return;
        rvComposer.style.display = '';
        var picked = mine ? clampR(mine.rating) : 0;
        rvComposer.innerHTML =
          '<h3 class="rv-ctitle">' + (mine ? 'Editează-ți recenzia' : 'Spune-ți părerea') + '</h3>' +
          '<div class="rv-pick" id="rvPick">' +
            [1,2,3,4,5].map(function(i){ return '<button type="button" class="rv-pstar' + (i <= picked ? ' on' : '') + '" data-v="' + i + '" aria-label="' + i + (i === 1 ? ' stea' : ' stele') + '">★</button>'; }).join('') +
            '<span class="rv-picklbl" id="rvPickLbl">' + (picked ? RWORD[picked] : 'Acordă o notă') + '</span></div>' +
          '<input type="text" id="rvTitleIn" class="rv-cinput" maxlength="120" placeholder="Titlu (opțional) — ex: Excelent" value="' + (mine ? DB.esc(mine.title || '') : '') + '" />' +
          '<textarea id="rvCommentIn" class="rv-cinput rv-carea" maxlength="1000" placeholder="Recenzia ta (opțional) — ce ți-a plăcut, cui recomanzi cursul?">' + (mine ? DB.esc(mine.comment || '') : '') + '</textarea>' +
          '<div class="rv-cfoot"><button type="button" class="btn btn-mint" id="rvSubmit">' + (mine ? 'Actualizează recenzia' : 'Trimite recenzia') + '</button>' +
          (mine ? '<button type="button" class="btn btn-ghost" id="rvCancel">Renunță</button>' : '') +
          '<span class="form-note rv-note" id="rvNote" aria-live="polite"></span></div>';
        var pick = rvComposer.querySelector('#rvPick'), lbl = rvComposer.querySelector('#rvPickLbl');
        var paint = function(v){ [].forEach.call(pick.querySelectorAll('.rv-pstar'), function(b, i){ b.classList.toggle('on', (i + 1) <= v); }); lbl.textContent = v ? RWORD[v] : 'Acordă o notă'; };
        [].forEach.call(pick.querySelectorAll('.rv-pstar'), function(b){
          var v = parseInt(b.dataset.v, 10);
          b.addEventListener('mouseenter', function(){ paint(v); });
          b.addEventListener('click', function(){ picked = v; paint(v); });
        });
        pick.addEventListener('mouseleave', function(){ paint(picked); });
        rvComposer.querySelector('#rvSubmit').addEventListener('click', function(){
          var note = rvComposer.querySelector('#rvNote');
          if(!picked){ setNote(note, 'Alege o notă (1–5 stele).', 'err'); return; }
          var btn = this; btn.disabled = true;
          DB.upsertReview(c.id, picked, rvComposer.querySelector('#rvCommentIn').value.trim(), rvComposer.querySelector('#rvTitleIn').value.trim())
            .then(function(){ setNote(note, 'Mulțumim! Recenzia ta a fost salvată.', 'ok'); return loadReviews(); })
            .catch(function(){ setNote(note, 'Nu am putut salva recenzia. Reîncearcă.', 'err'); btn.disabled = false; });
        });
        var cancel = rvComposer.querySelector('#rvCancel');
        if(cancel) cancel.addEventListener('click', function(){ loadReviews(); });
      };

      var loadReviews = function(){
        return Promise.all([DB.getUser(), DB.getReviews(c.id)]).then(function(res){
          myId = res[0] ? res[0].id : null;
          allRv = res[1] || [];
          paintSummary();
          if(allRv.length && !controlsBuilt) buildControls();
          else if(!allRv.length && rvControls) rvControls.style.display = 'none';
          updateChip();
          paintList();
          var mine = myId ? allRv.filter(function(r){ return r.user_id === myId; })[0] : null;
          if(isBuyer && !mine) buildComposer(null);
          else if(rvComposer) rvComposer.style.display = 'none';
        }).catch(function(){});
      };
      var rvEnableComposer = function(){ isBuyer = true; loadReviews(); };

      /* histogramă → filtru pe stele */
      rvSummary.addEventListener('click', function(e){
        var b = e.target.closest('.rv-hrow');
        if(!b) return;
        var s = parseInt(b.dataset.star, 10);
        starFilter = (starFilter === s ? 0 : s);
        paintSummary(); updateChip(); paintList();
      });
      /* meniu ⋯ pe recenzia proprie: editează / șterge */
      rvList.addEventListener('click', function(e){
        var dotsBtn = e.target.closest('.rv-dots');
        if(dotsBtn){
          e.stopPropagation();
          var pop = dotsBtn.parentElement.querySelector('.rv-pop');
          var wasOpen = !pop.hasAttribute('hidden');
          [].forEach.call(rvList.querySelectorAll('.rv-pop'), function(p){ p.setAttribute('hidden', ''); });
          if(!wasOpen) pop.removeAttribute('hidden');
          return;
        }
        var act = e.target.closest('.rv-pop button');
        if(act){
          var mine = myId ? allRv.filter(function(r){ return r.user_id === myId; })[0] : null;
          if(act.dataset.act === 'edit' && mine){
            buildComposer(mine);
            try{ rvComposer.scrollIntoView({behavior:'smooth', block:'center'}); }catch(_){}
          }else if(act.dataset.act === 'del'){
            if(confirm('Ștergi recenzia ta? Acțiunea nu poate fi anulată.')){
              DB.deleteReview(c.id).then(function(){ loadReviews(); }).catch(function(){});
            }
          }
          [].forEach.call(rvList.querySelectorAll('.rv-pop'), function(p){ p.setAttribute('hidden', ''); });
        }
      });
      document.addEventListener('click', function(){ [].forEach.call(rvList.querySelectorAll('.rv-pop'), function(p){ p.setAttribute('hidden', ''); }); });

      loadReviews();

      document.getElementById('cPrice').textContent = DB.fmtPrice(c.price);
      document.getElementById('cLessonsMeta').textContent =
        lessonCount + ' lecții video · ' + DB.fmtDur(totalMin || c.total_minutes);

      /* tracking: de unde a venit vizita */
      var src = cq.get('src');
      if(['front_page','catalog','search','external'].indexOf(src) === -1){
        src = 'direct';
        if(document.referrer){
          try{ if(new URL(document.referrer).host !== location.host) src = 'external'; }catch(e){}
        }
      }
      DB.logView(c.id, src, document.referrer);

      /* cumpărare + drept de vizionare (cumpărător sau instructorul cursului) */
      var buyBtn = document.getElementById('cBuy');
      var modal = document.getElementById('buyModal');
      var canWatch = false;
      var setOwned = function(){
        canWatch = true;
        buyBtn.textContent = 'Ai acest curs — vezi contul tău';
        buyBtn.href = 'cont.html';
        buyBtn.classList.remove('btn-mint');
        buyBtn.classList.add('btn-ghost');
        buyBtn.onclick = null;
        rvEnableComposer();   // cumpărătorii pot lăsa / edita o recenzie
      };
      Promise.all([DB.hasPurchase(c.id), DB.getProfile()]).then(function(res){
        if(res[0]) setOwned();
        else if(res[1] && c.instructor_id === res[1].id) canWatch = true;
      }).catch(function(){});
      buyBtn.addEventListener('click', function(e){
        if(buyBtn.href && buyBtn.getAttribute('href') !== '#') return;   // deja deținut → link normal
        e.preventDefault();
        DB.getUser().then(function(u){
          if(!u){
            location.href = 'cont.html?redirect=' + encodeURIComponent('curs.html?id=' + c.id);
            return;
          }
          document.getElementById('bmTitle').textContent = c.title;
          document.getElementById('bmPrice').textContent = DB.fmtPrice(c.price);
          modal.classList.add('open');
        });
      });
      var bmClose = function(){
        modal.classList.remove('open');
        document.getElementById('bmNote').textContent = '';
      };
      document.getElementById('bmX').addEventListener('click', bmClose);
      modal.addEventListener('click', function(e){ if(e.target === modal) bmClose(); });

      /* player video pentru lecții (URL semnat, doar cu acces) */
      var vidModal = document.getElementById('vidModal');
      var vidPlayer = document.getElementById('vidPlayer');
      var vmTitle = document.getElementById('vmTitle');
      dialogify(modal, 'bmTitle');
      dialogify(vidModal, 'vmTitle');
      var vidClose = function(){
        vidModal.classList.remove('open');
        try{ vidPlayer.pause(); vidPlayer.removeAttribute('src'); vidPlayer.load(); }catch(e){}
      };
      document.getElementById('vmX').addEventListener('click', vidClose);
      vidModal.addEventListener('click', function(e){ if(e.target === vidModal) vidClose(); });
      addEventListener('keydown', function(e){ if(e.key === 'Escape'){ bmClose(); vidClose(); } });
      document.getElementById('cCurriculum').addEventListener('click', function(e){
        var el = e.target.closest('.lesson.has-video');
        if(!el) return;
        DB.getUser().then(function(u){
          if(!u){
            location.href = 'cont.html?redirect=' + encodeURIComponent('curs.html?id=' + c.id);
            return;
          }
          if(!canWatch){
            document.getElementById('bmTitle').textContent = c.title;
            document.getElementById('bmPrice').textContent = DB.fmtPrice(c.price);
            modal.classList.add('open');
            return;
          }
          var vmRetry = document.getElementById('vmRetry');
          var loadVid = function(){
            vmTitle.textContent = el.dataset.vtitle;
            if(vmRetry) vmRetry.style.display = 'none';
            DB.videoUrl(el.dataset.video).then(function(url){
              vidPlayer.src = url;
              var pr = vidPlayer.play();
              if(pr && pr.catch) pr.catch(function(){});
            }).catch(function(){
              vmTitle.textContent = 'Nu am putut încărca videoul.';
              if(vmRetry) vmRetry.style.display = '';
            });
          };
          if(vmRetry) vmRetry.onclick = loadVid;
          vidModal.classList.add('open');
          loadVid();
        });
      });
      var bmConfirm = document.getElementById('bmConfirm');
      bmConfirm.addEventListener('click', function(){
        if(bmConfirm.disabled) return;
        bmConfirm.disabled = true; bmConfirm.textContent = 'Se procesează…';
        var bmFail = function(msg){
          bmConfirm.disabled = false; bmConfirm.textContent = 'Confirmă plata';
          document.getElementById('bmNote').textContent = msg;
        };
        DB.buyCourse(c.id, c.price).then(function(r){
          /* 23505 = cursul era deja cumpărat — tot al lui e */
          if(r.error && r.error.code !== '23505'){
            bmFail('Nu am putut finaliza plata. Verifică-ți conexiunea și reîncearcă.');
            return;
          }
          bmConfirm.disabled = false; bmConfirm.textContent = 'Confirmă plata';
          document.getElementById('bmBody').style.display = 'none';
          document.getElementById('bmDone').style.display = '';
          setOwned();
        }).catch(function(){
          bmFail('Nu am putut finaliza plata. Verifică-ți conexiunea și reîncearcă.');
        });
      });
    }).catch(function(){
      document.getElementById('cTitle').textContent = 'Nu am putut încărca acest curs.';
      document.getElementById('cLead').innerHTML =
        'Verifică-ți conexiunea și reîncearcă, sau <a href="cursuri.html" class="link">întoarce-te la catalog</a>.';
    });
  }

  /* ---- formular contact real (despre.html) ---- */
  var contactForm = document.getElementById('contactForm');
  if(contactForm && hasDB){
    contactForm.addEventListener('submit', function(e){
      e.preventDefault();
      var note = contactForm.querySelector('.form-note');
      var sendBtn = contactForm.querySelector('button[type="submit"]');
      var name = contactForm.name.value.trim();
      var email = contactForm.email.value.trim();
      var msg = contactForm.message.value.trim();
      contactForm.name.removeAttribute('aria-invalid');
      contactForm.message.removeAttribute('aria-invalid');
      if(name.length < 2){ contactForm.name.setAttribute('aria-invalid', 'true'); setNote(note, 'Scrie-ne și numele tău.', 'err'); return; }
      if(msg.length < 10){ contactForm.message.setAttribute('aria-invalid', 'true'); setNote(note, 'Mesajul e prea scurt — dă-ne câteva detalii.', 'err'); return; }
      var sendLabel = sendBtn.textContent;
      sendBtn.disabled = true; sendBtn.textContent = 'Se trimite…';
      setNote(note, '');
      var fail = function(){ setNote(note, 'Nu am putut trimite mesajul. Reîncearcă.', 'err'); };
      DB.sendContact(name, email, msg).then(function(r){
        if(r.error){ fail(); return; }
        setNote(note, 'Mulțumim! Mesajul a ajuns la noi — îți răspundem în maxim o zi lucrătoare.', 'ok');
        contactForm.reset();
      }).catch(fail).then(function(){
        sendBtn.disabled = false; sendBtn.textContent = sendLabel;
      });
    });
  }

  /* expune helperi pentru paginile cu script propriu (dashboard, wizard) */
  window.App = { courseCardHTML:courseCardHTML, tiltify:tiltify, authMsg:authMsg, revealify:revealify, countUp:countUp };
})();

/* ---- „lacul cunoașterii" PER-SECȚIUNE: fiecare secțiune are propriul câmp de simboluri ----
   Canvas fix (#lakeFx) în spatele întregului conținut. Simbolurile sunt ancorate pe DOCUMENT, în banda
   secțiunii lor (cu margine față de liniile de delimitare), și se mișcă odată cu pagina la scroll —
   nu trec peste linie; la trecerea dintr-o secțiune în alta apar simboluri noi. Lanterna le dezvăluie.
   Hero-ul e exclus (are propriile orbe). Rebuild la resize + conținut async (catalog/carusel). */
(function(){
  var canvas = document.getElementById('lakeFx');
  if(!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var live = matchMedia('(pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches;
  var GLYPHS = ['</>','{ }','( )','[ ]',';','#','01','Aa','▶','▷','♪','♫','♩','%','↗','€','★','✓'];
  var FONT = 'ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace';
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, bands = [], R = 200;
  function rnd(n){ var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }   // determinist
  function genBand(top, h, seed){
    var arr = [], cell = 86, cols = Math.ceil(W / cell), m = 28;   // m = margine sus/jos față de linia secțiunii
    var inner = h - m * 2;
    if(inner < 24) return arr;
    var rows = Math.max(1, Math.round(inner / cell)), k = seed;
    for(var iy = 0; iy < rows; iy++) for(var ix = 0; ix < cols; ix++){
      k++;
      var ly2 = m + (iy + 0.5) * (inner / rows) + (rnd(k * 3.7) - 0.5) * (inner / rows) * 0.55;
      if(ly2 < m * 0.6) ly2 = m * 0.6;
      if(ly2 > h - m * 0.6) ly2 = h - m * 0.6;
      arr.push({
        x: ix * cell + cell * 0.5 + (rnd(k * 2.1) - 0.5) * cell * 0.7,
        docY: top + ly2,
        g: GLYPHS[Math.floor(rnd(k * 5.3) * GLYPHS.length) % GLYPHS.length],
        s: 12 + Math.floor(rnd(k * 7.1) * 9),
        a0: 0.022 + rnd(k * 9.7) * 0.04,
        tw: rnd(k * 11.3) * 6.283,
        ax: 4 + rnd(k * 13.1) * 6,
        ay: 3 + rnd(k * 17.3) * 5,
        p1: rnd(k * 19.7) * 6.283,
        p2: rnd(k * 23.9) * 6.283
      });
    }
    return arr;
  }
  function genViewportSyms(){   // hero: simboluri ancorate pe VIEWPORT (plutesc pe loc cât hero-ul e fixat)
    var arr = [], cell = 86, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), k = 5;
    for(var iy = 0; iy < rows; iy++) for(var ix = 0; ix < cols; ix++){
      k++;
      arr.push({
        x: ix * cell + cell * 0.5 + (rnd(k * 2.1) - 0.5) * cell * 0.7,
        y: iy * cell + cell * 0.5 + (rnd(k * 3.7) - 0.5) * cell * 0.7,
        g: GLYPHS[Math.floor(rnd(k * 5.3) * GLYPHS.length) % GLYPHS.length],
        s: 12 + Math.floor(rnd(k * 7.1) * 9),
        a0: 0.022 + rnd(k * 9.7) * 0.04,
        tw: rnd(k * 11.3) * 6.283,
        ax: 4 + rnd(k * 13.1) * 7,
        ay: 5 + rnd(k * 17.3) * 8,
        p1: rnd(k * 19.7) * 6.283,
        p2: rnd(k * 23.9) * 6.283
      });
    }
    return arr;
  }
  function build(){
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    if(!W || !H) return;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.max(170, Math.min(260, W * 0.15));
    var sy = window.pageYOffset || 0;
    var all = [].slice.call(document.querySelectorAll('section,.tile,.car,header.phead'));
    var tops = all.filter(function(el){
      if(el.classList.contains('hero-zoom') || el.classList.contains('sect-alt') || el.classList.contains('featured')) return false;   // secțiuni opace (orbe proprii) — fără lac dedesubt
      if(el.offsetHeight < 90) return false;
      return !all.some(function(o){ return o !== el && o.contains(el); });   // doar blocurile de nivel-secțiune
    });
    bands = tops.map(function(el, i){
      var rr = el.getBoundingClientRect();
      var top = rr.top + sy;
      return { top: top, bot: top + rr.height, syms: genBand(top, rr.height, Math.floor(top) + i * 131 + 7) };
    });
    var hero = document.querySelector('.hero-zoom');   // hero (sticky) → bandă FIXĂ: simbolurile plutesc pe loc cât e fixat
    if(hero && hero.offsetHeight > 90){
      var hrr = hero.getBoundingClientRect();
      bands.push({ fixed: true, top: hrr.top + sy, bot: hrr.top + sy + hrr.height, syms: genViewportSyms() });
    }
  }
  var tx = -1e4, ty = -1e4, lx = -1e4, ly = -1e4, raf = 0, running = false;
  function frame(t){
    raf = 0;
    lx += (tx - lx) * 0.14; ly += (ty - ly) * 0.14;
    var sy = window.pageYOffset || 0;
    ctx.clearRect(0, 0, W, H);
    if(lx > -9e3){
      var gg = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 1.15);
      gg.addColorStop(0, 'rgba(46,201,171,.07)');
      gg.addColorStop(.6, 'rgba(46,201,171,.02)');
      gg.addColorStop(1, 'rgba(46,201,171,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for(var b = 0; b < bands.length; b++){
      var band = bands[b];
      if(band.fixed){ if(sy >= band.bot - H + 40) continue; }                         // hero: doar cât e fixat (apoi îl acoperă „featured")
      else if(band.bot - sy < -30 || band.top - sy > H + 30) continue;                // sare benzile din afara viewportului
      var syms = band.syms, fixed = band.fixed;
      for(var i = 0; i < syms.length; i++){
        var s = syms[i];
        var fy = (fixed ? s.y : (s.docY - sy)) + Math.sin(t * 0.0007 + s.p1) * s.ay;   // hero = viewport; restul = ancorat pe document
        if(fy < -30 || fy > H + 30) continue;
        var fx = s.x + Math.sin(t * 0.0005 + s.p2) * s.ax;
        var prox = 0;
        if(lx > -9e3){
          var dx = fx - lx, dy = fy - ly, d = Math.sqrt(dx * dx + dy * dy);
          if(d < R){ prox = 1 - d / R; prox = prox * prox * (3 - 2 * prox); }
        }
        var base = s.a0 * (0.6 + 0.4 * Math.sin(t * 0.001 + s.tw));
        var a = base + (0.55 - base) * prox;
        if(prox > 0.5){ ctx.shadowColor = 'rgba(46,201,171,.5)'; ctx.shadowBlur = 4 * prox; }
        else { ctx.shadowBlur = 0; }
        ctx.font = '500 ' + (s.s * (1 + 0.16 * prox)).toFixed(1) + 'px ' + FONT;
        ctx.fillStyle = 'rgba(46,201,171,' + a.toFixed(3) + ')';
        ctx.fillText(s.g, fx, fy);
      }
    }
    ctx.shadowBlur = 0;
    if(running) raf = requestAnimationFrame(frame);
  }
  function start(){ if(running || !live) return; running = true; raf = requestAnimationFrame(frame); }
  function stop(){ running = false; if(raf){ cancelAnimationFrame(raf); raf = 0; } }
  function drawStatic(){
    if(!W) return;
    var sy = window.pageYOffset || 0;
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowBlur = 0;
    for(var b = 0; b < bands.length; b++){
      var band = bands[b];
      if(band.fixed){ if(sy >= band.bot - H + 40) continue; }
      else if(band.bot - sy < -30 || band.top - sy > H + 30) continue;
      var syms = band.syms, fixed = band.fixed;
      for(var i = 0; i < syms.length; i++){ var s = syms[i];
        var fy = fixed ? s.y : (s.docY - sy);
        if(fy < -30 || fy > H + 30) continue;
        ctx.font = '500 ' + s.s + 'px ' + FONT;
        ctx.fillStyle = 'rgba(46,201,171,' + s.a0.toFixed(3) + ')';
        ctx.fillText(s.g, s.x, fy);
      }
    }
  }
  build();
  if(live){
    addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch') return;
      tx = e.clientX; ty = e.clientY;
    }, {passive: true});
    document.addEventListener('mouseleave', function(){ tx = -1e4; ty = -1e4; }, {passive: true});
    document.addEventListener('visibilitychange', function(){ if(document.hidden){ stop(); } else { start(); } });
    start();
  } else {
    drawStatic();
    var stick = false;
    addEventListener('scroll', function(){ if(!stick){ stick = true; requestAnimationFrame(function(){ drawStatic(); stick = false; }); } }, {passive: true});
  }
  var rz;
  function rebuild(){ clearTimeout(rz); rz = setTimeout(function(){ build(); if(!live) drawStatic(); }, 180); }
  addEventListener('resize', rebuild);
  if('ResizeObserver' in window){ new ResizeObserver(rebuild).observe(document.body); }   // conținut async schimbă înălțimile
})();

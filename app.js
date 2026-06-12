/* ===== smarttube — shared app.js ===== */
(function(){
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var hasDB = typeof window.DB !== 'undefined';

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
    var nsNorm = function(s){ return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    var nsIndex = function(it){ it._n = nsNorm(it.t + ' ' + it.s + ' ' + (it.k || '')); return it; };
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
      var q = nsNorm(raw).trim();
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
        if(el.id === 'heroVid' && innerWidth > 833){ el.style.transform = ''; return; }  // desktop hero uses its own scrub
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

  /* ---- hero founders video: grows on scroll, opens fullscreen modal ---- */
  var heroScrub = document.getElementById('heroScrub');
  var heroVid = document.getElementById('heroVid');
  var heroVideo = document.getElementById('heroVideo');
  var heroPlay = document.getElementById('heroPlay');
  var heroX = document.getElementById('heroX');
  var heroCopy = heroScrub && heroScrub.querySelector('.hero-copy');
  if(heroScrub && heroVid){
    /* pe mobil nu pornim videoul automat — consumă date; posterul + butonul play rămân */
    if(heroVideo && innerWidth <= 833){
      try{ heroVideo.autoplay = false; heroVideo.pause(); }catch(e){}
    }
    var hState = 'idle';            // idle | open | dismissed
    var hBase = null;               // {fill, dx, dy} measured near the top
    var hLockY = 0;
    var heroVidHome = heroVid.parentNode, heroVidNext = heroVid.nextSibling;
    var heroScrubOn = function(){ return innerWidth > 833 && !reduce; };

    var hScrub = function(){
      if(hState !== 'idle' || !heroScrubOn()) return;
      var vw = innerWidth, vh = innerHeight;
      var top = heroScrub.getBoundingClientRect().top;       // 68 → negative as it pins
      var span = heroScrub.offsetHeight - vh;
      var p = span > 0 ? Math.max(0, Math.min(1, -top / span)) : 0;
      if(p <= 0.01){                                          // transform ≈ identity here: safe to measure
        var r = heroVid.getBoundingClientRect();
        hBase = {
          fill: Math.max(vw / r.width, vh / r.height) * 1.02,
          dx: vw / 2 - (r.left + r.width / 2),
          dy: vh / 2 - (r.top + r.height / 2)
        };
      }
      if(!hBase) return;
      var s = 1 + (hBase.fill - 1) * p;
      heroVid.style.transform = 'translate(' + (hBase.dx * p).toFixed(1) + 'px,' + (hBase.dy * p).toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
      heroVid.style.borderRadius = (Math.max(0, 24 * (1 - p * 1.3)) / s).toFixed(2) + 'px';
      if(heroCopy) heroCopy.style.opacity = Math.max(0, 1 - p / 0.4).toFixed(3);
      if(p >= 0.992) heroOpen();
    };

    function heroOpen(){
      if(hState === 'open') return;
      hState = 'open';
      hLockY = window.pageYOffset || 0;
      heroVid.style.transform = '';
      heroVid.style.borderRadius = '';
      heroVid.classList.add('is-open', 'is-playing');
      document.body.appendChild(heroVid);          // escape the sticky stage's stacking context → true fullscreen
      document.body.style.top = -hLockY + 'px';
      document.body.classList.add('hero-locked');
      try{                                          // fullscreen: play with sound (mute fallback), no loop so it can end
        heroVideo.controls = true;
        heroVideo.loop = false;
        heroVideo.muted = false;
        var pr = heroVideo.play();
        if(pr && pr.catch) pr.catch(function(){ try{ heroVideo.muted = true; heroVideo.play(); }catch(e){} });
      }catch(e){}
    }

    var heroClose = function(){
      if(hState !== 'open') return;
      hState = 'dismissed';
      try{ heroVideo.pause(); }catch(e){}
      // place the page behind the (still-visible) overlay at the next section, then crossfade
      document.body.classList.remove('hero-locked');
      document.body.style.top = '';
      if(heroCopy) heroCopy.style.opacity = '';
      if(innerWidth > 833){                                  // collapse the tall scrub so the page continues cleanly
        heroScrub.style.minHeight = '100vh';
        heroScrub.style.height = '100vh';
        window.scrollTo(0, heroScrub.offsetHeight);           // featured section at viewport top
      }else{
        window.scrollTo(0, hLockY);
      }
      heroVid.classList.add('is-closing');                   // fade + slight scale-down → reveals the page smoothly
      setTimeout(function(){
        heroVid.classList.remove('is-open', 'is-playing', 'is-closing');
        heroVid.style.transform = '';
        heroVid.style.borderRadius = '';
        try{ heroVideo.controls = false; heroVideo.loop = true; heroVideo.currentTime = 0; heroVideo.load(); }catch(e){}
        if(heroVidHome) heroVidHome.insertBefore(heroVid, heroVidNext);   // put it back in the hero
      }, 480);
    };

    if(heroPlay) heroPlay.addEventListener('click', function(e){ e.preventDefault(); heroOpen(); });
    if(heroX) heroX.addEventListener('click', function(e){ e.preventDefault(); heroClose(); });
    if(heroVideo) heroVideo.addEventListener('ended', heroClose);   // auto-close when the video finishes
    addEventListener('keydown', function(e){ if(e.key === 'Escape' && hState === 'open') heroClose(); });

    var hTick = false;
    var onHeroScroll = function(){ if(!hTick){ hTick = true; requestAnimationFrame(function(){ hScrub(); hTick = false; }); } };
    if(heroScrubOn()){ addEventListener('scroll', onHeroScroll, {passive:true}); hScrub(); }
    addEventListener('resize', function(){ if(hState === 'idle' && heroScrubOn()) hScrub(); });
  }

  /* ---- courses carousel: cele mai accesate cursuri din ultimele 7 zile ---- */
  var carTrack = document.getElementById('carTrack');
  var carView = carTrack && carTrack.parentElement;
  if(carTrack && carView && hasDB){
    carTrack.innerHTML = new Array(5).join('<div class="ccard skeleton sk-card" aria-hidden="true"></div>');
    DB.popularCourses(6).then(function(cs){
      if(!cs.length) throw new Error('no courses');
      carTrack.innerHTML = cs.map(function(c){ return courseCardHTML(c, 'front_page'); }).join('');
      tiltify(carTrack);
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

    /* accesibil din tastatură: focusabil + săgeți; drift-ul se oprește cât e focusat sau sub cursor */
    var carFocus = false, carHover = false;
    carView.setAttribute('tabindex', '0');
    carView.setAttribute('role', 'region');
    carView.setAttribute('aria-label', 'Cursuri populare — navighează cu săgețile stânga și dreapta');
    carView.addEventListener('focus', function(){ carFocus = true; });
    carView.addEventListener('blur', function(){ carFocus = false; });
    carView.addEventListener('mouseenter', function(){ carHover = true; });
    carView.addEventListener('mouseleave', function(){ carHover = false; });

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
        carPos -= ((carFocus || carHover) ? 0 : carAuto) * dt;
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

  /* ---- card de curs (markup identic cu cel static) ---- */
  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
  var courseCardHTML = function(c, src){
    var rate = c.rating != null
      ? '<span class="cc-rate">' + STAR_SVG + DB.fmtRating(c.rating) + ' <em>(' + DB.esc(c.rating_count) + ')</em></span>'
      : '<span class="cc-rate cc-new">Nou</span>';
    return '<a class="ccard" href="curs.html?id=' + c.id + (src ? '&src=' + src : '') + '"' +
      ' data-cat="' + DB.esc(c.category) + '"' +
      ' data-price="' + (Number(c.price) || 0) + '" data-rating="' + (c.rating == null ? -1 : Number(c.rating)) + '"' +
      ' data-pop="' + (Number(c.rating_count) || 0) + '" data-created="' + DB.esc(c.created_at || '') + '"' +
      ' data-search="' + DB.esc((c.title + ' ' + c.instructor_name + ' ' + (DB.CATS[c.category] || '')).toLowerCase()) + '">' +
      '<div class="cc-thumb ' + DB.esc(c.thumb_style) + '"><span class="cc-tag">' + DB.esc(DB.CAT_SHORT[c.category] || '') + '</span>' +
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
        var q = (search && search.value || '').trim().toLowerCase();
        var shown = 0;
        cards.forEach(function(c){
          var okCat = (cat==='all') || (c.dataset.cat===cat);
          var okQ = !q || c.dataset.search.indexOf(q) > -1;
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
      var h = (location.hash || '').replace('#','');
      if(h){
        var match = document.querySelector('.chip[data-filter="'+h+'"]');
        if(match) match.click();
      }
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
    Promise.all([DB.publishedCourses(), statsVisible]).then(function(r){
      var cs = r[0];
      countUp(statCoursesEl, cs.length);
      var instr = {};
      cs.forEach(function(c){ if(c.instructor_name) instr[c.instructor_name] = 1; });
      var si = document.getElementById('statInstructors');
      if(si) countUp(si, Object.keys(instr).length);
    }).catch(function(){});
  }

  /* ---- pagina instructori: carduri din DB, cu statistici reale; click → catalog filtrat ---- */
  var instGrid = document.getElementById('instGrid');
  if(instGrid && hasDB){
    instGrid.innerHTML = new Array(7).join('<div class="inst-card skeleton" style="height:208px" aria-hidden="true"></div>');
    DB.instructorStats().then(function(list){
      if(!list.length){
        instGrid.innerHTML = '<p class="empty" style="display:block;grid-column:1/-1">Încă niciun instructor cu cursuri publicate.</p>';
        return;
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
      instGrid.innerHTML = '<p class="empty" style="display:block;grid-column:1/-1">Nu am putut încărca instructorii. Reîncarcă pagina.</p>';
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
      if(contHead){
        contHead.querySelector('.h1').textContent = 'Salut, ' + (p.name.split(' ')[0] || 'cursant') + '.';
        contHead.querySelector('.lead').textContent = 'Cursurile tale, profilul și — dacă predai — dashboard-ul tău.';
      }
      document.getElementById('hubName').textContent = p.name;
      document.getElementById('hubEmail').textContent = p.email;
      var instr = document.getElementById('hubInstr');
      if(p.is_instructor){
        instr.innerHTML = '<h3>Modul instructor</h3><p>Contul tău de instructor e activ. Vezi vânzările, accesările și cursurile tale.</p>' +
          '<div class="hub-cta"><a class="btn btn-mint" href="dashboard.html">Deschide dashboard-ul</a>' +
          '<a class="btn btn-ghost" href="curs-nou.html">Curs nou</a></div>';
      }else{
        instr.innerHTML = '<h3>Predă pe smarttube</h3><p>Transformă ce știi într-un venit. Activează modul instructor și publică primul tău curs.</p>' +
          '<div class="hub-cta"><button class="btn btn-mint" id="becomeInstr" type="button">Devino instructor</button></div>';
        var b = document.getElementById('becomeInstr');
        b.addEventListener('click', function(){
          b.disabled = true; b.textContent = 'Se activează…';
          DB.becomeInstructor().then(function(){ location.href = 'dashboard.html'; })
            .catch(function(){ b.disabled = false; b.textContent = 'Devino instructor'; });
        });
      }
      var box = document.getElementById('myCourses');
      var emptyBox = document.getElementById('myCoursesEmpty');
      box.innerHTML = new Array(4).join('<div class="ccard skeleton sk-card" aria-hidden="true"></div>');
      DB.myPurchases().then(function(ps){
        var courses = ps.map(function(x){ return x.courses; }).filter(Boolean);
        if(!courses.length){
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
        box.innerHTML = courses.map(function(c){ return courseCardHTML(c, ''); }).join('');
        tiltify(box);
        [].forEach.call(box.children, function(el){ el.classList.add('reveal'); });
        revealify(box);
      }).catch(function(){
        box.innerHTML = '<p class="empty" style="display:block;grid-column:1/-1">Nu am putut încărca cursurile tale. Reîncarcă pagina.</p>';
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
          ' <span style="color:var(--ink-2);font-weight:400">(' + c.rating_count + ' recenzii)</span>';
      }else{
        rateEl.textContent = 'Curs nou pe smarttube';
      }
      var when = new Date(c.created_at);
      var months = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie'];
      document.getElementById('cUpdated').textContent = 'Actualizat ' + months[when.getMonth()] + ' ' + when.getFullYear();

      /* coperta preia gradientul cursului — continuitate cu cardul din catalog */
      document.querySelectorAll('#coursePage .sc-hero').forEach(function(el){
        el.classList.add(/^g[123]$/.test(c.thumb_style) ? c.thumb_style : 'g1');
      });
      var cover = document.getElementById('cCover');
      if(cover){
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

      /* recenzii reale din DB + formular doar pentru cumpărători */
      var rvList = document.getElementById('cReviews');
      var rvEmpty = document.getElementById('cReviewsEmpty');
      var rvForm = document.getElementById('reviewForm');
      var renderReviews = function(){
        DB.getReviews(c.id, 6).then(function(rs){
          if(!rs.length){ rvList.style.display = 'none'; rvEmpty.style.display = 'block'; return; }
          rvEmpty.style.display = 'none'; rvList.style.display = '';
          rvList.innerHTML = rs.map(function(r){
            return '<div class="review"><div class="stars">' + new Array((r.rating || 0) + 1).join('★') + '</div>' +
              (r.comment ? '<p>„' + DB.esc(r.comment) + '"</p>' : '') +
              '<div class="who"><span class="av" aria-hidden="true">' + DB.esc(DB.initials(r.author_name)) + '</span>' +
              '<div><b>' + DB.esc(r.author_name) + '</b><span>Student</span></div></div></div>';
          }).join('');
          tiltify(rvList);
          [].forEach.call(rvList.children, function(el){ el.classList.add('reveal'); });
          revealify(rvList);
        }).catch(function(){});
      };
      renderReviews();
      var reviewFormShown = false;
      var showReviewForm = function(){
        if(reviewFormShown || !rvForm) return;
        reviewFormShown = true;
        rvForm.style.display = '';
        DB.myReview(c.id).then(function(mine){
          if(!mine) return;
          document.getElementById('rvRating').value = String(mine.rating);
          document.getElementById('rvComment').value = mine.comment || '';
          rvForm.querySelector('button[type="submit"]').textContent = 'Actualizează recenzia';
        }).catch(function(){});
      };
      if(rvForm) rvForm.addEventListener('submit', function(e){
        e.preventDefault();
        var rnote = rvForm.querySelector('.form-note');
        var rbtn = rvForm.querySelector('button[type="submit"]');
        rbtn.disabled = true;
        DB.upsertReview(c.id, parseInt(document.getElementById('rvRating').value, 10),
          document.getElementById('rvComment').value.trim())
          .then(function(){
            setNote(rnote, 'Mulțumim! Recenzia ta a fost salvată.', 'ok');
            rbtn.textContent = 'Actualizează recenzia';
            renderReviews();
          }).catch(function(){
            setNote(rnote, 'Nu am putut salva recenzia. Reîncearcă.', 'err');
          }).then(function(){ rbtn.disabled = false; });
      });

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
        showReviewForm();   // cumpărătorii pot lăsa o recenzie
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

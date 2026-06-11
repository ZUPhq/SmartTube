/* ===== smarttube — shared app.js ===== */
(function(){
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- theme (light/dark) toggle ---- */
  var getTheme = function(){
    try{ return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; }catch(e){ return 'dark'; }
  };
  var applyTheme = function(t){
    if(t === 'light') document.documentElement.setAttribute('data-theme','light');
    else document.documentElement.removeAttribute('data-theme');
  };
  applyTheme(getTheme());
  var themeSeg = document.getElementById('themeSeg');
  if(themeSeg){
    var themeBtns = [].slice.call(themeSeg.querySelectorAll('[data-theme-set]'));
    var syncSeg = function(t){
      themeBtns.forEach(function(b){ b.classList.toggle('on', b.dataset.themeSet === t); });
    };
    syncSeg(getTheme());
    themeBtns.forEach(function(b){
      b.addEventListener('click', function(){
        var t = b.dataset.themeSet;
        try{ localStorage.setItem('theme', t); }catch(e){}
        applyTheme(t);
        syncSeg(t);
      });
    });
  }

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
      document.body.style.overflow = (open && innerWidth <= 833) ? 'hidden' : '';
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
      document.body.style.overflow = (mmenu.classList.contains('open') && innerWidth <= 833) ? 'hidden' : '';
    });
  }

  /* ---- scroll reveal ---- */
  var reveals = document.querySelectorAll('.reveal');
  if(reveals.length){
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, {threshold:.14, rootMargin:'0px 0px -8% 0px'});
    reveals.forEach(function(el){ io.observe(el); });
  }

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
        if(innerWidth <= 833){ el.style.transform = ''; return; }
        var r = el.getBoundingClientRect();
        var p = (vh - r.top) / (vh*0.9 + r.height);
        p = Math.max(0, Math.min(1, p));
        el.style.transform = 'scale(' + Math.min(1.1, 0.9 + p*0.2).toFixed(3) + ')';
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
      heroVid.classList.add('is-open');
      document.body.appendChild(heroVid);          // escape the sticky stage's stacking context → true fullscreen
      document.body.style.top = -hLockY + 'px';
      document.body.classList.add('hero-locked');
    }

    var heroPlayNow = function(){
      if(hState !== 'open') heroOpen();
      heroVid.classList.add('is-playing');
      try{ heroVideo.controls = true; var pr = heroVideo.play(); if(pr && pr.catch) pr.catch(function(){}); }catch(e){}
    };

    var heroClose = function(){
      if(hState !== 'open') return;
      try{ heroVideo.pause(); heroVideo.controls = false; heroVideo.currentTime = 0; heroVideo.load(); }catch(e){}
      heroVid.classList.remove('is-open', 'is-playing');
      if(heroVidHome) heroVidHome.insertBefore(heroVid, heroVidNext);   // put it back in the hero
      document.body.classList.remove('hero-locked');
      document.body.style.top = '';
      window.scrollTo(0, hLockY);
      hState = 'dismissed';
      if(heroCopy) heroCopy.style.opacity = '';
      heroVid.style.transform = '';
      heroVid.style.borderRadius = '';
      if(innerWidth > 833){                                  // collapse the tall scrub so the page continues cleanly
        heroScrub.style.minHeight = '100vh';
        heroScrub.style.height = '100vh';
        window.scrollTo(0, heroScrub.offsetHeight);
      }
    };

    if(heroPlay) heroPlay.addEventListener('click', function(e){ e.preventDefault(); heroPlayNow(); });
    if(heroX) heroX.addEventListener('click', function(e){ e.preventDefault(); heroClose(); });
    addEventListener('keydown', function(e){ if(e.key === 'Escape' && hState === 'open') heroClose(); });

    var hTick = false;
    var onHeroScroll = function(){ if(!hTick){ hTick = true; requestAnimationFrame(function(){ hScrub(); hTick = false; }); } };
    if(heroScrubOn()){ addEventListener('scroll', onHeroScroll, {passive:true}); hScrub(); }
    addEventListener('resize', function(){ if(hState === 'idle' && heroScrubOn()) hScrub(); });
  }

  /* ---- courses carousel: auto-scroll + manual drag, infinite both ways ---- */
  var carTrack = document.getElementById('carTrack');
  var carView = carTrack && carTrack.parentElement;
  if(carTrack && carView){
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
        carPos -= carAuto * dt;
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
    addEventListener('resize', carFill);
  }

  /* ---- catalog filter ---- */
  var grid = document.getElementById('catalogGrid');
  if(grid){
    var chips = document.querySelectorAll('.chip');
    var cards = [].slice.call(grid.querySelectorAll('.ccard'));
    var search = document.getElementById('catalogSearch');
    var empty = document.getElementById('catalogEmpty');
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
      ch.addEventListener('click', function(){
        chips.forEach(function(x){ x.classList.remove('on'); });
        ch.classList.add('on');
        current = ch.dataset.filter;
        apply(current);
      });
    });
    if(search) search.addEventListener('input', function(){ apply(current); });
    /* preselect via #hash (e.g. cursuri.html#design) */
    var h = (location.hash || '').replace('#','');
    if(h){
      var match = document.querySelector('.chip[data-filter="'+h+'"]');
      if(match) match.click();
    }
  }

  /* ---- accordions (faq + curriculum) ---- */
  document.querySelectorAll('.faq-q').forEach(function(q){
    q.addEventListener('click', function(){
      var item = q.closest('.faq-item');
      var open = item.classList.contains('open');
      var group = item.parentElement;
      group.querySelectorAll('.faq-item').forEach(function(i){ i.classList.remove('open'); });
      if(!open) item.classList.add('open');
    });
  });
  document.querySelectorAll('.mod-head').forEach(function(h){
    h.addEventListener('click', function(){
      h.closest('.module').classList.toggle('open');
    });
  });

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

  /* ---- 3d card tilt (pointer:fine only) ---- */
  if(!matchMedia('(pointer:coarse)').matches){
    document.querySelectorAll('.ccard,.card,.inst-card,.review').forEach(function(card){
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
  }

  /* ---- demo forms: prevent real submit ---- */
  document.querySelectorAll('form[data-demo]').forEach(function(f){
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var note = f.querySelector('.form-note');
      if(note){ note.textContent = 'Mulțumim! Acesta este un demo — formularul nu trimite date reale.'; note.style.color = 'var(--mint)'; }
    });
  });
})();

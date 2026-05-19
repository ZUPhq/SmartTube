/* ===== smarttube — shared app.js ===== */
(function(){
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- nav scroll glass ---- */
  var nav = document.querySelector('.nav');
  if(nav){
    var updateNav = function(){ nav.classList.toggle('scrolled', scrollY > 10); };
    addEventListener('scroll', updateNav, {passive:true});
    updateNav();
  }

  /* ---- mobile nav ---- */
  var burger = document.getElementById('burger');
  var mmenu = document.getElementById('mmenu');
  if(burger && mmenu){
    var setMenu = function(open){
      mmenu.classList.toggle('open', open);
      burger.classList.toggle('on', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', function(){ setMenu(!mmenu.classList.contains('open')); });
    mmenu.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ setMenu(false); });
    });
    addEventListener('resize', function(){ if(innerWidth>833) setMenu(false); });
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

  /* ---- courses carousel ---- */
  var track = document.getElementById('carTrack');
  if(track){
    document.querySelectorAll('[data-car]').forEach(function(b){
      b.addEventListener('click', function(){
        var card = track.querySelector('.ccard');
        var step = card ? card.offsetWidth + 20 : 320;
        track.scrollBy({left: step*parseInt(b.dataset.car,10), behavior:'smooth'});
      });
    });
    var down=false, sx=0, sl=0, moved=false;
    track.addEventListener('pointerdown', function(e){
      down=true; moved=false; sx=e.pageX; sl=track.scrollLeft; track.classList.add('drag');
    });
    track.addEventListener('pointermove', function(e){
      if(!down) return;
      if(Math.abs(e.pageX-sx)>4) moved=true;
      track.scrollLeft = sl - (e.pageX-sx);
    });
    var endDrag = function(){ down=false; track.classList.remove('drag'); };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('pointerleave', endDrag);
    track.addEventListener('click', function(e){ if(moved) e.preventDefault(); }, true);
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

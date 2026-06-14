/* ===== smarttube — protect.js: protecție conținut (descurajare + trasabilitate) =====
   ONESTITATE TEHNICĂ: pe web NU se pot bloca 100% screenshot-urile sau înregistrarea de
   ecran. JS nu poate opri Snipping Tool / captura nativă a OS-ului, iar o cameră de telefon
   îndreptată spre ecran nu poate fi oprită de nimeni. Stratul de aici = DESCURAJARE +
   TRASABILITATE (watermark dinamic cu identitatea userului peste video, log de acces), NU
   prevenire absolută. Protecția reală anti-download (criptare + capturare blocată pe device-uri
   cu DRM hardware) vine din mutarea videourilor pe un host DRM — Faza 2.

   Modul AUTONOM: tot ce ține de protecție stă aici (inclusiv override-ul pe DB.videoUrl și
   CSS-ul injectat) ca să NU intre în conflict cu editări concurente pe db.js / styles.css / app.js. */
(function(){
  'use strict';
  if(typeof window.DB === 'undefined') return;

  var video = document.getElementById('vidPlayer');
  var modal = document.getElementById('vidModal');
  var courseId = new URLSearchParams(location.search).get('id') || null;

  /* ---------- CSS injectat (watermark + descurajare) ---------- */
  var css =
    '.wm-stage{position:relative;display:block;width:100%;border-radius:var(--r-md,14px);overflow:hidden}' +
    '.wm-overlay{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden;' +
      'display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:34px 46px;' +
      'padding:22px;opacity:.2;animation:wmDrift 9s ease-in-out infinite alternate}' +
    '.wm-cell{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;transform:rotate(-22deg);' +
      'text-shadow:0 1px 2px rgba(0,0,0,.65);letter-spacing:.02em}' +
    '.wm-clock{position:absolute;right:10px;top:8px;font-size:11px;font-weight:700;color:#fff;' +
      'background:rgba(0,0,0,.4);padding:2px 7px;border-radius:6px;text-shadow:0 1px 2px rgba(0,0,0,.7)}' +
    '@keyframes wmDrift{from{transform:translate(-9px,-5px)}to{transform:translate(9px,5px)}}' +
    '.wm-stage.wm-blank #vidPlayer{filter:brightness(0)}' +
    '.wm-stage.wm-blank .wm-overlay{opacity:0}' +
    '.wm-stage,#vidPlayer{-webkit-user-select:none;user-select:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* identitatea userului (o luăm o singură dată) */
  var profileP = null;
  var getProfile = function(){
    if(!profileP) profileP = DB.getProfile().catch(function(){ return null; });
    return profileP;
  };

  /* ---------- 0) Strat de date: TTL scurt la URL-uri semnate + log de acces ----------
     Override pe API-ul public DB.videoUrl (definit aici, nu în db.js, ca să evităm conflicte). */
  var SIGN_TTL = 1800; // 30 min; re-semnăm automat dacă expiră în timpul redării (vezi 3)
  var logAccess = function(cId, lId, kind){
    return DB.getUser().then(function(u){
      if(!u) return;
      return DB.sb.from('content_access_log').insert({
        user_id:u.id, course_id:cId || null, lesson_id:lId || null,
        kind:kind || 'video', user_agent:(navigator.userAgent || '').slice(0, 400)
      }).then(function(){}, function(){});
    }).catch(function(){});
  };
  DB.logAccess = logAccess;
  DB.videoUrl = function(path){
    var cId = (path || '').split('/')[1] || null;   // path = {uid}/{courseId}/{file}
    logAccess(cId, null, 'video');
    return DB.sb.storage.from('course-videos').createSignedUrl(path, SIGN_TTL)
      .then(function(r){ if(r.error) throw r.error; return r.data.signedUrl; });
  };

  /* ---------- 1) Hardening element <video>: fără download / PiP / cast ---------- */
  if(video){
    try{
      video.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
      video.disablePictureInPicture = true;
      video.setAttribute('disableRemotePlayback', '');
    }catch(e){}
    video.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    video.addEventListener('dragstart', function(e){ e.preventDefault(); });
  }

  /* ---------- 2) Watermark dinamic peste video (descurajantul principal) ----------
     Învelim <video> într-un .wm-stage ca să suprapunem overlay-ul exact pe imagine.
     Identitatea (email + id scurt) + un ceas viu apar tiled, deci orice screenshot /
     înregistrare poartă urma celui care a făcut leak-ul. */
  var stage = null, overlay = null;
  if(video && video.parentNode){
    stage = document.createElement('div');
    stage.className = 'wm-stage';
    video.parentNode.insertBefore(stage, video);
    stage.appendChild(video);
    overlay = document.createElement('div');
    overlay.className = 'wm-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    stage.appendChild(overlay);
  }

  var wmText = 'smarttube';
  var pad2 = function(n){ return (n < 10 ? '0' : '') + n; };
  var nowStr = function(){
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  };
  var buildOverlay = function(){
    if(!overlay) return;
    var cells = '';
    for(var i = 0; i < 24; i++) cells += '<span class="wm-cell">' + DB.esc(wmText) + '</span>';
    overlay.innerHTML = cells + '<span class="wm-clock"></span>';
  };
  buildOverlay();
  getProfile().then(function(p){
    wmText = p ? ((p.email || p.name || 'cont') + ' · ' + String(p.id || '').slice(0, 8)) : 'cont neidentificat';
    buildOverlay();
  });
  setInterval(function(){
    if(!modal || !modal.classList.contains('open')) return;   // tick doar cât e deschis playerul
    var c = overlay && overlay.querySelector('.wm-clock');
    if(c) c.textContent = wmText + '  ·  ' + nowStr();
  }, 1000);

  /* ---------- 3) Re-semnare când URL-ul semnat expiră în timpul redării ----------
     Dacă tokenul moare la mijlocul lecției, reîncărcăm de la currentTime cu un URL proaspăt. */
  var SIGN_MARK = '/object/sign/course-videos/';
  var pathFromSrc = function(src){
    var i = (src || '').indexOf(SIGN_MARK);
    if(i === -1) return null;
    try{ return decodeURIComponent(src.slice(i + SIGN_MARK.length).split('?')[0]); }catch(e){ return null; }
  };
  var lastPath = '', tries = 0;
  if(video){
    video.addEventListener('playing', function(){ tries = 0; });
    video.addEventListener('error', function(){
      var path = pathFromSrc(video.currentSrc || video.src);
      if(!path) return;                                  // src gol (modal închis) — ignoră
      if(path !== lastPath){ lastPath = path; tries = 0; }
      if(tries >= 2) return;                             // max 2 re-semnări pe același path
      tries++;
      var at = video.currentTime || 0;
      DB.videoUrl(path).then(function(url){
        var onMeta = function(){
          try{ if(at > 0 && at < (video.duration || Infinity)) video.currentTime = at; }catch(e){}
          var pr = video.play(); if(pr && pr.catch) pr.catch(function(){});
          video.removeEventListener('loadedmetadata', onMeta);
        };
        video.addEventListener('loadedmetadata', onMeta);
        video.src = url; video.load();
      }).catch(function(){});
    });
  }

  /* ---------- 4) Strat de descurajare (FRICTION, nu securitate — ușor de ocolit) ---------- */
  var isOpen = function(){ return !!(modal && modal.classList.contains('open')); };
  var pauseIfOpen = function(){ if(isOpen() && video && !video.paused){ try{ video.pause(); }catch(e){} } };

  /* pauză când fereastra/tab-ul pierde focusul (ex: comutare la un recorder) */
  document.addEventListener('visibilitychange', function(){ if(document.hidden) pauseIfOpen(); });
  addEventListener('blur', pauseIfOpen);

  /* PrintScreen: nu se poate bloca — golim cadrul, avertizăm și logăm tentativa */
  addEventListener('keyup', function(e){
    if(e.key !== 'PrintScreen') return;
    if(stage){ stage.classList.add('wm-blank'); setTimeout(function(){ stage.classList.remove('wm-blank'); }, 1500); }
    pauseIfOpen();
    logAccess(courseId, null, 'attempt');
  });

  /* combinații uzuale salvare / sursă / devtools — descurajare cosmetică */
  addEventListener('keydown', function(e){
    var k = (e.key || '').toLowerCase();
    if((e.ctrlKey && !e.shiftKey && (k === 's' || k === 'u')) ||
       (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
       k === 'f12'){ e.preventDefault(); }
  });
})();

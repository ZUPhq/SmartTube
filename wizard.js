/* ===== smarttube — wizard.js: publicare curs în 4 pași ===== */
(function(){
  'use strict';
  var view = document.getElementById('wizView');
  if(!view || typeof window.DB === 'undefined') return;

  var gate = document.getElementById('wizGate');
  var gateCard = document.getElementById('wizGateCard');
  var editId = new URLSearchParams(location.search).get('id');

  /* ---- acces: doar instructori ---- */
  DB.getProfile().then(function(p){
    if(!p){
      var back = 'curs-nou.html' + (editId ? '?id=' + editId : '');
      location.replace('cont.html?redirect=' + encodeURIComponent(back));
      return;
    }
    if(!p.is_instructor){
      gate.style.display = '';
      gateCard.innerHTML = '<h3 class="h3" style="margin-bottom:10px">Activează modul instructor</h3>' +
        '<p class="gate-sub">Ca să publici cursuri, activează mai întâi modul instructor pe contul tău.</p>' +
        '<button class="btn btn-mint btn-block btn-lg" id="wizActivate" type="button">Devino instructor</button>';
      var b = document.getElementById('wizActivate');
      b.addEventListener('click', function(){
        b.disabled = true; b.textContent = 'Se activează…';
        DB.becomeInstructor().then(function(){ location.reload(); })
          .catch(function(){ b.disabled = false; b.textContent = 'Devino instructor'; });
      });
      return;
    }
    view.style.display = '';
    init(p);
  });

  function init(profile){
    var step = 1;
    var note = document.getElementById('wNote');
    var setNote = function(msg, kind){
      note.classList.remove('err', 'ok');
      if(kind) note.classList.add(kind);
      note.textContent = msg;
    };
    var nextBtn = document.getElementById('wNext');
    var backBtn = document.getElementById('wBack');
    var draftBtn = document.getElementById('wDraft');
    var modBox = document.getElementById('wModules');
    var learnBox = document.getElementById('wLearn');

    var xBtn = '<button type="button" class="wx" aria-label="Șterge">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    var camIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z" stroke-linejoin="round"/></svg>';
    var MAX_VIDEO = 50 * 1024 * 1024;          // limita bucketului (plan gratuit)
    var pendingDeletes = [];                   // videouri de șters din Storage după salvare

    /* ---- curriculum: module + lecții (cu video opțional) ---- */
    var addLesson = function(modEl, title, dur, videoPath){
      var row = document.createElement('div');
      row.className = 'wlesson';
      row.innerHTML = '<input type="text" class="wl-title" maxlength="90" placeholder="Titlul lecției" aria-label="Titlul lecției" />' +
        '<input type="number" class="wl-dur" min="1" max="600" placeholder="min" title="Durata în minute" aria-label="Durata lecției în minute" />' +
        '<button type="button" class="wvid" title="Video pentru lecție (mp4/webm/mov, max 50MB)">' + camIcon + '<span>Video</span></button>' +
        '<button type="button" class="wx wvx" aria-label="Șterge videoul" title="Șterge videoul" style="display:none">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<input type="file" class="wl-file" accept="video/mp4,video/webm,video/quicktime" hidden />' + xBtn;
      row._videoPath = videoPath || null;
      row._videoFile = null;
      row.querySelector('.wl-title').value = title || '';
      row.querySelector('.wl-dur').value = dur || '';
      var vbtn = row.querySelector('.wvid');
      var vlabel = vbtn.querySelector('span');
      var vclear = row.querySelector('.wvx');
      var vfile = row.querySelector('.wl-file');
      var syncVid = function(){
        var has = !!(row._videoFile || row._videoPath);
        vbtn.classList.toggle('on', has);
        vlabel.textContent = row._videoFile
          ? row._videoFile.name
          : (row._videoPath ? 'Video ✓' : 'Video');
        vclear.style.display = has ? '' : 'none';
      };
      vbtn.addEventListener('click', function(){ vfile.click(); });
      vfile.addEventListener('change', function(){
        var f = vfile.files[0];
        if(!f) return;
        if(['video/mp4','video/webm','video/quicktime'].indexOf(f.type) === -1){
          err('Format video neacceptat — folosește mp4, webm sau mov.');
          vfile.value = '';
          return;
        }
        if(f.size > MAX_VIDEO){
          err('Videoul „' + f.name + '" depășește 50MB. Comprimă-l sau taie-l în lecții mai scurte.');
          vfile.value = '';
          return;
        }
        note.textContent = '';
        row._videoFile = f;
        syncVid();
      });
      vclear.addEventListener('click', function(){
        if(row._videoFile){ row._videoFile = null; vfile.value = ''; }
        else if(row._videoPath){ pendingDeletes.push(row._videoPath); row._videoPath = null; }
        syncVid();
      });
      row.querySelector('.wx:not(.wvx)').addEventListener('click', function(){
        if(row._videoPath) pendingDeletes.push(row._videoPath);
        row.remove();
      });
      syncVid();
      modEl.querySelector('.wlessons').appendChild(row);
    };
    var addModule = function(title, lessons){
      var el = document.createElement('div');
      el.className = 'wmod';
      el.innerHTML = '<div class="wmod-head">' +
        '<input type="text" class="wm-title" maxlength="90" placeholder="Titlul modulului (ex: Introducere)" aria-label="Titlul modulului" />' + xBtn +
        '</div><div class="wlessons"></div>' +
        '<button type="button" class="wadd wadd-lesson">+ Adaugă lecție</button>';
      el.querySelector('.wm-title').value = title || '';
      el.querySelector('.wmod-head .wx').addEventListener('click', function(){
        [].slice.call(el.querySelectorAll('.wlesson')).forEach(function(r){
          if(r._videoPath) pendingDeletes.push(r._videoPath);
        });
        el.remove();
      });
      el.querySelector('.wadd-lesson').addEventListener('click', function(){ addLesson(el); });
      modBox.appendChild(el);
      (lessons && lessons.length ? lessons : [{}]).forEach(function(l){
        addLesson(el, l.title, l.duration_min, l.video_path);
      });
      return el;
    };
    document.getElementById('wAddModule').addEventListener('click', function(){ addModule(); });

    /* ---- „ce vei învăța" ---- */
    var addLearn = function(text){
      var row = document.createElement('div');
      row.className = 'wlesson';
      row.innerHTML = '<input type="text" class="wlearn-in" maxlength="120" placeholder="ex: Să configurezi un proiect de la zero" aria-label="Punct la secțiunea Ce vei învăța" />' + xBtn;
      row.querySelector('.wlearn-in').value = text || '';
      row.querySelector('.wx').addEventListener('click', function(){ row.remove(); });
      learnBox.appendChild(row);
    };
    document.getElementById('wAddLearn').addEventListener('click', function(){ addLearn(); });

    /* ---- galerie media: poze + clipuri scurte (carousel pe pagina cursului, ca pe eMAG) ---- */
    var MAX_IMG = 5 * 1024 * 1024;
    var IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    var MAX_GAL = 12;
    var galBox = document.getElementById('wGallery');
    var galAdd = document.getElementById('wAddMedia');
    var galFile = document.getElementById('wMediaFile');
    var galItems = [];        // {t:'img'|'vid', p:<path|null>, file:<File|null>, url:<preview>, _obj:bool}
    var galDeletes = [];      // path-uri de șters din Storage după salvare
    var galRender = function(){
      if(!galBox) return;
      galBox.innerHTML = '';
      galItems.forEach(function(it, idx){
        var cell = document.createElement('div');
        cell.className = 'wgal-item' + (it.t === 'vid' ? ' is-vid' : '');
        cell.draggable = true;
        cell.innerHTML = (it.t === 'vid'
            ? '<video src="' + it.url + '" muted playsinline preload="metadata"></video><span class="wgal-vbadge">' + camIcon + '</span>'
            : '<img src="' + it.url + '" alt="" />') +
          (idx === 0 ? '<span class="wgal-cover">Copertă</span>' : '') +
          '<button type="button" class="wx wgal-x" aria-label="Șterge">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
        cell.querySelector('.wgal-x').addEventListener('click', function(){
          if(it.p) galDeletes.push(it.p);
          if(it._obj){ try{ URL.revokeObjectURL(it.url); }catch(e){} }
          galItems.splice(idx, 1);
          galRender(); markDirty();
        });
        cell.addEventListener('dragstart', function(e){ e.dataTransfer.setData('text/plain', idx); cell.classList.add('drag'); });
        cell.addEventListener('dragend', function(){ cell.classList.remove('drag'); });
        cell.addEventListener('dragover', function(e){ e.preventDefault(); });
        cell.addEventListener('drop', function(e){
          e.preventDefault();
          var from = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if(isNaN(from) || from === idx) return;
          var moved = galItems.splice(from, 1)[0];
          galItems.splice(idx, 0, moved);
          galRender(); markDirty();
        });
        galBox.appendChild(cell);
      });
    };
    var galAddFiles = function(files){
      [].slice.call(files).forEach(function(f){
        if(galItems.length >= MAX_GAL){ err('Galeria poate avea maxim ' + MAX_GAL + ' elemente.'); return; }
        var isImg = IMG_TYPES.indexOf(f.type) !== -1;
        var isVid = ['video/mp4', 'video/webm', 'video/quicktime'].indexOf(f.type) !== -1;
        if(!isImg && !isVid){ err('„' + f.name + '": format neacceptat (poze jpg/png/webp sau video mp4/webm/mov).'); return; }
        if(isImg && f.size > MAX_IMG){ err('Imaginea „' + f.name + '" depășește 5MB.'); return; }
        if(isVid && f.size > MAX_VIDEO){ err('Videoul „' + f.name + '" depășește 50MB.'); return; }
        note.textContent = '';
        galItems.push({t:isImg ? 'img' : 'vid', p:null, file:f, url:URL.createObjectURL(f), _obj:true});
      });
      galRender(); markDirty();
    };
    if(galAdd && galFile){
      galAdd.addEventListener('click', function(){ galFile.click(); });
      galFile.addEventListener('change', function(){ if(galFile.files.length){ galAddFiles(galFile.files); galFile.value = ''; } });
    }

    /* ---- draft local: contra pierderii muncii (doar la curs nou) ---- */
    var DRAFT_KEY = 'wizardDraft';
    var dirty = false;
    var snapshot = function(){
      return JSON.stringify({
        title:document.getElementById('wTitleIn').value,
        subtitle:document.getElementById('wSubtitle').value,
        category:document.getElementById('wCategory').value,
        level:document.getElementById('wLevel').value,
        desc:document.getElementById('wDesc').value,
        price:document.getElementById('wPrice').value,
        learn:readLearn(),
        modules:[].slice.call(modBox.querySelectorAll('.wmod')).map(function(el){
          return {
            title:el.querySelector('.wm-title').value,
            lessons:[].slice.call(el.querySelectorAll('.wlesson')).map(function(r){
              return {title:r.querySelector('.wl-title').value, duration_min:r.querySelector('.wl-dur').value};
            })
          };
        })
      });
    };
    var restoreDraft = function(){
      var raw = null;
      try{ raw = localStorage.getItem(DRAFT_KEY); }catch(e){}
      if(!raw) return false;
      var d;
      try{ d = JSON.parse(raw); }catch(e){ return false; }
      if(!d || (!d.title && !(d.modules || []).length)) return false;
      document.getElementById('wTitleIn').value = d.title || '';
      document.getElementById('wSubtitle').value = d.subtitle || '';
      if(d.category) document.getElementById('wCategory').value = d.category;
      if(d.level) document.getElementById('wLevel').value = d.level;
      document.getElementById('wDesc').value = d.desc || '';
      document.getElementById('wPrice').value = d.price || '';
      (d.learn && d.learn.length ? d.learn : ['', '', '']).forEach(addLearn);
      if(d.modules && d.modules.length){
        d.modules.forEach(function(m){ addModule(m.title, m.lessons || []); });
      }else{
        addModule();
      }
      return true;
    };
    var autoT = null;
    var markDirty = function(){
      dirty = true;
      if(editId) return;
      clearTimeout(autoT);
      autoT = setTimeout(function(){
        try{ localStorage.setItem(DRAFT_KEY, snapshot()); }catch(e){}
      }, 700);
    };
    view.addEventListener('input', markDirty);
    view.addEventListener('change', markDirty);
    addEventListener('beforeunload', function(e){
      if(!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });

    /* ---- precompletare (mod editare) sau schelet gol ---- */
    if(editId){
      document.getElementById('wHeading').textContent = 'Editează cursul';
      document.title = 'Editează cursul — smarttube';
      DB.getCourse(editId).then(function(c){
        if(!c || c.instructor_id !== profile.id){ location.replace('dashboard.html'); return; }
        document.getElementById('wTitleIn').value = c.title;
        document.getElementById('wSubtitle').value = c.subtitle;
        document.getElementById('wCategory').value = c.category;
        document.getElementById('wLevel').value = c.level;
        document.getElementById('wDesc').value = c.description;
        document.getElementById('wPrice').value = Math.round(c.price);
        var thumb = [].slice.call(document.querySelectorAll('input[name="wThumb"]'))
          .filter(function(r){ return r.value === c.thumb_style; })[0];
        if(thumb) thumb.checked = true;
        (c.what_you_learn || []).forEach(addLearn);
        if(!(c.what_you_learn || []).length) addLearn();
        (c.gallery || []).forEach(function(it){
          if(it && it.p) galItems.push({t:it.t === 'vid' ? 'vid' : 'img', p:it.p, file:null, url:DB.mediaUrl(it.p), _obj:false});
        });
        galRender();
        (c.course_modules || []).forEach(function(m){ addModule(m.title, m.lessons || []); });
        if(!(c.course_modules || []).length) addModule();
      }).catch(function(){
        err('Nu am putut încărca datele cursului. Reîncarcă pagina și încearcă din nou.');
      });
    }else if(restoreDraft()){
      setNote('Ți-am restaurat draftul nesalvat din sesiunea anterioară. Videourile trebuie selectate din nou.');
    }else{
      addModule();
      addLearn(); addLearn(); addLearn();
    }

    /* ---- citire & validare ---- */
    var readModules = function(){
      return [].slice.call(modBox.querySelectorAll('.wmod')).map(function(el){
        return {
          title:el.querySelector('.wm-title').value.trim(),
          lessons:[].slice.call(el.querySelectorAll('.wlesson')).map(function(r){
            return {
              title:r.querySelector('.wl-title').value.trim(),
              duration_min:Math.max(1, parseInt(r.querySelector('.wl-dur').value, 10) || 5),
              video_path:r._videoPath || null,
              file:r._videoFile || null
            };
          }).filter(function(l){ return l.title; })
        };
      }).filter(function(m){ return m.title && m.lessons.length; });
    };
    var readLearn = function(){
      return [].slice.call(learnBox.querySelectorAll('.wlearn-in'))
        .map(function(i){ return i.value.trim(); }).filter(Boolean);
    };
    var err = function(msg){ setNote(msg, 'err'); };
    var warnedShort = false;
    var validate = function(s){
      note.textContent = '';
      if(s === 1 && !document.getElementById('wTitleIn').value.trim()){ err('Dă-i cursului un titlu.'); return false; }
      if(s === 2){
        var mods = readModules();
        if(!mods.length){ err('Adaugă cel puțin un modul cu o lecție (cu titlu).'); return false; }
        var noDur = [].slice.call(modBox.querySelectorAll('.wlesson')).some(function(r){
          var t = r.querySelector('.wl-title');
          if(!t) return false;                      // rândurile „ce vei învăța" n-au durată
          var d = parseInt(r.querySelector('.wl-dur').value, 10);
          return t.value.trim() && (isNaN(d) || d < 1);
        });
        if(noDur){ err('Completează durata (în minute) pentru fiecare lecție. Videoul e opțional.'); return false; }
        var total = 0;
        mods.forEach(function(m){ m.lessons.forEach(function(l){ total += l.duration_min; }); });
        if(total < 5 && !warnedShort){
          warnedShort = true;
          err('Curriculum-ul are doar ' + total + ' min în total — cursurile foarte scurte se vând greu. Apasă din nou ca să continui oricum.');
          return false;
        }
      }
      if(s === 3){
        if(!document.getElementById('wDesc').value.trim()){ err('Scrie o descriere scurtă a cursului.'); return false; }
        if(!readLearn().length){ err('Adaugă cel puțin un punct la „Ce vei învăța".'); return false; }
      }
      if(s === 4){
        var pr = parseFloat(document.getElementById('wPrice').value);
        if(isNaN(pr) || pr < 0 || pr > 9999){ err('Setează un preț între 0 (gratuit) și 9999 lei.'); return false; }
      }
      return true;
    };

    /* ---- navigare pași ---- */
    var show = function(s){
      step = s;
      document.querySelectorAll('.wstep').forEach(function(el){
        var n = parseInt(el.dataset.step, 10);
        el.classList.toggle('on', n === s);
        el.classList.toggle('done', n < s);
      });
      document.querySelectorAll('.wpane').forEach(function(el){
        el.classList.toggle('on', parseInt(el.dataset.pane, 10) === s);
      });
      backBtn.style.visibility = s === 1 ? 'hidden' : 'visible';
      draftBtn.style.display = s === 4 ? '' : 'none';
      nextBtn.textContent = s === 4 ? 'Publică acum' : 'Continuă';
      note.textContent = '';
      if(s === 4) recap();
    };
    var recap = function(){
      var mods = readModules();
      var lessons = 0, mins = 0;
      mods.forEach(function(m){ m.lessons.forEach(function(l){ lessons++; mins += l.duration_min; }); });
      var cat = document.getElementById('wCategory');
      document.getElementById('wRecap').innerHTML =
        '<div class="hub-line"><span>Curs</span><b>' + DB.esc(document.getElementById('wTitleIn').value.trim()) + '</b></div>' +
        '<div class="hub-line"><span>Categorie</span><b>' + DB.esc(cat.options[cat.selectedIndex].text) + '</b></div>' +
        '<div class="hub-line"><span>Curriculum</span><b>' + mods.length + ' module · ' + lessons + ' lecții · ' + DB.fmtDur(mins) + '</b></div>' +
        '<div class="hub-line"><span>Instructor</span><b>' + DB.esc(profile.name) + '</b></div>';
    };
    backBtn.addEventListener('click', function(){ if(step > 1) show(step - 1); });
    nextBtn.addEventListener('click', function(){
      if(step < 4){
        if(!validate(step)) return;
        show(step + 1);
        return;
      }
      /* la publicare validăm toți pașii — utilizatorul putea modifica înapoi */
      for(var s = 1; s <= 4; s++){
        if(!validate(s)){
          if(s !== step){ show(s); validate(s); }
          return;
        }
      }
      save('published');
    });
    draftBtn.addEventListener('click', function(){
      if(!validate(1)){ show(1); validate(1); return; }
      if(!validate(4)) return;
      save('draft');
    });

    /* ---- salvare ---- */
    var save = function(status){
      var mods = readModules();
      var mins = 0;
      mods.forEach(function(m){ m.lessons.forEach(function(l){ mins += l.duration_min; }); });
      var thumbEl = document.querySelector('input[name="wThumb"]:checked');
      var fields = {
        title:document.getElementById('wTitleIn').value.trim(),
        subtitle:document.getElementById('wSubtitle').value.trim(),
        description:document.getElementById('wDesc').value.trim(),
        category:document.getElementById('wCategory').value,
        level:document.getElementById('wLevel').value,
        what_you_learn:readLearn(),
        thumb_style:thumbEl ? thumbEl.value : 'g1',
        price:Math.min(9999, Math.max(0, parseFloat(document.getElementById('wPrice').value) || 0)),
        total_minutes:mins,
        status:status
      };
      nextBtn.disabled = true; draftBtn.disabled = true;
      setNote(status === 'published' ? 'Se publică…' : 'Se salvează…');
      var phase = 'save';
      DB.saveCourse(editId, fields).then(function(course){
        /* upload videouri noi, pe rând (au nevoie de id-ul cursului) */
        phase = 'upload';
        var ups = [];
        mods.forEach(function(m){
          m.lessons.forEach(function(l){ if(l.file) ups.push(l); });
        });
        var uploadNext = function(i){
          if(i >= ups.length) return Promise.resolve();
          setNote('Se încarcă videourile… ' + (i + 1) + ' din ' + ups.length);
          var l = ups[i];
          return DB.uploadLessonVideo(course.id, l.file).then(function(path){
            if(l.video_path) pendingDeletes.push(l.video_path);   // video înlocuit
            l.video_path = path;
            l.file = null;
            return uploadNext(i + 1);
          });
        };
        return uploadNext(0).then(function(){
          /* upload media galerie (poze + clipuri), pe rând */
          var pend = galItems.filter(function(it){ return it.file; });
          var galNext = function(i){
            if(i >= pend.length) return Promise.resolve();
            setNote('Se încarcă media galeriei… ' + (i + 1) + ' din ' + pend.length);
            return DB.uploadCourseMedia(course.id, pend[i].file).then(function(path){
              pend[i].p = path; pend[i].file = null;
              return galNext(i + 1);
            });
          };
          return galNext(0);
        }).then(function(){
          /* salvează lista galeriei (în ordinea din UI) pe coloana gallery */
          var gallery = galItems.filter(function(it){ return it.p; }).map(function(it){ return {t:it.t, p:it.p}; });
          return DB.saveCourse(course.id, {gallery:gallery});
        }).then(function(){
          phase = 'curriculum';
          setNote('Se salvează curriculum-ul…');
          return DB.saveCurriculum(course.id, mods);
        });
      }).then(function(){
        pendingDeletes.forEach(function(p){ DB.removeVideo(p); });
        if(galDeletes.length) DB.removeCourseMedia(galDeletes);
        dirty = false;
        try{ localStorage.removeItem(DRAFT_KEY); }catch(e){}
        location.href = 'dashboard.html';
      }).catch(function(e){
        nextBtn.disabled = false; draftBtn.disabled = false;
        var msg = phase === 'upload'
          ? 'Un fișier nu s-a putut încărca (video sau imagine) — verifică-ți conexiunea și apasă din nou. Fișierele deja încărcate nu se reîncarcă.'
          : 'Nu am putut salva cursul. Reîncearcă.';
        err(msg + (e && e.message ? ' (' + e.message + ')' : ''));
      });
    };
  }
})();

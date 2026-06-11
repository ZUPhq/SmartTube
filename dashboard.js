/* ===== smarttube — dashboard.js: dashboard instructor ===== */
(function(){
  'use strict';
  var gate = document.getElementById('dashGate');
  var gateCard = document.getElementById('gateCard');
  var view = document.getElementById('dashView');
  if(!view || typeof window.DB === 'undefined') return;

  var DAY = 24 * 60 * 60 * 1000;

  var showGate = function(html){
    gate.style.display = '';
    view.style.display = 'none';
    gateCard.innerHTML = html;
  };

  DB.getProfile().then(function(p){
    if(!p){
      location.replace('cont.html?redirect=' + encodeURIComponent('dashboard.html'));
      return;
    }
    if(!p.is_instructor){
      showGate('<h3 class="h3" style="margin-bottom:10px">Activează modul instructor</h3>' +
        '<p style="color:var(--ink-2);font-size:15px;margin-bottom:20px">Contul tău e de cursant. Activează modul instructor ca să publici cursuri și să-ți vezi vânzările.</p>' +
        '<button class="btn btn-mint btn-block btn-lg" id="gateActivate" type="button">Devino instructor</button>');
      var b = document.getElementById('gateActivate');
      b.addEventListener('click', function(){
        b.disabled = true; b.textContent = 'Se activează…';
        DB.becomeInstructor().then(function(){ location.reload(); })
          .catch(function(){ b.disabled = false; b.textContent = 'Devino instructor'; });
      });
      return;
    }
    view.style.display = '';
    load();
  });

  function load(){
    DB.myCourses().then(function(courses){
      var ids = courses.map(function(c){ return c.id; });
      Promise.all([DB.courseViews(ids), DB.courseSales(ids)]).then(function(res){
        render(courses, res[0], res[1]);
      });
    });
  }

  function render(courses, views, sales){
    /* stat cards */
    var revenue = sales.reduce(function(s, x){ return s + Number(x.price_paid || 0); }, 0);
    document.getElementById('stRevenue').textContent = DB.fmtMoney(revenue);
    document.getElementById('stSales').textContent = sales.length;
    document.getElementById('stViews').textContent = views.length;
    document.getElementById('stConv').textContent =
      views.length ? (100 * sales.length / views.length).toFixed(1).replace('.', ',') + '%' : '—';

    /* grafic vânzări pe ultimele 30 de zile */
    var chart = document.getElementById('salesChart');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var buckets = [];
    for(var i = 29; i >= 0; i--) buckets.push(0);
    sales.forEach(function(s){
      var d = Math.floor((today - new Date(s.created_at).setHours(0,0,0,0)) / DAY);
      if(d >= 0 && d < 30) buckets[29 - d]++;
    });
    var max = Math.max(1, Math.max.apply(null, buckets));
    chart.innerHTML = buckets.map(function(n, idx){
      var d = new Date(today - (29 - idx) * DAY);
      return '<span style="height:' + Math.round(100 * n / max) + '%" title="' +
        d.getDate() + '.' + (d.getMonth() + 1) + ' — ' + n + (n === 1 ? ' vânzare' : ' vânzări') + '"></span>';
    }).join('');
    var fmtD = function(d){ return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); };
    document.getElementById('chartFrom').textContent = fmtD(new Date(today - 29 * DAY));
    document.getElementById('chartTo').textContent = 'azi';

    /* surse de trafic */
    var srcBox = document.getElementById('srcBars');
    var bySrc = {};
    views.forEach(function(v){ bySrc[v.source] = (bySrc[v.source] || 0) + 1; });
    var order = ['front_page','catalog','search','external','direct'];
    if(!views.length){
      srcBox.innerHTML = '<p style="color:var(--ink-2);font-size:14px;margin-top:16px">Încă nicio vizită. Publică un curs sau distribuie linkul de promovare.</p>';
    }else{
      srcBox.innerHTML = order.map(function(k){
        var n = bySrc[k] || 0;
        var pct = Math.round(100 * n / views.length);
        return '<div class="src-row"><div class="lab"><span>' + DB.SOURCES[k] + '</span><span>' + pct + '% · ' + n + '</span></div>' +
          '<div class="track"><div class="fill" style="width:' + pct + '%"></div></div></div>';
      }).join('');
    }

    /* tabel cursuri */
    var rows = document.getElementById('dashRows');
    var emptyBox = document.getElementById('dashEmpty');
    var wrap = document.getElementById('dashTableWrap');
    if(!courses.length){
      wrap.style.display = 'none';
      emptyBox.style.display = '';
      document.getElementById('promoHint').style.display = 'none';
      return;
    }
    wrap.style.display = '';
    emptyBox.style.display = 'none';
    var vBy = {}, sBy = {}, rBy = {};
    views.forEach(function(v){ vBy[v.course_id] = (vBy[v.course_id] || 0) + 1; });
    sales.forEach(function(s){
      sBy[s.course_id] = (sBy[s.course_id] || 0) + 1;
      rBy[s.course_id] = (rBy[s.course_id] || 0) + Number(s.price_paid || 0);
    });
    rows.innerHTML = courses.map(function(c){
      var pub = c.status === 'published';
      return '<tr>' +
        '<td><b>' + DB.esc(c.title) + '</b><br><span style="color:var(--ink-2);font-size:12.5px">' + DB.esc(DB.CATS[c.category] || '') + '</span></td>' +
        '<td><span class="badge ' + (pub ? 'pub' : 'draft') + '">' + (pub ? 'Publicat' : 'Draft') + '</span></td>' +
        '<td class="num">' + DB.fmtPrice(c.price) + '</td>' +
        '<td class="num">' + (vBy[c.id] || 0) + '</td>' +
        '<td class="num">' + (sBy[c.id] || 0) + '</td>' +
        '<td class="num">' + DB.fmtMoney(rBy[c.id] || 0) + '</td>' +
        '<td><div class="tbl-actions">' +
          '<a class="tbl-btn" href="curs-nou.html?id=' + c.id + '">Editează</a>' +
          (pub ? '<a class="tbl-btn" href="curs.html?id=' + c.id + '">Vezi pagina</a>' : '') +
          '<button class="tbl-btn" data-promo="' + c.id + '" type="button"' + (pub ? '' : ' disabled') + '>Link promovare</button>' +
          '<button class="tbl-btn" data-toggle="' + c.id + '" data-next="' + (pub ? 'draft' : 'published') + '" type="button">' + (pub ? 'Retrage' : 'Publică') + '</button>' +
        '</div></td></tr>';
    }).join('');

    rows.querySelectorAll('[data-promo]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var url = new URL('curs.html?id=' + btn.dataset.promo + '&src=external', location.href).href;
        var done = function(){
          btn.textContent = 'Copiat ✓';
          setTimeout(function(){ btn.textContent = 'Link promovare'; }, 1800);
        };
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(url).then(done, function(){ prompt('Copiază linkul:', url); });
        }else{
          prompt('Copiază linkul:', url);
        }
      });
    });
    rows.querySelectorAll('[data-toggle]').forEach(function(btn){
      btn.addEventListener('click', function(){
        btn.disabled = true;
        DB.setCourseStatus(btn.dataset.toggle, btn.dataset.next).then(function(){ location.reload(); });
      });
    });

    /* date demo: doar când există cursuri publicate dar nicio activitate */
    var genBtn = document.getElementById('genDemo');
    var published = courses.filter(function(c){ return c.status === 'published'; });
    if(published.length && !views.length && !sales.length){
      genBtn.style.display = '';
      genBtn.addEventListener('click', function(){
        genBtn.disabled = true; genBtn.textContent = 'Se generează…';
        var now = Date.now();
        var srcs = ['catalog','catalog','catalog','front_page','front_page','search','search','external','external','direct'];
        var vRows = [], pRows = [];
        published.forEach(function(c){
          var nv = 80 + Math.floor(Math.random() * 160);
          for(var i = 0; i < nv; i++){
            vRows.push({
              course_id:c.id,
              source:srcs[Math.floor(Math.random() * srcs.length)],
              referrer:'demo',
              created_at:new Date(now - Math.random() * 30 * DAY).toISOString()
            });
          }
          var ns = 6 + Math.floor(Math.random() * 12);
          for(var j = 0; j < ns; j++){
            pRows.push({
              user_id:null, course_id:c.id, price_paid:c.price,
              created_at:new Date(now - Math.random() * 30 * DAY).toISOString()
            });
          }
        });
        DB.sb.from('course_views').insert(vRows).then(function(){
          return DB.sb.from('purchases').insert(pRows);
        }).then(function(){ location.reload(); });
      });
    }
  }
})();

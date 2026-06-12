/* ===== smarttube — db.js: client Supabase + strat de date ===== */
var DB = (function(){
  'use strict';
  var SUPABASE_URL = 'https://gacmksubgqnxrxzcayeg.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_svT3My8-ccWNPwMRWM53CQ_uSoclL6H';
  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var CATS = {
    programare:'Programare & IT', design:'Design & UX', business:'Business & Marketing',
    video:'Foto & Video', muzica:'Muzică & Producție', dezvoltare:'Dezvoltare personală'
  };
  var CAT_SHORT = {
    programare:'Programare', design:'Design', business:'Business',
    video:'Foto & Video', muzica:'Muzică', dezvoltare:'Dezvoltare'
  };
  var SOURCES = {
    front_page:'Front page', catalog:'Catalog', search:'Căutare',
    external:'Link extern', direct:'Direct / altele'
  };

  /* ---- format ---- */
  var fmtDur = function(min){
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min/60), m = min%60;
    return h ? h + 'h ' + (m < 10 ? '0' : '') + m + 'm' : m + ' min';
  };
  var fmtPrice = function(p){ return Math.round(p) + ' lei'; };
  var fmtRating = function(r){ return r == null ? null : String(r).replace('.', ','); };
  var fmtMoney = function(p){ return (Math.round(p * 100) / 100).toLocaleString('ro-RO') + ' lei'; };
  var initials = function(name){
    var w = (name || '').trim().split(/\s+/).filter(Boolean);
    if(!w.length) return 'ST';
    return (w[0][0] + (w[1] ? w[1][0] : '')).toUpperCase();
  };
  var esc = function(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  };

  /* ---- sesiune & profil ---- */
  var getUser = function(){
    return sb.auth.getSession().then(function(r){
      return r.data.session ? r.data.session.user : null;
    });
  };
  var getProfile = function(){
    return getUser().then(function(u){
      if(!u) return null;
      return sb.from('profiles').select('*').eq('id', u.id).maybeSingle().then(function(r){
        var p = r.data || {id:u.id, name:'', is_instructor:false};
        if(!p.name) p.name = (u.user_metadata && u.user_metadata.name) || u.email || '';
        p.email = u.email;
        return p;
      });
    });
  };
  var signUp = function(name, email, password){
    return sb.auth.signUp({email:email, password:password, options:{data:{name:name}}});
  };
  var signIn = function(email, password){
    return sb.auth.signInWithPassword({email:email, password:password});
  };
  var signOut = function(){ return sb.auth.signOut(); };
  var becomeInstructor = function(){
    return getUser().then(function(u){
      if(!u) throw new Error('Nu ești autentificat.');
      return sb.from('profiles').update({is_instructor:true}).eq('id', u.id);
    });
  };

  /* ---- catalog ---- */
  var _coursesP = null;
  var publishedCourses = function(){
    if(!_coursesP){
      _coursesP = sb.from('courses').select('*').eq('status','published')
        .order('rating_count', {ascending:false})
        .then(function(r){ return r.data || []; });
    }
    return _coursesP;
  };
  var popularCourses = function(n){
    return sb.rpc('get_popular_courses', {days_back:7, max_n:n || 6})
      .then(function(r){ return r.data || []; });
  };
  var getCourse = function(id){
    return sb.from('courses')
      .select('*, course_modules(id,title,position, lessons(id,title,duration_min,position,video_path))')
      .eq('id', id).maybeSingle()
      .then(function(r){
        var c = r.data;
        if(c && c.course_modules){
          c.course_modules.sort(function(a,b){ return a.position - b.position; });
          c.course_modules.forEach(function(m){
            (m.lessons || []).sort(function(a,b){ return a.position - b.position; });
          });
        }
        return c;
      });
  };

  /* ---- achiziții ---- */
  var myPurchases = function(){
    return getUser().then(function(u){
      if(!u) return [];
      return sb.from('purchases').select('*, courses(*)').eq('user_id', u.id)
        .order('created_at', {ascending:false})
        .then(function(r){ return r.data || []; });
    });
  };
  var hasPurchase = function(courseId){
    return getUser().then(function(u){
      if(!u) return false;
      return sb.from('purchases').select('id').eq('user_id', u.id).eq('course_id', courseId)
        .maybeSingle().then(function(r){ return !!r.data; });
    });
  };
  var buyCourse = function(courseId, price){
    return getUser().then(function(u){
      if(!u) throw new Error('Nu ești autentificat.');
      return sb.from('purchases').insert({user_id:u.id, course_id:courseId, price_paid:price});
    });
  };

  /* ---- tracking accesări ---- */
  var logView = function(courseId, source, referrer){
    getUser().then(function(u){
      sb.from('course_views').insert({
        course_id:courseId, user_id:u ? u.id : null,
        source:source, referrer:(referrer || '').slice(0, 300)
      }).then(function(){});
    }).catch(function(){});
  };

  /* ---- instructor ---- */
  var myCourses = function(){
    return getUser().then(function(u){
      if(!u) return [];
      return sb.from('courses').select('*').eq('instructor_id', u.id)
        .order('created_at', {ascending:false})
        .then(function(r){ return r.data || []; });
    });
  };
  var courseViews = function(courseIds){
    if(!courseIds.length) return Promise.resolve([]);
    return sb.from('course_views').select('course_id,source,created_at')
      .in('course_id', courseIds).then(function(r){ return r.data || []; });
  };
  var courseSales = function(courseIds){
    if(!courseIds.length) return Promise.resolve([]);
    return sb.from('purchases').select('course_id,price_paid,created_at')
      .in('course_id', courseIds).then(function(r){ return r.data || []; });
  };
  var setCourseStatus = function(courseId, status){
    return sb.from('courses').update({status:status}).eq('id', courseId);
  };

  /* ---- wizard: salvare curs (fără curriculum) ---- */
  var saveCourse = function(courseId, fields){
    if(courseId){
      return sb.from('courses').update(fields).eq('id', courseId).select().single()
        .then(function(r){
          if(r.error) throw r.error;
          return r.data;
        });
    }
    return getProfile().then(function(prof){
      fields.instructor_id = prof.id;
      fields.instructor_name = prof.name;
      fields.instructor_initials = initials(prof.name);
      return sb.from('courses').insert(fields).select().single().then(function(r){
        if(r.error) throw r.error;
        return r.data;
      });
    });
  };

  /* ---- wizard: rescrie curriculum-ul (module + lecții) ---- */
  var saveCurriculum = function(courseId, modules){
    return sb.from('course_modules').delete().eq('course_id', courseId).then(function(){
      var rows = modules.map(function(m, i){
        return {course_id:courseId, title:m.title, position:i + 1};
      });
      return sb.from('course_modules').insert(rows).select().then(function(r){
        if(r.error) throw r.error;
        var lrows = [];
        r.data.forEach(function(mrow){
          var m = modules[mrow.position - 1];
          m.lessons.forEach(function(l, j){
            lrows.push({module_id:mrow.id, title:l.title, duration_min:l.duration_min,
              video_path:l.video_path || null, position:j + 1});
          });
        });
        return sb.from('lessons').insert(lrows).then(function(r2){
          if(r2.error) throw r2.error;
        });
      });
    });
  };

  /* ---- videouri lecții (Storage, bucket privat course-videos) ---- */
  var uploadLessonVideo = function(courseId, file){
    return getUser().then(function(u){
      if(!u) throw new Error('Nu ești autentificat.');
      var ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      var path = u.id + '/' + courseId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      return sb.storage.from('course-videos')
        .upload(path, file, {contentType:file.type || 'video/mp4'})
        .then(function(r){
          if(r.error) throw r.error;
          return path;
        });
    });
  };
  var removeVideo = function(path){
    return sb.storage.from('course-videos').remove([path]);
  };
  var videoUrl = function(path){
    return sb.storage.from('course-videos').createSignedUrl(path, 7200)
      .then(function(r){
        if(r.error) throw r.error;
        return r.data.signedUrl;
      });
  };

  /* ---- recenzii (doar cumpărătorii pot scrie; agregarea pe curs o face un trigger) ---- */
  var getReviews = function(courseId, n){
    return sb.from('reviews').select('*').eq('course_id', courseId)
      .order('created_at', {ascending:false}).limit(n || 6)
      .then(function(r){ return r.data || []; });
  };
  var myReview = function(courseId){
    return getUser().then(function(u){
      if(!u) return null;
      return sb.from('reviews').select('*').eq('course_id', courseId).eq('user_id', u.id)
        .maybeSingle().then(function(r){ return r.data; });
    });
  };
  var upsertReview = function(courseId, rating, comment){
    return getProfile().then(function(p){
      if(!p) throw new Error('Nu ești autentificat.');
      return sb.from('reviews').upsert({
        course_id:courseId, user_id:p.id, rating:rating,
        comment:(comment || '').slice(0, 1000) || null,
        author_name:p.name || 'Student'
      }, {onConflict:'course_id,user_id'}).then(function(r){
        if(r.error) throw r.error;
      });
    });
  };

  /* ---- instructori: statistici publice agregate (RPC) ---- */
  var instructorStats = function(){
    return sb.rpc('get_instructor_stats').then(function(r){ return r.data || []; });
  };

  /* ---- contact ---- */
  var sendContact = function(name, email, message){
    return sb.from('contact_messages').insert({name:name, email:email, message:message});
  };

  return {
    sb:sb, CATS:CATS, CAT_SHORT:CAT_SHORT, SOURCES:SOURCES,
    fmtDur:fmtDur, fmtPrice:fmtPrice, fmtRating:fmtRating, fmtMoney:fmtMoney,
    initials:initials, esc:esc,
    getUser:getUser, getProfile:getProfile,
    signUp:signUp, signIn:signIn, signOut:signOut, becomeInstructor:becomeInstructor,
    publishedCourses:publishedCourses, popularCourses:popularCourses, getCourse:getCourse,
    myPurchases:myPurchases, hasPurchase:hasPurchase, buyCourse:buyCourse,
    logView:logView,
    getReviews:getReviews, myReview:myReview, upsertReview:upsertReview,
    instructorStats:instructorStats,
    myCourses:myCourses, courseViews:courseViews, courseSales:courseSales,
    setCourseStatus:setCourseStatus, saveCourse:saveCourse, saveCurriculum:saveCurriculum,
    uploadLessonVideo:uploadLessonVideo, removeVideo:removeVideo, videoUrl:videoUrl,
    sendContact:sendContact
  };
})();

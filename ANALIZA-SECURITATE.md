# Raport de securitate — SmartTube

*Platformă de cursuri online (HTML static + vanilla JS pe Vercel, backend Supabase). Proiect Supabase: `gacmksubgqnxrxzcayeg`. Data evaluării: 2026-06-14.*

> Generat printr-un audit multi-agent: 7 dimensiuni de recon (RLS live, advisors Supabase, storage, plată/authz, funcții/auth, XSS client, headers/secrete) → verificare adversarială per finding → sinteză. 33 findings brute, 26 confirmate, 7 respinse la verificare.

---

## 0. Status remediere (aplicat 2026-06-14)

Tot ce era fezabil din cod + DB live a fost aplicat. Advisorii Supabase: securitate **8→7** WARN, performanță **24→3** (cele 21 de `auth_rls_initplan` rezolvate).

| Finding | Status | Cum |
|---------|--------|-----|
| #3 venituri corupte | ✅ Rezolvat | cele 2 rânduri de 1.000.000 readuse la prețul real (9.999); `total_revenue` 2.000.621 → **20.619** lei |
| #1 (parțial) preț arbitrar | ✅ Rezolvat parțial | `purchases_insert_own` leagă `price_paid = courses.price` + CHECK `0–9999`. *Accesul fără plată reală rămâne Faza 2.* |
| #4 listare bucket public | ✅ Rezolvat | `drop policy media_public_read` (advisor dispărut) |
| #5 profiluri publice | ✅ Rezolvat | `profiles_select_all` → `is_instructor OR auth.uid()=id` |
| #7 profiles fără WITH CHECK | ✅ Rezolvat | adăugat `WITH CHECK (auth.uid()=id)` |
| #11 esc() fără `'` | ✅ Rezolvat | [db.js:35](db.js#L35) escapează acum `'`→`&#39;` |
| #12 sink CSS `url()` | ✅ Rezolvat | [app.js:499](app.js#L499) URL în `url('…')` + `'`→%27 |
| #10 CSP `unsafe-inline` | ✅ Rezolvat | scos din `script-src`; înlocuit cu 2 hash-uri SHA-256 (temă + redirect) |
| #13 SRI lipsă | ✅ Rezolvat | pin `@2.108.1/dist/umd/supabase.js` + `integrity` SHA-384 pe 11 pagini |
| #15 perf RLS + FK | ✅ Rezolvat | `(select auth.uid())` pe 19 politici + index pe `reviews.user_id` |
| #16 COOP/CORP + CSP | ✅ Rezolvat | adăugat COOP/CORP same-origin + `frame-src/worker-src/manifest-src` |
| #17 deps moarte | ✅ Rezolvat | `package.json` golit + `package-lock.json` șters |
| #18 robots `Disallow` | ✅ Rezolvat | scos `Disallow`; **sitemap.xml** are nevoie de domeniul de producție (vezi mai jos) |
| #9 leaked password | ⏳ Manual | toggle în Supabase Dashboard → Auth (vezi §6) |
| #19 auth (MFA/OTP/email) | ⏳ Manual | decizii în Dashboard (vezi §6) |
| #8 insert anon nelimitat | ⏳ Amânat | rate-limiting necesită infra (edge/RPC throttle); inserția publică e by-design |
| #6 video_path expus | ⏳ Faza 2 | defense-in-depth; poarta reală (RLS storage) ține deja |
| #1 (complet) / #14 / #2 | ⏳ Faza 2 / decizie | necesită PSP real (Stripe) / moderare cursuri — vezi §5 |

> RPC-urile `get_popular_courses` și `get_instructor_stats` rămân executabile de `anon` (2 advisori) — **intenționat**: alimentează paginile publice (homepage „populare", `instructori.html`). Sunt pe date deja publice.

---

## 1. Rezumat executiv

SmartTube are o fundație de securitate **mai bună decât media** pentru un proiect MVP: Row Level Security (RLS) este activat pe toate cele 9 tabele, scrierile pe conținut (cursuri, module, lecții) sunt corect izolate per-instructor prin `instructor_id = auth.uid()`, videoclipurile plătite stau într-un bucket **privat** cu acces legat strict de achiziție, toate funcțiile `SECURITY DEFINER` au `search_path` fixat, iar datele utilizatorului sunt escapate consecvent înainte de randare. Nu există secrete scurse în cod sau în istoricul git, iar cheia din client este cea publishable (corectă, protejată de RLS).

Cele mai importante observații **nu sunt breșe exploatabile azi**, ci consecințe ale unei decizii arhitecturale fundamentale: **plata este 100% simulată în client** (fără Stripe, fără webhook, fără Edge Function). Crearea achiziției și „promovarea la instructor" se fac prin scrieri directe din browser. În acest model, „accesul gratuit la cursuri" și „prețul plătit ales de client" sunt în aceeași graniță de încredere cu butonul de cumpărare fals — nu se pierde venit real. Aceleași fluxuri devin însă **critice în ziua integrării unui procesator de plată real** și trebuie reproiectate server-side înainte de acel moment.

Restul findings-urilor sunt de severitate joasă: minimizare de date (profiluri și listare storage citibile public), igienă de configurare (CSP cu `unsafe-inline`, lipsă SRI) și un toggle de auth dezactivat (protecția parolelor compromise). Nu există expunere de email-uri/date de plată și nicio escaladare cross-user.

**Scor de risc global: SCĂZUT** (în starea curentă). Justificare: niciun bypass de autorizare cross-user, nicio scurgere de PII sensibilă, nicio pierdere financiară posibilă (plată simulată). Riscul ar urca la **RIDICAT** în momentul atașării unei plăți reale fără reproiectarea fluxului de achiziție — de aceea acele elemente sunt marcate explicit ca „datorie de securitate Faza 2".

---

## 2. Tabel findings

| # | Severitate | Categorie | Titlu | Locație |
|---|-----------|-----------|-------|---------|
| 1 | Medium | Business Logic | Acces complet la curs fără plată: self-insert de achiziție cu `price_paid` ales de client | `db.js:118-123`; policy `purchases_insert_own` |
| 2 | Medium | Access Control | Auto-promovare instant la instructor + publicare cursuri nemoderate | `db.js:65-70`; policy `profiles_update_own` |
| 3 | Low | Business Logic | `price_paid` controlat de client corupe deja rapoartele de venit ale instructorului | `db.js:118-123`, `db.js:149-153`; `dashboard.js:57` |
| 4 | Low | Sensitive Data Exposure | Bucket public `course-media` permite listarea (enumerarea) tuturor fișierelor | storage policy `media_public_read` |
| 5 | Low | Sensitive Data Exposure | `profiles` citibil public (anon) — enumerarea numelor tuturor conturilor | policy `profiles_select_all` |
| 6 | Low | Sensitive Data Exposure | `video_path` al lecțiilor expus public prin SELECT pe `lessons`, fără achiziție | policy `lessons_select`; `db.js:88` |
| 7 | Low | Access Control | `profiles_update_own` fără `WITH CHECK` (gap latent de hardening) | policy `profiles_update_own` |
| 8 | Low | Business Logic | INSERT anon nelimitat pe `course_views` (manipulare clasament „populare") și `contact_messages` (spam) | policies `views_insert_any`, `contact_insert_any` |
| 9 | Low | Auth | Protecția parolelor compromise (HaveIBeenPwned) dezactivată în Supabase Auth | Supabase Auth config |
| 10 | Low | Security Misconfiguration | CSP `script-src 'unsafe-inline'` — plasă de siguranță XSS dezactivată | `vercel.json:14` |
| 11 | Low | Injection | `esc()` nu escapează apostroful (`'`) — risc latent de attribute-injection | `db.js:35-39` |
| 12 | Low | Injection | URL galerie inserat neescapat în `background-image:url()` (injecție CSS limitată) | `app.js:499` |
| 13 | Low | Security Misconfiguration | Lipsă Subresource Integrity (SRI) pe scriptul Supabase de la jsDelivr | toate paginile HTML |
| 14 | Info | Sensitive Data Exposure | Clipuri promo video în bucket PUBLIC `course-media` (footgun de proces) | bucket `course-media`; `db.js:239-251` |
| 15 | Info | Security Misconfiguration | 21 de politici RLS reevaluează `auth.uid()` per-rând (perf, nu securitate) | politici RLS pe 7 tabele |
| 16 | Info | Security Misconfiguration | Lipsesc COOP/CORP și câteva directive CSP explicite | `vercel.json:6-15` |
| 17 | Info | Security Misconfiguration | Dependențe npm React/Tailwind complet nefolosite | `package.json:2-7` |
| 18 | Info | Sensitive Data Exposure | `robots.txt`/`sitemap.xml` cu domeniu vechi (GitHub Pages) + `Disallow` pe pagini „private" | `robots.txt`, `sitemap.xml` |
| 19 | Info | Security Misconfiguration | Înăspriri de auth neconfirmate/by-design (MFA, OTP expiry, email confirmation OFF) | Supabase Auth config |

---

## 3. Findings detaliate

> **Notă transversală — limitarea fundamentală.** Findings #1, #2 și #3 derivă toate din aceeași decizie de arhitectură: **plata este simulată client-side** și **achiziția + promovarea se scriu direct din browser**. Într-o arhitectură client-only cu plată falsă, clientul controlează inevitabil aceste valori. Nu sunt bug-uri de cod izolate care se „repară" punctual — sunt plafonul de securitate al întregului model, care trebuie reproiectat server-side la trecerea pe plată reală (vezi planul, secțiunea 5).

---

### Grup A — Plată & business logic

#### Finding #1 — Acces complet la curs fără plată: self-insert de achiziție cu `price_paid` ales de client
- **Severitate:** Medium · **Categorie:** Business Logic
- **Locație:** `db.js:118-123` (`buyCourse`); policy `public.purchases` / `purchases_insert_own`

**Descriere.** `buyCourse(courseId, price)` face direct din browser `sb.from('purchases').insert({user_id:u.id, course_id, price_paid:price})`. Politica de INSERT pe `purchases` validează DOAR că `user_id = auth.uid()` — nu verifică `price_paid`, nu există webhook sau confirmare de plată server-side, nu există nicio constrângere că suma corespunde `courses.price`. Coloana `price_paid` are `DEFAULT 0` și e complet controlată de client. Orice user logat poate, prin Console sau curl cu cheia anon publică, să insereze `{user_id: propriul uid, course_id: orice curs publicat, price_paid: 0}` și să primească instant acces complet.

**Dovadă.**
- `db.js:121`: `sb.from('purchases').insert({user_id:u.id, course_id:courseId, price_paid:price})` — `price` e argument 100% controlat de client.
- `WITH CHECK` pe `purchases_insert_own`: `((user_id = auth.uid()) OR (user_id IS NULL AND EXISTS(courses c WHERE c.id=purchases.course_id AND c.instructor_id=auth.uid())))` — **nicio** condiție pe `price_paid`.
- `price_paid`: `numeric NOT NULL DEFAULT 0`. Niciun trigger pe `purchases` (`pg_trigger` gol), niciun CHECK.
- Gate-ul real de acces la video verifică doar **existența** rândului: `videos_read_owner_or_buyer` → `EXISTS(... pu.user_id=auth.uid() AND pu.course_id::text=foldername[2])`, ignoră `price_paid`. La fel `reviews_insert_buyer`.

**Scenariu de atac.** Un user autentificat deschide DevTools și execută `await DB.buyCourse('<orice-course-id>', 0)` (sau un PATCH REST direct). Rândul de achiziție cu `price_paid=0` deblochează imediat URL-urile semnate ale videoclipurilor premium și dreptul de a lăsa recenzie.

**Impact.** În starea curentă: **scăzut-spre-mediu**. Plata fiind simulată, nu se incasează bani — bypass-ul prin REST e funcțional echivalent cu apăsarea butonului fals de „Confirmă plata" (app.js:1356-1372): ambele dau acces gratuit cu zero bani reali. **Devine critic** în momentul integrării unui PSP real, dacă insertul rămâne direct din client.

**Remediere.**
- *Faza 2 (obligatoriu înainte de plăți reale):* mută crearea achiziției pe server (Edge Function / webhook Stripe cu service role) care verifică plata confirmată și setează `price_paid` din prețul real citit server-side, apoi **revocă INSERT pe `purchases`** de la rolurile `anon`/`authenticated`:
  ```sql
  REVOKE INSERT ON public.purchases FROM anon, authenticated;
  -- crearea se face doar din contextul service-role al webhook-ului
  ```
- *Igienă imediată (parțială):* adaugă în `WITH CHECK` o constrângere de sanity (nu rezolvă problema de fond, dar oprește valori absurde):
  ```sql
  ALTER POLICY purchases_insert_own ON public.purchases
  WITH CHECK (
    user_id = auth.uid()
    AND price_paid = (SELECT price FROM public.courses WHERE id = course_id)
  );
  ```

---

#### Finding #2 — Auto-promovare instant la instructor + publicare cursuri nemoderate
- **Severitate:** Medium · **Categorie:** Broken Access Control (mai precis: self-service fără garduri)
- **Locație:** `db.js:65-70` (`becomeInstructor`); policy `public.profiles` / `profiles_update_own`; `wizard.js:394`

**Descriere.** `becomeInstructor()` face `sb.from('profiles').update({is_instructor:true}).eq('id', u.id)`. Politica `profiles_update_own` permite update pe propriul profil fără restricție de coloană, deci orice user își setează singur `is_instructor=true`. Imediat după, satisface condiția de upload din storage și poate publica cursuri direct cu `status='published'` (`wizard.js:394`), fără nicio moderare.

> Aceasta este o funcție **self-service deliberată** (probabil intenționată pentru MVP), nu un bug de mass-assignment: userul își schimbă doar propriul flag, nu obține capabilități de admin/service-role și nu poate modifica flagul altcuiva. Încadrarea corectă este „self-service instructor fără garduri", nu „escaladare cross-user".

**Dovadă.**
- `db.js:68`: `update({is_instructor:true}).eq('id', u.id)`; `profiles_update_own`: `qual=(auth.uid()=id)`, `with_check=NULL`. Rolul `authenticated` are GRANT explicit UPDATE pe coloana `is_instructor`; niciun trigger BEFORE UPDATE.
- Gardul de storage e trivial: `media_upload_own_folder` / `videos_upload_own_folder` cer doar `EXISTS(profiles WHERE id=auth.uid() AND is_instructor)`.
- `wizard.js:394`: `save('published')` publică direct; `courses_select_published_or_own` expune orice `status='published'` tuturor. Buckets: `file_size_limit = 50MB`.

**Scenariu de atac.** Un cont nou (creabil prin signup, posibil cu sesiune instantă dacă email confirmation e OFF) se auto-promovează la instructor și (1) publică cursuri publice nemoderate (spam / înșelătorii / conținut abuziv vizibile altor useri pe homepage și catalog); (2) încarcă fișiere până la 50MB/fișier, putând epuiza cota de 1GB a planului gratuit (DoS economic).

**Impact.** Mediu: conținut public nemoderat + abuz de cotă storage. **Nu** e breach de confidențialitate și **nu** e escaladare cross-user. Notă: doar bucketul `course-media` (promo) e public; videoclipurile abuzive urcate în `course-videos` rămân private (citire gated pe achiziție), deci nu devin automat publice.

**Remediere.** Dacă self-service instructor e intenționat, adaugă garduri:
- **(a) Moderare:** cursurile noi intră într-o stare intermediară (`status='pending_review'`) și devin `published` doar după aprobare; nu lăsa wizard.js să publice direct.
- **(b) Rate limiting** pe upload și pe numărul de cursuri per cont nou; monitorizare cotă storage.
- **(c)** Dacă promovarea trebuie înăsprită ulterior, mută `is_instructor` sub un trigger `BEFORE UPDATE` care păstrează vechea valoare dacă apelantul nu e admin.

---

#### Finding #3 — `price_paid` controlat de client corupe deja rapoartele de venit (date injectate live)
- **Severitate:** Low · **Categorie:** Business Logic
- **Locație:** `db.js:118-123` (`buyCourse`), `db.js:149-153` (`courseSales`); `dashboard.js:57,79,158`; `app.js:1363`

**Descriere.** `price_paid` e ales integral de client. Deși UI-ul trimite `c.price`, un apel REST direct poate trimite orice valoare. Rapoartele de încasări ale instructorului (`courseSales` însumează `price_paid`) sunt astfel corupte. **Abuzul s-a produs deja** pe baza live.

**Dovadă (date reale).** Query pe `purchases`: `max_paid = 1.000.000,00`; `total_revenue = 2.000.621,00` lei pe 11 achiziții. Cursul `c598b473` are 2 rânduri cu `price_paid = 1.000.000` (prețul real al celuilalt curs e 69 lei). Valoarea otrăvită ESTE afișată în dashboard: `dashboard.js:57` (card „Încasări"), `:79` (grafic 30 zile), `:158` (venit pe curs), alimentate de `courseSales` (`db.js:151`).

**Impact.** Corupere reală de integritate a datelor, deja materializată. **Mărginit de RLS:** `WITH CHECK` forțează `user_id=auth.uid()`, iar SELECT limitează vizibilitatea la propriile achiziții sau la instructorul cursului — un atacator NU poate injecta rânduri pentru cursul unui terț fără relație; poate doar (i) să-și umfle propria achiziție (lovind dashboard-ul instructorului acelui curs) sau (ii) să falsifice cifre pe cursuri pe care le deține. Fără bani reali / payout, impactul e strict pe analitica instructorului. Ar deveni high/critical dacă aceste cifre alimentează vreodată un payout.

**Remediere.**
- Derivă `price_paid` server-side din `courses.price` (vezi Finding #1).
- Măsură imediată low-cost — CHECK de sanity + curățarea rândului otrăvit:
  ```sql
  ALTER TABLE public.purchases
    ADD CONSTRAINT purchases_price_paid_sane CHECK (price_paid >= 0 AND price_paid <= 9999);
  DELETE FROM public.purchases WHERE price_paid > 9999;  -- curăță cele 2 rânduri de 1.000.000
  ```
- Investighează și rândurile cu `user_id IS NULL` (achiziții demo/seed) ca să nu polueze statisticile de vânzări.

---

### Grup B — Storage & conținut

#### Finding #4 — Bucket public `course-media` permite listarea (enumerarea) tuturor fișierelor
- **Severitate:** Low · **Categorie:** Sensitive Data Exposure / Broken Access Control
- **Locație:** storage policy `media_public_read` (USING `bucket_id='course-media'`); bucket `course-media` (`public=true`); `db.js:227-256`

**Descriere.** Politica `media_public_read` are USING doar `(bucket_id='course-media')` și se aplică tuturor rolurilor (inclusiv `anon`). Pe un bucket public, accesul la obiecte prin URL public **nu necesită** o politică de SELECT largă — această politică activează în plus operația `list()`, deci oricine cu cheia publishable poate apela `sb.storage.from('course-media').list('')` la rădăcină și enumera toate folderele/fișierele tuturor instructorilor.

**Dovadă.** `pg_policies`: `media_public_read = SELECT`, roles `{public}`, qual `(bucket_id='course-media')`. Advisor nativ Supabase: `0025 public_bucket_allows_listing` — *„Public bucket course-media has 1 broad SELECT policy (media_public_read), allowing clients to list all files."* Căile sunt `{instructor_uid}/{course_id}/{file}` (`db.js:243`).

**Scenariu de atac.** Un vizitator anonim apelează `list('')` → obține UID-urile instructorilor (foldere top-level) → `list('<uid>')` și `list('<uid>/<courseId>')` → recuperează căile exacte. Ocolește RLS pe `courses` (care ascunde rândurile de cursuri draft), enumerând media drafturilor direct din storage.

**Impact.** Scăzut. Conținutul e material promo/coperti (oricum destinat publicării), iar UID-urile și ID-urile de curs sunt deja publice prin tabela `courses`/RPC. Aportul incremental real e doar **enumerarea numelor de fișiere ale cursurilor încă nepublicate** (descoperire de campanii pre-lansare) + confirmarea mapării uid→fișiere. **Videoclipurile plătite NU sunt afectate** (sunt în bucketul privat `course-videos`, corect protejat).

**Remediere.** Elimină politica largă de SELECT — `getPublicUrl` funcționează fără ea pe bucket public, iar aplicația **nu folosește niciodată `.list()`** (galeriile sunt căi explicite în `courses.gallery`), deci eliminarea e non-breaking:
```sql
DROP POLICY media_public_read ON storage.objects;
```
Alternativ, restrânge la owner: `USING (bucket_id='course-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)`.

---

#### Finding #6 — `video_path` al lecțiilor expus public prin SELECT pe `lessons`, fără achiziție
- **Severitate:** Low · **Categorie:** Sensitive Data Exposure (defense-in-depth)
- **Locație:** policy `lessons_select`; `db.js:88` (`getCourse` selectează `video_path`)

**Descriere.** `lessons_select` permite oricui (rol public/anon) să citească rândurile de lecție — inclusiv coloana `video_path` — pentru orice curs `status='published'`. `getCourse()` (`db.js:88`) cere explicit `video_path` în SELECT-ul imbricat, deci paginile de curs primesc căile chiar și pentru vizitatori care nu au cumpărat.

**Dovadă.** `lessons_select`: SELECT, roles `{public}`, qual `EXISTS(... c.status='published' OR c.instructor_id=auth.uid())`. `db.js:88`: `select('*, course_modules(... lessons(...,video_path))')`. `app.js:1036-1038` scrie `video_path` în atributul `data-video` înainte de achiziție. Cale reală: `754464ed.../bd585c54.../1781205560085-c90ax3.mp4`.

**Impact.** **MIC.** Poarta reală e RLS pe storage: cunoașterea căii **NU** permite generarea unui URL semnat fără achiziție (`videos_read_owner_or_buyer` blochează `createSignedUrl` pentru ne-cumpărători). Singurul leak nou e structura/numărul lecțiilor și numele fișierelor — `instructor_id` e oricum deja public prin `courses_select_published_or_own`. Devine relevant doar dacă cineva slăbește vreodată policy-ul de citire pe `course-videos`.

**Remediere (defense-in-depth, nu urgent).** Nu trimite `video_path` la clienții fără drept de vizionare: o coloană derivată `has_video` (boolean) pentru afișaj, iar `video_path` expusă doar după verificarea achiziției (RPC `SECURITY DEFINER` care întoarce calea + URL semnat doar dacă există purchase). Alternativ, policy split pe `lessons` care ascunde `video_path` ne-cumpărătorilor.

---

#### Finding #14 — Clipuri promo video în bucket PUBLIC `course-media` (footgun de proces)
- **Severitate:** Info · **Categorie:** Sensitive Data Exposure
- **Locație:** bucket `course-media` (`allowed_mime_types` include `video/mp4`, `video/webm`, `video/quicktime`); `db.js:239-251`; `wizard.js`

**Descriere.** Bucketul `course-media` e PUBLIC și acceptă explicit tipuri video. Galeria cursului (poze + clipuri promo) ajunge aici, servită prin `getPublicUrl`. Nu există o graniță care să împiedice un instructor să expună din greșeală conținut de valoare ca „galerie".

**Dovadă.** `course-media`: `public=true`, `allowed_mime_types=[image/*..., video/mp4, video/webm, video/quicktime]`, `file_size_limit=52428800` (50MB). `db.js:239` → `getPublicUrl` (`db.js:229`).

**Impact.** Redus prin design (promo-urile sunt menite să fie publice). **Stratul de apărare există și e corect:** conținutul de valoare (lecțiile) NU poate ajunge aici pe fluxul normal — merge în bucketul privat `course-videos` cu URL semnat 2h. Singurul reziduu e disciplina instructorului (footgun de proces), parțial acoperit deja de capul de 50MB + galerie limitată la 12 elemente client-side (`wizard.js`).

**Remediere.** Documentează/forțează că galeria = doar promo public. Opțional: folder dedicat pentru promo + limite de durată. Dacă promo-urile trebuie semi-private, mută-le în bucket privat cu URL semnat (ca la `course-videos`).

---

### Grup C — Funcții & auth

#### Finding #9 — Protecția parolelor compromise (HaveIBeenPwned) dezactivată
- **Severitate:** Low · **Categorie:** Auth
- **Locație:** Supabase Auth config (advisor `auth_leaked_password_protection`)

**Descriere.** Linterul oficial de securitate raportează că „Leaked Password Protection" este dezactivată. Supabase Auth poate refuza parolele apărute în breșe publice (HaveIBeenPwned). Combinat cu signup instant (email confirmation OFF) și politica implicită de parolă (min 6 caractere), userii își pot crea conturi cu parole deja sparte.

**Dovadă.** `get_advisors(security)` → `{"name":"auth_leaked_password_protection","level":"WARN","detail":"Leaked password protection is currently disabled."}`. `db.js:58-59` trimite parola brută direct în `sb.auth.signUp` (verificarea nu se poate face client-side). Lungimea minimă e deja parțial acoperită: `cont.html:54` are `minlength="6"` și Supabase impune min 6 server-side.

**Impact.** Risc de preluare de cont prin credential stuffing. Pe această platformă, takeover-ul expune doar cursurile proprii cumpărate și panoul de instructor (care, prin RLS, permite mutații doar pe cursurile proprietarului). **Email-ul cumpărătorilor NU e expus** (nu e în `profiles`, ci doar în `auth.users`, neexpus). Impact moderat-mic, dar e o apărare gratuită care lipsește.

**Remediere.** Pas manual de un minut (vezi secțiunea 6): activează „Leaked password protection" în Dashboard → Authentication. Opțional ridică minimul la ≥8 și consideră MFA TOTP pentru instructori.

---

#### Finding #19 — Înăspriri de auth neconfirmate / by-design (MFA, OTP expiry, email confirmation OFF)
- **Severitate:** Info · **Categorie:** Security Misconfiguration
- **Locație:** Supabase Auth config (pași manuali dashboard)

**Descriere.** Pe lângă leaked-password protection: email confirmation este OFF (sesiune instant la signup — confirmat live: 2/3 conturi auto-confirmate în ~0.025s, `auth.one_time_tokens` gol), MFA neutilizat (`auth.mfa_factors=0`, `auth.webauthn_credentials=0`), iar OTP expiry / single-session sunt probabil la valorile default (necitibile prin MCP). Codul client suportă de fapt **ambele** moduri de confirmare email (`app.js:934-938`), deci nu e hardcodat pe sesiune instant.

**Impact.** Suprafață de atac ușor mai mare la nivel de cont (conturi cu email-uri neverificate; protecție doar prin parolă). Linterul Supabase NU semnalează niciunul ca problemă de securitate — sunt alegeri de configurare acceptabile la stadiul actual. RLS rămâne stratul real de apărare.

**Remediere.** Acceptă-le explicit pentru lansare SAU, pentru robustețe: reactivează email confirmation, setează OTP expiry ≤1h, MFA opțional pentru instructori. Documentează decizia ca să nu fie uitată la trecerea pe plată reală.

---

### Grup D — Autorizare / RLS (minimizare de date)

#### Finding #5 — `profiles` citibil public (anon) — enumerarea numelor tuturor conturilor
- **Severitate:** Low · **Categorie:** Sensitive Data Exposure
- **Locație:** policy `public.profiles` / `profiles_select_all`

**Descriere.** `profiles_select_all` are `USING (true)` pentru rolul public, deci orice vizitator anonim poate enumera toate rândurile: `id` (uuid), `name`, `is_instructor`. **Email-ul NU este în `profiles`** (e doar în `auth.users`, neexpus), deci expunerea e limitată la nume + flag instructor + uuid.

**Dovadă.** `profiles_select_all`: SELECT, roles `{public}`, qual `true`. Coloane: `id, name, is_instructor, created_at` (email absent, confirmat). În `db.js` nu există nicio citire largă din `profiles` — ambele citiri sunt `.eq('id', u.id)` (`db.js:50,68`), deci restrângerea politicii e fezabilă fără a strica nimic.

**Impact.** Mic. Numele instructorilor sunt oricum publice (denormalizate în `reviews.author_name`, `courses.instructor_name`). Corelarea cu achizițiile e blocată de `purchases_select_own_or_instructor`. **Latent:** politica se va aplica și viitoarelor profiluri de studenți (azi sunt 3 rânduri, toate instructori → expunere materială zero acum).

**Remediere.** Înainte de onboarding de studenți, restrânge SELECT public la instructori:
```sql
ALTER POLICY profiles_select_all ON public.profiles USING (is_instructor);
-- profilul complet rămâne vizibil proprietarului prin alte politici (auth.uid()=id)
```

---

#### Finding #7 — `profiles_update_own` fără `WITH CHECK` (gap latent de hardening)
- **Severitate:** Low · **Categorie:** Broken Access Control
- **Locație:** policy `public.profiles` / `profiles_update_own`

**Descriere.** `profiles_update_own` are `USING (auth.uid() = id)` dar NU are `WITH CHECK`. La UPDATE, în lipsa `WITH CHECK`, Postgres reutilizează `USING` ca verificare a rândului nou — care validează doar `id`, nu valorile coloanelor. Astfel un user își poate seta orice coloană proprie via REST PATCH.

**Dovadă.** `profiles_update_own`: `qual=(auth.uid()=id)`, `with_check=null`. Coloane: `id, name, is_instructor, created_at`.

**Impact.** **Practic neglijabil azi.** Singura coloană cu aparență de privilegiu (`is_instructor`) e oricum oferită deschis prin `becomeInstructor()` (Finding #2). Mai mult, `is_instructor` **nu e folosit în nicio politică RLS de autorizare** — scrierile pe `courses`/`lessons`/`modules` se gatează pe `instructor_id = auth.uid()` (ownership), nu pe flag. Deci flipul flagului nu conferă niciun privilegiu la nivel DB. Gap-ul devine relevant doar dacă în viitor se adaugă coloane cu adevărat privilegiate (`is_admin`, `plan`, `credite`).

**Remediere.** Adaugă `WITH CHECK` pentru consistență:
```sql
ALTER POLICY profiles_update_own ON public.profiles WITH CHECK (auth.uid() = id);
```
Orice viitoare coloană de rol moderat: mut-o sub un trigger `BEFORE UPDATE` care interzice schimbarea ei din client.

---

#### Finding #8 — INSERT anon nelimitat pe `course_views` și `contact_messages`
- **Severitate:** Low · **Categorie:** Business Logic
- **Locație:** policies `views_insert_any`, `contact_insert_any` (ambele INSERT, roles `{anon,authenticated}`, `WITH CHECK=true`)

**Descriere.** Două politici INSERT folosesc `WITH CHECK(true)`, deci orice client anon poate insera rânduri nelimitate fără validare sau rate-limit. Pentru `contact_messages` e prin design (formular public) dar permite flood. Pentru `course_views` permite oricui să fabrice vizualizări pentru orice curs existent, corupând clasamentul `get_popular_courses`.

**Dovadă.** `pg_policies`: `views_insert_any` și `contact_insert_any` cu `with_check="true"`. `db.js:128` (`logView`) și `db.js:309` (`sendContact`) scriu direct din client, fără gate/rate-limit. `course_views` are deja 1286 rânduri pe 8 cursuri. Advisor: 2× `rls_policy_always_true`.

**Scenariu de atac.** `get_popular_courses` (RPC SECURITY DEFINER, `db.js:83`) ordonează cursurile published după `count(course_views.id)`. Inserarea automată de vizualizări false urcă direct un curs în „Cursuri populare acum". ID-urile cursurilor published sunt enumerabile de anon.

**Impact.** Scăzut: nu se scurg date, nu se ocolește plata. Riscurile sunt (1) spam/flood în `contact_messages` (bloat DB pe plan gratuit) și (2) manipularea clasamentului „populare" și a metricilor de vizualizări per curs (`courseViews`, `db.js:146`). *Notă: statisticile de „studenți" ale instructorului numără `purchases`, NU `course_views`, deci NU sunt afectate. FK-ul `course_views_course_id_fkey` blochează UUID-uri inexistente — doar cursuri reale, nu „arbitrare".*

**Remediere.** `course_views`: mută scrierea pe un RPC `SECURITY DEFINER` cu rate-limit / deduplicare per IP+sesiune în loc de INSERT direct (existența cursului e deja impusă de FK — lipsa reală e throttle-ul). `contact_messages`: păstrează dar adaugă rate limiting (edge Vercel sau trigger pe `request.headers`); limita de 2000 caractere există deja.

---

### Grup E — XSS / client

#### Finding #10 — CSP `script-src 'unsafe-inline'` — plasă de siguranță XSS dezactivată
- **Severitate:** Low · **Categorie:** Security Misconfiguration
- **Locație:** `vercel.json:14` (directiva `script-src`)

**Descriere.** `script-src` este `'self' 'unsafe-inline' https://cdn.jsdelivr.net`. Cu `'unsafe-inline'`, orice handler de eveniment inline injectat (`onerror=`, `onload=`...) s-ar executa. În prezent nicio injecție nu ajunge aici (toate câmpurile user-controlled trec prin `DB.esc()`), dar `'unsafe-inline'` elimină stratul de defense-in-depth: dacă apare o regresie de escaping, payload-ul ar rula nestingherit (furt de sesiune Supabase din localStorage).

**Dovadă.** `vercel.json:14`: `"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net"`.

**Impact.** Pierderea apărării în adâncime împotriva XSS. Fără `'unsafe-inline'`, o eventuală injecție de handler inline ar fi neutralizată la nivel de browser.

**Remediere — atenție, NU șterge simplu `'unsafe-inline'`.** Există scripturi inline **legitime** pe toate paginile (theme bootstrap pe fiecare `*.html` ~linia 19; **plus un al doilea, distinct, de redirect auth la `index.html:22`**). Ștergerea simplă ar sparge tema + redirectul pe tot site-ul. Remedierea corectă este **allowlisting prin hash** (nonce nu e fezabil pe static Vercel fără edge middleware):
```
script-src 'self' 'sha256-<hash_bloc_tema>' 'sha256-<hash_bloc_redirect_index>' https://cdn.jsdelivr.net
```
Calculează: `openssl dgst -sha256 -binary <script> | openssl base64`. Necesită **două** hash-uri (blocul de temă repetat + blocul de redirect doar din `index.html`) — aplicat cu un singur hash, redirectul logat s-ar rupe silentios.

---

#### Finding #11 — `esc()` nu escapează apostroful (`'`) — risc latent de attribute-injection
- **Severitate:** Low · **Categorie:** Injection
- **Locație:** `db.js:35-39` (funcția `esc`)

**Descriere.** `esc()` înlocuiește doar `& < > "`. Apostroful `'` nu e escapat. În codul ACTUAL nu e exploatabil — toate atributele HTML construite din date folosesc ghilimele duble (verificat în peste 40 de sink-uri). Este însă o capcană: orice viitor atribut construit cu ghilimele simple ar deveni instant vulnerabil, amplificat de `'unsafe-inline'`.

**Dovadă.** `return String(...).replace(/[&<>"]/g, ...)` — clasa de caractere nu include `'`. Singurul sink unde apostroful ar putea apărea în date reale (watermark cu email/nume la `protect.js:98`) e randat ca **text content** al unui `<span>`, deci inofensiv.

**Impact.** Niciun impact direct azi. Risc de regresie. (Atenuant: datele care ajung în `esc()` sunt în mare parte controlate de instructor pe propriul cont → mai degrabă self-XSS / stored-XSS limitat la propriul conținut.)

**Remediere.** Cost zero, elimină definitiv categoria:
```js
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => (
  {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
)); }
```
Convenție de respectat: orice atribut dinamic se construiește doar cu ghilimele duble.

---

#### Finding #12 — URL galerie inserat neescapat în `background-image:url()` (injecție CSS limitată)
- **Severitate:** Low · **Categorie:** Injection
- **Locație:** `app.js:499` (`courseCardHTML`)

**Descriere.** `cov = DB.coverUrl(c)` → `DB.mediaUrl(gallery[i].p)` → `getPublicUrl(path).data.publicUrl` este inserat **fără** `DB.esc()` direct într-un `style="background-image:url(' + cov + ')"`. Coloana `gallery` (jsonb) e scriibilă direct de instructor prin `courses_update_own` (`with_check = instructor_id = auth.uid()`, fără validare de conținut), deci `.p` e modelabil.

**Dovadă.** `app.js:499`: `(cov ? ' style="background-image:url(' + cov + ')"' : '')` — fără `esc()`. `gallery` e jsonb fără CHECK; `mediaUrl` (`db.js:227-230`) doar concatenează `publicUrl`.

**Mecanism (corecție tehnică).** `getPublicUrl` din `@supabase/storage-js@2` aplică `encodeURI()` pe **tot** URL-ul (nu `encodeURIComponent` pe segmente). `encodeURI` codează `"`→`%22` și spațiul→`%20`, deci **NU există XSS** (evadarea din atributul style cu ghilimele duble e neutralizată). DAR `; : ( ) /` supraviețuiesc, deci e posibilă o **injecție CSS reală** în atributul style (ex. `);background:url(http://evil/x`).

**Impact.** Minor, contained: (1) doar în cardul propriului curs (RLS pe `instructor_id`) → self-defacement; (2) încărcările cross-origin via CSS sunt blocate de CSP `img-src` (doar self + supabase.co) → fără exfiltrare; (3) zero impact asupra altor useri.

**Remediere.** Setează ca proprietate DOM în loc de string HTML, sau validează `.p` la randare:
```js
el.style.backgroundImage = "url('" + encodeURI(cov) + "')";
// sau validează că .p respectă pattern-ul uid/courseId/file
```

---

#### Finding #13 — Lipsă Subresource Integrity (SRI) pe scriptul Supabase de la jsDelivr
- **Severitate:** Low · **Categorie:** Security Misconfiguration / Supply-chain
- **Locație:** toate cele 11 pagini HTML de aplicație, ex. `index.html:195`, `curs.html:128`, `cont.html:124`

**Descriere.** Toate paginile încarcă `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` fără `integrity`/SRI și cu tag flotant `@2` (rezolvă mereu la ultima minoră/patch). Dacă jsDelivr ar servi cod modificat pentru acel tag, scriptul rulează cu acces complet la sesiunea Supabase (tokenuri, profil, achiziții). CSP permite explicit `cdn.jsdelivr.net`, deci nu ar bloca cod malițios de acolo.

**Dovadă.** `index.html:195`: `<script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>` — `grep integrity` = 0 rezultate.

**Impact.** Supply-chain: compromiterea CDN/pachetului ar expune sesiunile tuturor vizitatorilor. Risc real **scăzut** (jsDelivr e reputat, plata e simulată, datele apărate de RLS), dar e un punct unic de încredere nemitigat.

**Remediere (tensiune internă: tagul flotant `@2` face SRI imposibil).** Alege una:
- **Pin exact + SRI:** `@supabase/supabase-js@2.x.y` + `integrity="sha384-..."` + `crossorigin="anonymous"`.
- **Self-host (preferat):** descarcă biblioteca local (vendor), servește din `'self'` și **scoate** `cdn.jsdelivr.net` din `script-src`.

---

### Grup F — Config & secrete

#### Finding #15 — 21 de politici RLS reevaluează `auth.uid()` per-rând (performanță, nu securitate)
- **Severitate:** Info · **Categorie:** Security Misconfiguration (de fapt: performanță)
- **Locație:** politici RLS pe `profiles`, `courses`(×4), `course_modules`(×4), `lessons`(×4), `purchases`(×2), `course_views`(×1), `reviews`(×3)

**Descriere.** Linterul de performanță Supabase (`0003_auth_rls_initplan`) raportează 21 de politici care apelează `auth.uid()` direct în `qual`/`with_check`, forțând reevaluarea per-rând în loc de o dată per query. Politicile mai noi (`content_access_log`, storage) folosesc deja corect `(select auth.uid())`.

> **Reîncadrare:** aceasta este o optimizare de **performanță**, NU o problemă de securitate. `auth.uid()` și `(select auth.uid())` produc rezultat identic — niciun bypass de autorizare, nicio expunere de date. Claimul de „DoS amplificat" este nefondat (`auth.uid()` e o citire ieftină de GUC, sub-milisecunde). Inclus aici doar pentru completitudine și pentru că fixul e trivial.

**Remediere.** Înlocuiește `auth.uid()` cu `(select auth.uid())` în cele 21 de politici (aliniat la stilul deja folosit în `content_access_log`). Task de igienă de performanță, severitate info pentru un raport de securitate.

---

#### Finding #16 — Lipsesc COOP/CORP și câteva directive CSP explicite
- **Severitate:** Info · **Categorie:** Security Misconfiguration
- **Locație:** `vercel.json:6-15`

**Descriere.** Headerele nu includ `Cross-Origin-Opener-Policy` (COOP) și `Cross-Origin-Resource-Policy` (CORP). CSP nu definește explicit `worker-src`, `manifest-src`, `frame-src` (cad pe `default-src 'self'`, ceea ce e corect funcțional — aplicația nu folosește service worker, manifest sau iframe-uri).

**Dovadă.** `vercel.json` nu conține COOP/CORP. Grep confirmă: 0 `new Worker`, 0 `<iframe`, 0 `serviceWorker`, 0 flux OAuth. `requestFullscreen` (`app.js:327`) e nativ pe `<video>`, nu necesită `frame-src`.

**Impact.** Hardening lipsă, nu vulnerabilitate. Fără flux OAuth/popup, absența COOP nu deschide un vector concret.

**Remediere.** Adaugă `Cross-Origin-Opener-Policy: same-origin` și `Cross-Origin-Resource-Policy: same-origin`. Opțional, declară explicit `frame-src 'none'`, `manifest-src 'self'` pentru claritate. **NU adăuga COEP** (ar rupe media cross-origin din Supabase).

---

#### Finding #17 — Dependențe npm React/Tailwind complet nefolosite
- **Severitate:** Info · **Categorie:** Security Misconfiguration (igienă)
- **Locație:** `package.json:2-7`

**Descriere.** `package.json` declară `@tabler/icons-react`, `clsx`, `motion`, `tailwind-merge` — biblioteci React/Tailwind. Proiectul e HTML+vanilla JS fără build, fără React. Niciuna nu e referențiată în cod (singurele hit-uri pe „motion" sunt media queries CSS `prefers-reduced-motion`).

**Dovadă.** `git grep -E 'tabler|tailwind-merge|clsx|framer'` în cod = 0 utilizări. `node_modules` nu e urmărit de git, deci impact runtime zero (pachetele nu ajung în browser).

**Impact.** Confuzie de mentenanță și zgomot în audit/SCA. Niciun impact runtime.

**Remediere.** Șterge cele 4 dependențe din `package.json` (sau elimină `package.json`/`package-lock.json` dacă nu există pas de build), ca să reflecte realitatea: site static fără bundler.

---

#### Finding #18 — `robots.txt`/`sitemap.xml` cu domeniu vechi + `Disallow` pe pagini „private"
- **Severitate:** Info · **Categorie:** Sensitive Data Exposure
- **Locație:** `robots.txt`, `sitemap.xml`

**Descriere.** `robots.txt` și `sitemap.xml` referă baza URL veche `https://zuphq.github.io/SmartTube/...` (proiectul rulează acum pe Vercel), dezvăluind istoricul de gazduire și numele org `zuphq`. `robots.txt` folosește `Disallow: /dashboard.html` și `Disallow: /curs-nou.html` — anti-pattern care evidențiază exact paginile considerate sensibile (robots NU e control de acces).

**Dovadă.** `robots.txt:3-7`: `Disallow: /dashboard.html`, `Disallow: /curs-nou.html`, `Sitemap: https://zuphq.github.io/SmartTube/sitemap.xml`. `sitemap.xml:4-11`: 8 URL-uri `zuphq.github.io`.

**Impact.** Scurgere minoră (nume de pagini + domeniu/org vechi). Fără impact de confidențialitate: paginile sunt SPA shells cu garduri de auth (`dashboard.js:17-33`) și RLS în spate; nume oricum inferabile din nav.

**Remediere.** Actualizează baza URL la domeniul de producție în `robots.txt:7` și `sitemap.xml:4-11`. Scoate liniile `Disallow` (sunt **redundante** — paginile au deja `<meta name="robots" content="noindex">` la `dashboard.html:14`, `curs-nou.html:14`, `404.html:7`).

---

## 4. Ce e făcut corect (a NU se strica la refactor)

**RLS & autorizare**
- RLS **ENABLED** pe toate cele 9 tabele din `public` (verificat live în `pg_class`).
- Scrierile pe `courses`/`course_modules`/`lessons` izolate strict per-instructor (`instructor_id = auth.uid()`, cu lanț join modules→courses pentru lecții). Un user NU poate edita/șterge cursuri străine.
- Conținut draft protejat: `courses_select_published_or_own` + `modules_select` + `lessons_select` expun doar `status='published'` sau cursurile proprii.
- `reviews_insert_buyer`: recenzii permise DOAR cu achiziție dovedită pe acel curs; rating-ul agregat se recalculează server-side prin triggerul `refresh_course_rating` (nefalsificabil din client).
- `purchases_select_own_or_instructor`: vizibilitate limitată corect; **NU există policy DELETE/UPDATE pe `purchases`** → ștergerea/modificarea achizițiilor e blocată complet.
- `contact_messages`: DOAR policy INSERT, fără SELECT → nimeni nu poate citi email-urile/mesajele prin API.
- `content_access_log`: SELECT/INSERT strict per-user; IP setat server-side prin trigger `SECURITY DEFINER set_access_log_ip`, nu din client.
- Constraint `UNIQUE(user_id, course_id)` pe `purchases` previne achizițiile duplicate (clientul tratează 23505 ca „deja deții cursul").

**Storage & conținut**
- Bucket `course-videos` **PRIVAT** (`public=false`); `videos_read_owner_or_buyer` e poarta reală de autorizare, corect scoped pe owner sau cumpărător dovedit. Cunoașterea căii NU permite URL semnat fără achiziție. URL semnat cu TTL 2h.
- Upload restrâns la instructori (`EXISTS profiles.is_instructor`) și în folderul propriu (`foldername[1]=auth.uid()`), cu cap 50MB și mime-types restrânse.
- `protect.js` corect și onest documentat ca **descurajare + trasabilitate** (watermark cu identitate, log de acces, TTL scurt 1800s, max 2 re-semnări/path), NU ca prevenire absolută.

**Funcții & auth**
- Toate cele 5 funcții `SECURITY DEFINER` au `search_path` fixat explicit → clasa de search_path hijacking complet acoperită.
- EXECUTE corect revocat pe funcțiile-trigger (`handle_new_user`, `refresh_course_rating`, `set_access_log_ip` — neapelabile prin PostgREST).
- `handle_new_user` inserează DOAR `id` + `name`; nu atinge `is_instructor` (default false) → fără escaladare la signup, chiar dacă atacatorul controlează `raw_user_meta_data`.
- Autorizarea reală pe operațiile de instructor se face prin RLS per-rând cu `instructor_id = auth.uid()`, NU prin flagul `is_instructor` → flagul auto-acordabil rămâne doar o poartă de UI.

**Client / XSS / config**
- `DB.esc()` aplicat consecvent pe TOATE câmpurile text user-controlled randate prin `innerHTML` (titluri, recenzii, nume, what_you_learn, watermark...). Câmpurile randate fără escaping sunt strict numerice/temporale.
- `level` și valorile de profil (`name`, `email`) randate prin `textContent`, nu `innerHTML`.
- Open-redirect apărat: `safeRedirect()` (`app.js:814-819`) respinge `//`, `:`, `/` la început; redirecturi interne cu `encodeURIComponent`.
- Cheia din `db.js` e publishable/anon (corectă pentru client), protejată de RLS. **Niciun secret comis** — `git log -p --all` curat (zero `service_role`/`sb_secret`/JWT, niciun `.env` vreodată).
- Câmpurile text principale au CHECK de lungime server-side (`reviews.comment ≤1000`, `courses.title ≤120`, `subtitle ≤220`, `description ≤2000`).
- Headere solide: HSTS preload, X-Frame-Options DENY + `frame-ancestors 'none'`, nosniff, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `connect/img/media-src` restrânse la self + Supabase, Permissions-Policy restrictiv.

---

## 5. Plan de remediere prioritizat

### ACUM (bug-uri/igienă exploatabile sau cu efort minim)
1. **Curăță datele otrăvite + CHECK de sanity pe `price_paid`** (Finding #3) — șterge cele 2 rânduri de 1.000.000 lei și adaugă `CHECK (price_paid BETWEEN 0 AND 9999)`. *5 minute, oprește coruperea dashboard-ului.*
2. **Activează Leaked Password Protection** în Supabase Dashboard (Finding #9) — un toggle (vezi §6).
3. **Elimină / restrânge `media_public_read`** (Finding #4) — `DROP POLICY` non-breaking, oprește enumerarea storage.
4. **Adaugă `'` la `esc()`** (Finding #11) — cost zero, închide categoria attribute-injection.
5. **Fixează sink-ul CSS din `app.js:499`** (Finding #12) — setare prin `element.style.backgroundImage`.
6. **Adaugă `WITH CHECK (auth.uid()=id)` pe `profiles_update_own`** (Finding #7) — consistență.

### CURÂND (hardening cu efort mic-mediu)
7. **Garduri pentru self-service instructor** (Finding #2) — stare `pending_review` înainte de publicare + rate-limit pe upload/cursuri per cont + monitorizare cotă storage.
8. **CSP: înlocuiește `'unsafe-inline'` cu hash-uri SHA-256** (Finding #10) — DOUĂ hash-uri (temă + redirect `index.html`), altfel rupi redirectul.
9. **SRI / self-host pentru scriptul Supabase** (Finding #13) — pin exact + `integrity`, sau vendor local.
10. **Restrânge `profiles_select_all` la `is_instructor`** (Finding #5) — **înainte** de onboarding de studenți reali.
11. **Rate-limit pe `course_views` și `contact_messages`** (Finding #8) — RPC cu throttle / edge rate-limit.
12. **Actualizează `robots.txt`/`sitemap.xml`** + scoate `Disallow` redundante (Finding #18).
13. **Headere COOP/CORP** + directive CSP explicite (Finding #16); curăță dependențele npm moarte (Finding #17); pachetează `auth.uid()` în `(select auth.uid())` (Finding #15).

### MAI TÂRZIU — „by design până la plăți reale (Faza 2)"
> Aceste elemente NU sunt bug-uri exploatabile azi (plata e simulată), dar devin **critice** în momentul atașării unui PSP. A se trata ca un checklist obligatoriu de Fază 2.

14. **Reproiectează crearea achiziției server-side** (Finding #1 + #3) — Edge Function / webhook Stripe (service role) care verifică plata confirmată și setează `price_paid` din `courses.price` server-side; apoi `REVOKE INSERT ON purchases FROM anon, authenticated`. **Acesta este plafonul de securitate al întregii monetizări.**
15. **Defense-in-depth pe `video_path`** (Finding #6) — expune calea doar după verificarea achiziției (RPC SECURITY DEFINER) odată ce fluxul de plată e server-side.
16. **Decizii conștiente de auth** (Finding #19) — email confirmation, OTP expiry ≤1h, MFA pentru instructori; documentează ce rămâne OFF intenționat.

---

## 6. Pași manuali în Supabase Dashboard (nu se pot face din cod)

1. **Authentication → Policies/Password → „Leaked password protection"**: activează (verificare HaveIBeenPwned la signup/schimbare parolă). *Rezolvă Finding #9.* Opțional: ridică lungimea minimă a parolei la ≥8.
2. **Authentication → MFA**: (opțional) activează TOTP, recomandat cel puțin pentru conturile de instructor. *Finding #9/#19.*
3. **Authentication → Email / Sessions**: decide conștient asupra:
   - Email confirmation (în prezent OFF → sesiune instant la signup) — reactivează dacă vrei conturi cu email verificat.
   - OTP / recovery expiry — setează ≤1h.
   - Single-session, dacă e dorit.
   *Finding #19 — documentează deciziile ca să nu fie uitate la trecerea pe plată reală.*
4. **(Faza 2) Edge Functions + webhook Stripe**: configurarea procesatorului de plată și a funcției server-side de creare achiziție se face din Dashboard/CLI Supabase + Stripe; este precondiția pentru `REVOKE INSERT ON purchases` (Finding #1).

> **Notă finală — limitarea fundamentală.** SmartTube este, în starea curentă, o arhitectură **client-only cu plată simulată**. Atâta timp cât această premisă ține, „accesul gratuit la cursuri" și „prețul ales de client" NU sunt vulnerabilități care produc pierderi — sunt comportamentul așteptat al unui MVP fără procesator de plată. Findings #1, #2 și #3 trebuie înțelese ca **datorie de securitate planificată**, scadentă exact în ziua în care se atașează banii reali. Restul raportului (minimizare de date, CSP, SRI, toggles de auth) este igienă reală, aplicabilă oricând, fără a aștepta Faza 2.

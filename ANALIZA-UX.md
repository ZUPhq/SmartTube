# Analiză UX — smarttube

> Analiză realizată cu metodologia `ux-analyzer` (euristicile Nielsen, WCAG 2.1 A/AA, pattern-uri e-commerce/e-learning, analiză de fluxuri, responsive). 26 de agenți: câte unul pe fiecare pagină + 4 audituri transversale (accesibilitate, responsive, fluxuri, consistență), cu verificare adversarială a problemelor majore pe codul real. **181 de probleme confirmate**, deduplicate mai jos pe teme.

---

## 0. URGENT — Conținut depășit: „Garanție 14 zile"

Politica reală e **plată unică, acces pe viață, fără rambursare**. Site-ul promite în prezent contrariul în **14+ locuri**:

| Fișier | Locație | Ce scrie |
|---|---|---|
| `index.html:145` | secțiunea „Plată unică. Acces pe viață." | span „Garanție 14 zile" |
| `index.html:187` | footer „Pentru studenți" | link „Garanție 14 zile" |
| `curs.html:130` | side-card | „Plată unică · Acces pe viață · Garanție 14 zile" |
| `curs.html:152` | modal cumpărare | același text |
| `curs.html:188` | footer | link |
| `cursuri.html:115` | footer | link |
| `cont.html:~144` | footer | link |
| `instructori.html:157` | footer | link |
| `curs-nou.html:174` | footer | link |
| `dashboard.html:147` | footer | link |
| `despre.html:91` | „smarttube în cifre" | card statistic „14 zile / garanție" |
| `asistenta.html:81` | card „Plăți & facturare" | „politica de rambursare în 14 zile" |
| `asistenta.html:106-107` | FAQ „Pot primi banii înapoi?" | răspuns: **„Da. Ai la dispoziție 14 zile…"** |
| `asistenta.html:156` | footer | link |

**Fix:** scoate toate mențiunile; în side-card/modal rămâne „Plată unică · Acces pe viață"; în FAQ răspunsul devine explicit: plata e finală, cursul rămâne al tău pe viață; în `despre.html` înlocuiește statistica cu una reală. Footer-ul fiind duplicat în toate cele 9 pagini, modificarea se face peste tot (vezi și §7 — fragmentarea footer-ului).

---

## 1. Critice

1. **Contrast sub WCAG pe tema dark în dashboard** — `--ink-2` (#9aa4b4) pe `--surface-2` (#252b37) ≈ 3.8:1, sub limita AA de 4.5:1. Afectează etichetele stat-cardurilor și header-ul tabelului. Fix: `--ink-2` dark → ~#aab4c3 sau folosește `--ink` pe elementele afectate. (`styles.css:4`, `:895`, `:924`)
2. **Wizard pasul 2 acceptă curriculum fără sens** — validarea cere doar module cu lecții cu titlu; durata e opțională (default 5 min), un curs cu o lecție de 1 minut trece. Fix: titlu + durată ≥1 min per lecție, avertisment sub 5 min total, hint că videoul e opțional. (`wizard.js:165-189`)

---

## 2. Accesibilitate (majore)

- **Modalele nu sunt dialoguri** — `#buyModal` și `#vidModal` sunt div-uri simple: fără `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, fără focus trap și fără întoarcerea focusului la închidere. (`curs.html:146,168`, `app.js:687-694,717`)
- **`outline:none` fără alternativă** — suprimat în 8 locuri (`styles.css:106,184,554,692,956,961,970,1001`). Lipsesc focus indicators pe: chips de filtrare, tab-urile de autentificare, cardurile de curs/instructor, butoanele FAQ, nav. Fix global: `:focus-visible{outline:2px solid var(--mint);outline-offset:2px}` + eliminarea suprimărilor.
- **Label-uri neconectate la inputuri** — niciun formular nu folosește `for`/`id`: login/register (`cont.html:86-96`), wizard (`curs-nou.html:97-145`), contact (`despre.html:151-153`, `asistenta.html:134-136`).
- **Contrast marginal pe tema light** — `--ink-2` light (#6e6e73) pe alb ≈ 4.4:1, la limită pentru text mic (side-note, labels, text carduri instructori). Chips inactive pe dark ≈ 2.8:1 (`styles.css:542-548`).
- **Caruselul nu e navigabil din tastatură** — doar pointer + wheel; lipsesc săgeți/Home/End. (`app.js:312-369`)
- **Butoane doar-SVG fără aria-label** — play-ul de preview (`curs.html:83,126` — e `<span>`, nici măcar buton), butoanele din tabelul dashboard, radio-urile de copertă din wizard.
- **Graficul din dashboard inaccesibil** — tooltip doar pe mousemove; barele nu sunt focusabile. (`dashboard.js:71-90`)
- **Mărunte:** `aria-expanded` lipsă pe burger și pe FAQ items; `aria-live` lipsă pe rezultatele căutării, pe `catalogEmpty`, pe `.form-note`/`.wNote`; `cont.html` nu are `<h1>`; heading-uri vizuale făcute cu `<p class="h1">` în `despre.html`.

---

## 3. Stări de eroare și loading (majore)

- **Pagina de curs poate rămâne blocată pe „Se încarcă…"** — `DB.getCourse()` nu are catch; dacă Supabase pică, utilizatorul nu află niciodată. (`app.js:592`)
- **Caruselul „Cursuri populare" dispare silențios la eroare** — fără skeleton, fără mesaj, fără retry. (`app.js:298-311`)
- **Dashboard cu catch gol** — la eșec, statistici și tabel rămân pur și simplu goale. (`dashboard.js:38-45`)
- **Eroarea de plată e mascată** — codul tratează `23505` (curs deja cumpărat) ca succes fără să spună „Ai deja acest curs", iar orice altă eroare primește un mesaj generic. (`app.js:732-738`)
- **Video modal fără retry** — la eșec schimbă doar titlul; nu există buton de reîncercare. (`app.js:706-729`)
- **Niciun skeleton loader pe site** — catalog, dashboard, „cursurile mele", pagina de curs: toate fac swap direct sau flash de conținut.
- **Formularul de contact fără stare de trimitere** — butonul nu se dezactivează, risc de trimiteri duplicate; validarea se bazează doar pe HTML5 default. (`app.js:748-763`)

---

## 4. Fluxuri utilizator (majore)

- **Redirect-ul după login pierde contextul** — `safeRedirect` (`app.js:503-508`) respinge URL-uri legitime cu query string (`curs.html?id=123`), deci utilizatorul trimis la login din pagina unui curs aterizează pe cont, nu înapoi la curs. Fix: validare same-origin cu `new URL(raw, location.href)` în loc de verificări pe caractere.
- **Modalul de cumpărare nu se resetează** — redeschis după o achiziție, arată starea finală în loc de formular. (`app.js:678-689`)
- **`curs-nou.html` nu are gard de autentificare** — un vizitator nelogat/non-instructor poate completa tot wizardul și eșuează abia la salvare.
- **Nu există flux de resetare a parolei** — „Ai uitat parola?" duce doar la Help Center; Supabase suportă nativ `resetPasswordForEmail`. (`cont.html:90`)
- **Wizard: muncă pierdută ușor** — fără auto-save (draft doar la pasul 4), fără `beforeunload` la navigare/back, fără handling dedicat la eșecul upload-ului video (mesaj generic, nu știi ce să refaci). (`wizard.js`)
- **Dashboard: acțiuni distructive fără plasă** — „Retrage" se execută instant, fără confirmare și fără undo (`dashboard.js:157-162`); „Publică" nu validează că un curs are curriculum/copertă/preț complet.

---

## 5. Responsive (majore)

- **Tap targets sub 44px** — iconițele din nav (~23-34px efectiv) și tab-urile de auth. Fix: `min-width/min-height:44px` pe `.nav-ic-btn`, `.theme-toggle`, padding mai mare pe `.auth-tab` mobil. (`styles.css:100-135,685`)
- **Gol de breakpoint 834-1000px** — footer-ul rămâne pe 5 coloane înghesuite (trece la 2 abia la 600px), grid-urile au gap-uri inegale. Fix: breakpoint intermediar la ~1000px cu 3 coloane.
- **Tabelul dashboard se sparge sub 834px** — `min-width:680px` forțează scroll orizontal fără nicio indicație vizuală (gradient/fade) că există overflow; pe mobil ar merita card-view. (`styles.css:922-938`)
- **Modalele nu blochează scroll-ul pe body** — pe mobil se vede/derulează conținutul de sub modal. (`styles.css:868-873`)
- **Bug la resize cu meniul mobil deschis** — `body.overflow='hidden'` nu se resetează când treci de 833px; pagina rămâne blocată. (`app.js:60-62`)
- **Search-ul pe mobil ascunde linkul de cont** fără vreo tranziție/feedback. (`styles.css:112-117`)

---

## 6. Conversie și conținut (majore)

- **Claim nesusținut: „peste 1.000 de cursuri"** (`cursuri.html:71`) — hardcodat; ajustează la realitate sau calculează din DB. Și fără paginare/lazy-load dacă catalogul chiar crește.
- **Recenziile de pe pagina cursului sunt hardcodate** — aceleași 3 recenzii de 5 stele la orice curs (`curs.html:100-119`). Leagă-le de DB sau arată „Fii primul care evaluează cursul".
- **Statisticile instructorilor sunt hardcodate** (3 cursuri, 640 studenți, 4.9) și **cardurile nu sunt clickabile** — nu poți ajunge la cursurile unui instructor. (`instructori.html:78-107`)
- **Linkuri legale moarte** — Termeni / Confidențialitate / Cookie-uri duc toate generic la `asistenta.html`; paginile nu există. Pentru un site cu conturi și plăți e o problemă de încredere și de conformitate.
- **Catalogul fără căutare inline și fără sortare** — doar 6 chips de categorie; căutarea există doar în nav. (`cursuri.html:73-88`)

---

## 7. Consistență și arhitectura informației

- **Nav + footer duplicate în 9 fișiere** — orice modificare (ex. scoaterea garanției) trebuie făcută de 9 ori; risc permanent de divergență. Merită o soluție de include (JS sau build step).
- **Fără active state în navigație** — nu se vede pe ce pagină ești.
- **Fără breadcrumbs** pe curs.html / cursuri.html.
- **Nomenclatură inconsistentă** — „Asistență" vs „Centru de ajutor".
- **Title-uri inconsistente** — „Curs — smarttube" e static; ar trebui să devină titlul real al cursului după încărcare.
- **Multe stiluri inline** în HTML (curs.html, cont.html etc.) — de migrat în `styles.css`.

---

## 8. Lista completă minor / nice-to-have (pe scurt)

**index:** placeholder search prea lung pe mobil; rezultate search limitate hard la 8; grid-3 sare direct de la 3 la 1 coloană (lipsește pas de 2 pe tabletă); promise section înghesuită; butonul din meniul mobil face wrap urât; video-ul hero fără fallback/mesaj la rețea lentă.

**cursuri:** fără sortare; chips fără `aria-pressed`; iconițe SVG fără `<title>`; fără skeleton la încărcare; mesaj loading fără `role="status"`; minmax(270px) prea mare pe mobil mic; tap targets chips; badge „NOU" pentru cursuri fără rating; preț + durată lipsesc de pe cardurile din catalog (homepage le are).

**curs:** breadcrumbs; loading skeleton; recenzii reale; textul demo mai vizibil; sticky side-card între 834-950px; doar primul modul expandat fără hint; preview-ul video e doar decor (play fals).

**cont:** „Se verifică…" fără spinner/timeout; empty state sărac la „Cursurile mele" (+ recomandări); fără confirmare la logout; mesaje de eroare Supabase netraduse complet; fără indicator de forță a parolei; mesajul de succes la înregistrare prea lung.

**instructori:** avatare fără aria-label; grid fără pasul de 2 coloane; CTA mic pe mobil; search-ul global nu indexează instructorii din DB (doar hardcodați); fără pagină de profil instructor.

**curs-nou:** pași neclickabili pentru navigare înapoi; focus nu se mută la schimbarea pasului; mesaje de validare generice fără `role="alert"`; fără character counter la titlu; recap incomplet la pasul 4 (lipsesc videourile/statusul); fără confirmare la ștergerea videoului; wsteps înghesuiți pe mobil mic; preț fără validare de interval; hint fără limita de 50MB.

**dashboard:** fără loading la generarea datelor demo; `prompt()` ca fallback la copierea linkului (confuz pe mobil); empty state generic pentru instructor nou; date pe grafic fără an; ierarhie vizuală slabă pe stat-carduri; header tabel fără hover.

**despre:** feedback de succes ambiguu la contact; iconițe fără etichete; statistici fără structură semantică; heading order; echipa descrisă ca departamente, fără oameni reali.

**asistenta:** formularul nu spune că e demo; FAQ fără `aria-expanded`/`aria-controls`; cardurile de categorie nu duc nicăieri; căutare în FAQ (nice); o intrare FAQ care să explice clar modelul de plată fără rambursare.

**fluxuri:** dublu-click pe „Confirmă plata" nu e blocat; search-ul nu are debounce; Enter pe search nu face nimic; filtrul din hash nu se reaplică la `hashchange`; cursurile nu se încarcă în search dacă îl deschizi imediat; „cursurile mele" fără loading.

---

## 9. Ce e deja bine

HTML semantic (nav/main/section/aside/footer); dark/light theme consistent pe CSS variables; tipografie fluidă cu `clamp()`; search global inteligent (cu normalizare de diacritice); animații performante (rAF, passive listeners); carusel cu drag + wheel; hero video creativ; design curat și modern; aria-label pe butoanele principale din nav.

---

## 10. Ordine de atac recomandată

1. **Garanția** — scoate toate cele 14+ mențiuni + actualizează FAQ (§0). Cel mai urgent: promite ceva fals.
2. **Cele 2 critice** (§1) + erorile silențioase (§3) — catch + mesaj + retry pe getCourse/carusel/dashboard/plată.
3. **Pachetul de accesibilitate** (§2) — focus-visible global, role="dialog" + focus trap pe modale, label for/id, contrast `--ink-2` pe ambele teme, aria pe carusel/chips/burger/FAQ. Multe sunt fixuri de 1-2 linii.
4. **Fluxurile** (§4) — safeRedirect, resetarea modalului, gardul pe curs-nou, password reset, confirmare la „Retrage".
5. **Responsive** (§5) — tap targets, breakpoint 834-1000px, scroll lock pe modale, bugul de resize.
6. **Conversie** (§6) — recenzii/statistici reale din DB, carduri instructor clickabile, pagini legale, căutare+sortare în catalog.
7. **Datoria structurală** (§7) — nav/footer dintr-o singură sursă, apoi restul listei de la §8.

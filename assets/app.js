/* Strelitzia 공식 사이트 — 화면 그리기 (주소 # 뒤로 페이지를 나눠요)
   배치: 게임 화면처럼 위 구석 HUD + 아래 가운데 핫바 메뉴, 도감은 인벤토리 칸 */
(function () {
  'use strict';
  const { TAGS, TAG_ORDER, pixelIcon, esc, richText, sortNotices, isFresh, formatDate, loadJson } = window.SZ;
  const app = document.getElementById('app');
  const state = { site: null, notices: [], codex: null, downloads: { requirements: {}, files: [] } };
  const GOLD = '#3A9D47'; // 강조색 (진한 초록)

  // ------------------------------------------------------------------ 읽음 표시
  // 공지를 열면 "읽음"으로 이 브라우저에 기억해요 → N 표시와 숫자가 사라져요.
  // (브라우저 저장소를 못 쓰는 환경이면 이번 방문 동안만 기억해요)
  const READ_KEY = 'strelitzia.read.v1';
  let readSet = new Set();
  try { readSet = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { readSet = new Set(); }
  function saveRead() { try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(readSet))); } catch (e) { /* 저장 못 해도 괜찮아요 */ } }
  /** 새 글(7일 안) 인데 아직 안 읽은 글 */
  function isUnread(n) { return isFresh(n) && !readSet.has(n.id); }
  function markRead(n) {
    if (readSet.has(n.id)) return;
    readSet.add(n.id); saveRead(); refreshCounts();
  }
  function markAllRead() {
    state.notices.forEach(function (n) { readSet.add(n.id); });
    saveRead(); refreshCounts();
  }
  /** 위 구석 알림과 핫바 숫자 다시 그리기 */
  function refreshCounts() {
    const n = state.notices.filter(isUnread).length;
    const badge = document.getElementById('newCount');
    badge.textContent = n; badge.hidden = n === 0;
    const alert = document.getElementById('hudAlert');
    alert.classList.toggle('has', n > 0);
    document.getElementById('hudAlertText').textContent = n > 0 ? '새 소식 ' + n + '개' : '새 소식 없음';
    alert.title = n > 0 ? '안 읽은 새 글 ' + n + '개 보기' : '공지·업데이트 보기';
  }
  // 다른 탭에서 읽어도 맞춰요
  window.addEventListener('storage', function (e) {
    if (e.key !== READ_KEY) return;
    try { readSet = new Set(JSON.parse(e.newValue || '[]')); } catch (x) { return; }
    refreshCounts();
  });

  // ------------------------------------------------------------------ 데이터
  async function load() {
    const [site, notices, codex] = await Promise.all([
      loadJson('data/site.json'), loadJson('data/notices.json'), loadJson('data/codex.json')
    ]);
    state.site = site;
    state.notices = sortNotices(notices.notices || []);
    state.codex = codex;
    // 모드 파일 목록 (없거나 못 읽어도 나머지 화면은 그대로 열려요)
    try {
      const dl = await loadJson('data/downloads.json');
      state.downloads = { requirements: dl.requirements || {}, files: (dl.files || []).slice().sort(function (a, b) { return window.SZ.compareVersion(b.version, a.version); }) };
    } catch (e) { /* 아직 파일이 없어요 */ }
    const latest = latestUpdate();
    if (latest) document.getElementById('hudVer').textContent = 'v' + latest.version + ' · 능력 ' + codex.abilities.length + '종';
    refreshCounts();
  }

  /** 버전이 있는 업데이트 중 가장 높은 것 */
  function updates() {
    return state.notices.filter(function (n) { return n.kind === 'update' && n.version; })
      .sort(function (a, b) { return window.SZ.compareVersion(b.version, a.version); });
  }
  function latestUpdate() { return updates()[0]; }
  function ability(id) { return (state.codex.abilities || []).find(function (a) { return a.id === id; }); }
  function weapon(id) { return (state.codex.weapons || []).find(function (w) { return w.id === id; }); }

  function tagChip(t) {
    const m = TAGS[t] || TAGS.NOTICE;
    return '<span class="tag" style="--c:' + m.color + '">' + pixelIcon(m.icon, m.color, 10) + m.label + '</span>';
  }
  function newBadge(n) { return isUnread(n) ? '<span class="new-badge" title="아직 안 읽은 새 글">N</span>' : ''; }
  function orderTags(tags) { return TAG_ORDER.filter(function (t) { return tags.indexOf(t) >= 0; }); }
  function mainTag(n) { return TAGS[n.mainTag] || TAGS.NOTICE; }
  /** 글 종류 아이콘 칸 (분류 색) */
  function tagSlot(n, size) {
    const m = mainTag(n);
    return '<span class="slot" style="border-color:' + m.color + '55">' + pixelIcon(m.icon, m.color, size || 12) + '</span>';
  }
  /** 판 제목 띠 */
  function ptitle(icon, text, right) {
    return '<div class="ptitle"><span>' + pixelIcon(icon, GOLD, 12) + esc(text) + '</span>' + (right || '') + '</div>';
  }
  /** 아이템 칸 (능력·무기) */
  function itemSlot(href, img, name, color, opts) {
    opts = opts || {};
    return '<a class="slot' + (opts.on ? ' on' : '') + '" href="' + href + '" data-tip="' + esc(name) + '" style="--glow:' + esc(color || GOLD) + '"' +
      (opts.on ? ' aria-current="true"' : '') + ' aria-label="' + esc(name) + '"><span class="glow"></span>' +
      '<img src="' + esc(img) + '" alt="" loading="lazy">' + (opts.label ? '<span class="nm">' + esc(name) + '</span>' : '') + '</a>';
  }
  function emptySlots(n) { let s = ''; for (let i = 0; i < n; i++) s += '<span class="slot empty" aria-hidden="true"></span>'; return s; }
  function latestFile() { return state.downloads.files[0]; }
  function fileFor(version) { return state.downloads.files.find(function (f) { return f.version === version; }); }
  function fileSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  function abilityColor(id) { const a = ability(id); return a ? a.color : GOLD; }

  // ------------------------------------------------------------------ 홈 (타이틀 화면)
  function renderHome() {
    const s = state.site;
    const latest = latestUpdate();
    const quests = state.notices.slice(0, 7);
    const ab = state.codex.abilities;
    let html = '<div class="home">';

    // 왼쪽: 소식 기록 (안 읽은 글은 N)
    html += '<aside class="panel quest">' + ptitle('bell', '소식', '<a href="#/news">전체</a>') + '<div class="items">' +
      quests.map(function (n) {
        return '<a class="qrow' + (isUnread(n) ? '' : ' read') + '" href="#/news/' + esc(n.id) + '">' + tagSlot(n, 12) +
          '<span><span class="t">' + (n.pinned ? '<span class="pin-mark">고정</span>' : '') + esc(n.title) + '</span>' +
          '<span class="d">' + (n.version ? esc(n.version) + ' · ' : '') + formatDate(n.date) + '</span></span>' + newBadge(n) + '</a>';
      }).join('') + '</div></aside>';

    // 가운데: 게임 타이틀 화면
    html += '<section class="title-screen">' +
      '<img class="logo" src="' + esc(s.logo) + '" alt="">' +
      '<h1>' + esc(s.name) + '</h1>' +
      '<div class="splash" aria-hidden="true">' + (latest ? 'v' + esc(latest.version) + ' 나왔어요!' : '능력자 모드!') + '</div>' +
      '<div class="ko">' + esc(s.nameKo) + ' · 능력자 모드</div>' +
      '<p class="lead">' + esc(s.tagline) + '</p><p class="sub">' + esc(s.intro) + '</p>' +
      (latestFile()
        ? '<div class="menu"><a class="btn" href="#/download">' + pixelIcon('down', '#FFFFFF', 12) + '모드 받기 v' + esc(latestFile().version) + '</a>' +
          '<div class="row3"><a class="btn ghost" href="#/news">공지</a><a class="btn ghost" href="#/about">모드 정보</a><a class="btn ghost" href="#/codex">도감</a></div></div>'
        : '<div class="menu"><a class="btn" href="#/news">공지·업데이트</a>' +
          '<div class="row2"><a class="btn ghost" href="#/about">모드 정보</a><a class="btn ghost" href="#/codex">도감</a></div></div>') +
      '<div class="meta">마인크래프트 ' + esc(s.minecraft || '26.3') + ' · ' + esc(s.loader || 'Fabric') +
      (latest ? ' · 최근 업데이트 ' + formatDate(latest.date) : '') + '</div></section>';

    // 오른쪽: 최신 업데이트
    if (latest) {
      html += '<aside class="panel latest">' + ptitle('up', '최신 업데이트', newBadge(latest)) + '<div class="pbody">' +
        '<div class="chips">' + orderTags(latest.tags).map(tagChip).join('') + '</div>' +
        '<h2><span class="ver">' + esc(latest.version) + '</span> ' + esc(latest.title) + '</h2>' +
        latestChanges(latest) +
        '<div class="foot2"><span>' + formatDate(latest.date) + '</span><a class="btn small ghost" href="#/news/' + esc(latest.id) + '">자세히</a></div>' +
        '</div></aside>';
    }
    html += '</div>';

    // 아래: 능력 카드 (게임 안 능력 선택 화면 카드와 같은 모양) — 누르면 도감 설명으로
    html += '<section class="panel inv">' + ptitle('star', '능력 ' + ab.length + '종', '<a href="#/codex">도감 전체</a>') +
      '<div class="ab-cards">' + ab.map(function (a) {
        return '<a class="ab-card" style="--c:' + esc(a.color) + '" href="#/codex/ability/' + esc(a.id) + '">' +
          '<b>' + esc(a.name) + '</b><span>' + esc(a.en) + '</span>' +
          '<img src="' + esc(a.image) + '" alt="' + esc(a.name) + ' 대표 그림" loading="lazy"></a>';
      }).join('') + '</div></section>';
    app.innerHTML = html;
  }
  /** 최신 업데이트 판: 바뀐 점이 적으면 바로 앞 버전 것도 이어서 (최대 5줄) */
  function latestChanges(feature) {
    const ups = updates();
    let start = ups.indexOf(feature); if (start < 0) start = 0;
    let left = 5, out = '';
    for (let i = start; i < ups.length && left > 0; i++) {
      const n = ups[i];
      if (i > start) { out += '<li class="prev"><a href="#/news/' + esc(n.id) + '">' + esc(n.version) + ' ' + esc(n.title) + '</a></li>'; left--; }
      n.changes.slice(0, Math.max(0, left)).forEach(function (c) {
        const m = TAGS[c.tag] || TAGS.NOTICE;
        out += '<li' + (i > start ? ' class="old"' : '') + '>' + pixelIcon(m.icon, m.color, 12) + '<span>' + esc(c.text) + '</span></li>';
        left--;
      });
    }
    return '<ul class="changes">' + out + '</ul>';
  }

  // ------------------------------------------------------------------ 공지·업데이트 (기록장)
  const newsFilter = { tab: 'all', tags: new Set(), q: '' };
  function renderNews(id) {
    const n = id ? state.notices.find(function (x) { return x.id === id; }) : null;
    if (n) markRead(n);   // 열면 바로 읽음 (탭 숫자도 줄어든 값으로)
    const unread = state.notices.filter(isUnread).length;
    app.innerHTML = '<div class="page-head"><h1>공지·업데이트</h1><p>모든 버전의 기록을 지우지 않고 보관해요.</p></div>' +
      '<div class="log' + (n ? ' reading' : '') + '">' +
        '<section class="loglist"><div class="tabs" role="tablist">' +
          tabBtn('all', '전체') + tabBtn('notice', '공지') + tabBtn('update', '업데이트') + tabBtn('unread', '안 읽음' + (unread ? '<b>' + unread + '</b>' : '')) +
        '</div><div class="panel"><div class="tools">' +
          '<input class="field" id="q" type="search" placeholder="제목·내용·버전 검색" value="' + esc(newsFilter.q) + '" aria-label="검색">' +
          '<div class="chips" id="tagChips">' + TAG_ORDER.map(function (t) {
            return '<button class="chip" style="--c:' + TAGS[t].color + '" data-tag="' + t + '" aria-pressed="' + newsFilter.tags.has(t) + '">' + TAGS[t].name + '</button>';
          }).join('') + '</div></div><div class="items" id="newsList"></div></div></section>' +
        '<section class="panel logview" id="logview"></section>' +
      '</div>';
    app.querySelectorAll('[role=tab]').forEach(function (b) {
      b.addEventListener('click', function () { newsFilter.tab = b.dataset.tab; renderNews(id); });
    });
    app.querySelector('#q').addEventListener('input', function (e) { newsFilter.q = e.target.value; drawNewsList(id); });
    app.querySelectorAll('#tagChips .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        const t = b.dataset.tag;
        if (newsFilter.tags.has(t)) newsFilter.tags.delete(t); else newsFilter.tags.add(t);
        b.setAttribute('aria-pressed', newsFilter.tags.has(t));
        drawNewsList(id);
      });
    });
    if (n) drawNewsView(n);
    else if (id) drawMissingView();
    else drawIdleView();
    drawNewsList(id);
  }
  function tabBtn(id, label) {
    return '<button role="tab" data-tab="' + id + '" aria-selected="' + (newsFilter.tab === id) + '">' + label + '</button>';
  }
  function drawNewsList(selected) {
    const q = newsFilter.q.trim().toLowerCase();
    const list = state.notices.filter(function (n) {
      if (newsFilter.tab === 'unread') { if (!isUnread(n) && n.id !== selected) return false; }
      else if (newsFilter.tab !== 'all' && n.kind !== newsFilter.tab) return false;
      if (newsFilter.tags.size && !n.tags.some(function (t) { return newsFilter.tags.has(t); })) return false;
      if (q) {
        const hay = [n.title, n.summary, n.body, n.version].concat(n.changes.map(function (c) { return c.text; })).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    const box = document.getElementById('newsList');
    box.innerHTML = list.length ? list.map(function (n) {
      return '<a class="lrow' + (isUnread(n) ? '' : ' read') + '" href="#/news/' + esc(n.id) + '"' + (n.id === selected ? ' aria-current="true"' : '') + '>' +
        tagSlot(n, 12) + '<span><span class="t">' + (n.pinned ? '<span class="pin-mark">고정</span>' : '') + esc(n.title) + '</span>' +
        '<span class="d">' + (n.version ? '<span class="ver">' + esc(n.version) + '</span>' : '') + formatDate(n.date) + '</span></span>' + newBadge(n) + '</a>';
    }).join('') : '<div class="empty">' + (newsFilter.tab === 'unread' ? '안 읽은 새 글이 없어요.' : '조건에 맞는 글이 없어요. 검색어나 분류를 바꿔 보세요.') + '</div>';
  }
  function drawIdleView() {
    const v = document.getElementById('logview');
    const unread = state.notices.filter(isUnread).length;
    const latest = latestUpdate();
    v.innerHTML = ptitle('book', '읽기') + '<div class="idle"><div class="big">' + (unread ? unread : '0') + '</div>' +
      '<p>' + (unread ? '안 읽은 새 글이 ' + unread + '개 있어요. 목록에서 글을 고르면 여기에 열려요.' : '새 글을 모두 읽었어요. 목록에서 지난 기록을 골라 볼 수 있어요.') + '</p>' +
      '<div class="chips" style="justify-content:center">' +
        (latest ? '<a class="btn" href="#/news/' + esc(latest.id) + '">최신 업데이트 ' + esc(latest.version) + ' 보기</a>' : '') +
        '<button class="btn ghost" id="readAll"' + (unread ? '' : ' disabled') + '>모두 읽음으로 표시</button>' +
      '</div></div>';
    v.querySelector('#readAll').addEventListener('click', function () { markAllRead(); renderNews(); });
  }
  function drawMissingView() {
    document.getElementById('logview').innerHTML = ptitle('book', '읽기') +
      '<div class="idle"><p>그 글을 찾을 수 없어요. 지워졌거나 주소가 바뀌었을 수 있어요.</p><a class="btn ghost" href="#/news">목록 처음으로</a></div>';
  }
  function drawNewsView(n) {
    const groups = TAG_ORDER.map(function (t) {
      const items = n.changes.filter(function (c) { return c.tag === t; });
      if (!items.length) return '';
      const m = TAGS[t];
      return '<div class="group" style="--c:' + m.color + '"><h3>' + pixelIcon(m.icon, m.color, 12) + m.name + '</h3><ul>' +
        items.map(function (c) { return '<li>' + esc(c.text) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    // 이전·다음: 업데이트는 버전 순서, 공지는 목록 순서
    const seq = n.kind === 'update' && n.version ? updates() : state.notices;
    const i = seq.indexOf(n);
    const newer = i > 0 ? seq[i - 1] : null, older = i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
    const label = function (x) { return x.version ? x.version + ' ' + x.title : x.title; };
    document.getElementById('logview').innerHTML = ptitle(mainTag(n).icon, n.kind === 'notice' ? '공지' : '업데이트 기록') +
      '<div class="pbody"><a class="back-link" href="#/news">← 목록으로</a>' +
        '<div class="chips">' + orderTags(n.tags).map(tagChip).join('') + '</div>' +
        '<h1>' + (n.version ? '<span class="ver">' + esc(n.version) + '</span> ' : '') + esc(n.title) + '</h1>' +
        '<div class="byline">' + formatDate(n.date) + (n.pinned ? ' · 고정된 공지' : '') + '</div>' +
        (n.version && fileFor(n.version) ? '<a class="btn small get" href="' + esc(fileFor(n.version).file) + '" download>' + pixelIcon('down', '#FFFFFF', 10) + '이 버전 받기 (' + esc(fileFor(n.version).name) + ')</a>' : '') +
        (n.body ? '<div class="body">' + richText(n.body) + '</div>' : (n.summary && !n.changes.length ? '<div class="body"><p>' + esc(n.summary) + '</p></div>' : '')) + groups +
        (n.images && n.images.length ? '<div class="figs">' + n.images.filter(function (im) { return im.src; }).map(function (im) {
          return '<figure><img src="' + esc(im.src) + '" alt="' + esc(im.caption || n.title) + '" loading="lazy">' + (im.caption ? '<figcaption>' + esc(im.caption) + '</figcaption>' : '') + '</figure>';
        }).join('') + '</div>' : '') +
        '<div class="pager">' +
          (older ? '<a class="btn ghost small" href="#/news/' + esc(older.id) + '"><span>← ' + esc(label(older)) + '</span></a>' : '<span></span>') +
          (newer ? '<a class="btn ghost small" href="#/news/' + esc(newer.id) + '"><span>' + esc(label(newer)) + ' →</span></a>' : '<span></span>') +
        '</div></div>';
  }

  // ------------------------------------------------------------------ 모드 정보 (가이드북)
  function renderAbout(secId) {
    const list = state.site.about;
    let idx = list.findIndex(function (x) { return x.id === secId; });
    if (idx < 0) idx = 0;
    const sec = list[idx];
    const prev = list[idx - 1], next = list[idx + 1];
    app.innerHTML = '<div class="page-head"><h1>모드 정보</h1><p>Strelitzia를 처음 보는 분도 한눈에 알 수 있게 정리했어요.</p></div>' +
      '<div class="guide"><nav class="panel guide-toc" aria-label="모드 정보 목차">' + ptitle('book', '목차') + '<div class="items">' + list.map(function (x, i) {
        return '<a href="#/about/' + x.id + '"' + (i === idx ? ' aria-current="true"' : '') + '><span class="slot">' + pixelIcon(x.icon, GOLD, 14) + '</span>' + esc(x.title) + '</a>';
      }).join('') + '</div></nav>' +
      '<article class="panel guide-page" id="sec-' + sec.id + '">' + ptitle(sec.icon, (idx + 1) + '쪽 / ' + list.length + '쪽') + '<div class="pbody">' +
        '<h2>' + pixelIcon(sec.icon, GOLD, 18) + esc(sec.title) + '</h2>' + sec.blocks.map(block).join('') +
        '<div class="pager">' +
          (prev ? '<a class="btn ghost small" href="#/about/' + prev.id + '"><span>← ' + esc(prev.title) + '</span></a>' : '<span></span>') +
          (next ? '<a class="btn small" href="#/about/' + next.id + '"><span>' + esc(next.title) + ' →</span></a>' : '<a class="btn small" href="#/codex"><span>도감 보러 가기 →</span></a>') +
        '</div></div></article></div>';
  }
  function block(b) {
    if (b.p) return '<p>' + esc(b.p) + '</p>';
    if (b.h) return '<h3>' + esc(b.h) + '</h3>';
    if (b.list) return '<ul>' + b.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (b.table) return '<table class="keytable">' + b.table.map(function (r) { return '<tr><td><kbd>' + esc(r[0]) + '</kbd></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    if (b.codex === 'abilities') return '<div class="slots">' + state.codex.abilities.map(function (a) { return itemSlot('#/codex/ability/' + a.id, a.image, a.name, a.color, { label: true }); }).join('') + '</div>';
    if (b.codex === 'weapons') return '<div class="slots">' + state.codex.weapons.map(function (w) { return itemSlot('#/codex/weapon/' + w.id, w.image, w.name, abilityColor(w.ability), { label: true }); }).join('') + '</div>';
    return '';
  }

  // ------------------------------------------------------------------ 도감 (인벤토리 + 설명 판)
  const codexFilter = { tab: 'abilities', q: '', cat: '' };
  function renderCodex(kind, id) {
    if (kind === 'ability') codexFilter.tab = 'abilities';
    if (kind === 'weapon') codexFilter.tab = 'weapons';
    const isAb = codexFilter.tab === 'abilities';
    const items = isAb ? state.codex.abilities : state.codex.weapons;
    // 고른 것이 없으면 첫 칸을 보여줘요
    const picked = (id && (isAb ? ability(id) : weapon(id))) || items[0];
    const cats = Array.from(new Set(items.map(function (x) { return x.category; })));
    if (cats.indexOf(codexFilter.cat) < 0) codexFilter.cat = '';
    app.innerHTML = '<div class="page-head"><h1>도감</h1><p>칸을 누르면 오른쪽에 자세한 설명이 나와요.</p></div>' +
      '<div class="codex"><section class="inv-panel"><div class="tabs" role="tablist">' +
        '<button role="tab" data-tab="abilities" aria-selected="' + isAb + '">능력 ' + state.codex.abilities.length + '</button>' +
        '<button role="tab" data-tab="weapons" aria-selected="' + !isAb + '">무기 ' + state.codex.weapons.length + '</button></div>' +
        '<div class="panel"><div class="tools"><input class="field" id="cq" type="search" placeholder="이름·스킬·설명 검색" value="' + esc(codexFilter.q) + '" aria-label="도감 검색">' +
        '<div class="chips" id="catChips"><button class="chip" data-cat="" aria-pressed="' + (codexFilter.cat === '') + '">전체</button>' +
        cats.map(function (c) { return '<button class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (codexFilter.cat === c) + '">' + esc(c) + '</button>'; }).join('') +
        '</div></div><div class="slots" id="codexGrid"></div>' +
        '<div class="picked" id="picked"></div></div></section>' +
      '<article class="panel entry" id="entry"></article></div>';
    app.querySelectorAll('[role=tab]').forEach(function (b) {
      b.addEventListener('click', function () { codexFilter.tab = b.dataset.tab; codexFilter.cat = ''; location.hash = '#/codex'; if (!kind) renderCodex(); });
    });
    app.querySelector('#cq').addEventListener('input', function (e) { codexFilter.q = e.target.value; drawCodexGrid(picked); });
    app.querySelectorAll('#catChips .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        codexFilter.cat = b.dataset.cat;
        app.querySelectorAll('#catChips .chip').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        drawCodexGrid(picked);
      });
    });
    drawCodexGrid(picked);
    if (picked) { if (isAb) drawAbility(picked); else drawWeapon(picked); }
  }
  function drawCodexGrid(picked) {
    const q = codexFilter.q.trim().toLowerCase();
    const isAb = codexFilter.tab === 'abilities';
    const items = (isAb ? state.codex.abilities : state.codex.weapons).filter(function (x) {
      if (codexFilter.cat && x.category !== codexFilter.cat) return false;
      return !q || JSON.stringify(x).toLowerCase().indexOf(q) >= 0;
    });
    const grid = document.getElementById('codexGrid');
    // 인벤토리처럼 빈 칸까지 채워서 5칸 x 최소 3줄
    const total = Math.max(15, Math.ceil(items.length / 5) * 5);
    grid.innerHTML = items.map(function (x) {
      return itemSlot('#/codex/' + (isAb ? 'ability/' : 'weapon/') + x.id, x.image, x.name, isAb ? x.color : abilityColor(x.ability), { on: picked && x.id === picked.id });
    }).join('') + emptySlots(total - items.length);
    document.getElementById('picked').innerHTML = items.length
      ? (picked ? esc(picked.name) + '<small>' + esc(picked.en) + '</small>' : '')
      : '<span class="muted">찾는 항목이 없어요. 다른 이름으로 검색해 보세요.</span>';
  }
  function skillType(s) { return s.type === 'passive' ? '패시브' : s.type === 'charge' ? '충전형' : '액티브'; }
  function drawAbility(a) {
    const w = a.weapon ? weapon(a.weapon) : null;
    const weps = [w].concat(state.codex.weapons.filter(function (x) { return x.ability === a.id && x !== w; })).filter(Boolean);
    const e = document.getElementById('entry');
    e.style.setProperty('--glow', a.color);
    e.innerHTML = ptitle('star', '능력') +
      '<div class="head"><span class="slot"><span class="glow"></span><img src="' + esc(a.image) + '" alt="' + esc(a.name) + ' 대표 그림"></span><div>' +
        '<h1>' + esc(a.name) + '</h1><span class="en">' + esc(a.en) + '</span>' +
        '<p class="lead">' + esc(a.summary) + '</p><p class="desc">' + esc(a.description) + '</p>' +
        '<dl class="facts"><div><dt>분류</dt><dd>' + esc(a.category) + '</dd></div><div><dt>역할</dt><dd>' + esc(a.roles.join(', ')) + '</dd></div>' +
        '<div><dt>전용 무기</dt><dd>' + (w ? '<a href="#/codex/weapon/' + esc(w.id) + '">' + esc(w.name) + '</a>' : '없음') + '</dd></div>' +
        '<div><dt>추가된 버전</dt><dd class="ver">' + esc(a.since) + '</dd></div></dl></div></div>' +
      '<section><h2>스킬</h2>' + a.skills.map(function (s) {
        return '<div class="skill"><kbd>' + esc(s.key) + '</kbd><span class="slot"><img src="' + esc(s.icon) + '" alt=""></span>' +
          '<div><h3>' + esc(s.name) + '<span class="cd">' + skillType(s) + (s.cooldown ? ' · 쿨타임 ' + esc(s.cooldown) : '') + '</span></h3>' +
          '<p>' + esc(s.desc) + '</p><div class="how">조작: ' + esc(s.how) + '</div></div></div>';
      }).join('') + '</section>' +
      '<section class="two"><div><h2>특징</h2><ul>' + (a.features || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h2>사용 팁</h2><ul>' + (a.tips || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></section>' +
      (weps.length ? '<section><h2>관련 무기</h2><div class="rel">' + weps.map(function (x) {
        return '<a href="#/codex/weapon/' + esc(x.id) + '"><span class="slot"><img src="' + esc(x.image) + '" alt=""></span>' + esc(x.name) + '</a>';
      }).join('') + '</div></section>' : '');
  }
  function drawWeapon(w) {
    const a = ability(w.ability);
    const e = document.getElementById('entry');
    e.style.setProperty('--glow', a ? a.color : GOLD);
    e.innerHTML = ptitle('sword', '무기') +
      '<div class="head"><span class="slot"><span class="glow"></span><img src="' + esc(w.image) + '" alt="' + esc(w.name) + ' 모델"></span><div>' +
        '<h1>' + esc(w.name) + '</h1><span class="en">' + esc(w.en) + '</span>' +
        '<p class="lead">' + esc(w.summary) + '</p>' +
        '<dl class="facts"><div><dt>등급</dt><dd>' + esc(w.grade) + '</dd></div><div><dt>종류</dt><dd>' + esc(w.category) + '</dd></div>' +
        '<div><dt>능력</dt><dd>' + (a ? '<a href="#/codex/ability/' + esc(a.id) + '">' + esc(a.name) + '</a>' : '-') + '</dd></div>' +
        '<div><dt>추가된 버전</dt><dd class="ver">' + esc(w.since) + '</dd></div>' +
        Object.keys(w.stats || {}).map(function (k) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(w.stats[k]) + '</dd></div>'; }).join('') +
        '</dl></div></div>' +
      '<section><h2>고유 능력</h2><p class="text">' + esc(w.unique) + '</p></section>' +
      '<section class="two"><div><h2>얻는 방법</h2><p>' + esc(w.obtain) + '</p></div><div><h2>사용 방법</h2><p>' + esc(w.usage) + '</p></div></section>';
  }

  // ------------------------------------------------------------------ 모드 받기
  function renderDownload() {
    const req = state.downloads.requirements || {};
    const files = state.downloads.files;
    const f = files[0];
    const noticeOf = function (x) { return x.notice ? state.notices.find(function (n) { return n.id === x.notice; }) : state.notices.find(function (n) { return n.version === x.version; }); };
    let html = '<div class="page-head"><h1>모드 받기</h1><p>업데이트가 올라오면 여기서 바로 받을 수 있어요.</p></div><div class="dl">';
    // 왼쪽: 최신 버전
    html += '<section class="panel dl-main">' + ptitle('down', '최신 버전') + '<div class="pbody">';
    if (f) {
      const nt = noticeOf(f);
      html += '<div class="dl-head"><span class="slot"><img src="img/logo.png" alt=""></span><div>' +
        '<h2>Strelitzia <span class="ver">v' + esc(f.version) + '</span></h2>' +
        '<div class="dl-meta">' + formatDate(f.date) + ' · ' + fileSize(f.size || 0) + ' · ' + esc(f.name) + '</div>' +
        (f.tested ? '<span class="tag" style="--c:#5BCB6A">게임에서 확인함</span>' : '<span class="tag" style="--c:#F39A3D">게임 확인 전</span>') +
        '</div></div>' +
        (f.note ? '<p class="dl-note">' + esc(f.note) + '</p>' : '') +
        '<div class="chips"><a class="btn" href="' + esc(f.file) + '" download>' + pixelIcon('down', '#FFFFFF', 12) + 'jar 파일 받기</a>' +
        (nt ? '<a class="btn ghost" href="#/news/' + esc(nt.id) + '">바뀐 점 보기</a>' : '') + '</div>' +
        (f.sha256 ? '<p class="hash">SHA-256 <code>' + esc(f.sha256) + '</code></p>' : '');
    } else {
      html += '<div class="idle"><p>아직 올라온 파일이 없어요. 첫 버전이 올라오면 여기에 받기 버튼이 생겨요.</p><a class="btn ghost" href="#/news">업데이트 소식 보기</a></div>';
    }
    // 설치 방법 (순서가 있어서 번호)
    html += '<h3>설치 방법</h3><ol class="steps">' +
      '<li><b>마인크래프트 ' + esc(req.minecraft || '26.3') + '</b> 에 <a href="https://fabricmc.net/use/installer/" target="_blank" rel="noopener">Fabric Loader</a> ' + esc(req.fabricLoader || '') + ' 이상을 깔아요.</li>' +
      '<li><a href="https://modrinth.com/mod/fabric-api" target="_blank" rel="noopener">Fabric API</a> ' + esc(req.fabricApi || '') + ' 를 받아서 <code>mods</code> 폴더에 넣어요.</li>' +
      '<li>위에서 받은 <code>strelitzia-버전.jar</code> 를 같은 <code>mods</code> 폴더에 넣어요. 예전 버전 jar 는 지워 주세요.</li>' +
      '<li>Fabric 으로 게임을 켜고, 월드에서 <kbd>G</kbd> 를 눌러 능력을 골라요.</li></ol>' +
      '<p class="muted small">함께 노는 서버가 있다면 서버와 모두의 컴퓨터에 같은 버전을 넣어야 해요.</p>';
    html += '</div></section>';
    // 오른쪽: 지난 버전
    html += '<section class="panel dl-old">' + ptitle('book', '지난 버전', '<small>' + files.length + '개</small>') + '<div class="items">' +
      (files.length > 1 ? files.slice(1).map(function (x) {
        return '<div class="lrow read"><span class="slot">' + pixelIcon('down', '#7A818D', 12) + '</span>' +
          '<span><span class="t"><span class="ver">v' + esc(x.version) + '</span> ' + esc(x.name) + '</span><span class="d">' + formatDate(x.date) + ' · ' + fileSize(x.size || 0) + (x.tested ? ' · 확인함' : '') + '</span></span>' +
          '<a class="btn small ghost" href="' + esc(x.file) + '" download>받기</a></div>';
      }).join('') : '<div class="empty">아직 지난 버전이 없어요.</div>') + '</div></section>';
    app.innerHTML = html + '</div>';
  }

  function renderMissing(msg, href, label) {
    app.innerHTML = '<div class="panel idle"><p>' + esc(msg) + '</p><a class="btn ghost" href="' + href + '">' + label + '</a></div>';
  }

  // ------------------------------------------------------------------ 핫바 메뉴
  const NAV_NAME = { home: '홈', news: '공지·업데이트', about: '모드 정보', codex: '도감', download: '모드 받기' };
  document.querySelectorAll('.hotbar .ico').forEach(function (el) { el.innerHTML = pixelIcon(el.dataset.icon, 'currentColor', 18); });
  let nameTimer = 0;
  function showHotbarName(text) {
    const el = document.getElementById('hotbarName');
    el.textContent = text; el.classList.add('show');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }
  // 숫자키 1~4 로 핫바 칸 이동 (글자 입력 중엔 안 해요)
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const link = document.querySelector('.hotbar a[data-key="' + e.key + '"]');
    if (link) { e.preventDefault(); location.hash = link.getAttribute('href'); }
  });
  // 위 구석 알림: 안 읽은 글이 있으면 "안 읽음" 목록으로
  document.getElementById('hudAlert').addEventListener('click', function (e) {
    e.preventDefault();
    newsFilter.tab = state.notices.some(isUnread) ? 'unread' : 'all';
    if (location.hash === '#/news') route(); else location.hash = '#/news';
  });

  // ------------------------------------------------------------------ 주소 → 페이지
  let lastPage = null;
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
    const page = parts[0] || 'home';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.dataset.nav === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const keepScroll = page === lastPage && (page === 'codex' || page === 'news' || page === 'about');
    if (page === 'home') renderHome();
    else if (page === 'news') renderNews(parts[1]);
    else if (page === 'about') renderAbout(parts[1]);
    else if (page === 'codex') renderCodex(parts[1], parts[2]);
    else if (page === 'download') renderDownload();
    else renderMissing('없는 페이지예요.', '#/', '홈으로');
    document.title = 'Strelitzia — ' + (NAV_NAME[page] || '공식 정보');
    if (page !== lastPage && NAV_NAME[page]) showHotbarName(NAV_NAME[page]);
    // 같은 페이지 안에서 칸·글만 바꾸면 위치를 지켜요 (좁은 화면은 설명 판으로 내려가요)
    if (!keepScroll) window.scrollTo(0, 0);
    else if (window.innerWidth <= 860) {
      const target = document.getElementById(page === 'codex' ? 'entry' : page === 'news' ? 'logview' : 'app');
      if (target && parts[1]) target.scrollIntoView({ block: 'start' });
    }
    lastPage = page;
  }

  load().then(function () {
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) {
    app.innerHTML = '<div class="err"><p>공지 데이터를 불러오지 못했어요: ' + esc(e.message) + '</p><p>잠시 뒤 새로고침해 보세요.</p></div>';
  });
})();

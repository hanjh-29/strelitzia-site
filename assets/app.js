/* Strelitzia 공식 사이트 — 화면 그리기 (주소 # 뒤로 페이지를 나눠요) */
(function () {
  'use strict';
  const { TAGS, TAG_ORDER, pixelIcon, esc, richText, sortNotices, isFresh, formatDate, loadJson } = window.SZ;
  const app = document.getElementById('app');
  const state = { site: null, notices: [], codex: null };

  // ------------------------------------------------------------------ 데이터
  async function load() {
    const [site, notices, codex] = await Promise.all([
      loadJson('data/site.json'), loadJson('data/notices.json'), loadJson('data/codex.json')
    ]);
    state.site = site;
    state.notices = sortNotices(notices.notices || []);
    state.codex = codex;
    const fresh = state.notices.filter(function (n) { return isFresh(n); }).length;
    const badge = document.getElementById('newCount');
    if (fresh > 0) { badge.textContent = fresh; badge.hidden = false; badge.title = '최근 7일 새 글 ' + fresh + '개'; }
  }

  /** 버전이 있는 업데이트 중 가장 높은 것 */
  function latestUpdate() {
    return state.notices.filter(function (n) { return n.kind === 'update' && n.version; })
      .sort(function (a, b) { return window.SZ.compareVersion(b.version, a.version); })[0];
  }
  function ability(id) { return (state.codex.abilities || []).find(function (a) { return a.id === id; }); }
  function weapon(id) { return (state.codex.weapons || []).find(function (w) { return w.id === id; }); }

  function tagChip(t) {
    const m = TAGS[t] || TAGS.NOTICE;
    return '<span class="tag" style="--c:' + m.color + '">' + pixelIcon(m.icon, '#17142c', 10) + m.label + '</span>';
  }
  function newBadge(n) { return isFresh(n) ? '<span class="new-badge" title="최근 7일 안에 올라온 글">N</span>' : ''; }
  function orderTags(tags) { return TAG_ORDER.filter(function (t) { return tags.indexOf(t) >= 0; }); }
  function noticeColor(n) { return (TAGS[n.mainTag] || TAGS.NOTICE).color; }

  // ------------------------------------------------------------------ 홈
  function renderHome() {
    const s = state.site;
    const latest = latestUpdate();
    const top = state.notices[0];
    const pinned = state.notices.filter(function (n) { return n.pinned; });
    const recent = state.notices.filter(function (n) { return n.kind === 'update'; }).slice(0, 5);
    const feature = latest || top;
    let html = '<section class="hero"><div>' +
      '<div class="hero-title"><img src="' + esc(s.logo) + '" alt=""><div><h1>' + esc(s.name) + '</h1><span class="ko">' + esc(s.nameKo) + ' · 능력자 모드</span></div></div>' +
      '<p class="lead">' + esc(s.tagline) + '</p><p class="sub">' + esc(s.intro) + '</p>' +
      '<div class="hero-meta">' +
        '<div><b>' + esc(latest ? latest.version : '-') + '</b><span>최신 버전</span></div>' +
        '<div><b>' + esc(latest && latest.date ? formatDate(latest.date) : '-') + '</b><span>최근 업데이트</span></div>' +
        '<div><b>' + (state.codex.abilities || []).length + '</b><span>능력</span></div>' +
      '</div>' +
      '<div class="hero-actions"><a class="btn" href="#/news">공지·업데이트 보기</a><a class="btn ghost" href="#/codex">능력 도감</a></div>' +
    '</div>';
    if (feature) {
      html += '<article class="latest px-frame"><div class="head"><span class="muted">최신 업데이트</span>' + newBadge(feature) + '</div>' +
        '<div class="chips">' + orderTags(feature.tags).map(tagChip).join('') + '</div>' +
        '<h2>' + (feature.version ? '<span class="ver">' + esc(feature.version) + '</span> ' : '') + esc(feature.title) + '</h2>' +
        '<ul>' + feature.changes.slice(0, 4).map(function (c) {
          const m = TAGS[c.tag] || TAGS.NOTICE;
          return '<li>' + pixelIcon(m.icon, m.color, 12) + '<span>' + esc(c.text) + '</span></li>';
        }).join('') + '</ul>' +
        '<a class="btn ghost" href="#/news/' + esc(feature.id) + '">자세히 보기</a></article>';
    }
    html += '</section>';

    if (pinned.length) {
      html += '<section class="section"><div class="section-head"><h2>중요 공지</h2></div><div class="news">' + pinned.map(newsRow).join('') + '</div></section>';
    }
    html += '<section class="section"><div class="section-head"><h2>능력</h2><a href="#/codex">도감 전체</a></div>' +
      '<div class="cards">' + state.codex.abilities.map(abilityCard).join('') + '</div></section>';
    html += '<section class="section"><div class="section-head"><h2>최근 업데이트</h2><a href="#/news">전체 기록</a></div>' +
      '<div class="news">' + recent.map(newsRow).join('') + '</div></section>';
    app.innerHTML = html;
  }

  function newsRow(n) {
    return '<a class="row' + (n.important ? ' important' : '') + '" style="--c:' + noticeColor(n) + '" href="#/news/' + esc(n.id) + '">' +
      '<div class="when">' + (n.version ? '<span class="ver">' + esc(n.version) + '</span>' : (n.pinned ? pixelIcon('pin', '#F0596B', 14) : '')) + formatDate(n.date) + '</div>' +
      '<div><h3>' + esc(n.title) + newBadge(n) + '</h3><p>' + esc(n.summary) + '</p></div>' +
      '<div class="tags">' + orderTags(n.tags).map(tagChip).join('') + '</div></a>';
  }

  // ------------------------------------------------------------------ 공지·업데이트
  const newsFilter = { tab: 'all', tags: new Set(), q: '' };
  function renderNews() {
    app.innerHTML = '<div class="page-head"><h1>공지·업데이트</h1><p>모든 버전의 기록을 지우지 않고 보관해요. 최신 글이 위에 있어요.</p></div>' +
      '<div class="tabs" role="tablist">' +
        tabBtn('all', '전체') + tabBtn('notice', '공지') + tabBtn('update', '업데이트') +
      '</div>' +
      '<div class="news-tools"><input class="field" id="q" type="search" placeholder="제목·내용·버전 검색" value="' + esc(newsFilter.q) + '" aria-label="검색">' +
      '<div class="chips" id="tagChips">' + TAG_ORDER.map(function (t) {
        return '<button class="chip" style="--c:' + TAGS[t].color + '" data-tag="' + t + '" aria-pressed="' + newsFilter.tags.has(t) + '">' + TAGS[t].label + ' · ' + TAGS[t].name + '</button>';
      }).join('') + '</div></div>' +
      '<div class="news" id="newsList"></div>';
    app.querySelectorAll('[role=tab]').forEach(function (b) {
      b.addEventListener('click', function () { newsFilter.tab = b.dataset.tab; renderNews(); });
    });
    app.querySelector('#q').addEventListener('input', function (e) { newsFilter.q = e.target.value; drawNewsList(); });
    app.querySelectorAll('#tagChips .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        const t = b.dataset.tag;
        if (newsFilter.tags.has(t)) newsFilter.tags.delete(t); else newsFilter.tags.add(t);
        b.setAttribute('aria-pressed', newsFilter.tags.has(t));
        drawNewsList();
      });
    });
    drawNewsList();
  }
  function tabBtn(id, label) {
    return '<button role="tab" data-tab="' + id + '" aria-selected="' + (newsFilter.tab === id) + '">' + label + '</button>';
  }
  function drawNewsList() {
    const q = newsFilter.q.trim().toLowerCase();
    const list = state.notices.filter(function (n) {
      if (newsFilter.tab !== 'all' && n.kind !== newsFilter.tab) return false;
      if (newsFilter.tags.size && !n.tags.some(function (t) { return newsFilter.tags.has(t); })) return false;
      if (q) {
        const hay = [n.title, n.summary, n.body, n.version].concat(n.changes.map(function (c) { return c.text; })).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    const box = document.getElementById('newsList');
    box.innerHTML = list.length ? list.map(newsRow).join('') : '<div class="empty">조건에 맞는 글이 없어요. 검색어나 분류를 바꿔 보세요.</div>';
  }

  function renderNewsDetail(id) {
    const n = state.notices.find(function (x) { return x.id === id; });
    if (!n) return renderMissing('그 글을 찾을 수 없어요. 지워졌거나 주소가 바뀌었을 수 있어요.', '#/news', '공지·업데이트로');
    const groups = TAG_ORDER.map(function (t) {
      const items = n.changes.filter(function (c) { return c.tag === t; });
      if (!items.length) return '';
      const m = TAGS[t];
      return '<div class="group" style="--c:' + m.color + '"><h3>' + pixelIcon(m.icon, m.color, 14) + m.name + '</h3><ul>' +
        items.map(function (c) { return '<li>' + esc(c.text) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    const versions = state.notices.filter(function (x) { return x.kind === 'update'; });
    app.innerHTML = '<a class="back" href="#/news">← 공지·업데이트</a>' +
      '<div class="detail"><article class="article px-frame">' +
        '<div class="chips">' + orderTags(n.tags).map(tagChip).join('') + newBadge(n) + '</div>' +
        '<h1>' + (n.version ? '<span class="ver">' + esc(n.version) + '</span> ' : '') + esc(n.title) + '</h1>' +
        '<div class="byline">' + formatDate(n.date) + (n.kind === 'notice' ? ' · 공지' : ' · 업데이트') + '</div>' +
        (n.body ? '<div class="body">' + richText(n.body) + '</div>' : '') + groups +
        (n.images && n.images.length ? '<div class="figs">' + n.images.filter(function (i) { return i.src; }).map(function (i) {
          return '<figure><img src="' + esc(i.src) + '" alt="' + esc(i.caption || n.title) + '" loading="lazy">' + (i.caption ? '<figcaption>' + esc(i.caption) + '</figcaption>' : '') + '</figure>';
        }).join('') + '</div>' : '') +
      '</article>' +
      '<aside class="side px-frame"><h4>버전별 기록</h4>' +
        '<select class="field" id="verPick" aria-label="버전 고르기">' + versions.map(function (v) {
          return '<option value="' + esc(v.id) + '"' + (v.id === n.id ? ' selected' : '') + '>' + esc(v.version) + ' — ' + esc(v.title) + '</option>';
        }).join('') + '</select>' +
        '<div class="list">' + versions.slice(0, 40).map(function (v) {
          return '<a href="#/news/' + esc(v.id) + '"' + (v.id === n.id ? ' aria-current="true"' : '') + '><span>' + esc(v.version) + '</span><span>' + esc(v.title) + '</span></a>';
        }).join('') + '</div></aside></div>';
    app.querySelector('#verPick').addEventListener('change', function (e) { location.hash = '#/news/' + e.target.value; });
  }

  // ------------------------------------------------------------------ 모드 정보
  function renderAbout() {
    const s = state.site;
    app.innerHTML = '<div class="page-head"><h1>모드 정보</h1><p>Strelitzia를 처음 보는 분도 한눈에 알 수 있게 정리했어요.</p></div>' +
      '<div class="about"><nav class="toc" aria-label="모드 정보 목차">' + s.about.map(function (sec) {
        return '<a href="#/about/' + sec.id + '">' + pixelIcon(sec.icon, '#F2C14E', 14) + esc(sec.title) + '</a>';
      }).join('') + '</nav><div>' + s.about.map(function (sec) {
        return '<section class="px-frame" id="sec-' + sec.id + '"><h2>' + pixelIcon(sec.icon, '#F2C14E', 18) + esc(sec.title) + '</h2>' + sec.blocks.map(block).join('') + '</section>';
      }).join('') + '</div></div>';
  }
  function block(b) {
    if (b.p) return '<p>' + esc(b.p) + '</p>';
    if (b.h) return '<h3>' + esc(b.h) + '</h3>';
    if (b.list) return '<ul>' + b.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (b.table) return '<table class="keytable">' + b.table.map(function (r) { return '<tr><td><kbd>' + esc(r[0]) + '</kbd></td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    if (b.codex === 'abilities') return '<div class="cards">' + state.codex.abilities.map(abilityCard).join('') + '</div>';
    if (b.codex === 'weapons') return '<div class="cards">' + state.codex.weapons.map(weaponCard).join('') + '</div>';
    return '';
  }

  // ------------------------------------------------------------------ 도감
  const codexFilter = { tab: 'abilities', q: '', cat: '' };
  function abilityCard(a) {
    return '<a class="card px-frame" style="--glow:' + esc(a.color) + '" href="#/codex/ability/' + esc(a.id) + '">' +
      '<div class="portrait"><img src="' + esc(a.image) + '" alt="' + esc(a.name) + ' 대표 그림" loading="lazy"></div>' +
      '<h3>' + esc(a.name) + '</h3><span class="en">' + esc(a.en) + '</span><p>' + esc(a.summary) + '</p>' +
      '<div class="meta"><span>' + esc(a.category) + '</span>' + a.roles.map(function (r) { return '<span>' + esc(r) + '</span>'; }).join('') + '</div>' +
      '<div class="keys">' + a.skills.map(function (s) { return '<img src="' + esc(s.icon) + '" alt="' + esc(s.key + ' ' + s.name) + '" title="' + esc(s.key + ' · ' + s.name) + '" loading="lazy">'; }).join('') + '</div></a>';
  }
  function weaponCard(w) {
    const a = ability(w.ability);
    return '<a class="card weapon px-frame" style="--glow:' + esc(a ? a.color : '#F2C14E') + '" href="#/codex/weapon/' + esc(w.id) + '">' +
      '<div class="portrait"><img src="' + esc(w.image) + '" alt="' + esc(w.name) + ' 모델" loading="lazy"></div>' +
      '<h3>' + esc(w.name) + '</h3><span class="en">' + esc(w.en) + '</span><p>' + esc(w.summary) + '</p>' +
      '<div class="meta"><span>' + esc(w.grade) + '</span><span>' + esc(w.category) + '</span>' + (a ? '<span>' + esc(a.name) + '</span>' : '') + '</div></a>';
  }
  function renderCodex() {
    const items = codexFilter.tab === 'abilities' ? state.codex.abilities : state.codex.weapons;
    const cats = Array.from(new Set(items.map(function (x) { return x.category; })));
    if (cats.indexOf(codexFilter.cat) < 0) codexFilter.cat = '';
    app.innerHTML = '<div class="page-head"><h1>도감</h1><p>모드에 나오는 능력과 무기를 모두 모았어요. 카드를 누르면 자세한 정보가 나와요.</p></div>' +
      '<div class="tabs" role="tablist"><button role="tab" data-tab="abilities" aria-selected="' + (codexFilter.tab === 'abilities') + '">능력 ' + state.codex.abilities.length + '</button>' +
      '<button role="tab" data-tab="weapons" aria-selected="' + (codexFilter.tab === 'weapons') + '">무기 ' + state.codex.weapons.length + '</button></div>' +
      '<div class="news-tools"><input class="field" id="cq" type="search" placeholder="이름·스킬·설명 검색" value="' + esc(codexFilter.q) + '" aria-label="도감 검색">' +
      '<div class="chips" id="catChips"><button class="chip" data-cat="" aria-pressed="' + (codexFilter.cat === '') + '">전체</button>' +
      cats.map(function (c) { return '<button class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (codexFilter.cat === c) + '">' + esc(c) + '</button>'; }).join('') +
      '</div></div><div class="cards" id="codexList"></div>';
    app.querySelectorAll('[role=tab]').forEach(function (b) {
      b.addEventListener('click', function () { codexFilter.tab = b.dataset.tab; codexFilter.cat = ''; renderCodex(); });
    });
    app.querySelector('#cq').addEventListener('input', function (e) { codexFilter.q = e.target.value; drawCodex(); });
    app.querySelectorAll('#catChips .chip').forEach(function (b) {
      b.addEventListener('click', function () { codexFilter.cat = b.dataset.cat; renderCodex(); });
    });
    drawCodex();
  }
  function drawCodex() {
    const q = codexFilter.q.trim().toLowerCase();
    const isAb = codexFilter.tab === 'abilities';
    const items = (isAb ? state.codex.abilities : state.codex.weapons).filter(function (x) {
      if (codexFilter.cat && x.category !== codexFilter.cat) return false;
      if (!q) return true;
      const hay = JSON.stringify(x).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    document.getElementById('codexList').innerHTML = items.length ? items.map(isAb ? abilityCard : weaponCard).join('') : '<div class="empty">찾는 항목이 없어요. 다른 이름으로 검색해 보세요.</div>';
  }

  function renderAbility(id) {
    const a = ability(id);
    if (!a) return renderMissing('그 능력을 찾을 수 없어요.', '#/codex', '도감으로');
    const w = a.weapon ? weapon(a.weapon) : null;
    const related = state.codex.weapons.filter(function (x) { return x.ability === a.id && x.id !== a.weapon; });
    app.innerHTML = '<a class="back" href="#/codex">← 도감</a>' +
      '<section class="codex-head px-frame" style="--glow:' + esc(a.color) + '"><div class="portrait"><img src="' + esc(a.image) + '" alt="' + esc(a.name) + ' 대표 그림"></div>' +
      '<div><h1>' + esc(a.name) + '</h1><span class="en">' + esc(a.en) + '</span>' +
      '<div class="desc"><p>' + esc(a.summary) + '</p><p class="muted">' + esc(a.description) + '</p></div>' +
      '<div class="facts"><span>분류 <b>' + esc(a.category) + '</b></span><span>역할 <b>' + esc(a.roles.join(', ')) + '</b></span>' +
      '<span>사용 무기 <b>' + (w ? '<a href="#/codex/weapon/' + esc(w.id) + '">' + esc(w.name) + '</a>' : '없음') + '</b></span>' +
      '<span>추가된 버전 <b class="ver">' + esc(a.since) + '</b></span></div></div></section>' +
      '<div class="section-head"><h2>스킬 구성</h2></div><div class="skills">' + a.skills.map(function (s) {
        return '<div class="skill px-frame"><kbd>' + esc(s.key) + '</kbd><img src="' + esc(s.icon) + '" alt="">' +
          '<div><h3>' + esc(s.name) + '<span class="cd">' + (s.type === 'passive' ? '패시브' : s.type === 'charge' ? '충전형' : '액티브') + (s.cooldown ? ' · 쿨타임 ' + esc(s.cooldown) : '') + '</span></h3>' +
          '<p>' + esc(s.desc) + '</p><div class="how">조작: ' + esc(s.how) + '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="two"><div class="px-frame"><h3>특징</h3><ul>' + (a.features || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="px-frame"><h3>사용 팁</h3><ul>' + (a.tips || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' +
      ((w || related.length) ? '<section class="section"><div class="section-head"><h2>관련 무기</h2></div><div class="cards">' + [w].concat(related).filter(Boolean).map(weaponCard).join('') + '</div></section>' : '');
  }

  function renderWeapon(id) {
    const w = weapon(id);
    if (!w) return renderMissing('그 무기를 찾을 수 없어요.', '#/codex', '도감으로');
    const a = ability(w.ability);
    app.innerHTML = '<a class="back" href="#/codex">← 도감</a>' +
      '<section class="codex-head px-frame" style="--glow:' + esc(a ? a.color : '#F2C14E') + '"><div class="portrait"><img src="' + esc(w.image) + '" alt="' + esc(w.name) + ' 모델"></div>' +
      '<div><h1>' + esc(w.name) + '</h1><span class="en">' + esc(w.en) + '</span>' +
      '<div class="desc"><p>' + esc(w.summary) + '</p></div>' +
      '<div class="facts"><span>등급 <b>' + esc(w.grade) + '</b></span><span>종류 <b>' + esc(w.category) + '</b></span>' +
      '<span>능력 <b>' + (a ? '<a href="#/codex/ability/' + esc(a.id) + '">' + esc(a.name) + '</a>' : '-') + '</b></span>' +
      '<span>추가된 버전 <b class="ver">' + esc(w.since) + '</b></span></div>' +
      '<div class="stats">' + Object.keys(w.stats || {}).map(function (k) { return '<div><span>' + esc(k) + '</span><b>' + esc(w.stats[k]) + '</b></div>'; }).join('') + '</div>' +
      '</div></section>' +
      '<div class="two"><div class="px-frame"><h3>고유 능력</h3><p>' + esc(w.unique) + '</p></div>' +
      '<div class="px-frame"><h3>얻는 방법</h3><p>' + esc(w.obtain) + '</p></div></div>' +
      '<div class="two"><div class="px-frame"><h3>사용 방법</h3><p>' + esc(w.usage) + '</p></div><div></div></div>';
  }

  function renderMissing(msg, href, label) {
    app.innerHTML = '<div class="empty"><p>' + esc(msg) + '</p><a class="btn ghost" href="' + href + '">' + label + '</a></div>';
  }

  // ------------------------------------------------------------------ 주소 → 페이지
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const page = parts[0] || '';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      const on = (a.dataset.nav === 'home' && !page) || a.dataset.nav === page;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    let title = '공식 정보';
    if (!page) renderHome();
    else if (page === 'news' && parts[1]) { renderNewsDetail(parts[1]); title = '공지·업데이트'; }
    else if (page === 'news') { renderNews(); title = '공지·업데이트'; }
    else if (page === 'about') {
      renderAbout(); title = '모드 정보';
      if (parts[1]) { const el = document.getElementById('sec-' + parts[1]); if (el) { el.scrollIntoView(); return; } }
    }
    else if (page === 'codex' && parts[1] === 'ability') { renderAbility(parts[2]); title = '도감'; }
    else if (page === 'codex' && parts[1] === 'weapon') { renderWeapon(parts[2]); title = '도감'; }
    else if (page === 'codex') { renderCodex(); title = '도감'; }
    else renderMissing('없는 페이지예요.', '#/', '홈으로');
    document.title = 'Strelitzia — ' + title;
    window.scrollTo(0, 0);
  }

  load().then(function () {
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) {
    app.innerHTML = '<div class="err"><p>공지 데이터를 불러오지 못했어요: ' + esc(e.message) + '</p><p>잠시 뒤 새로고침해 보세요.</p></div>';
  });
})();

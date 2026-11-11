/* Strelitzia 관리자 페이지
 * - 저장소에 쓰기 권한이 있는 GitHub 토큰으로만 들어올 수 있어요 (토큰은 이 브라우저에만 저장, 저장소엔 안 올라가요)
 * - 저장하면 data/*.json 을 GitHub 에 바로 커밋해요 → 1~2분 뒤 사이트·게임 공지에 반영
 * - 모든 저장이 git 기록에 남아서, 「백업·복구」 탭에서 예전 버전으로 되돌릴 수 있어요
 */
(function () {
  'use strict';
  const REPO = 'hanjh-29/strelitzia-site';
  const BRANCH = 'main';
  const API = 'https://api.github.com';
  const FILES = { notices: 'data/notices.json', codex: 'data/codex.json', site: 'data/site.json', downloads: 'data/downloads.json' };
  const MAX_JAR = 25 * 1024 * 1024; // jar 는 25MB 까지 (보통 1~3MB)
  const { TAGS, TAG_ORDER, esc, sortNotices, pixelIcon } = window.SZ;

  const root = document.getElementById('admin');
  const nav = document.getElementById('adminNav');
  const S = { token: null, user: null, data: {}, sha: {}, tab: 'notices', sel: {} };

  // ================================================================== GitHub
  function b64encodeUtf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decodeUtf8(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  async function gh(path, opts) {
    opts = opts || {};
    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + S.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok) {
      let msg = res.status + '';
      try { msg += ' ' + (await res.json()).message; } catch (e) { /* 무시 */ }
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  async function readFile(path, ref) {
    const j = await gh('/repos/' + REPO + '/contents/' + path + '?ref=' + encodeURIComponent(ref || BRANCH));
    return { sha: j.sha, text: b64decodeUtf8(j.content) };
  }
  /** 저장소에 있는 파일의 sha (없으면 null) — 큰 파일도 내용 없이 sha 만 받아와요 */
  async function fileSha(path) {
    try { return (await gh('/repos/' + REPO + '/contents/' + path + '?ref=' + BRANCH)).sha; }
    catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function deleteFile(path, message) {
    const sha = await fileSha(path);
    if (!sha) return;
    await gh('/repos/' + REPO + '/contents/' + path, { method: 'DELETE', body: { message: message, sha: sha, branch: BRANCH } });
  }
  async function writeFile(path, b64, message, sha) {
    const body = { message: message, content: b64, branch: BRANCH };
    if (sha) body.sha = sha;
    const j = await gh('/repos/' + REPO + '/contents/' + path, { method: 'PUT', body: body });
    return j.content.sha;
  }

  // ================================================================== 데이터 읽기·저장
  async function loadAll() {
    for (const key of Object.keys(FILES)) {
      if (key === 'downloads') {
        // 모드 파일 목록은 처음엔 없을 수도 있어요 → 빈 목록으로 시작
        try { const f0 = await readFile(FILES[key]); S.sha[key] = f0.sha; S.data[key] = JSON.parse(f0.text); }
        catch (e) {
          if (e.status !== 404) throw e;
          S.sha[key] = null;
          S.data[key] = { schema: 1, requirements: { minecraft: '26.3', fabricLoader: '', fabricApi: '' }, files: [] };
        }
        continue;
      }
      const f = await readFile(FILES[key]);
      S.sha[key] = f.sha;
      S.data[key] = JSON.parse(f.text);
    }
  }
  /** 검사 → 저장. 다른 곳에서 먼저 바뀌었으면 알려 줘요 */
  async function save(key, message) {
    const problems = validate(key, S.data[key]);
    if (problems.length) { toast('저장 안 됨: ' + problems[0], true); return false; }
    S.data[key].updated = new Date().toLocaleDateString('sv-SE');
    const text = JSON.stringify(S.data[key], null, 1) + '\n';
    try {
      S.sha[key] = await writeFile(FILES[key], b64encodeUtf8(text), message, S.sha[key]);
      toast('저장했어요. 1~2분 뒤 사이트와 게임 공지에 반영돼요.');
      return true;
    } catch (e) {
      if (e.status === 409 || e.status === 422) toast('다른 곳에서 먼저 바뀌었어요. 새로고침한 뒤 다시 고쳐 주세요.', true);
      else toast('저장 실패: ' + e.message, true);
      return false;
    }
  }

  /** 잘못된 데이터가 올라가지 않게 검사 (문제 목록을 돌려줘요) */
  function validate(key, d) {
    const out = [];
    const dateOk = function (x) { return x == null || x === '' || /^\d{4}-\d{2}-\d{2}$/.test(x); };
    if (key === 'notices') {
      if (!Array.isArray(d.notices)) return ['notices 목록이 없어요'];
      const ids = new Set();
      d.notices.forEach(function (n, i) {
        const where = '(' + (n.title || (i + 1) + '번째 글') + ') ';
        if (!n.id || !/^[a-z0-9._-]+$/i.test(n.id)) out.push(where + 'id 는 영문·숫자·.-_ 만 쓸 수 있어요');
        if (ids.has(n.id)) out.push(where + 'id 가 겹쳐요: ' + n.id);
        ids.add(n.id);
        if (!n.title || !n.title.trim()) out.push(where + '제목을 적어 주세요');
        if (n.kind !== 'update' && n.kind !== 'notice') out.push(where + '종류가 이상해요');
        if (!dateOk(n.date)) out.push(where + '날짜는 2026-11-12 형식이에요');
        if (!TAGS[n.mainTag]) out.push(where + '대표 분류를 골라 주세요');
        (n.changes || []).forEach(function (c) { if (!TAGS[c.tag]) out.push(where + '변경 항목 분류가 이상해요'); });
      });
    } else if (key === 'codex') {
      ['abilities', 'weapons'].forEach(function (list) {
        const ids = new Set();
        (d[list] || []).forEach(function (x) {
          if (!x.id || !/^[a-z0-9_]+$/.test(x.id)) out.push((x.name || '?') + ': id 는 영문 소문자·숫자·_ 만 (게임 안 id 와 같게)');
          if (ids.has(x.id)) out.push('id 가 겹쳐요: ' + x.id);
          ids.add(x.id);
          if (!x.name) out.push(x.id + ': 이름을 적어 주세요');
        });
      });
    } else if (key === 'downloads') {
      if (!Array.isArray(d.files)) return ['files 목록이 없어요'];
      const vs = new Set();
      d.files.forEach(function (f) {
        if (!/^\d+\.\d+\.\d+$/.test(f.version || '')) out.push('버전은 0.5.4 처럼 숫자 세 개예요: ' + (f.version || '?'));
        if (vs.has(f.version)) out.push('같은 버전이 두 번 있어요: ' + f.version);
        vs.add(f.version);
        if (!/^downloads\/[a-z0-9._-]+\.jar$/.test(f.file || '')) out.push(f.version + ': 파일 주소가 이상해요');
        if (!dateOk(f.date)) out.push(f.version + ': 날짜는 2026-11-12 형식이에요');
      });
    } else if (key === 'site') {
      if (!d.name) out.push('모드 이름(name)이 없어요');
      if (!Array.isArray(d.about)) out.push('about 목록이 없어요');
    }
    return out;
  }

  // ================================================================== 로그인
  function renderLogin(msg) {
    nav.hidden = true;
    root.innerHTML = '<section class="login px-frame"><h1>관리자 로그인</h1>' +
      '<p class="muted">이 저장소(' + esc(REPO) + ')에 쓰기 권한이 있는 GitHub 토큰으로 들어와요. 토큰은 이 브라우저에만 저장돼요.</p>' +
      '<ol><li>github.com → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token</li>' +
      '<li>Repository access: <b>Only select repositories</b> → strelitzia-site</li>' +
      '<li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>' +
      '<li>만든 토큰을 아래에 붙여 넣기</li></ol>' +
      (msg ? '<p class="err">' + esc(msg) + '</p>' : '') +
      '<form class="form" id="loginForm"><label>GitHub 토큰<input class="field" id="tok" type="password" autocomplete="off" required></label>' +
      '<label class="check"><input type="checkbox" id="remember"> 이 브라우저에 기억하기 (공용 PC 에선 끄세요)</label>' +
      '<button class="btn" type="submit">로그인</button></form></section>';
    root.querySelector('#loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const t = root.querySelector('#tok').value.trim();
      const remember = root.querySelector('#remember').checked;
      await login(t, remember);
    });
  }
  async function login(token, remember) {
    S.token = token;
    root.innerHTML = '<p class="muted">확인하는 중…</p>';
    try {
      const repo = await gh('/repos/' + REPO);
      if (!repo.permissions || !repo.permissions.push) throw new Error('이 토큰은 저장소에 쓰기 권한이 없어요');
      const me = await gh('/user').catch(function () { return { login: '관리자' }; });
      S.user = me.login;
      (remember ? localStorage : sessionStorage).setItem('sz-admin-token', token);
      await loadAll();
      nav.hidden = false;
      route();
    } catch (e) {
      sessionStorage.removeItem('sz-admin-token');
      localStorage.removeItem('sz-admin-token');
      S.token = null;
      renderLogin('로그인 실패: ' + e.message);
    }
  }
  function logout() {
    sessionStorage.removeItem('sz-admin-token');
    localStorage.removeItem('sz-admin-token');
    location.hash = '';
    location.reload();
  }

  // ================================================================== 공용 조각
  function toast(msg, bad) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (bad ? ' bad' : '');
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, bad ? 7000 : 4000);
  }
  function tagOptions(sel) {
    return TAG_ORDER.map(function (t) { return '<option value="' + t + '"' + (t === sel ? ' selected' : '') + '>' + TAGS[t].label + ' · ' + TAGS[t].name + '</option>'; }).join('');
  }
  function val(id) { const el = root.querySelector('#' + id); return el ? el.value : ''; }
  function checked(id) { const el = root.querySelector('#' + id); return !!(el && el.checked); }
  function lines(id) { return val(id).split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
  function inp(id, label, value, type, extra) {
    return '<label>' + label + '<input class="field" id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"' + (extra || '') + '></label>';
  }
  function area(id, label, value, cls) {
    return '<label>' + label + '<textarea class="field ' + (cls || '') + '" id="' + id + '">' + esc(value == null ? '' : value) + '</textarea></label>';
  }
  function topBar(title) {
    return '<div class="section-head"><h2>' + esc(title) + '</h2><span class="hint">' + esc(S.user || '') + ' 로그인 · <a href="#" id="logout">로그아웃</a></span></div>';
  }
  function bindLogout() { const a = root.querySelector('#logout'); if (a) a.addEventListener('click', function (e) { e.preventDefault(); logout(); }); }

  /** 그림 파일 올리기 → img/uploads/ 에 커밋 → 주소를 돌려줘요 */
  async function uploadImage(file) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error('PNG·JPG·GIF·WEBP 그림만 올릴 수 있어요');
    if (file.size > 2 * 1024 * 1024) throw new Error('2MB 보다 작은 그림만 올릴 수 있어요');
    const b64 = await new Promise(function (ok, no) {
      const r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = no;
      r.readAsDataURL(file);
    });
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
    const path = 'img/uploads/' + new Date().toISOString().slice(0, 10) + '-' + Date.now().toString(36) + '-' + safe;
    await writeFile(path, b64, '그림 올리기: ' + safe);
    return path;
  }

  // ================================================================== 공지·업데이트
  function renderNotices() {
    const list = sortNotices(S.data.notices.notices);
    const cur = S.data.notices.notices.find(function (n) { return n.id === S.sel.notice; });
    root.innerHTML = topBar('공지·업데이트 관리') + '<div class="editor">' +
      '<div class="list-panel px-frame"><button class="btn small" id="newNotice">새 글 쓰기</button>' +
      '<input class="field" id="nq" placeholder="찾기" style="margin-top:10px">' +
      '<div class="items">' + list.map(function (n) {
        return '<button class="item" data-id="' + esc(n.id) + '" style="--c:' + (TAGS[n.mainTag] || TAGS.NOTICE).color + '"' + (n.id === S.sel.notice ? ' aria-current="true"' : '') + '>' +
          esc((n.version ? n.version + ' · ' : '') + n.title) + '<small>' + esc(n.date || '날짜 없음') + (n.pinned ? ' · 고정' : '') + '</small></button>';
      }).join('') + '</div></div>' +
      '<div class="edit-panel px-frame" id="noticeForm">' + (cur ? noticeForm(cur) : '<p class="muted">왼쪽에서 글을 고르거나 「새 글 쓰기」를 눌러 주세요.</p>') + '</div></div>';
    bindLogout();
    root.querySelector('#newNotice').addEventListener('click', function () {
      const today = new Date().toLocaleDateString('sv-SE'); // 내 컴퓨터 날짜 (YYYY-MM-DD)
      const n = { id: 'notice-' + Date.now().toString(36), kind: 'notice', version: null, date: today, title: '', tags: ['NOTICE'], mainTag: 'NOTICE',
        summary: '', changes: [], body: '', images: [], important: false, _new: true };
      S.data.notices.notices.push(n);
      S.sel.notice = n.id;
      renderNotices();
    });
    root.querySelector('#nq').addEventListener('input', function (e) {
      const q = e.target.value.toLowerCase();
      root.querySelectorAll('.items .item').forEach(function (b) { b.hidden = b.textContent.toLowerCase().indexOf(q) < 0; });
    });
    root.querySelectorAll('.items .item').forEach(function (b) {
      b.addEventListener('click', function () { S.sel.notice = b.dataset.id; renderNotices(); });
    });
    if (cur) bindNoticeForm(cur);
  }
  function noticeForm(n) {
    return '<h2>' + (n._new ? '새 글' : '글 고치기') + '</h2><form class="form" id="nf">' +
      '<div class="grid3"><label>종류<select class="field" id="n_kind"><option value="update"' + (n.kind === 'update' ? ' selected' : '') + '>업데이트</option><option value="notice"' + (n.kind === 'notice' ? ' selected' : '') + '>공지</option></select></label>' +
      inp('n_version', '버전 (공지는 비워도 돼요)', n.version || '') + inp('n_date', '날짜', n.date || '', 'date') + '</div>' +
      '<div class="grid2">' + inp('n_id', '글 id (주소에 쓰여요)', n.id) + '<label>대표 분류 (목록 색)<select class="field" id="n_main">' + tagOptions(n.mainTag) + '</select></label></div>' +
      inp('n_title', '제목', n.title, 'text', ' required') +
      inp('n_summary', '한 줄 요약 (목록에 보여요)', n.summary) +
      '<div class="grid2"><label class="check"><input type="checkbox" id="n_imp"' + (n.important ? ' checked' : '') + '> 중요 (목록에서 강조)</label>' +
      '<label class="check"><input type="checkbox" id="n_pin"' + (n.pinned ? ' checked' : '') + '> 맨 위 고정 (메인 「중요 공지」)</label></div>' +
      '<div><div class="section-head"><h3>바뀐 내용</h3><button type="button" class="btn small ghost" id="addChange">항목 추가</button></div><div class="rows" id="changes">' +
      (n.changes || []).map(changeRow).join('') + '</div><p class="hint">분류별로 묶여서 보여요: NEW 새 기능 · UPDATE 개선·변경 · FIX 오류 수정 · BALANCE 밸런스 · NOTICE 중요 공지</p></div>' +
      area('n_body', '자세한 설명 (빈 줄 = 문단, **굵게**)', n.body) +
      '<div><div class="section-head"><h3>그림</h3><label class="btn small ghost">그림 올리기<input type="file" id="n_upload" accept="image/*" hidden></label></div><div class="rows" id="images">' +
      (n.images || []).map(imageRow).join('') + '</div><button type="button" class="btn small ghost" id="addImage" style="margin-top:8px">주소로 그림 추가</button></div>' +
      '<div class="actions"><button class="btn" type="submit">저장</button>' +
      (n._new ? '<button class="btn ghost" type="button" id="cancelNew">취소</button>' : '<button class="btn danger" type="button" id="delNotice">삭제</button>') +
      (n._new ? '' : '<a class="btn ghost" href="index.html#/news/' + esc(n.id) + '" target="_blank" rel="noopener">사이트에서 보기</a>') + '</div></form>';
  }
  function changeRow(c) {
    return '<div class="rowedit"><select class="field ch-tag">' + tagOptions(c.tag) + '</select><input class="field ch-text" value="' + esc(c.text) + '" placeholder="바뀐 내용"><button type="button" class="iconbtn del" aria-label="항목 지우기">✕</button></div>';
  }
  function imageRow(im) {
    return '<div class="rowedit" style="grid-template-columns:64px 1fr 1fr 40px"><img class="thumb" src="' + esc(im.src) + '" alt=""><input class="field im-src" value="' + esc(im.src) + '" placeholder="img/..."><input class="field im-cap" value="' + esc(im.caption || '') + '" placeholder="설명"><button type="button" class="iconbtn del" aria-label="그림 지우기">✕</button></div>';
  }
  function bindRows(box) {
    box.querySelectorAll('.del').forEach(function (b) { b.onclick = function () { b.parentElement.remove(); }; });
  }
  function bindNoticeForm(n) {
    const f = root.querySelector('#nf');
    const changes = root.querySelector('#changes');
    const images = root.querySelector('#images');
    bindRows(changes); bindRows(images);
    root.querySelector('#addChange').onclick = function () {
      changes.insertAdjacentHTML('beforeend', changeRow({ tag: val('n_main') || 'UPDATE', text: '' }));
      bindRows(changes);
    };
    root.querySelector('#addImage').onclick = function () {
      images.insertAdjacentHTML('beforeend', imageRow({ src: '', caption: '' }));
      bindRows(images);
    };
    root.querySelector('#n_upload').onchange = async function (e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        toast('그림 올리는 중…');
        const path = await uploadImage(file);
        images.insertAdjacentHTML('beforeend', imageRow({ src: path, caption: '' }));
        bindRows(images);
        toast('그림을 올렸어요. 글을 저장해야 공지에 붙어요.');
      } catch (err) { toast('그림 올리기 실패: ' + err.message, true); }
    };
    const cancel = root.querySelector('#cancelNew');
    if (cancel) cancel.onclick = function () {
      S.data.notices.notices = S.data.notices.notices.filter(function (x) { return x !== n; });
      S.sel.notice = null; renderNotices();
    };
    const del = root.querySelector('#delNotice');
    if (del) del.onclick = async function () {
      if (!confirm('「' + n.title + '」 글을 지울까요? (백업·복구 탭에서 되돌릴 수 있어요)')) return;
      const backup = S.data.notices.notices.slice();
      S.data.notices.notices = backup.filter(function (x) { return x !== n; });
      if (await save('notices', '공지 삭제: ' + n.title)) { S.sel.notice = null; renderNotices(); }
      else S.data.notices.notices = backup;
    };
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      const before = JSON.stringify(n);
      const ch = Array.from(changes.querySelectorAll('.rowedit')).map(function (r) {
        return { tag: r.querySelector('.ch-tag').value, text: r.querySelector('.ch-text').value.trim() };
      }).filter(function (c) { return c.text; });
      const ims = Array.from(images.querySelectorAll('.rowedit')).map(function (r) {
        return { src: r.querySelector('.im-src').value.trim(), caption: r.querySelector('.im-cap').value.trim() };
      }).filter(function (i) { return i.src; });
      n.kind = val('n_kind'); n.version = val('n_version').trim() || null; n.date = val('n_date') || null;
      n.id = val('n_id').trim(); n.mainTag = val('n_main'); n.title = val('n_title').trim(); n.summary = val('n_summary').trim();
      n.important = checked('n_imp'); n.pinned = checked('n_pin') || undefined; n.changes = ch; n.body = val('n_body').trim(); n.images = ims;
      n.tags = TAG_ORDER.filter(function (t) { return t === n.mainTag || ch.some(function (c) { return c.tag === t; }); });
      if (!n.summary && ch.length) n.summary = ch[0].text;
      const wasNew = n._new; delete n._new;
      const ok = await save('notices', (wasNew ? '공지 추가: ' : '공지 수정: ') + n.title);
      if (ok) { S.sel.notice = n.id; renderNotices(); }
      else { Object.assign(n, JSON.parse(before)); }
    });
  }

  // ================================================================== 능력 도감
  function listPanel(items, selId, newLabel, kind) {
    return '<div class="list-panel px-frame"><button class="btn small" id="newItem">' + newLabel + '</button><div class="items">' +
      items.map(function (x) {
        return '<button class="item" data-id="' + esc(x.id) + '" style="--c:' + esc(x.color || '#F2C14E') + '"' + (x.id === selId ? ' aria-current="true"' : '') + '>' +
          esc(x.name || '(이름 없음)') + '<small>' + esc(x.id) + '</small></button>';
      }).join('') + '</div></div>';
  }
  function renderAbilities() {
    const items = S.data.codex.abilities;
    const cur = items.find(function (a) { return a.id === S.sel.ability; });
    root.innerHTML = topBar('능력 도감 관리') + '<div class="editor">' + listPanel(items, S.sel.ability, '새 능력 추가') +
      '<div class="edit-panel px-frame">' + (cur ? abilityForm(cur) : '<p class="muted">왼쪽에서 능력을 고르거나 「새 능력 추가」를 눌러 주세요. 게임에 새 능력이 생기면 여기에도 등록해 주세요.</p>') + '</div></div>';
    bindLogout();
    root.querySelector('#newItem').onclick = function () {
      const a = { id: 'new_ability', name: '', en: '', color: '#F2C14E', image: '', since: '', category: '', roles: [], weapon: null, summary: '', description: '',
        skills: [{ key: 'Z', name: '', type: 'active', cooldown: '', icon: '', desc: '', how: '' }, { key: 'X', name: '', type: 'active', cooldown: '', icon: '', desc: '', how: '' }, { key: 'P', name: '', type: 'passive', cooldown: null, icon: '', desc: '', how: '' }],
        features: [], tips: [], _new: true };
      items.push(a); S.sel.ability = a.id; renderAbilities();
    };
    root.querySelectorAll('.items .item').forEach(function (b) { b.onclick = function () { S.sel.ability = b.dataset.id; renderAbilities(); }; });
    if (cur) bindAbilityForm(cur);
  }
  function abilityForm(a) {
    const weapons = S.data.codex.weapons;
    return '<h2>' + (a._new ? '새 능력' : esc(a.name)) + '</h2><form class="form" id="af">' +
      '<div class="grid3">' + inp('a_id', 'id (게임 안 능력 id)', a.id) + inp('a_name', '이름', a.name) + inp('a_en', '영어 이름', a.en) + '</div>' +
      '<div class="grid3">' + inp('a_color', '대표 색', a.color, 'color') + inp('a_cat', '분류 (필터)', a.category) + inp('a_roles', '역할 (쉼표로)', (a.roles || []).join(', ')) + '</div>' +
      '<div class="grid3">' + inp('a_since', '추가된 버전', a.since) +
      '<label>사용 무기<select class="field" id="a_weapon"><option value="">없음</option>' + weapons.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === a.weapon ? ' selected' : '') + '>' + esc(w.name) + '</option>'; }).join('') + '</select></label>' +
      imageField('a_image', '대표 그림 (64x64 도트)', a.image) + '</div>' +
      inp('a_summary', '한 줄 소개', a.summary) + area('a_desc', '기본 설명', a.description) +
      '<div><div class="section-head"><h3>스킬</h3><button type="button" class="btn small ghost" id="addSkill">스킬 추가</button></div><div class="rows" id="skills">' +
      (a.skills || []).map(skillBox).join('') + '</div></div>' +
      '<div class="grid2">' + area('a_feat', '특징 (한 줄에 하나)', (a.features || []).join('\n')) + area('a_tips', '사용 팁 (한 줄에 하나)', (a.tips || []).join('\n')) + '</div>' +
      '<div class="actions"><button class="btn" type="submit">저장</button>' + (a._new ? '<button class="btn ghost" type="button" id="cancelNew">취소</button>' : '<button class="btn danger" type="button" id="delItem">삭제</button><a class="btn ghost" target="_blank" rel="noopener" href="index.html#/codex/ability/' + esc(a.id) + '">사이트에서 보기</a>') + '</div></form>';
  }
  function imageField(id, label, value) {
    return '<label>' + label + '<span style="display:flex;gap:6px"><input class="field" id="' + id + '" value="' + esc(value || '') + '" style="flex:1" placeholder="img/..."><label class="btn small ghost" style="margin:0">올리기<input type="file" data-for="' + id + '" class="up" accept="image/*" hidden></label></span></label>';
  }
  function skillBox(s) {
    return '<div class="skillbox"><div class="grid3"><label>키<input class="field sk-key" value="' + esc(s.key) + '"></label>' +
      '<label>이름<input class="field sk-name" value="' + esc(s.name) + '"></label>' +
      '<label>종류<select class="field sk-type"><option value="active"' + (s.type === 'active' ? ' selected' : '') + '>액티브</option><option value="charge"' + (s.type === 'charge' ? ' selected' : '') + '>충전형</option><option value="passive"' + (s.type === 'passive' ? ' selected' : '') + '>패시브</option></select></label></div>' +
      '<div class="grid2"><label>쿨타임 (예: 3초, 없으면 비우기)<input class="field sk-cd" value="' + esc(s.cooldown || '') + '"></label><label>아이콘 (img/skills/…)<input class="field sk-icon" value="' + esc(s.icon) + '"></label></div>' +
      '<label>효과<textarea class="field sk-desc">' + esc(s.desc) + '</textarea></label><label>조작 방법<input class="field sk-how" value="' + esc(s.how) + '"></label>' +
      '<button type="button" class="btn small danger del" style="justify-self:start">이 스킬 빼기</button></div>';
  }
  function bindUploads() {
    root.querySelectorAll('input.up').forEach(function (u) {
      u.onchange = async function () {
        const file = u.files[0]; if (!file) return;
        try { toast('그림 올리는 중…'); root.querySelector('#' + u.dataset.for).value = await uploadImage(file); toast('그림을 올렸어요. 저장을 눌러야 반영돼요.'); }
        catch (e) { toast('그림 올리기 실패: ' + e.message, true); }
      };
    });
  }
  function bindDeleteAndCancel(listKey, item, selKey, rerender, label) {
    const cancel = root.querySelector('#cancelNew');
    if (cancel) cancel.onclick = function () {
      S.data.codex[listKey] = S.data.codex[listKey].filter(function (x) { return x !== item; });
      S.sel[selKey] = null; rerender();
    };
    const del = root.querySelector('#delItem');
    if (del) del.onclick = async function () {
      if (!confirm('「' + item.name + '」을(를) 도감에서 지울까요? (백업·복구 탭에서 되돌릴 수 있어요)')) return;
      const backup = S.data.codex[listKey].slice();
      S.data.codex[listKey] = backup.filter(function (x) { return x !== item; });
      if (await save('codex', label + ' 삭제: ' + item.name)) { S.sel[selKey] = null; rerender(); }
      else S.data.codex[listKey] = backup;
    };
  }
  function bindAbilityForm(a) {
    const skills = root.querySelector('#skills');
    bindRows(skills); bindUploads();
    skills.querySelectorAll('.del').forEach(function (b) { b.onclick = function () { b.closest('.skillbox').remove(); }; });
    root.querySelector('#addSkill').onclick = function () {
      skills.insertAdjacentHTML('beforeend', skillBox({ key: 'C', name: '', type: 'active', cooldown: '', icon: '', desc: '', how: '' }));
      skills.querySelectorAll('.del').forEach(function (b) { b.onclick = function () { b.closest('.skillbox').remove(); }; });
    };
    bindDeleteAndCancel('abilities', a, 'ability', renderAbilities, '능력');
    root.querySelector('#af').addEventListener('submit', async function (e) {
      e.preventDefault();
      const before = JSON.stringify(a);
      Object.assign(a, {
        id: val('a_id').trim(), name: val('a_name').trim(), en: val('a_en').trim(), color: val('a_color'), category: val('a_cat').trim(),
        roles: val('a_roles').split(',').map(function (s) { return s.trim(); }).filter(Boolean), since: val('a_since').trim(),
        weapon: val('a_weapon') || null, image: val('a_image').trim(), summary: val('a_summary').trim(), description: val('a_desc').trim(),
        features: lines('a_feat'), tips: lines('a_tips'),
        skills: Array.from(skills.querySelectorAll('.skillbox')).map(function (b) {
          const q = function (c) { return b.querySelector(c).value.trim(); };
          return { key: q('.sk-key'), name: q('.sk-name'), type: q('.sk-type'), cooldown: q('.sk-cd') || null, icon: q('.sk-icon'), desc: q('.sk-desc'), how: q('.sk-how') };
        })
      });
      const wasNew = a._new; delete a._new;
      if (await save('codex', (wasNew ? '능력 추가: ' : '능력 수정: ') + a.name)) { S.sel.ability = a.id; renderAbilities(); }
      else Object.assign(a, JSON.parse(before));
    });
  }

  // ================================================================== 무기 도감
  function renderWeapons() {
    const items = S.data.codex.weapons;
    const cur = items.find(function (w) { return w.id === S.sel.weapon; });
    root.innerHTML = topBar('무기 도감 관리') + '<div class="editor">' + listPanel(items, S.sel.weapon, '새 무기 추가') +
      '<div class="edit-panel px-frame">' + (cur ? weaponForm(cur) : '<p class="muted">왼쪽에서 무기를 고르거나 「새 무기 추가」를 눌러 주세요.</p>') + '</div></div>';
    bindLogout();
    root.querySelector('#newItem').onclick = function () {
      const w = { id: 'new_weapon', name: '', en: '', grade: '', category: '', ability: '', image: '', since: '', summary: '', stats: {}, unique: '', obtain: '', usage: '', _new: true };
      items.push(w); S.sel.weapon = w.id; renderWeapons();
    };
    root.querySelectorAll('.items .item').forEach(function (b) { b.onclick = function () { S.sel.weapon = b.dataset.id; renderWeapons(); }; });
    if (cur) bindWeaponForm(cur);
  }
  function weaponForm(w) {
    const abilities = S.data.codex.abilities;
    return '<h2>' + (w._new ? '새 무기' : esc(w.name)) + '</h2><form class="form" id="wf">' +
      '<div class="grid3">' + inp('w_id', 'id', w.id) + inp('w_name', '이름', w.name) + inp('w_en', '영어 이름', w.en) + '</div>' +
      '<div class="grid3">' + inp('w_grade', '등급', w.grade) + inp('w_cat', '종류 (필터)', w.category) +
      '<label>능력<select class="field" id="w_ability"><option value="">없음</option>' + abilities.map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === w.ability ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="grid2">' + imageField('w_image', '모델 그림', w.image) + inp('w_since', '추가된 버전', w.since) + '</div>' +
      inp('w_summary', '한 줄 소개', w.summary) +
      area('w_stats', '능력치 (한 줄에 「이름: 값」)', Object.keys(w.stats || {}).map(function (k) { return k + ': ' + w.stats[k]; }).join('\n')) +
      area('w_unique', '고유 능력', w.unique) + area('w_obtain', '얻는 방법', w.obtain) + area('w_usage', '사용 방법', w.usage) +
      '<div class="actions"><button class="btn" type="submit">저장</button>' + (w._new ? '<button class="btn ghost" type="button" id="cancelNew">취소</button>' : '<button class="btn danger" type="button" id="delItem">삭제</button><a class="btn ghost" target="_blank" rel="noopener" href="index.html#/codex/weapon/' + esc(w.id) + '">사이트에서 보기</a>') + '</div></form>';
  }
  function bindWeaponForm(w) {
    bindUploads();
    bindDeleteAndCancel('weapons', w, 'weapon', renderWeapons, '무기');
    root.querySelector('#wf').addEventListener('submit', async function (e) {
      e.preventDefault();
      const before = JSON.stringify(w);
      const stats = {};
      lines('w_stats').forEach(function (l) { const i = l.indexOf(':'); if (i > 0) stats[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
      Object.assign(w, { id: val('w_id').trim(), name: val('w_name').trim(), en: val('w_en').trim(), grade: val('w_grade').trim(), category: val('w_cat').trim(),
        ability: val('w_ability'), image: val('w_image').trim(), since: val('w_since').trim(), summary: val('w_summary').trim(), stats: stats,
        unique: val('w_unique').trim(), obtain: val('w_obtain').trim(), usage: val('w_usage').trim() });
      const wasNew = w._new; delete w._new;
      if (await save('codex', (wasNew ? '무기 추가: ' : '무기 수정: ') + w.name)) { S.sel.weapon = w.id; renderWeapons(); }
      else Object.assign(w, JSON.parse(before));
    });
  }

  // ================================================================== 모드 파일 (jar 올리기)
  function versionOf(name) { const m = /(\d+\.\d+\.\d+)/.exec(name || ''); return m ? m[1] : ''; }
  function sizeText(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  async function sha256Hex(buf) {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function renderFiles() {
    const D = S.data.downloads;
    const files = D.files.slice().sort(function (a, b) { return window.SZ.compareVersion(b.version, a.version); });
    const updates = S.data.notices.notices.filter(function (n) { return n.kind === 'update' && n.version; });
    const req = D.requirements || {};
    root.innerHTML = topBar('모드 파일') + '<div class="editor">' +
      '<div class="list-panel px-frame"><h3 style="font-size:14px;margin:4px 0 6px">올라간 버전</h3><div class="items">' +
      (files.length ? files.map(function (f, i) {
        return '<div class="item" style="--c:' + (i === 0 ? '#3A9D47' : '#555') + '">v' + esc(f.version) + (i === 0 ? ' · 최신' : '') +
          '<small>' + esc(f.date || '') + ' · ' + sizeText(f.size || 0) + (f.tested ? ' · 게임 확인함' : ' · 확인 전') + '</small>' +
          '<span style="display:flex;gap:6px;margin-top:6px"><button class="btn small ghost" data-tested="' + esc(f.version) + '">' + (f.tested ? '확인 전으로' : '게임 확인함') + '</button>' +
          '<button class="btn small danger" data-del="' + esc(f.version) + '">지우기</button></span></div>';
      }).join('') : '<p class="muted">아직 없어요.</p>') + '</div></div>' +
      '<div class="edit-panel px-frame"><h2>새 버전 올리기</h2>' +
      '<p class="hint">마인크래프트를 끄고 <code>gradlew build</code> 를 한 뒤, <code>Strelitzia\\build\\libs</code> 안의 <b>strelitzia-버전.jar</b> 를 아래에 끌어다 놓거나 골라 주세요. (<code>-sources</code> 가 붙은 파일은 아니에요)</p>' +
      '<form class="form" id="ff"><label class="drop" id="drop">jar 파일을 여기로 끌어다 놓기<small id="picked">또는 눌러서 고르기</small><input type="file" id="jar" accept=".jar" hidden></label>' +
      '<div class="grid3">' + inp('f_version', '버전', '') + inp('f_date', '날짜', new Date().toLocaleDateString('sv-SE'), 'date') +
      '<label>업데이트 공지 연결<select class="field" id="f_notice"><option value="">(같은 버전 공지 자동)</option>' +
      updates.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(n.version + ' · ' + n.title) + '</option>'; }).join('') + '</select></label></div>' +
      inp('f_note', '한 줄 메모 (받기 화면에 보여요, 비워도 돼요)', '') +
      '<label class="check"><input type="checkbox" id="f_tested"> 이 버전은 게임에서 확인했어요</label>' +
      '<div class="actions"><button class="btn" type="submit" id="upBtn">올리기</button><a class="btn ghost" href="index.html#/download" target="_blank" rel="noopener">받기 화면 보기</a></div></form>' +
      '<div class="section"><h3 style="font-size:15px;margin-bottom:8px">설치에 필요한 것 (받기 화면에 보여요)</h3><form class="form" id="rf"><div class="grid3">' +
      inp('r_mc', '마인크래프트', req.minecraft) + inp('r_loader', 'Fabric Loader', req.fabricLoader) + inp('r_api', 'Fabric API', req.fabricApi) +
      '</div><div class="actions"><button class="btn small" type="submit">저장</button></div></form></div></div></div>';
    bindLogout();
    let picked = null;
    const drop = root.querySelector('#drop');
    const pick = function (file) {
      if (!file) return;
      if (!/\.jar$/i.test(file.name)) { toast('.jar 파일만 올릴 수 있어요', true); return; }
      if (/-(sources|dev)\.jar$/i.test(file.name)) { toast('-sources·-dev 가 붙지 않은 jar 를 골라 주세요', true); return; }
      if (file.size > MAX_JAR) { toast('25MB 보다 큰 파일은 올릴 수 없어요', true); return; }
      picked = file;
      root.querySelector('#picked').textContent = file.name + ' · ' + sizeText(file.size);
      const v = versionOf(file.name);
      if (v) {
        root.querySelector('#f_version').value = v;
        const n = updates.find(function (x) { return x.version === v; });
        if (n) root.querySelector('#f_notice').value = n.id;
      }
    };
    root.querySelector('#jar').onchange = function (e) { pick(e.target.files[0]); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files[0]); });
    root.querySelector('#ff').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!picked) { toast('먼저 jar 파일을 골라 주세요', true); return; }
      const version = val('f_version').trim();
      if (!/^\d+\.\d+\.\d+$/.test(version)) { toast('버전은 0.5.4 처럼 적어 주세요', true); return; }
      const exists = D.files.find(function (f) { return f.version === version; });
      if (exists && !confirm('v' + version + ' 파일이 이미 있어요. 새 파일로 바꿀까요?')) return;
      const btn = root.querySelector('#upBtn'); btn.disabled = true;
      try {
        toast('올리는 중… (몇 초 걸려요)');
        const buf = await picked.arrayBuffer();
        const name = 'strelitzia-' + version + '.jar';
        const path = 'downloads/' + name;
        await writeFile(path, bufToB64(buf), '모드 파일 올리기: v' + version, await fileSha(path));
        const entry = { version: version, date: val('f_date') || new Date().toLocaleDateString('sv-SE'), file: path, name: name, size: picked.size,
          sha256: await sha256Hex(buf), notice: val('f_notice') || null, note: val('f_note').trim(), tested: checked('f_tested') };
        const backup = D.files.slice();
        D.files = D.files.filter(function (f) { return f.version !== version; }).concat([entry]);
        if (await save('downloads', '모드 파일 목록: v' + version + (exists ? ' 바꿈' : ' 추가'))) renderFiles();
        else D.files = backup;
      } catch (err) { toast('올리기 실패: ' + err.message, true); }
      finally { btn.disabled = false; }
    });
    root.querySelectorAll('[data-tested]').forEach(function (b) {
      b.onclick = async function () {
        const f = D.files.find(function (x) { return x.version === b.dataset.tested; });
        f.tested = !f.tested;
        if (await save('downloads', 'v' + f.version + (f.tested ? ' 게임 확인함' : ' 확인 전으로'))) renderFiles(); else f.tested = !f.tested;
      };
    });
    root.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        const v = b.dataset.del;
        if (!confirm('v' + v + ' 파일을 받기 목록과 저장소에서 지울까요?')) return;
        const f = D.files.find(function (x) { return x.version === v; });
        const backup = D.files.slice();
        D.files = D.files.filter(function (x) { return x !== f; });
        if (!(await save('downloads', '모드 파일 목록: v' + v + ' 지움'))) { D.files = backup; return; }
        try { await deleteFile(f.file, '모드 파일 지우기: v' + v); } catch (err) { toast('목록에선 뺐지만 파일은 못 지웠어요: ' + err.message, true); }
        renderFiles();
      };
    });
    root.querySelector('#rf').addEventListener('submit', async function (e) {
      e.preventDefault();
      const before = D.requirements;
      D.requirements = { minecraft: val('r_mc').trim(), fabricLoader: val('r_loader').trim(), fabricApi: val('r_api').trim() };
      if (!(await save('downloads', '설치에 필요한 것 수정'))) D.requirements = before;
    });
  }

  // ================================================================== 사이트 정보 (JSON 직접)
  function renderSite() {
    root.innerHTML = topBar('사이트 정보') + '<div class="edit-panel px-frame"><p class="hint">메인 화면 소개 문구와 「모드 정보」 페이지 내용이에요. 형식(JSON)을 지켜야 저장돼요. 문단 {"p": "..."}, 소제목 {"h": "..."}, 목록 {"list": [...]}, 키 표 {"table": [["키","설명"]]}.</p>' +
      '<form class="form" id="sf">' + area('s_json', 'site.json', JSON.stringify(S.data.site, null, 2), 'code') +
      '<div class="actions"><button class="btn" type="submit">저장</button><a class="btn ghost" href="index.html#/about" target="_blank" rel="noopener">사이트에서 보기</a></div></form></div>';
    bindLogout();
    root.querySelector('#sf').addEventListener('submit', async function (e) {
      e.preventDefault();
      let parsed;
      try { parsed = JSON.parse(val('s_json')); } catch (err) { toast('형식이 틀렸어요: ' + err.message, true); return; }
      const before = S.data.site;
      S.data.site = parsed;
      if (!(await save('site', '사이트 정보 수정'))) S.data.site = before;
    });
  }

  // ================================================================== 백업·복구
  function renderBackup() {
    root.innerHTML = topBar('백업·복구') +
      '<div class="two"><div class="px-frame"><h3>전체 백업 받기</h3><p class="hint">공지·도감·사이트 정보를 파일 하나로 내려받아요. 큰 수정 전에 받아 두면 좋아요.</p><button class="btn" id="dl">백업 파일 받기</button></div>' +
      '<div class="px-frame"><h3>백업 파일로 되돌리기</h3><p class="hint">예전에 받은 백업 파일을 올리면 그 내용으로 세 파일을 모두 되돌려요.</p><label class="btn ghost">백업 파일 고르기<input type="file" id="restoreFile" accept="application/json" hidden></label></div></div>' +
      '<section class="section px-frame" style="padding:22px"><h3>저장 기록 (git)</h3><p class="hint">저장할 때마다 기록이 남아요. 고른 시점의 내용으로 되돌릴 수 있어요 (되돌린 것도 새 기록으로 남아요).</p>' +
      '<div class="chips" style="margin-top:10px">' + Object.keys(FILES).map(function (k) { return '<button class="chip" data-file="' + k + '" aria-pressed="' + (S.sel.hist === k) + '">' + FILES[k] + '</button>'; }).join('') + '</div>' +
      '<div class="history" id="hist"><p class="muted">파일을 고르면 기록이 나와요.</p></div></section>';
    bindLogout();
    root.querySelector('#dl').onclick = function () {
      const blob = new Blob([JSON.stringify({ backup: 'strelitzia-site', at: new Date().toISOString(), notices: S.data.notices, codex: S.data.codex, site: S.data.site }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'strelitzia-backup-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
    root.querySelector('#restoreFile').onchange = async function (e) {
      const file = e.target.files[0]; if (!file) return;
      let b;
      try { b = JSON.parse(await file.text()); } catch (err) { toast('백업 파일을 읽을 수 없어요', true); return; }
      if (b.backup !== 'strelitzia-site' || !b.notices || !b.codex || !b.site) { toast('Strelitzia 백업 파일이 아니에요', true); return; }
      const msg = b.at + ' 백업으로 되돌릴까요?\n공지 ' + b.notices.notices.length + '개 · 능력 ' + b.codex.abilities.length + '개 · 무기 ' + b.codex.weapons.length + '개';
      if (!confirm(msg)) return;
      const keep = { notices: S.data.notices, codex: S.data.codex, site: S.data.site };
      for (const k of ['notices', 'codex', 'site']) {
        S.data[k] = b[k];
        if (!(await save(k, '백업에서 되돌리기 (' + b.at + ')'))) { S.data[k] = keep[k]; return; }
      }
      toast('백업으로 되돌렸어요.');
    };
    root.querySelectorAll('[data-file]').forEach(function (c) {
      c.onclick = function () { S.sel.hist = c.dataset.file; renderBackup(); loadHistory(c.dataset.file); };
    });
    if (S.sel.hist) loadHistory(S.sel.hist);
  }
  async function loadHistory(key) {
    const box = root.querySelector('#hist');
    box.innerHTML = '<p class="muted">불러오는 중…</p>';
    try {
      const commits = await gh('/repos/' + REPO + '/commits?sha=' + BRANCH + '&path=' + encodeURIComponent(FILES[key]) + '&per_page=30');
      box.innerHTML = commits.map(function (c, i) {
        return '<div><span>' + esc(c.commit.message.split('\n')[0]) + '<small>' + esc(new Date(c.commit.author.date).toLocaleString('ko-KR')) + ' · ' + esc(c.commit.author.name) + (i === 0 ? ' · 지금 버전' : '') + '</small></span>' +
          (i === 0 ? '' : '<button class="btn small ghost" data-sha="' + c.sha + '">이 버전으로 되돌리기</button>') + '</div>';
      }).join('') || '<p class="muted">기록이 없어요.</p>';
      box.querySelectorAll('[data-sha]').forEach(function (b) {
        b.onclick = async function () {
          if (!confirm(FILES[key] + ' 를 이 시점으로 되돌릴까요?')) return;
          try {
            const old = await readFile(FILES[key], b.dataset.sha);
            const before = S.data[key];
            S.data[key] = JSON.parse(old.text);
            if (await save(key, FILES[key] + ' 되돌리기 (' + b.dataset.sha.slice(0, 7) + ')')) loadHistory(key);
            else S.data[key] = before;
          } catch (e) { toast('되돌리기 실패: ' + e.message, true); }
        };
      });
    } catch (e) { box.innerHTML = '<p class="err">기록을 불러오지 못했어요: ' + esc(e.message) + '</p>'; }
  }

  // ================================================================== 탭 이동
  function route() {
    if (!S.token) return renderLogin();
    S.tab = location.hash.replace('#', '') || 'notices';
    nav.querySelectorAll('a').forEach(function (a) { if (a.dataset.tab === S.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    ({ notices: renderNotices, abilities: renderAbilities, weapons: renderWeapons, files: renderFiles, site: renderSite, backup: renderBackup }[S.tab] || renderNotices)();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', function (e) {
    const unsaved = (S.data.notices && S.data.notices.notices.some(function (n) { return n._new; })) ||
      (S.data.codex && S.data.codex.abilities.concat(S.data.codex.weapons).some(function (x) { return x._new; }));
    if (unsaved) { e.preventDefault(); e.returnValue = ''; }
  });

  const saved = sessionStorage.getItem('sz-admin-token') || localStorage.getItem('sz-admin-token');
  if (saved) login(saved, !!localStorage.getItem('sz-admin-token')); else renderLogin();
  void pixelIcon;
})();

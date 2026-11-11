/* Strelitzia 공식 사이트 공용 도구 (사이트·관리자 페이지 같이 써요) */
(function (global) {
  'use strict';

  /** 업데이트 분류 — 색과 픽셀 아이콘. 새 분류를 추가하면 여기에만 넣으면 돼요 */
  const TAGS = {
    NEW: { label: 'NEW', name: '새 기능', color: '#5BCB6A', icon: 'plus' },
    UPDATE: { label: 'UPDATE', name: '개선·변경', color: '#58A6FF', icon: 'up' },
    FIX: { label: 'FIX', name: '오류 수정', color: '#F39A3D', icon: 'wrench' },
    BALANCE: { label: 'BALANCE', name: '밸런스', color: '#B98AF7', icon: 'scale' },
    NOTICE: { label: 'NOTICE', name: '중요 공지', color: '#F0596B', icon: 'bell' }
  };
  const TAG_ORDER = ['NEW', 'UPDATE', 'FIX', 'BALANCE', 'NOTICE'];

  /** 8x8 픽셀 아이콘 ('#' = 칠한 칸) */
  const PIXEL = {
    plus: ['...##...', '...##...', '...##...', '########', '########', '...##...', '...##...', '...##...'],
    up: ['...##...', '..####..', '.######.', '########', '...##...', '...##...', '...##...', '...##...'],
    wrench: ['.##..##.', '.##..##.', '.######.', '..####..', '...##...', '...##...', '...##...', '..####..'],
    scale: ['...##...', '########', '.#.##.#.', '#..##..#', '#..##..#', '##.##.##', '...##...', '.######.'],
    bell: ['...##...', '..####..', '.######.', '.######.', '.######.', '########', '........', '...##...'],
    star: ['...##...', '...##...', '########', '.######.', '..####..', '.##..##.', '##....##', '........'],
    gear: ['.#.##.#.', '########', '.##..##.', '##....##', '##....##', '.##..##.', '########', '.#.##.#.'],
    spark: ['...#....', '...##...', '..####..', '########', '..####..', '...##...', '....#...', '........'],
    book: ['##....##', '###..###', '#.#..#.#', '#.#..#.#', '#.#..#.#', '#.#..#.#', '########', '........'],
    sword: ['......##', '.....###', '....###.', '#..###..', '.####...', '..##....', '.#.#....', '#.......'],
    bolt: ['....###.', '...###..', '..###...', '.######.', '...###..', '..###...', '.##.....', '##......'],
    gem: ['.######.', '##.##.##', '########', '.######.', '..####..', '...##...', '........', '........'],
    key: ['.###....', '#...#...', '#...#...', '.#######', '....#.##', '....#.#.', '........', '........'],
    pin: ['..####..', '.######.', '.######.', '..####..', '...##...', '...##...', '...#....', '........']
  };

  function pixelIcon(name, color, size) {
    const rows = PIXEL[name] || PIXEL.star;
    const px = size || 16;
    let rects = '';
    rows.forEach(function (row, y) {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      }
    });
    return '<svg class="px-icon" viewBox="0 0 8 8" width="' + px + '" height="' + px + '" fill="' + (color || 'currentColor') +
      '" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 본문: 빈 줄 = 문단, 줄바꿈 = <br>, **굵게** 만 허용 (나머지는 그대로 글자) */
  function richText(s) {
    if (!s) return '';
    return String(s).split(/\n\s*\n/).map(function (para) {
      const html = esc(para.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      return '<p>' + html + '</p>';
    }).join('');
  }

  /** 버전 비교 ("0.4.16" vs "0.5.0", "0.2.2 ~ 0.2.3" 은 뒤쪽 숫자 기준) */
  function versionKey(v) {
    if (!v) return [-1];
    const last = String(v).split('~').pop().trim();
    return last.split('.').map(function (n) { return parseInt(n, 10) || 0; });
  }
  function compareVersion(a, b) {
    const x = versionKey(a), y = versionKey(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  /** 최신이 위로: 고정 공지 → 날짜 → 버전 */
  function sortNotices(list) {
    return list.slice().sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      const da = a.date || '', db = b.date || '';
      if (da !== db) {
        if (!da) return 1;
        if (!db) return -1;
        return db < da ? -1 : 1;
      }
      return compareVersion(b.version, a.version);
    });
  }

  /** 오늘부터 7일 안에 올라온 글 = NEW */
  function isFresh(n, days) {
    if (!n.date) return false;
    const d = new Date(n.date + 'T00:00:00');
    return (Date.now() - d.getTime()) / 86400000 <= (days || 7);
  }

  function formatDate(s) {
    if (!s) return '날짜 기록 없음';
    const p = s.split('-');
    return p[0] + '. ' + parseInt(p[1], 10) + '. ' + parseInt(p[2], 10) + '.';
  }

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(path + ' 를 불러오지 못했어요 (' + res.status + ')');
    return res.json();
  }

  global.SZ = { TAGS: TAGS, TAG_ORDER: TAG_ORDER, pixelIcon: pixelIcon, esc: esc, richText: richText,
    compareVersion: compareVersion, sortNotices: sortNotices, isFresh: isFresh, formatDate: formatDate, loadJson: loadJson };
})(window);

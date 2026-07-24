const pptxgen = require('pptxgenjs');

// ─── palette (from NuneDDine web theme) ───────────────────────────────────────
const C = {
  darkBg:    '071410',   // near-black dark background
  darkSurf:  '0D1E1A',   // dark surface
  darkSurf2: '112820',
  accent:    '0D9488',   // teal accent (light mode)
  accentBr:  '2DD4BF',   // bright teal (dark mode accent)
  textDark:  '0F2922',   // dark text
  textLight: 'E0F5F2',   // light text on dark bg
  textMuted: '6BA89A',
  positive:  '16A34A',
  negative:  'EF4444',
  white:     'FFFFFF',
  lightBg:   'F2FAF8',   // light page bg
  surface:   'FFFFFF',
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function darkSlide(pres, opts = {}) {
  const s = pres.addSlide();
  s.background = { color: opts.bg || C.darkBg };
  return s;
}
function lightSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.lightBg };
  return s;
}

// title + optional subtitle centered, for dark slides
function addCenterTitle(slide, title, sub) {
  slide.addText(title, {
    x: 0.5, y: sub ? 1.8 : 2.2, w: 9, h: 1.4,
    fontSize: 44, bold: true, color: C.textLight,
    fontFace: 'Cambria', align: 'center', margin: 0,
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.5, y: 3.3, w: 9, h: 0.7,
      fontSize: 18, color: C.accentBr,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
  }
}

// left-aligned slide title for content slides
function addSlideTitle(slide, title) {
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 28, bold: true, color: C.textDark,
    fontFace: 'Cambria', margin: 0,
  });
}

// section divider: dark slide with section number + title
function addSectionDivider(pres, num, title) {
  const s = darkSlide(pres);
  // large number
  s.addText(`0${num}`, {
    x: 0.5, y: 0.8, w: 2.5, h: 2,
    fontSize: 96, bold: true, color: C.accentBr,
    fontFace: 'Cambria', margin: 0, transparency: 30,
  });
  s.addText(title, {
    x: 0.5, y: 2.9, w: 9, h: 0.9,
    fontSize: 34, bold: true, color: C.textLight,
    fontFace: 'Cambria', margin: 0,
  });
  return s;
}

// teal accent pill shape
function addPill(slide, x, y, w, h, color) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: color || C.accent },
    line: { color: color || C.accent, width: 0 },
    rectRadius: 0.15,
  });
}

// bullet list helper
function addBullets(slide, items, x, y, w, h, opts = {}) {
  const rows = items.map((item, i) => ({
    text: item,
    options: {
      fontSize: opts.fontSize || 15,
      color: opts.color || C.textDark,
      fontFace: 'Calibri',
      bullet: true,
      breakLine: i < items.length - 1,
      paraSpaceAfter: 6,
    },
  }));
  slide.addText(rows, { x, y, w, h, margin: 0 });
}

// stat callout box
function addStat(slide, x, y, value, label, dark) {
  const bg = dark ? C.darkSurf2 : 'E8F6F3';
  const vc = dark ? C.accentBr : C.accent;
  const lc = dark ? C.textLight : C.textDark;
  slide.addShape('roundRect', {
    x, y, w: 2.8, h: 1.3,
    fill: { color: bg }, line: { color: vc, width: 1 },
    rectRadius: 0.15,
    shadow: { type: 'outer', color: '000000', blur: 4, offset: 2, angle: 45, opacity: 0.08 },
  });
  slide.addText(value, {
    x, y: y + 0.08, w: 2.8, h: 0.72,
    fontSize: 32, bold: true, color: vc,
    fontFace: 'Cambria', align: 'center', margin: 0,
  });
  slide.addText(label, {
    x, y: y + 0.82, w: 2.8, h: 0.38,
    fontSize: 11, color: lc,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });
}

// ─── PRESENTATION ─────────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10" × 5.625"
pres.title = 'NuneDDine 프로젝트 발표';
pres.author = 'NuneDDine Team';

// ══════════════════════════════════════════════════════════════════════════════
// Slide 1 — Cover
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide(pres);
  // background circuit-like decorative circles
  for (const [cx, cy, r] of [[8.5,0.8,1.8],[9.2,2.2,1.0],[7.8,4.8,0.9]]) {
    s.addShape('ellipse', {
      x: cx - r, y: cy - r, w: r*2, h: r*2,
      fill: { color: C.accent, transparency: 88 },
      line: { color: C.accent, width: 1, transparency: 70 },
    });
  }
  // logo text
  s.addText('Nune', {
    x: 2.5, y: 1.4, w: 2.5, h: 0.9,
    fontSize: 40, bold: true, color: C.textLight,
    fontFace: 'Cambria', margin: 0, align: 'right',
  });
  s.addText('DD', {
    x: 5.0, y: 1.4, w: 1.1, h: 0.9,
    fontSize: 40, bold: true, color: C.accentBr,
    fontFace: 'Cambria', margin: 0, align: 'center',
  });
  s.addText('ine', {
    x: 6.1, y: 1.4, w: 1.5, h: 0.9,
    fontSize: 40, bold: true, color: C.textLight,
    fontFace: 'Cambria', margin: 0, align: 'left',
  });

  s.addText('AI 기반 주식 분석 + 다마고치 하드웨어 연동 서비스', {
    x: 0.8, y: 2.5, w: 8.4, h: 0.6,
    fontSize: 17, color: C.accentBr,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });

  // tag row
  for (const [i, tag] of ['React + Vite', 'FastAPI', 'Firebase', 'FinBERT', 'ESP32 + BLE'].entries()) {
    const x = 0.7 + i * 1.8;
    addPill(s, x, 3.3, 1.55, 0.36, C.accent);
    s.addText(tag, {
      x, y: 3.3, w: 1.55, h: 0.36,
      fontSize: 11, bold: true, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
  }

  s.addText('2025  ·  IoT 기반 융합 서비스 개발', {
    x: 0.5, y: 4.9, w: 9, h: 0.4,
    fontSize: 12, color: C.textMuted,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 2 — 목차
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres);
  addSlideTitle(s, '목차');

  const items = [
    ['01', '프로젝트 개요 및 주제 선정 이유'],
    ['02', '팀 구성 및 역할 분담'],
    ['03', '기술 스택'],
    ['04', '시스템 아키텍처'],
    ['05', '주요 기능 ① — AI 종목 분석'],
    ['06', '주요 기능 ② — 인기 / 관심 종목'],
    ['07', '주요 기능 ③ — 커뮤니티'],
    ['08', '주요 기능 ④ — 하드웨어 연동 (다마고치)'],
    ['09', '개발 과정 및 트러블슈팅'],
    ['10', '시연'],
    ['11', '회고 및 개선 방향'],
  ];

  const col1 = items.slice(0, 6);
  const col2 = items.slice(6);

  col1.forEach(([num, label], i) => {
    const y = 1.25 + i * 0.65;
    addPill(s, 0.5, y + 0.04, 0.46, 0.38, C.accent);
    s.addText(num, { x: 0.5, y: y + 0.04, w: 0.46, h: 0.38, fontSize: 12, bold: true, color: C.white, fontFace: 'Calibri', align: 'center', margin: 0 });
    s.addText(label, { x: 1.06, y, w: 3.9, h: 0.5, fontSize: 14, color: C.textDark, fontFace: 'Calibri', margin: 0 });
  });

  col2.forEach(([num, label], i) => {
    const y = 1.25 + i * 0.65;
    addPill(s, 5.2, y + 0.04, 0.46, 0.38, C.accent);
    s.addText(num, { x: 5.2, y: y + 0.04, w: 0.46, h: 0.38, fontSize: 12, bold: true, color: C.white, fontFace: 'Calibri', align: 'center', margin: 0 });
    s.addText(label, { x: 5.76, y, w: 3.9, h: 0.5, fontSize: 14, color: C.textDark, fontFace: 'Calibri', margin: 0 });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 3 — 01 프로젝트 개요
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 1, '프로젝트 개요 및 주제 선정 이유');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '왜 NuneDDine인가?');

  // left: problem cards
  const problems = [
    { icon: '📰', title: '뉴스는 많지만 해석이 어렵다', desc: '금융 뉴스는 전문 용어가 많아 개인 투자자가 종목 영향을 판단하기 어렵다.' },
    { icon: '📊', title: '데이터는 있지만 인사이트가 없다', desc: '주가 데이터는 넘치지만 "왜 올랐는지" 설명해주는 서비스는 드물다.' },
    { icon: '🔔', title: '항상 스마트폰을 볼 수 없다', desc: '장 중에도 다른 일을 해야 하는 상황에서 직관적인 현황 파악이 필요하다.' },
  ];

  problems.forEach(({ icon, title, desc }, i) => {
    const y = 1.2 + i * 1.35;
    s.addShape('roundRect', {
      x: 0.5, y, w: 4.2, h: 1.18,
      fill: { color: 'E8F6F3' }, line: { color: C.accent, width: 0.5 },
      rectRadius: 0.12,
    });
    s.addText(icon + '  ' + title, {
      x: 0.7, y: y + 0.1, w: 3.9, h: 0.38,
      fontSize: 14, bold: true, color: C.textDark,
      fontFace: 'Calibri', margin: 0,
    });
    s.addText(desc, {
      x: 0.7, y: y + 0.5, w: 3.9, h: 0.6,
      fontSize: 11, color: C.textDark,
      fontFace: 'Calibri', margin: 0,
    });
  });

  // right: solution arrow
  s.addText('→', {
    x: 4.9, y: 2.2, w: 0.5, h: 0.6,
    fontSize: 36, bold: true, color: C.accentBr,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });

  // right: solution box
  s.addShape('roundRect', {
    x: 5.5, y: 1.1, w: 4.0, h: 3.8,
    fill: { color: C.accent }, line: { color: C.accent, width: 0 },
    rectRadius: 0.2,
    shadow: { type: 'outer', color: '000000', blur: 12, offset: 4, angle: 45, opacity: 0.15 },
  });
  s.addText('NuneDDine', {
    x: 5.5, y: 1.35, w: 4.0, h: 0.65,
    fontSize: 26, bold: true, color: C.white,
    fontFace: 'Cambria', align: 'center', margin: 0,
  });
  const solutions = [
    'FinBERT로 뉴스 감성 분석',
    'Prophet 7일 가격 예측',
    'XAI 요인별 영향도 시각화',
    'Critic Agent 투자 의견 생성',
    'ESP32 다마고치로 직관적 알림',
  ];
  solutions.forEach((sol, i) => {
    s.addText('✓  ' + sol, {
      x: 5.7, y: 2.2 + i * 0.52, w: 3.6, h: 0.44,
      fontSize: 13, color: C.white,
      fontFace: 'Calibri', margin: 0,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 4 — 02 팀 구성
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 2, '팀 구성 및 역할 분담');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '팀 구성 및 역할 분담');

  const members = [
    { name: '희선', role: 'A · 시스템 / 백엔드 리더', tasks: ['FastAPI 전체 API 구조', '에이전트 orchestration', '결과 통합 JSON', '전체 연결 책임자'], accent: '065A82' },
    { name: '유빈', role: 'B · 데이터 수집', tasks: ['yfinance 주가 수집', 'NewsAPI / RSS 크롤링', '데이터 전처리', 'stock_price + news API'], accent: '6D2E46' },
    { name: '연우', role: 'C · AI / ML', tasks: ['FinBERT 감성 분석', 'Prophet 가격 예측', 'uncertainty 계산', 'confidence_score 반환'], accent: '2C5F2D' },
    { name: '채민', role: 'D · 프론트엔드', tasks: ['React / Vite UI', '차트 · 신뢰도 시각화', 'CSS 디자인 시스템', 'ESP32 다마고치 / BLE'], accent: C.accent },
  ];

  members.forEach(({ name, role, tasks, accent }, i) => {
    const x = 0.35 + i * 2.35;
    s.addShape('roundRect', {
      x, y: 1.15, w: 2.18, h: 4.05,
      fill: { color: 'FFFFFF' },
      line: { color: accent, width: 1.2 },
      rectRadius: 0.15,
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.09 },
    });
    // avatar circle
    s.addShape('ellipse', {
      x: x + 0.59, y: 1.32, w: 1.0, h: 1.0,
      fill: { color: accent },
      line: { color: accent, width: 0 },
    });
    s.addText(name[0], {
      x: x + 0.59, y: 1.32, w: 1.0, h: 1.0,
      fontSize: 28, bold: true, color: C.white,
      fontFace: 'Cambria', align: 'center', margin: 0,
    });
    s.addText(name, {
      x, y: 2.48, w: 2.18, h: 0.38,
      fontSize: 15, bold: true, color: C.textDark,
      fontFace: 'Cambria', align: 'center', margin: 0,
    });
    s.addText(role, {
      x, y: 2.87, w: 2.18, h: 0.36,
      fontSize: 10, color: accent,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
    tasks.forEach((t, j) => {
      s.addText('· ' + t, {
        x: x + 0.1, y: 3.3 + j * 0.46, w: 1.98, h: 0.4,
        fontSize: 11, color: C.textDark,
        fontFace: 'Calibri', margin: 0,
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 5 — 03 기술 스택
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 3, '기술 스택');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '기술 스택');

  const stacks = [
    { cat: 'Frontend', color: C.accent, items: ['React 18 + Vite', 'Firebase Auth / Firestore', 'CSS Custom Properties', 'Recharts'] },
    { cat: 'Backend', color: '065A82', items: ['FastAPI (Python)', 'Firebase Admin SDK', 'yfinance / requests', 'uvicorn'] },
    { cat: 'AI / ML', color: '6D2E46', items: ['FinBERT (감성분석)', 'Prophet (시계열 예측)', 'Shapley XAI', 'Critic Agent (LLM)'] },
    { cat: 'Hardware', color: '2C5F2D', items: ['ESP32-C3 (BLE)', 'ST7789 240×240 TFT', 'BLE ble_sender.py', 'Passive Buzzer'] },
  ];

  stacks.forEach(({ cat, color, items }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.75;
    const y = 1.1 + row * 2.15;
    s.addShape('roundRect', {
      x, y, w: 4.4, h: 1.95,
      fill: { color: 'FFFFFF' }, line: { color: color, width: 1 },
      rectRadius: 0.14,
      shadow: { type: 'outer', color: '000000', blur: 5, offset: 2, angle: 45, opacity: 0.07 },
    });
    addPill(s, x + 0.15, y + 0.14, 1.5, 0.36, color);
    s.addText(cat, {
      x: x + 0.15, y: y + 0.14, w: 1.5, h: 0.36,
      fontSize: 12, bold: true, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
    items.forEach((item, j) => {
      const ix = x + 0.2 + (j % 2) * 2.1;
      const iy = y + 0.63 + Math.floor(j / 2) * 0.54;
      s.addText('▸ ' + item, {
        x: ix, y: iy, w: 2.0, h: 0.44,
        fontSize: 12, color: C.textDark,
        fontFace: 'Calibri', margin: 0,
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 6 — 04 시스템 아키텍처
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 4, '시스템 아키텍처');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '시스템 아키텍처');

  // flow: User → Frontend → Backend → AI / Firebase → Arduino
  const boxes = [
    { label: '사용자', sub: 'Web Browser', x: 0.3, y: 2.2, color: C.darkSurf },
    { label: 'Frontend', sub: 'React + Vite', x: 2.2, y: 2.2, color: C.accent },
    { label: 'Backend', sub: 'FastAPI', x: 4.1, y: 2.2, color: '065A82' },
    { label: 'AI / Data', sub: 'FinBERT · Prophet', x: 6.0, y: 1.0, color: '6D2E46' },
    { label: 'Firebase', sub: 'Auth · Firestore', x: 6.0, y: 3.4, color: 'C45628' },
    { label: 'Arduino', sub: 'ESP32 + ST7789', x: 8.0, y: 2.2, color: '2C5F2D' },
  ];

  boxes.forEach(({ label, sub, x, y, color }) => {
    s.addShape('roundRect', {
      x, y, w: 1.75, h: 0.9,
      fill: { color }, line: { color, width: 0 },
      rectRadius: 0.12,
      shadow: { type: 'outer', color: '000000', blur: 6, offset: 2, angle: 45, opacity: 0.15 },
    });
    s.addText(label, {
      x, y: y + 0.06, w: 1.75, h: 0.42,
      fontSize: 14, bold: true, color: C.white,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
    s.addText(sub, {
      x, y: y + 0.46, w: 1.75, h: 0.34,
      fontSize: 10, color: 'CCEBE8',
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
  });

  // arrows
  const arrows = [
    [2.0, 2.65, 2.2, 2.65],   // user→fe
    [3.95, 2.65, 4.1, 2.65],  // fe→be
    [5.85, 2.3, 6.0, 1.55],   // be→ai
    [5.85, 3.0, 6.0, 3.55],   // be→firebase
    [7.75, 1.45, 8.0, 2.45],  // ai→arduino
    [7.75, 3.85, 8.0, 2.85],  // firebase→arduino
  ];
  arrows.forEach(([x1, y1, x2, y2]) => {
    s.addShape('line', {
      x: x1, y: y1, w: x2 - x1, h: y2 - y1,
      line: { color: C.accentBr, width: 1.5, dashType: 'solid',
              endArrowType: 'arrow' },
    });
  });

  // BLE label
  s.addText('BLE', {
    x: 7.6, y: 2.55, w: 0.5, h: 0.28,
    fontSize: 10, color: C.accent,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 7 — 05 AI 종목 분석
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 5, '주요 기능 ① — AI 종목 분석');

{
  const s = lightSlide(pres);
  addSlideTitle(s, 'AI 종목 분석 파이프라인');

  // pipeline steps
  const steps = [
    { n: '1', title: '뉴스 수집', desc: 'RSS / API로\n실시간 뉴스 크롤링', color: '065A82' },
    { n: '2', title: 'FinBERT\n감성 분석', desc: 'Positive / Neutral\n/ Negative 점수화', color: C.accent },
    { n: '3', title: 'Prophet\n가격 예측', desc: '7일 후 종가\n신뢰구간 포함', color: '6D2E46' },
    { n: '4', title: 'XAI\n요인 분석', desc: 'Shapley 값으로\n요인별 기여도', color: 'C45628' },
    { n: '5', title: 'Critic Agent\n의견 생성', desc: 'LLM이 투자\n의견 텍스트 생성', color: '2C5F2D' },
  ];

  steps.forEach(({ n, title, desc, color }, i) => {
    const x = 0.4 + i * 1.85;
    // connector
    if (i > 0) {
      s.addShape('line', {
        x: x - 0.18, y: 2.55, w: 0.18, h: 0,
        line: { color: C.accentBr, width: 1.5, endArrowType: 'arrow' },
      });
    }
    s.addShape('ellipse', {
      x: x + 0.43, y: 1.15, w: 0.9, h: 0.9,
      fill: { color }, line: { color, width: 0 },
      shadow: { type: 'outer', color: '000000', blur: 5, offset: 2, angle: 45, opacity: 0.15 },
    });
    s.addText(n, {
      x: x + 0.43, y: 1.15, w: 0.9, h: 0.9,
      fontSize: 22, bold: true, color: C.white,
      fontFace: 'Cambria', align: 'center', margin: 0,
    });
    s.addText(title, {
      x: x - 0.08, y: 2.18, w: 1.92, h: 0.7,
      fontSize: 13, bold: true, color: color,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
    s.addText(desc, {
      x: x - 0.08, y: 2.9, w: 1.92, h: 0.7,
      fontSize: 11, color: C.textDark,
      fontFace: 'Calibri', align: 'center', margin: 0,
    });
  });

  // result box
  s.addShape('roundRect', {
    x: 0.5, y: 3.8, w: 9.0, h: 1.5,
    fill: { color: C.darkBg }, line: { color: C.accent, width: 1 },
    rectRadius: 0.15,
  });
  s.addText('결과 →  분석 탭에서 감성 점수 · 예측 차트 · XAI 바 · Critic 텍스트 원스톱 제공', {
    x: 0.5, y: 3.8, w: 9.0, h: 1.5,
    fontSize: 15, color: C.accentBr,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 8 — 06 인기/관심 종목
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 6, '주요 기능 ② — 인기 / 관심 종목');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '인기 종목 & 관심 종목 관리');

  // left col — 인기 종목
  s.addText('인기 종목', {
    x: 0.5, y: 1.1, w: 4.2, h: 0.44,
    fontSize: 18, bold: true, color: C.accent,
    fontFace: 'Cambria', margin: 0,
  });
  const rankItems = ['실시간 조회수 기반 랭킹', '현재가 · 등락률 표시', '분석 바로가기 버튼', 'Firebase onSnapshot 실시간 동기화'];
  addBullets(s, rankItems, 0.5, 1.65, 4.2, 2.0);

  // right col — 관심 종목
  s.addText('관심 종목', {
    x: 5.3, y: 1.1, w: 4.2, h: 0.44,
    fontSize: 18, bold: true, color: '6D2E46',
    fontFace: 'Cambria', margin: 0,
  });
  const favItems = ['매수가 · 매수 수량 입력 관리', '총 손익 금액 · 손익률 계산', '탭 전환 (전체 / 수익 / 손실)', 'Firestore에 실시간 저장'];
  addBullets(s, favItems, 5.3, 1.65, 4.2, 2.0);

  // divider
  s.addShape('line', {
    x: 5.0, y: 1.1, w: 0, h: 3.8,
    line: { color: C.accent, width: 0.5, dashType: 'dash' },
  });

  // stat callouts
  addStat(s, 0.5, 3.8, 'Firebase', 'onSnapshot 실시간', false);
  addStat(s, 3.6, 3.8, '손익 계산', '(현재가 - 매수가) × 수량', false);
  addStat(s, 6.7, 3.8, '탭 필터', '전체 / 수익 / 손실', false);
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 9 — 07 커뮤니티
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 7, '주요 기능 ③ — 커뮤니티');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '커뮤니티 기능');

  const features = [
    { icon: '💬', title: '종목별 토론 게시판', desc: '특정 종목에 대한 투자자들의 의견과 분석을 공유하는 커뮤니티 공간' },
    { icon: '👍', title: '좋아요 / 댓글', desc: '게시글에 반응하고 댓글로 심층 토론 가능' },
    { icon: '🔐', title: 'Firebase Auth 연동', desc: '로그인한 사용자만 작성 가능, 프로필 기반 표시' },
    { icon: '📈', title: '감성 통계 연동', desc: '커뮤니티 내 반응을 AI 감성 분석과 함께 보여줌' },
  ];

  features.forEach(({ icon, title, desc }, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.75;
    const y = 1.15 + row * 2.1;
    s.addShape('roundRect', {
      x, y, w: 4.4, h: 1.88,
      fill: { color: 'FFFFFF' }, line: { color: C.accent, width: 0.6 },
      rectRadius: 0.14,
      shadow: { type: 'outer', color: '000000', blur: 5, offset: 2, angle: 45, opacity: 0.07 },
    });
    s.addText(icon, {
      x: x + 0.18, y: y + 0.2, w: 0.7, h: 0.6,
      fontSize: 26, fontFace: 'Calibri', align: 'center', margin: 0,
    });
    s.addText(title, {
      x: x + 0.95, y: y + 0.18, w: 3.3, h: 0.42,
      fontSize: 15, bold: true, color: C.accent,
      fontFace: 'Calibri', margin: 0,
    });
    s.addText(desc, {
      x: x + 0.95, y: y + 0.62, w: 3.3, h: 1.1,
      fontSize: 12, color: C.textDark,
      fontFace: 'Calibri', margin: 0,
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 10 — 08 하드웨어 연동
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 8, '주요 기능 ④ — 하드웨어 연동 (다마고치)');

{
  const s = darkSlide(pres, { bg: C.darkSurf });
  addCenterTitle(s, '', '');
  s.addText('다마고치 하드웨어 연동', {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 28, bold: true, color: C.textLight,
    fontFace: 'Cambria', margin: 0,
  });

  // left: spec
  const specs = [
    ['MCU', 'ESP32-C3'],
    ['디스플레이', 'ST7789  240×240'],
    ['통신', 'BLE (bleak)'],
    ['알림', 'Passive Buzzer'],
    ['최대 종목', '6개'],
    ['갱신 주기', '5분'],
  ];
  specs.forEach(([k, v], i) => {
    const y = 1.1 + i * 0.65;
    s.addText(k, { x: 0.5, y, w: 1.8, h: 0.5, fontSize: 13, color: C.textMuted, fontFace: 'Calibri', margin: 0 });
    s.addText(v, { x: 2.4, y, w: 2.5, h: 0.5, fontSize: 13, bold: true, color: C.accentBr, fontFace: 'Calibri', margin: 0 });
  });

  // right: emotion table
  s.addText('감정 상태 매핑', {
    x: 5.2, y: 1.0, w: 4.3, h: 0.45,
    fontSize: 16, bold: true, color: C.accentBr,
    fontFace: 'Cambria', margin: 0,
  });
  const emotions = [
    ['HAPPY',      '+5% 초과',       '초록'],
    ['SEMI-HAPPY', '+2% ~ +5%',      '연두'],
    ['NORMAL',     '-2% ~ +2%',      '흰색'],
    ['TIRED',      '-5% ~ -2%',      '노랑'],
    ['CRYING',     '-10% ~ -5%',     '하늘'],
    ['SICK',       '-10% 이하',      '빨강'],
  ];
  const eColors = [C.positive, '34D399', 'CCCCCC', 'F59E0B', '22D3EE', C.negative];
  emotions.forEach(([state, range, _], i) => {
    const y = 1.55 + i * 0.58;
    s.addShape('ellipse', {
      x: 5.2, y: y + 0.08, w: 0.36, h: 0.36,
      fill: { color: eColors[i] }, line: { color: eColors[i], width: 0 },
    });
    s.addText(state, {
      x: 5.65, y, w: 1.65, h: 0.5,
      fontSize: 12, bold: true, color: eColors[i],
      fontFace: 'Calibri', margin: 0,
    });
    s.addText(range, {
      x: 7.35, y, w: 2.1, h: 0.5,
      fontSize: 12, color: C.textLight,
      fontFace: 'Calibri', margin: 0,
    });
  });

  // BLE data format
  s.addShape('roundRect', {
    x: 0.5, y: 4.8, w: 9.0, h: 0.6,
    fill: { color: C.darkBg }, line: { color: C.accent, width: 0.8 },
    rectRadius: 0.1,
  });
  s.addText('BLE 포맷:  "삼성전자,+1.23,71000.00,W,68000.00,10|카카오,..."  (|로 종목 구분)', {
    x: 0.5, y: 4.8, w: 9.0, h: 0.6,
    fontSize: 11, color: C.accentBr,
    fontFace: 'Courier New', align: 'center', margin: 0,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 11 — 09 개발 과정 & 트러블슈팅
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 9, '개발 과정 및 트러블슈팅');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '주요 트러블슈팅');

  const issues = [
    { problem: 'Firebase 키 노출', solution: 'GCP Console에서 즉시 키 삭제 후 재발급, firebase_config.json을 .gitignore에 추가', tag: '보안' },
    { problem: 'BLE MTU 초과', solution: '512바이트 청크 분할 전송으로 해결', tag: '하드웨어' },
    { problem: 'ST7735 → ST7789 교체', solution: '해상도 240×240 맞게 좌표/폰트 사이즈 전면 재조정', tag: '디스플레이' },
    { problem: 'ranking-info flex 충돌', solution: '관심종목 info 영역에 inline style fixed width 적용', tag: 'CSS' },
  ];

  const tagColors = { '보안': C.negative, '하드웨어': '2C5F2D', '디스플레이': C.accent, 'CSS': '6D2E46' };

  issues.forEach(({ problem, solution, tag }, i) => {
    const y = 1.15 + i * 1.05;
    const tc = tagColors[tag] || C.accent;
    s.addShape('roundRect', {
      x: 0.5, y, w: 9.0, h: 0.92,
      fill: { color: 'FFFFFF' }, line: { color: tc, width: 0.7 },
      rectRadius: 0.12,
      shadow: { type: 'outer', color: '000000', blur: 4, offset: 1, angle: 45, opacity: 0.06 },
    });
    addPill(s, 0.65, y + 0.26, 1.0, 0.32, tc);
    s.addText(tag, { x: 0.65, y: y + 0.26, w: 1.0, h: 0.32, fontSize: 11, bold: true, color: C.white, fontFace: 'Calibri', align: 'center', margin: 0 });
    s.addText('⚠ ' + problem, { x: 1.78, y: y + 0.08, w: 3.4, h: 0.36, fontSize: 13, bold: true, color: tc, fontFace: 'Calibri', margin: 0 });
    s.addText('→ ' + solution, { x: 1.78, y: y + 0.47, w: 7.55, h: 0.36, fontSize: 12, color: C.textDark, fontFace: 'Calibri', margin: 0 });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 12 — 10 시연
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 10, '시연');

{
  const s = darkSlide(pres);
  addCenterTitle(s, '라이브 시연', '실제 서비스를 직접 보여드립니다');

  const demos = [
    { icon: '🖥', label: '웹 분석 화면', sub: '인기 종목 → 분석 탭' },
    { icon: '❤️', label: '관심 종목 손익', sub: '매수가 입력 → 손익 표시' },
    { icon: '🤖', label: '다마고치', sub: 'BLE 연결 → 감정 변화' },
  ];
  demos.forEach(({ icon, label, sub }, i) => {
    const x = 1.0 + i * 2.9;
    s.addShape('roundRect', {
      x, y: 3.5, w: 2.5, h: 1.5,
      fill: { color: C.darkSurf2 }, line: { color: C.accentBr, width: 1 },
      rectRadius: 0.15,
    });
    s.addText(icon, { x, y: 3.6, w: 2.5, h: 0.55, fontSize: 26, fontFace: 'Calibri', align: 'center', margin: 0 });
    s.addText(label, { x, y: 4.18, w: 2.5, h: 0.35, fontSize: 13, bold: true, color: C.accentBr, fontFace: 'Calibri', align: 'center', margin: 0 });
    s.addText(sub, { x, y: 4.55, w: 2.5, h: 0.3, fontSize: 10, color: C.textMuted, fontFace: 'Calibri', align: 'center', margin: 0 });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 13 — 11 회고 및 개선 방향
// ══════════════════════════════════════════════════════════════════════════════
addSectionDivider(pres, 11, '회고 및 개선 방향');

{
  const s = lightSlide(pres);
  addSlideTitle(s, '회고 및 개선 방향');

  // left: 잘 된 점
  s.addText('✅  잘 된 점', { x: 0.5, y: 1.1, w: 4.3, h: 0.44, fontSize: 17, bold: true, color: C.positive, fontFace: 'Cambria', margin: 0 });
  addBullets(s, [
    'AI 파이프라인 end-to-end 완성',
    'BLE 실시간 연동 성공',
    '통일된 UI/UX 디자인 시스템',
    'Firebase 실시간 동기화 구현',
  ], 0.5, 1.65, 4.3, 2.5, { color: C.textDark });

  // right: 개선 방향
  s.addText('🔧  개선 방향', { x: 5.2, y: 1.1, w: 4.3, h: 0.44, fontSize: 17, bold: true, color: C.accent, fontFace: 'Cambria', margin: 0 });
  addBullets(s, [
    '모바일 반응형 레이아웃 추가',
    '더 많은 종목 / 글로벌 시장 확대',
    '푸시 알림 (FCM) 연동',
    '다마고치 캐릭터 애니메이션 다양화',
    'AI 모델 정확도 개선 (파인튜닝)',
  ], 5.2, 1.65, 4.3, 3.0, { color: C.textDark });

  // divider
  s.addShape('line', {
    x: 5.0, y: 1.1, w: 0, h: 3.6,
    line: { color: C.accent, width: 0.5, dashType: 'dash' },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Slide 14 — Closing
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide(pres);
  for (const [cx, cy, r] of [[1,5,2],[9.5,0.5,1.5],[5,2.8,4]]) {
    s.addShape('ellipse', {
      x: cx - r, y: cy - r, w: r*2, h: r*2,
      fill: { color: C.accent, transparency: 92 },
      line: { color: C.accent, width: 0.5, transparency: 80 },
    });
  }
  s.addText('감사합니다', {
    x: 0.5, y: 1.8, w: 9, h: 1.2,
    fontSize: 52, bold: true, color: C.textLight,
    fontFace: 'Cambria', align: 'center', margin: 0,
  });
  s.addText('NuneDDine', {
    x: 0.5, y: 3.1, w: 9, h: 0.7,
    fontSize: 22, color: C.accentBr,
    fontFace: 'Cambria', align: 'center', margin: 0,
  });
  s.addText('AI 기반 주식 분석 + 다마고치 하드웨어 연동 서비스', {
    x: 0.5, y: 3.85, w: 9, h: 0.5,
    fontSize: 14, color: C.textMuted,
    fontFace: 'Calibri', align: 'center', margin: 0,
  });
}

// ─── output ──────────────────────────────────────────────────────────────────
const OUT = '/Users/gimchaemin/Desktop/비교과/it_26/NuneDDine_발표.pptx';
pres.writeFile({ fileName: OUT }).then(() => console.log('✅ saved:', OUT));

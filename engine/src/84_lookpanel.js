'use strict';
// ---- a panel to compare the light with and without each of its parts. Every part of the lighting reads a switch in G.look;
//      the buttons flip them, and two presets set them all: the plain light the engine started from, and everything on.
//      L hides the panel. To make something new comparable, add a key to G.look, read it where the effect is made, and list it in PARTS. ----
const LookPanel = (() => {
  const PARTS = [
    ['shadows', '그림자', '해가 드리우는 그림자'],
    ['contact', '접촉 음영', '바위와 벌통 받침이 지면에 닿는 곳에 생기는 짧은 음영'],
    ['air', '공기', '거리와 높이에 따른 안개, 해 쪽으로 밝아지는 대기'],
    ['bounce', '땅의 되비침', '해의 색 × 땅의 색을 아래쪽 보조광에 더함 (눈이 쌓이면 희어짐)'],
    ['field', '빛 필드', '숲 아래 하늘빛 가림 + 해 받은 숲이 옆으로 돌려주는 빛'],
    ['surface', '젖은 노면', '차 바퀴 자국과 지면의 낮은 곳에 고인 물, 하늘 반사와 빗방울 물결'],
    ['shafts', '빛기둥', '해가 낮을 때 나무·능선 사이로 새는 빛줄기'],
    ['bloom', '블룸', '흰색보다 밝은 곳이 번지는 빛'],
    ['adapt', '노출 적응', '밤에 열리고 낮과 눈 위에서 조이는 노출'],
    ['film', '필름', 'ACES 톤 곡선, 비네트, 색 번짐, 그레인'],
  ];
  const btn = {}, css = 'font:600 12px/1.3 "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f6ead0;border:1px solid rgba(243,217,189,.25);border-radius:8px;padding:5px 9px;cursor:pointer;text-align:left;';
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:14px;top:12px;z-index:6;display:flex;flex-direction:column;gap:5px;background:rgba(14,12,10,.6);padding:9px;border-radius:11px;border:1px solid rgba(243,217,189,.18);max-width:190px;max-height:calc(100dvh - 24px);box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain';
  const title = document.createElement('div'); title.textContent = '라이팅 비교 (L)'; title.style.cssText = 'font:700 12px "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif;color:#f6ead0;opacity:.8;margin-bottom:2px'; box.appendChild(title);
  const paint = () => { for (const [k, name] of PARTS) { const on = G.look[k]; btn[k].textContent = (on ? '● ' : '○ ') + name; btn[k].style.background = on ? 'rgba(232,181,74,.28)' : 'rgba(14,12,10,.4)'; btn[k].style.opacity = on ? 1 : .7; } };
  const make = (text, fn, tip) => { const b = document.createElement('button'); b.textContent = text; b.title = tip || ''; b.style.cssText = css + 'background:rgba(14,12,10,.4)'; b.addEventListener('click', e => { e.stopPropagation(); fn(); paint(); b.blur(); }); b.addEventListener('pointerdown', e => e.stopPropagation()); box.appendChild(b); return b; };
  const all = v => { for (const [k] of PARTS) G.look[k] = v; };
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:5px'; box.appendChild(row);
  const preset = (text, fn, tip) => { const b = make(text, fn, tip); b.style.flex = '1'; b.style.textAlign = 'center'; row.appendChild(b); };
  preset('기본 조명', () => { all(false); G.look.shadows = true; }, '해 하나, 하늘·땅 보조광, 그림자만. 나머지는 모두 끔');
  preset('전부 켜기', () => all(true), '지금 엔진의 라이팅 전부');
  for (const [k, name, tip] of PARTS) btn[k] = make(name, () => { G.look[k] = !G.look[k]; }, tip);
  function build() { document.body.appendChild(box); paint(); if (Q.has('nopanel')) box.style.display = 'none'; { const q = Q.get('look'); if (q === 'plain') { all(false); G.look.shadows = true; paint(); } } }
  addEventListener('keydown', e => { if (e.code === 'KeyL' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) box.style.display = box.style.display === 'none' ? 'flex' : 'none'; });
  return { build, paint, all };
})();

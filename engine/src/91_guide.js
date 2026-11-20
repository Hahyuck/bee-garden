'use strict';
// ---- the guide, inside the engine: H opens a drawer that explains how to use it, in five parts. Each example shows its code,
//      and where it can, a button runs that very code on the world behind the drawer. To add an example, add an entry to PARTS. ----
const Guide = (() => {
  const AIM = 'const c = G.camera, d = c.getWorldDirection(new THREE.Vector3());\n';
  const PARTS = [
    { t: '1. 둘러보기', lead: '이 엔진은 세계 하나와, 그 안에 있는 방법(모드) 여러 개로 이뤄져 있습니다. 숫자 키로 모드를 바꾸고, 이 안내는 H로 여닫습니다.', ex: [
      { t: '모드 바꾸기', d: '1 자유 비행 · 2 벌 · 3 FPS · 4 레이싱 · 5 경비행 · 6 배 · 7 잠수함 · 8 낚시. 화면 왼쪽 위 목록에서도 고를 수 있습니다.', code: "Modes.set('drive');", run: 1 },
      { t: '해안 항해', d: 'W/S로 전후진하고 A/D로 조타해 부표를 차례로 지납니다.', code: "Modes.set('boat');", run: 1 },
      { t: '산호초 잠항', d: 'Q 잠항, E 부상, P 잠망경입니다. 잠망경에서 드래그로 둘러보고 Z로 배율을 바꿉니다.', code: "Modes.set('sub');", run: 1 },
      { t: '내 게임 만들기', d: '상단의 게임 비주얼에서 화면 표현을 고르세요. GLB 파일은 시스템 메뉴의 도구와 설정에서 추가합니다. 만들고 싶은 내용을 적고 제작 프롬프트 복사를 누르면 저장소 링크와 설정을 함께 가져갈 수 있습니다.' },
      { t: '자유 비행으로 돌아오기', d: 'W A S D 이동, 화면을 끌어서 둘러보기, Q E 높이, Shift 빠르게.', code: "Modes.set('free');", run: 1 },
      { t: '정원에서 캐릭터 조작', d: '위쪽 목록에서 사람이나 개구리 Froggy를 고르세요. W + Shift + Space로 달리면서 점프합니다. 높은 벽을 향해 전진하며 점프하면 잡고, 앞뒤로 오르내리거나 점프로 놓을 수 있습니다. WASD로 이동하고 Shift로 달리고 Space로 점프합니다. C를 누르면 앉거나 일어섭니다. 터치 화면에서는 왼쪽 스틱과 오른쪽 동작 버튼을 사용하세요.', code: "Modes.set('actors');", run: 1 },
      { t: '2D와 2.5D 시점', d: '게임 비주얼에서 2D나 2.5D를 선택하세요. 캐릭터 주변을 드래그해 회전하고 마우스 휠로 확대·축소할 수 있습니다. 2D의 클린 도트는 이동할 때 카메라를 픽셀 격자에 맞춥니다.' },
      { t: '해안의 바위와 흙', d: '정원 끝 바위로 돌아갑니다. 가까이 다가가 표면의 갈라진 결을 보고, 위쪽 숲으로 시선을 돌리면 오후 햇빛이 드는 방향을 읽을 수 있습니다.', code: 'Modes.visitOutcrop();\nG.day = 16.15;', run: 1 },
      { t: '벌의 눈으로 보기', d: '어안 렌즈와 자동 초점이 켜집니다. B를 누르면 겹눈으로 봅니다.', code: "Modes.set('bee');", run: 1 },
      { t: '주소로 시작 상태 정하기', d: '코드를 고치지 않고 장면을 고정합니다. 주소 뒤에 붙입니다.', code: '?mode=drive&day=17.5&still     해질녘에 멈춘 시간, 운전\n?weather=snow&day=9            아침, 눈\n?look=plain                    기본 조명만\n?low                           가벼운 설정' },
      { t: '8 바다낚시', d: '부교에 선 캐릭터가 낚싯대를 쥡니다. 낚싯대와 떡밥을 고른 뒤 A/D로 찌 방향을 정합니다. Space로 던지고 입질에 맞춰 다시 누르세요. 감는 동안 장력계를 보고 손을 떼면 줄이 풀립니다. 어망에서 어종과 무게를 확인하세요.', code: "Modes.set('fishing');", run: 1 },
    ] },
    { t: '2. 세계 바꾸기', lead: '시각, 날씨, 빛은 모두 값 하나로 바뀌고, 세계의 나머지(땅의 색, 접지력, 안개, 소리)가 그 값을 따라갑니다.', ex: [
      { t: '눈 내리게 하기', d: '기온이 내려가고 눈이 쌓이기 시작합니다. 20초쯤 지나면 땅이 덮입니다. 키로는 N.', code: "Weather.set('snow');", run: 1 },
      { t: '비와 폭풍', d: '구름이 덮이고 바람이 세지며, 흙이 젖고 도로가 미끄러워집니다. 키로는 I.', code: "Weather.set('rain');", run: 1 },
      { t: '비 갠 뒤 해안 도로', d: '해안 굽잇길을 낮게 바라봅니다. L 패널에서 젖은 노면을 누르면 바퀴 자국에 반사되는 하늘을 비교할 수 있습니다.', code: "Modes.set('free');\nModes.fly.p.set(-415.647, 12.942, -139.209);\nModes.fly.yaw = 1.593;\nModes.fly.pitch = -.232;\nG.day = 16.6;\nWeather.set('clear');\nWeather.S.wet = .95;\nWeather.S.pooled = .91;", run: 1 },
      { t: '맑은 날로', d: '눈이 녹으면서 땅을 적십니다. 키로는 K.', code: "Weather.set('clear');", run: 1 },
      { t: '해질녘으로', d: 'G.day가 시각(0~24)입니다. 키로는 [ 와 ], T는 시간 멈춤.', code: 'G.day = 17.6;', run: 1 },
      { t: '한밤으로', d: '달이 해를 이어받고, 노출이 천천히 열립니다.', code: 'G.day = 23;', run: 1 },
      { t: '아침으로', d: '해가 낮을 때는 물 위에 안개가 깔리고 나무 사이로 빛줄기가 샙니다.', code: 'G.day = 6.6;', run: 1 },
      { t: '라이팅을 부분별로 비교', d: '왼쪽 위 패널(L)의 버튼과 같은 일을 코드로 합니다.', code: 'G.look.bloom = !G.look.bloom;\nLookPanel.paint();', run: 1 },
      { t: '땅에 대해 묻기', d: '눈에 보이는 땅, 바퀴, 물리가 모두 이 함수 하나를 씁니다.', code: 'const [height, kind] = Island.surf(x, z);\n// kind: 0 아스팔트, 1 갓길, 2 풀밭, 3 모래' },
    ] },
    { t: '3. 물리와 효과', lead: '물리는 이미 돌고 있습니다. 물체를 놓기만 하면 중력, 충돌, 부력, 바람이 적용됩니다. 키로는 F 돌, G 상자, X 폭발.', ex: [
      { t: '상자 탑 쌓기', d: '보는 방향 8m 앞에 상자 12개를 쌓습니다.', code: AIM + 'const x = c.position.x + d.x * 8, z = c.position.z + d.z * 8, y = Math.max(Island.surf(x, z)[0], 0);\nPhys.prime(x, z);\nfor (let i = 0; i < 12; i++)\n  Phys.spawn(\'crate\', x + (i % 2) * .62, y + .3 + Math.floor(i / 2) * .52, z);', run: 1 },
      { t: '보는 곳에 폭발', d: '광선으로 맞은 곳을 찾아 터뜨립니다. 주변 물체가 날아가고 잠깐 밝아집니다.', code: AIM + 'const hit = Phys.ray(c.position, d, 150);\nif (hit) Phys.blast(hit.x, hit.y + .3, hit.z);', run: 1 },
      { t: '통 쏟기', d: '머리 위에서 통 15개를 떨어뜨립니다. 물에 떨어지면 뜹니다.', code: AIM + 'const x = c.position.x + d.x * 10, z = c.position.z + d.z * 10;\nPhys.prime(x, z);\nfor (let i = 0; i < 15; i++)\n  Phys.spawn(\'barrel\', x + Math.random() * 4 - 2, c.position.y + 6 + i * .9, z + Math.random() * 4 - 2, { color: i % 2 ? 0xb5332d : 0x2d6fb5 });', run: 1 },
      { t: '달의 중력', d: '물리 세계의 중력을 6분의 1로 줄입니다. 그 뒤에 폭발을 눌러 보세요.', code: 'Phys.world.gravity = { x: 0, y: -1.62, z: 0 };', run: 1 },
      { t: '지구의 중력으로', d: '', code: 'Phys.world.gravity = { x: 0, y: -9.81, z: 0 };', run: 1 },
      { t: '새 종류의 물체', d: '85_phys.js의 KIND에 한 줄을 더하면 Phys.spawn으로 놓을 수 있습니다. 밀도 80이면 물(1000)에 뜹니다.', code: "ball: { n: 60, geo: () => new THREE.SphereGeometry(.5, 24, 16), col: c => c.ball(.5),\n        rho: 80, fr: .6, re: .7, vol: .52, r: .5, area: .8, tint: 0xe84a3a }," },
    ] },
    { t: '4. 고쳐서 내 것으로', lead: '엔진은 src 폴더의 파일 묶음입니다. dev.html로 열면 파일을 고치고 새로고침하는 것만으로 반영됩니다.', ex: [
      { t: '숫자를 바꾸는 곳', d: 'src/02_config.js 하나에 차, 물리, 날씨, 하늘, 바다, 렌즈의 값이 모여 있습니다.', code: "sky:  { dayLength: 720, ... }      // 하루의 길이(초)\ncar:  { mass: 980, grip: [1.05, .78, .62, .5], ... }\nsea:  { level: 0, swell: .22, windSwell: .9 }\npost: { exposure: 1, bloom: 1, ... }" },
      { t: '지금 바로 바꿔 보기: 빙판 타이어', d: '설정값은 실행 중에도 바뀝니다. 아스팔트 접지력을 3분의 1로 줄이고 운전해 보세요.', code: "CFG.car.grip[0] = .35;\nModes.set('drive');", run: 1 },
      { t: '접지력 되돌리기', d: '', code: 'CFG.car.grip[0] = 1.05;', run: 1 },
      { t: '새 시스템 넣기', d: 'src/NN_name.js를 만들고 90_main.js의 STEPS에 한 줄을 더합니다. 숫자가 불러오는 순서입니다.', code: "const Name = (() => {\n  function build(scene) { /* 만들기 */ G.tick.push((t, dt) => { /* 매 프레임 */ }); }\n  return { build };\n})();\n\n// 90_main.js\n['이름', 1, async () => Name.build(scene)]," },
      { t: '새 모드(게임 규칙) 넣기', d: '모드는 들어올 때, 나갈 때, 매 프레임 할 일을 가진 객체입니다. step이 카메라를 놓고 화면 아래 한 줄을 돌려줍니다.', code: "Modes.add('mygame', {\n  name: '내 게임',\n  enter() { /* 새 판 준비 */ },\n  leave() {},\n  step(camera, dt) { /* 카메라, 규칙 */ return '점수 0'; },\n}, 'Digit0', '0');" },
      { t: '재질에 날씨 입히기', d: 'patch()로 표준 재질에 셰이더 조각을 끼웁니다. wxCover가 그 자리의 적설량을 돌려줍니다.', code: "patch(material, s => {\n  s.fHead(GLSL_NOISE + GLSL_WX);\n  s.f('#include <color_fragment>', `#include <color_fragment>\n    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.87, .9, .95), wxCover(vFogW, .8));`);\n}, 'my-roof');" },
      { t: '배포용 한 파일 만들기', d: '새 파일을 더했거나 웹에 올릴 때 한 번 돌립니다. index.html이 다시 만들어집니다.', code: 'python tools/build.py' },
    ] },
    { t: '5. 게임 엔진으로 활용하는 방법', lead: '지형, 날씨, 물리, 차량과 카메라를 조합해 장르를 구성합니다. V 모드에서 외부 GLB 캐릭터를 직접 조작하고, 샘플 메뉴에서 모델의 크기와 재질을 살펴볼 수 있습니다.', ex: [
      { t: '해안 레이싱', d: '운전석으로 다가가 E로 탑승합니다. 자동 변속으로 3개 체크포인트와 결승선을 통과합니다. O 운전석 문, W 가속, A/D 조향, Space 제동, 제동 중 조향으로 드리프트, R 코스 복귀입니다.', code: "Modes.set('drive');", run: 1 },
      { t: 'FPS 사격장', d: '마우스를 움직여 중앙 조준점으로 표적을 겨누세요. 화면 가장자리에 두면 계속 선회합니다. 왼쪽 클릭은 발사, 오른쪽 클릭이나 R은 재장전입니다. WASD로 이동하고 Space로 점프하며 C로 앉습니다. Esc로 일시정지하면 커서가 나타납니다. 계속하기를 클릭하면 다시 조준합니다.', code: "Modes.set('fps');", run: 1 },
      { t: '경비행', d: '활주로의 조종석으로 다가가 E로 탑승합니다. W/S 출력, 마우스 위·아래 또는 ↑/↓로 기수 조종, A/D 선회, 지상 Space 제동입니다. E로 하차하고 공중에서는 낙하산이 펼쳐집니다.', code: "Modes.set('flight');", run: 1 },
      { t: '3인칭 RPG', d: 'V 모드의 캐릭터 이동, 추적 카메라, 대기·걷기 전환을 활용할 수 있습니다. 여기에 상호작용, 대화와 인벤토리를 연결해 보세요.', code: '' },
      { t: '대화로 만들기', d: '이 엔진은 원하는 것을 말하면 Claude가 해당 파일을 고치는 방식으로 자랐습니다. 구체적으로, 보이는 대로 말할수록 결과가 좋습니다.', code: '"차가 너무 미끄러워"                → 02_config.js의 접지력 조정\n"밤에 전조등이 켜지게 해 줘"         → 87_drive.js에 조명 추가\n"해안 도로에 헤어핀을 두 개 넣어 줘" → 42_island.js의 도로 수정\n"가지 끝이 보라색으로 보여"          → 원인을 찾아 렌즈 값 수정' },
      { t: '다음에 키울 강점', d: '세계를 코드가 아닌 데이터 파일 하나로 적으면 세 가지가 한꺼번에 됩니다: 대화로 물체를 놓는 월드 빌딩, "움직인다, 무게는 얼마"라고만 적으면 붙는 물리, 불러온 GLB에 그림자·충돌·눈 쌓임이 자동으로 입혀지는 환경. 아직 만들지 않았습니다.', code: '' },
      { t: '알고 써야 할 한계', d: '브라우저에서 도는 엔진이라 편집기와 콘솔 출시 경로가 없습니다. 빛은 추적이 아닌 근사입니다. 세계는 섬 하나(약 1km) 크기에 맞춰져 있습니다. 조작감과 소리는 사람이 직접 해 봐야 알 수 있습니다.', code: '' },
    ] },
  ];
  const F = '"Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif', el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text !== undefined) e.textContent = text; return e; };
  const box = el('div', `position:fixed;right:0;top:0;bottom:0;width:min(440px,92vw);z-index:8;display:none;flex-direction:column;background:rgba(12,11,9,.9);border-left:1px solid rgba(243,217,189,.2);color:#f3e6d2;font:500 13px/1.6 ${F}`);
  const head = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px'); head.appendChild(el('div', `font:700 16px ${F}`, '엔진 활용법'));
  const close = el('button', `font:600 12px ${F};color:#f3e6d2;background:rgba(243,217,189,.1);border:1px solid rgba(243,217,189,.25);border-radius:8px;padding:5px 10px;cursor:pointer`, 'H 닫기'); head.appendChild(close);
  const tabs = el('div', 'display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;border-bottom:1px solid rgba(243,217,189,.15)'), body = el('div', 'flex:1;overflow-y:auto;padding:14px 16px 28px');
  box.append(head, tabs, body); let cur = 0; const tabB = [];
  function show(i) { cur = i; tabB.forEach((b, k) => { b.style.background = k === i ? 'rgba(232,181,74,.3)' : 'rgba(243,217,189,.06)'; b.style.opacity = k === i ? 1 : .75; }); body.textContent = ''; body.scrollTop = 0; const P = PARTS[i];
    body.appendChild(el('div', `font:700 15px ${F};margin-bottom:6px`, P.t)); body.appendChild(el('div', 'opacity:.82;margin-bottom:14px', P.lead));
    for (const x of P.ex) { const card = el('div', 'border:1px solid rgba(243,217,189,.16);border-radius:10px;padding:10px 12px;margin-bottom:10px;background:rgba(243,217,189,.04)');
      const top = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px'); top.appendChild(el('div', `font:700 13px ${F}`, x.t));
      if (x.run) { const b = el('button', `flex:none;font:700 12px ${F};color:#1a1408;background:#e8b54a;border:0;border-radius:8px;padding:5px 11px;cursor:pointer`, '해보기'), note = el('div', 'font-size:12px;color:#ff9c8a;margin-top:6px;display:none');
        b.addEventListener('click', e => { e.stopPropagation(); try { new Function(x.code)(); note.style.display = 'none'; b.textContent = '실행됨'; setTimeout(() => { b.textContent = '해보기'; }, 900); } catch (err) { note.textContent = '실행하지 못했습니다: ' + err.message; note.style.display = ''; } b.blur(); }); top.appendChild(b); card.appendChild(top); if (x.d) card.appendChild(el('div', 'opacity:.82;margin-top:4px', x.d)); card.appendChild(note); }
      else { card.appendChild(top); if (x.d) card.appendChild(el('div', 'opacity:.82;margin-top:4px', x.d)); }
      if (x.code) card.appendChild(el('pre', 'margin:8px 0 0;padding:8px 10px;background:rgba(0,0,0,.45);border-radius:8px;font:500 11.5px/1.5 ui-monospace,Consolas,monospace;color:#e9dcc0;white-space:pre-wrap;word-break:break-word;overflow-x:auto', x.code));
      body.appendChild(card); } }
  PARTS.forEach((P, i) => { const b = el('button', `font:600 12px ${F};color:#f3e6d2;border:1px solid rgba(243,217,189,.22);border-radius:8px;padding:5px 9px;cursor:pointer`, P.t); b.addEventListener('click', e => { e.stopPropagation(); show(i); b.blur(); }); tabs.appendChild(b); tabB.push(b); });
  const toggle = () => { const on = box.style.display === 'none'; box.style.display = on ? 'flex' : 'none'; if (on) show(cur); };
  close.addEventListener('click', e => { e.stopPropagation(); toggle(); }); for (const ev of ['pointerdown', 'wheel', 'keydown']) box.addEventListener(ev, e => e.stopPropagation());
  addEventListener('keydown', e => { if (e.code === 'KeyH' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) toggle(); });
  function build() { document.body.appendChild(box); if (Q.has('guide')) { toggle(); show(clamp((+Q.get('guide') || 1) - 1, 0, PARTS.length - 1)); } }
  return { build, toggle, show, PARTS };
})();

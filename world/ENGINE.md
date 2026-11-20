# 엔진으로 쓰기

이 폴더는 한 장의 HTML이 아니라, 고쳐 가며 쓰는 소스 묶음입니다. `index.html`은 배포용으로 소스를 한 파일에 합친 결과물일 뿐입니다.

## 고치고 바로 보기

```bash
python -m http.server 8765
```

- **`dev.html`** — `src/*.js`를 파일 하나씩 순서대로 불러옵니다. 소스를 고치고 새로고침하면 바로 반영됩니다. 빌드가 필요 없습니다.
- **`index.html`** — 배포용. `python tools/build.py`가 `src/`를 한 파일로 합쳐 다시 씁니다(Windows에서는 `PYTHONUTF8=1`). 새 모듈 파일을 추가했을 때도 빌드를 한 번 돌려야 `dev.html`의 목록에 들어갑니다.

주소 뒤에 붙이는 것: `?mode=fort|bee|hike|drive`, `?weather=clear|rain|snow|frost`, `?low`(가벼운 설정), `?cam=x,y,z,tx,ty,tz`.

## 숫자를 바꾸는 곳: `src/02_config.js`

차의 질량·스프링·접지력, 물리의 스텝·중력·물의 밀도, 날씨의 기온·적설 속도·바람 세기가 `CFG` 하나에 모여 있습니다. 값을 바꾸고 `dev.html`을 새로고침하면 됩니다.

## 층

파일 이름 앞의 숫자가 불러오는 순서이자 층입니다. 위층은 아래층만 씁니다.

| 번호 | 층 | 파일 | 하는 일 |
|---|---|---|---|
| 00–05 | 바탕 | `00_util` `02_config` `05_glsl` | 수학 도우미, 공용 상태 `G`, 설정 `CFG`, 공용 GLSL, 재질에 셰이더를 끼워 넣는 `patch()` |
| 10–36 | 요새 장면 | `10_sdf` … `36_town` | 요새·마을·바위(원본 seafort) |
| 40–41 | 도구 | `40_fxkit` `41_weather` | 절차적 지오메트리와 유기 재질(FXKit), 날씨 상태 |
| 42–44 | 지형과 장면 | `42_island` `44_garden` | 섬(높이 함수, 도로, 등산로, 숲), 정원 |
| 58–80 | 렌더 | `20_sky` `68_water` `70_fx` `80_post` … | 하늘·구름·물·후처리(Crimson Loong) |
| 85 | 물리 | `85_phys` | 강체 세계(Rapier) |
| 86–89 | 놀이 요소 | `86_ambient` `87_drive` `89_walk` | 소리, 차, 자유 카메라 |
| 90–92 | 조립 | `90_main` `92_journey` | 빌드 순서와 프레임 루프, 보는 방식 전환 |

## 공용 약속

- **`G`** — 모두가 보는 상태. `G.scene`, `G.camera`, `G.sun`, `G.hemi`, `G.t`(초), `G.tEnv`(환경 시계 0–90), `G.snd`(소리 출력), `G.drive`(운전 중).
- **`G.tick.push((t, dt) => ...)`** — 매 프레임 불립니다. 새 시스템은 여기에 겁니다.
- **`patch(material, s => ..., key)`** — three.js 표준 재질에 셰이더 조각을 끼웁니다. 시간·바람·날씨(`uWx`) 유니폼이 자동으로 붙습니다.
- **모듈 모양** — `const Name = (() => { ...; return { build, ... }; })();` 최상위 이름은 모든 파일이 공유하므로 겹치면 안 됩니다. 다른 모듈은 함수 안에서(실행 시점에) 참조합니다.

## 자주 할 일

**새 시스템 넣기**: `src/NN_name.js`를 만들고 위 모양으로 쓴 뒤, `90_main.js`의 빌드 단계에 한 줄을 더합니다.

```js
if (typeof Name !== 'undefined') add('building the thing', 2, async prog => { await Name.build(scene); prog(1); });
```

**물체를 물리 세계에 놓기**

```js
Phys.spawn('crate', x, y, z, { q, v, color });      // crate | barrel | cone | stone
Phys.blast(x, y, z);                                 // 주변의 느슨한 것을 날림
Phys.ray(origin, dir, max);                          // 광선 검사
Phys.pre.push(h => { /* 스텝마다 내 힘을 넣기 */ });
Phys.adopt(body, { vol, r, lift });                  // 내가 만든 Rapier 몸체에 부력·바람·폭발을 적용
```

새 종류는 `85_phys.js`의 `KIND`에 모양(`geo`), 충돌체(`col`), 밀도(`rho`), 부피(`vol`)를 한 줄로 더합니다.

**날씨에 반응하게 하기**: JS에서는 `Weather.S`(`temp`, `rain`, `snowing`, `cover`, `ice`, `wet`, `wind`, `speed`)를 읽습니다. 셰이더에서는 `GLSL_WX`를 머리에 넣고 `uWx`(적설, 빙결, 젖음, 바람)와 `wxCover(월드좌표, 위를 향한 정도)`를 씁니다.

**보는 방식(게임 모드) 더하기**: `92_journey.js`에 이름과 키를 더하고, 매 프레임 카메라를 정하는 함수를 연결합니다. `87_drive.js`가 본보기입니다(`enter`, `leave`, `step(camera, dt)`).

**땅의 높이·표면 묻기**: `Island.surf(x, z)` → `[높이, 종류]`(0 아스팔트, 1 갓길, 2 풀밭, 3 모래). 눈에 보이는 땅, 바퀴, 물리 타일이 모두 이 함수 하나를 씁니다.

## 권리

`20_sky`, `68_water`, `70_fx`, `80_post`, `88_film` 등 하늘·물·후처리는 Crimson Loong(ChetasLua)의 코드이고 원작에 라이선스 표기가 없습니다. 개인 연구에는 쓸 수 있지만, 이 엔진을 공개 배포하거나 상용으로 쓰려면 이 층을 직접 쓴 것으로 바꾸거나 원작자의 허락을 받아야 합니다. 나머지(FXKit, 날씨, 섬, 정원, 물리 연결, 차, 여정)는 직접 쓴 코드이고, three.js는 MIT, Rapier는 Apache-2.0입니다.

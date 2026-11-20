# garden engine — 벌의 정원 방식으로 세운 독립 엔진

벌의 정원의 하늘·날씨·카메라를 토대로 만든 브라우저용 월드 엔진입니다. Three.js와 Rapier 위에서 지형을 생성하고, 실측한 암석·흙 재질과 뼈대가 있는 캐릭터를 같은 빛으로 그립니다.

**사용 안내: [GUIDE.md](GUIDE.md)** — 실행하고 고치기, 세계 바꾸기, 물리와 효과, 게임 규칙 넣기, 게임 엔진으로 활용하는 방법을 예시와 함께 정리했습니다. `0` 키의 "통 모으기"가 그 예시 게임입니다(`src/89_example_collect.js`).

자유 비행은 해안 정원의 바위 앞에서 시작합니다. 옆면에는 갈라진 암반의 결이 이어지고, 아래로 내려가면 흙에 파묻힌 자갈이 보입니다. [오후의 해안 정원](https://hahyuck.github.io/bee-garden/engine/?day=16.15&still&weather=clear) · [사람과 동물 보행 테스트](https://hahyuck.github.io/bee-garden/engine/?mode=actors&day=16&weather=clear)

### 재질과 모델의 출처

바위·갓길·흙에는 Poly Haven의 CC0 스캔 네 종을 사용했습니다. 색상과 표면 정보를 각기 한 장에 묶고, 표면 정보에는 OpenGL 노멀의 두 축, 거칠기, 상대 높이를 저장했습니다. [Rock Boulder Cracked](https://polyhaven.com/a/rock_boulder_cracked) · [Rock Ground 02](https://polyhaven.com/a/rock_ground_02) · [Brown Mud 02](https://polyhaven.com/a/brown_mud_02) · [Rock Face 03](https://polyhaven.com/a/rock_face_03) · [Poly Haven 라이선스](https://polyhaven.com/license)

보행 테스트에는 Polygonal Mind의 VRChat 컬렉션에서 CC0로 공개한 Kate와 Froggy를 사용했습니다. 원본 VRM의 메시·스킨·텍스처를 웹용 GLB로 정리하고 걷기와 도약 동작을 제작했습니다. Froggy는 원작의 의인화된 개구리입니다. 로더는 Three.js r180의 MIT 라이선스 GLTFLoader와 BufferGeometryUtils에 기반합니다. [Kate 원본](https://github.com/PolygonalMind/100Avatars/tree/ff07c2ad0017819c4e5366656ee1e5bcc4029bd4/100Avatars_038) · [Froggy 원본](https://github.com/PolygonalMind/100Avatars/tree/ff07c2ad0017819c4e5366656ee1e5bcc4029bd4/100Avatars_010) · [Three.js GLTFLoader](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/loaders/GLTFLoader.js)

## 실행

```bash
python -m http.server 8765
```

- `engine/dev.html` — 소스 파일을 하나씩 불러옵니다. 고치고 새로고침하면 반영됩니다.
- `engine/index.html` — 한 파일로 합친 배포용. `python tools/build.py`로 다시 만듭니다(Windows는 `PYTHONUTF8=1`).

주소 옵션: `?mode=free|bee|hike|drive|actors`, `?weather=clear|rain|snow|frost|auto`, `?day=17.5`(시각), `?still`(시간 멈춤), `?low`, `?cam=x,y,z,tx,ty,tz`.

## 조작

| 키 | 동작 |
|---|---|
| `1` `2` `3` `4` | 자유 비행 · 벌 · 산행 · 운전 |
| `V` | 정원에서 사람과 개구리의 보행·도약 보기. 화면을 끌면 시점을 돌릴 수 있습니다. |
| `5` `6` `7` `8` `9` | 맑음 · 비 · 눈 · 혹한 · 자동 날씨 |
| `[` `]` / `T` | 시각을 한 시간씩 옮기기 / 시간 흐름 멈춤 |
| `F` `G` `X` | 돌 던지기 · 벌통 상자 놓기 · 폭발 |
| `M` | 소리 |
| `H` | 엔진 활용법(화면 안 안내서, 예시를 눌러 바로 실행) |
| `L` | 라이팅 비교 패널 보이기/숨기기 |
| `B` | 벌 시점에서 겹눈 보기 |

자유 비행: `W A S D`, `Q` `E` 높이, `Shift` 빠르게, 끌어서 둘러보기. 운전: `W S A D`, `Space` 핸드브레이크, `C` 카메라, `R` 도로 복귀, `Esc` 일시정지.

## 라이팅 비교

왼쪽 위 라이팅 패널은 `L`로 여닫습니다. 벌통 받침 아래에서 **접촉 음영**을 켜고 끄면 지면과 물체가 만나는 좁은 틈의 밝기를 비교할 수 있습니다. [비 갠 뒤 해안 도로](https://hahyuck.github.io/bee-garden/engine/?wet&weather=clear&still&day=16.6&cam=-415.647,12.942,-139.209,-424.934,10.75,-139.007,62,.11)에서는 **젖은 노면**을 눌러 바퀴 자국에 비치는 하늘을 살펴보세요. `6`을 누르면 다시 비가 오고, `5`를 누르면 비가 그치면서 고인 물도 서서히 빠집니다.

그림자, 공기, 땅의 되비침, 빛 필드, 빛기둥, 블룸, 노출 적응, 필름도 각각 비교할 수 있습니다. `기본 조명`과 `?look=plain`은 해와 하늘·땅 보조광, 그림자로 시작합니다. 각 스위치는 `G.look`과 `84_lookpanel.js`의 `PARTS`에 있습니다.

## 층

파일 이름 앞의 숫자가 불러오는 순서이자 층입니다.

| 파일 | 하는 일 |
|---|---|
| `00_core.js` | 수학, 시드 난수, 노이즈(CPU·GLSL), 공용 상태 `G`, 공기(높이 안개), 재질에 셰이더를 끼우는 `patch()` |
| `02_config.js` | 조절 값 전부: 하늘, 바다, 필름, 카메라, 물리, 날씨, 차 |
| `10_sky.js` | 하늘 함수와 빛. 해가 뜨고 지고, 달이 이어받고, 하늘색이 보조광과 안개색이 됩니다 |
| `12_sea.js` | 바다. 여섯 겹의 너울, 깊이를 아는 물빛(얕은 곳은 모래가 비치고 깊은 곳은 짙어짐), 하늘 반사, 윤슬, 파도 등으로 비쳐 드는 빛, 물가를 오르내리는 포말, 혹한의 해빙 |
| `40_fxkit.js` | 절차적 지오메트리와 유기 재질 하나(잎, 꽃잎, 털, 나무껍질, 돌 …) |
| `41_weather.js` | 날씨 상태: 기온, 바람, 구름, 비, 눈, 적설, 빙결, 젖음 |
| `41_geology.js` · `81_groundwind.js` | 암석의 표면 방향·경사에 따라 광물, 흙, 자갈을 혼합하고, 마른 노면과 오솔길에서 풍속을 따라 먼지를 띄웁니다. |
| `42_island.js` `44_garden.js` | 섬(높이 함수, 도로, 등산로, 숲)과 정원(잔디, 꽃, 벌집, 고양이, 벌) |
| `46_lightfield.js` | 빛 필드: 섬을 위에서 본 지도 한 장으로 숲 아래의 하늘빛 가림과, 해 받은 숲이 옆으로 되돌려 주는 빛을 계산. 폭발 같은 뜨거운 점광도 여기서 |
| `79_contact.js` · `80_post.js` | 깊이 기반 접촉 음영, 어안 렌즈, 자동 초점, 겹눈, 접사 심도, 블룸, 빛기둥, 열 아지랑이, 노출 적응, 비네트, ACES, 그레인 |
| `82_effects.js` | 잠깐 있다 사라지는 것: 먼지·물보라·불꽃 띠(`FX.trail`), 폭발의 껍질과 고리(`FX.blast`) |
| `85_phys.js` | 강체 세계(Rapier): 지면, 나무, 바위, 느슨한 물체, 부력, 바람, 폭발 |
| `86_audio.js` | 소리 출력과 바람·파도·빗소리(합성) |
| `87_drive.js` | 차 |
| `89_vr_actors.js` | GLB 뼈대 모델과 애니메이션을 불러와 지형을 따라 움직입니다. |
| `88_modes.js` | 보는 방식(모드)과 그림자 범위 |
| `90_main.js` | 빌드 순서와 프레임 루프 |
| `91_guide.js` | 화면 안 안내서(`H`): 다섯 항목, 예시마다 코드와 `해보기` 버튼 |

## 공용 약속

- **`G`** — `G.scene`, `G.camera`, `G.sun`, `G.hemi`, `G.t`(초), `G.day`(시각 0–24), `G.snd`, `G.drive`, `G.U`(빛과 공기의 유니폼).
- **`G.tick.push((t, dt) => ...)`** — 매 프레임 불립니다.
- **`patch(material, s => ..., key)`** — three.js 표준 재질에 셰이더 조각을 끼웁니다. 시간·바람·날씨 유니폼이 자동으로 붙습니다.
- **모듈 모양** — `const Name = (() => { ...; return { build, ... }; })();` 최상위 이름은 모든 파일이 공유합니다.

## 자주 할 일

**새 시스템**: `src/NN_name.js`를 쓰고 `90_main.js`의 `STEPS`에 한 줄을 더한 뒤 빌드를 한 번 돌립니다(`dev.html`의 목록이 갱신됩니다).

```js
['이름', 2, async p => Name.build(scene, p)],
```

**새 모드**: `88_modes.js`의 `MODES`에 `{ name, enter(), leave(), step(camera, dt) }`를 더합니다. `step`이 카메라를 놓고 화면 아래에 보일 한 줄을 돌려줍니다. 심도가 필요하면 `Post.lens.focus`와 `Post.lens.aperture`를 정합니다.

**물리**: `Phys.spawn(kind, x, y, z, {q, v, color})`, `Phys.blast(x, y, z)`, `Phys.ray(o, d)`, `Phys.pre.push(h => ...)`, `Phys.adopt(body, {vol, r, lift})`. 새 종류는 `85_phys.js`의 `KIND`에 한 줄.

**날씨에 반응**: JS는 `Weather.S`, 셰이더는 `GLSL_WX`의 `uWx`(적설, 빙결, 젖음, 바람)와 `wxCover()`.

**효과**: `FX.trail(a, b, 폭, 종류)`(0 먼지, 1 물보라·눈·타이어 연기, 2 불꽃), `FX.blast(x, y, z, 반경)`, `LightField.hot(x, y, z, 세기)`, `Post.heat(위치, 세기)`.

**하늘을 비추는 표면**: `GLSL_NOISE + GLSL_SKY`를 넣고 `skyCol(방향, 해 원반 0|1)`을 부릅니다(바다가 그렇게 합니다). 유니폼은 `Sky.U`.

**땅 묻기**: `Island.surf(x, z)` → `[높이, 종류]`. 눈에 보이는 땅, 바퀴, 물리 타일이 모두 이 함수를 씁니다.

## Pixel Aleste에서 가져온 것

[Pixel Aleste](https://hahyuck.github.io/rgb-world-play/pixel-aleste/)의 셰이딩 가운데 이 엔진에 쓸모 있는 다섯 가지를 옮겼습니다.

| 효과 | 여기서 하는 일 |
|---|---|
| 조도 필드(간접광) | 숲 아래가 어두워지고, 해 받은 숲 가장자리가 옆 땅에 빛을 돌려줍니다. 눈이 쌓이면 그 빛이 희어집니다 |
| 화면 공간 빛기둥 | 해가 낮을 때 나무와 능선 사이로 빛줄기가 샙니다 |
| 열 아지랑이 | 폭발 자리의 공기가 일렁입니다 |
| 폭발 껍질과 고리 | `X` 폭발이 결이 있는 껍질, 퍼지는 고리, 불꽃 띠로 그려지고 주변을 잠깐 밝힙니다 |
| 띠(트레일) | 차의 뒷바퀴가 자갈·풀·모래에서 먼지를, 눈길과 젖은 길에서 물보라를, 미끄러질 때 연기를 냅니다 |

옮기지 않은 것: 구름·화염 아틀라스를 쓰는 효과(텍스처 파일이 필요), 음속 응결 고리와 날개 끝 비행운(비행 모드를 만들 때 쓸 것), 먼 공기 산란(이 엔진의 높이 안개가 같은 일을 함).

## 아직 안 된 것

- 빛은 해(달) 하나와 하늘·땅 보조광, 땅에서 한 번 되비친 빛의 근사, 그리고 숲만 아는 빛 필드입니다(바위·지형·물체는 필드에 없음). 빛 추적 방식의 전역 조명, 반사 프로브, 화면 공간 반사는 없습니다. 금속 재질에 비칠 환경 맵도 아직 없습니다.
- 구름은 하늘에 그린 평면 한 겹입니다(부피 구름이 아님). 구름 그림자가 땅에 지지 않습니다.
- 바다에 굴절과 물속 장면이 없습니다. 물체가 물에 닿아도 물보라가 없고, 물에 비치는 것은 하늘뿐입니다(섬과 물체는 비치지 않음).
- 자유 비행은 땅 아래로만 못 갑니다. 나무·바위와는 부딪히지 않습니다.
- 눈에 자국이 패이지 않습니다. 밤에는 차의 전조등이 길을 비추지 않습니다.
- `world/`의 요새와 마을은 여기 없습니다(그쪽은 Crimson Loong 층에 기대고 있습니다).

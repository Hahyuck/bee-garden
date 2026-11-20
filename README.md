# Bee Garden Game Engine

Created by Creative Labs

벌의 정원의 표현 방식을 기준으로 세운 브라우저용 게임 엔진입니다. 하늘·바다·빛·필름·날씨·물리·차가 모두 직접 쓴 모듈이고, 소스를 고쳐 가며 쓸 수 있게 나뉘어 있습니다.

[엔진 실행](https://hahyuck.github.io/bee-garden/engine/) · [엔진 사용 안내](engine/README.md)

## 벌의 정원 (Bee Garden)

꿀벌 한 마리가 벌집을 나서 아침 정원을 돌고 돌아오기까지, 컷 없는 110초의 비행. 카메라는 벌의 눈입니다.

**보기: https://hahyuck.github.io/bee-garden/**

그림과 소리는 모두 `index.html` 한 파일의 코드가 브라우저에서 실시간으로 계산합니다. 사진·텍스처·3D 모델·음원 파일은 쓰지 않았습니다 (three.js만 CDN에서 불러옵니다).

### 여정

벌집 안 → 착륙판 → 이륙 → 잔디밭과 토끼풀 → 코스모스에 착지해 꿀 마시기 → 라벤더와 뒤영벌 → 고양이 → 연못과 잠자리, 수련 잎에서 물 마시기 → 해바라기 → 높이 올라 정원 내려다보기 → 귀가 → 8자 춤

### 조작

| 키 | 동작 |
|---|---|
| `Space` | 재생 / 정지 |
| `←` `→` | 5초 이동 |
| `V` | 벌의 눈 (겹눈 모자이크 + 자외선 가짜색) |
| `C` | 자막 |
| `F` | 전체화면 |
| `R` | 녹화 (webm 저장) |
| `M` | 음소거 |

주소 뒤에 `?q=low` 또는 `?q=med`를 붙이면 사양이 낮은 기기용 화질로 실행됩니다. WebGL2를 지원하는 데스크톱 브라우저를 권장합니다.

## 산행 (Mountain Hike)

**보기: https://hahyuck.github.io/bee-garden/hike.html**

해발 1,600m 가문비나무 숲에서 2,488m 정상까지, 아침에 출발해 구름바다 위로 해가 질 때까지의 1인칭 산행. 여덟 장면 95초이며 `hike.html` 한 파일로 되어 있습니다.

가문비나무 숲 → 개울과 나무다리 → 안개 숲 → 수목한계선의 낙엽송 → 풀밭 비탈 → 안부 → 눈 얹힌 바위 능선 → 석양의 정상

지형은 능선 골격과 프랙탈 노이즈로 만든 높이 함수이고, 등산로는 경사를 따라 일정한 기울기로 오르도록 코드가 찾습니다. 산 그림자는 높이 지도를 따라 광선을 행진시켜 계산하며, 음악(패드·피아노·벨)과 발소리·바람·새·개울 소리는 모두 Web Audio로 합성합니다. 조작 키는 벌의 정원과 같습니다(`V` 제외).

## one world — 요새·산·정원을 하나의 세계로

**보기: https://hahyuck.github.io/bee-garden/world/**

바다 위 요새(seafort) 뒤에 산섬을 세우고 산자락에 정원을 놓아, 세 작품을 한 공간에서 이어 봅니다. `0` 이어 보기 · `1` 요새 · `2` 벌 · `3` 산행 · `W A S D` 자유 카메라. 자세한 내용은 [world/README.md](world/README.md), 모아 둔 셰이딩·모델링 묶음은 [world/FXKIT.md](world/FXKIT.md)에 있습니다. 하늘·물·후처리 엔진은 ChetasLua의 Crimson Loong입니다.

## 출처

[awesome-fable-5.2 / cat-garden](https://github.com/BubbleBrainBB/awesome-fable-5.2/tree/main/cat-garden)(고양이의 눈으로 본 식물원, 오프라인 패스 트레이싱 영상)의 구상을 벌의 시점으로 바꿔, 브라우저 실시간 버전으로 새로 만든 것입니다. 산행은 같은 저장소의 [mountain-hike](https://github.com/BubbleBrainBB/awesome-fable-5.2/tree/main/mountain-hike)를 같은 방식으로 새로 만든 것입니다. 코드는 Claude(Claude Code)가 작성했습니다.

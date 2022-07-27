# 개선된 홈페이지와 프로젝트 콘
이건 정말 집채만한 프로젝트야

## 오랜 고민 끝에 가장 기반에는 Ionic 이 들어옵니다
Godot 엔진이 현재 가지고 있는 서비스 상의 한계를 뛰어넘기 위해  
많은 기능을 포기하고 적당한 선에서 매우기로 했습니다.  
- 웹, 앱 (Android, iOS) 으로 진행되고 PC는 전부 사라집니다
- 필요하다면 PC용 사설 서버는 별도 프로그램으로 제공하게 됩니다
대신 많은 것들을 얻기도 합니다
- Ionic에서 제공하는 다양한 Native 액션 플로그인들
  - 예를 들면 BackgroundMode가 있다. 엔진에서 절대 제공될 이유가 없음

## 1개 저장소에서 처리
- 서버 진입시 실시간 소통 진행
- 서버 진입 실패시 기록물 기반 탐방 기능
    - 서버 종료 직전 git에 현재까지의 진행사항 전부 업로드, git 정보를 토대로 자료 보여주기
- 로그인 화면 후 포털을 통해 진행
- 파일당 최대 용량 50MB 제한 (git 제한량 따라가기)

## SC1: 캠페인식 컴까기
- github 페이지인 이상 이 페이지가 포함될 수 밖에 없다. 첫 구성으로 시도해보자
- 메인 페이지 구성
- 캠페인식 컴까기 상세 페이지(사진 돌려보기, 파일 다운받기, 버전 로그 보기)
- 리모콘 기능 테스트
- 서버와의 소통 테스트

## 개인 블로그
- 그냥 보통의 블로그처럼... 그렇게 관리하기
- 기술 이야기, 잡소리, 게임이야기 등등
- 기술 테스트에 대한 기록물 남기기 (꼭 해)
- 다른 기기에서 작업하면 페이지 업데이트하기
- liss22_home으로부터 선물 개체들을 받아와줘
- 곽인지 고양이 캐릭터 넣기
- 컨텐츠 뷰어 구성
- 서버와의 소통을 기반, 웹 사이트 UI를 통해 게시물 관리하기 기능

## Project: Cone
- 커뮤니티 구성
- 최고의 사용자 경험을 위해 모바일 앱 설치를 권장하기
- 기존에 분리되어있던 프로젝트 중 흡수 가능한 앱들을 전부 흡수하여 커다한 장으로 만들 것
- pwa 기반으로 변경되었으므로 컴 서버 관련 기능은 별도 앱으로 구성되어야 함
- 내부에서 사용되는 엔진캔버스는 *.pck 다운 및 행동처리 양식만을 가지고 있고 *.pck를 서버에서 받아 진행하는 방식
  - 이렇게 하면 오픈 플러그인 구성이 엄청 원활해짐

## 구성
0. 인앱 및 웹 광고
1. 로그인 (온라인 여부 검토)
2. 포털 (Root)
   - 개인 블로그
   1. 작성자인 나도 웹에서 서버에 작성할 수 있어야하며 자료관리가 이루어져야함
   2. 개인 사담
   3. 작업 기록 아카이브
   4. 방명록, 관리자에게만 보이기, 답글달기
   5. 최고관리자 권한 전용 페이지: 광고 관리자
   - 캠페인식 컴까기
   1. 설명
   2. 파일 받기
   3. 방명록, 답글달기 (누구나)
   - Project: Cone
   1. 분야별 게시판
      - 글쓰기
      - 번역
      - 그림 (voidDraw, DrawScribbleDeluxe 병합)
      - 사진 (who miss me)
      - 음악 (freeInst)
      - 짤빵 (동진, 계원과 대화했던 것에 기반)
      - 영상
      - 3D
      - 게임
   2. 채팅방 (DIYFreeChat)
      - ContentsViewer (DIYFreeChat)
      - 공유 그림판 (DrawScribbleDeluxe)
      - 내부 악기 관리자 ()
      - 내부 타악기 시뮬레이터 (freeInst)
      - 내부망 랜덤채팅 (ehh_chat, RandomCharacterChat)
   3. 플러그인 개발 테스트 공간 제공 (*.pck 직접 업로드 및 테스트용)
   - 기타 다른 앱을 웹에 *.pck 로 제공하여 웹에서도 플레이 가능하게 구성, 또는 웹과 다른 플랫폼(Android, Oculus 등)과 연동되는 구성
     - ExactTime
     - HNY_instance
     - IDoYN
     - engineWorkPPT (웹에 *.pck 올려서 로딩, 폰으로 리모콘)
     - JustRacing (VR Racing, RaceTonight 병합)
       - 회원관리가 된다면 웹에서 디스플레이를 제공하고 폰으로 핸들 역할을 자연스럽게 연결시킬 수 있음
     - 맵찔이 맵 (연동)
     - GoodMorningWorld
     - STTMic (연동)
     - MafiaLibrary
     - phonecap (폰에서 구성하기, 웹에서 전체 모양보기)
     - 상담센터용 업무관리자 (workflow_assistant)
     - VRShooter (폰에서 게임 플레이, 웹에서 관전 또는 3인칭 구경)
     - 작업관리툴 (DIYFreeChat, work_time, MutexUser, workflow_assistant 병합)
     - Climber (주사위를 굴리며 바벨탑을 올라가는 게임)
     - your_orchestra (Oculus 지휘자, 나머지 관중)
     - 지체발달장애꼬마의 술래잡기

## 기능 일람
- [ ] github를 겨냥한 자체 서버, 한개 노드 아래에서 다중 서버 운용됨
  - [ ] 이메일 아이디 / 기기uid 패스워드
    - [ ] 동시 접속시 원클릭 허용
    - [ ] 동시 접속 불가시 이메일 발송을 통한 기기 추가
    - [ ] exim4를 이용한 발송전용 이메일 구성
    - [ ] 이메일 발송시 토큰으로 관리하기 (시간제한걸기)
    - [ ] 메일링크로 진입하여 진입 진위여부를 검토한 후 회원가입 처리화면으로 보내기
    - [ ] 앱에서만 로그인 가능
      - [ ] 웹에서는 앱으로부터 로그인정보 연동받기
  - [ ] 사용자 관리
    - [ ] 이메일에 기기uid가 연결됨
    - [ ] 기기로부터 첫 연결 때 토큰 생성
    - [ ] 모든 기기에서 연결이 끊어지면 토큰 삭제
  - [ ] 파일 관리
    - [ ] thread가 꼬이지 않도록 파일과 변수를 위한 mutex 철저
    - [ ] 동작 테스트 필수
- [ ] 게시물을 페이지화 시키고 필요한 만큼만 자료 불러오기 (pagenation)
- [ ] 게시물 그룹 처리 (카테고리, 태그) / nakama
- [ ] 게시물 id 관리를 진행하고 id로 게시물 들어가기 기능 구성

## Android 빌드 작업보조 정보글
- Application에 추가 작성
  - android:usesCleartextTraffic="true"
- [백그라운드 모드 안드로이드 권한 설정](https://stackoverflow.com/questions/69101863/background-mode-not-quite-working-ionic-app-sleeps-after-5-minutes)
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>  
<!-- <uses-permission android:name="android.permission.ACCESS_BACKGROUND_SERVICE"/>   -->
<uses-permission android:name="android.permission.WAKE_LOCK" />  
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />  
```
- Godot-html은 백그라운드가 켜져있더라도 액션이 멈춤, 통신을 ionic에 의존해야함 
- 최초 Android 플랫폼 설치 후 오류시 다음 코드 진행
```bash
npm install jetifier
npx jetify
npx cap sync android
```
- Android 빌드 후 버전 정보 변경 (수동): android/variables.gradle
```gradle
    minSdkVersion = 22,
    cordovaAndroidVersion = '10.1.2',
```
- Component 중복 링크 불가로 엔진 부르기를 할 때 아래 코드를 직접 사용하는 것으로 대체합니다
```html
<iframe id="godot" src="assets/html/index.html" frameborder="0" class="full_screen"></iframe>
```

## 사용중인 포트
- 7350-7352: Nakama
- 12000: SingleAct_카운터
- 12010: Exim4
- 12011: Minichat 병합

## License
MIT
### 사용된 주 프로그램 고지
Ionic 6, Capacitor, Godot engine, p5js, Nakama
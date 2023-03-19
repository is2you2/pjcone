# 개선된 홈페이지와 프로젝트 콘
이건 정말 집채만한 프로젝트야

## 오랜 고민 끝에 가장 기반에는 Ionic 이 들어옵니다
Godot 엔진이 현재 가지고 있는 구조상의 한계를 뛰어넘기 위해 많은 기능을 포기하고 적당한 선에서 매우기로 했습니다.  
- 웹, 앱 (Android, iOS) 으로 진행되고 PC는 전부 웹으로 대체됩니다. 모바일 웹을 지원하지 않습니다.
- Ionic에서 제공하는 다양한 Native 액션 플로그인들
  - 예를 들면 BackgroundMode가 있다. 통상의 게임엔진에서 제공될 이유가 없음

## github 저장소에서 처리
- [x] 서버 진입시 실시간 소통 진행
- [x] 서버 진입 실패시 기록물 기반 탐방 기능 (github에 업로드 된 내역 기반)
    - [x] 서버 종료 직전 git에 현재까지의 진행사항 전부 업로드, git 정보를 토대로 자료 보여주기
      - 수동 처리, github 폴더 심볼릭 링크로 진행됨. 서버 종료시 강제 종료기 때문에 말이 안됨
- [x] 파일당 최대 용량 50MB 제한 (git 제한량 따라가기)

## 개인 블로그
- [ ] 그냥 보통의 블로그처럼... 그렇게 관리하기
- [ ] 기술 이야기, 잡소리, 게임이야기 등등
- [ ] 다른 기기에서 작업하면 페이지 업데이트하기
- [ ] liss22_home으로부터 선물 개체들을 받아와줘
- [ ] 곽인지 고양이 캐릭터 넣기
- [x] 컨텐츠 뷰어 구성
- [ ] 서버와의 소통을 기반, 웹 사이트 UI를 통해 게시물 관리하기 기능

## Project: Cone
- [ ] 커뮤니티 구성
- [ ] 기존에 분리되어있던 프로젝트 중 흡수 가능한 앱들을 전부 흡수하여 거대한 장으로 만들 것
- [x] 내부에서 사용되는 엔진캔버스는 *.pck 다운 및 행동처리 양식만을 가지고 있고 *.pck를 서버에서 받아 진행하는 방식
  - [ ] 사용자 지정 플러그인 관리 기능
- [ ] 작업관리 웹 전용 앱을 배포하여 Nakama, 커뮤니티 서버와 연동
  - [ ] 모든 작업 그룹이 기능만 받아쓰고 데이터는 자신들 것을 이용할 수 있도록 구성

## 구성
- [x] 인앱 광고 (Admob)
- [ ] 웹앱 광고 (AdSense)
- [x] 사설 인앱 및 웹 광고
  - [x] 구성 틀 생성됨
- [ ] 커뮤니티 웹 광고 (AdSense)
- [x] 로그인 (온라인 여부 검토)
  - [x] 커뮤니티 서버에서 일일 카운터 진행, godot-log상에 기록
- [ ] 포털 웹
   - [ ] 개인 블로그
   - [ ] 작업 기록 아카이브
   - [ ] 방명록, 관리자에게만 보이기, 답글달기
   - [x] 최고관리자 권한 전용 페이지: 메인서버 uuid 검토를 통해 사용자를 구분할 수 있음
   - [x] 캠페인식 컴까기
     - 설명
     - 파일 받기
     - 방명록, 답글달기 (누구나)
   - [ ] Project: Cone
     - [ ] github 호스팅 기반 게시물 열람 구성
     - [ ] 마지막으로 업데이트된 시간을 매 커밋당 기록하기
     - [ ] 공개 게시물 관리와 각 사람별 게시물 관리 (기능만 제공하는 방식, 사설 서버 등의 자료를 관리)
   - [ ] 분야별 게시판
      - [ ] 글쓰기
        - [ ] 단문
        - [ ] 단편
        - [ ] 장편
      - [ ] 번역
      - [ ] 그림 (voidDraw, DrawScribbleDeluxe 병합)
      - [ ] 사진 (who miss me)
      - [ ] 음악 (freeInst)
      - [ ] 짤빵 (동진, 계원과 대화했던 것에 기반)
      - [ ] 영상
      - [ ] 3D
      - [ ] 게임
   - [ ] 채팅방 (DIYFreeChat)
      - [x] ContentsViewer (DIYFreeChat)
      - [ ] 공유 그림판 (DrawScribbleDeluxe)
      - [ ] 내부 악기 관리자
      - [ ] 내부 타악기 시뮬레이터 (freeInst)
      - [x] ~~내부망 랜덤채팅~~ 내부망 그룹채팅
        - [x] ehh_chat
        - [ ] RandomCharacterChat
   - [ ] 플러그인 개발 테스트 공간 제공 (*.pck 직접 업로드 및 테스트용)
   - [ ] 기타 다른 앱을 웹에 *.pck 로 제공하여 웹에서도 플레이 가능하게 구성, 또는 웹과 다른 플랫폼(Android, Oculus 등)과 연동되는 구성
     - [ ] ExactTime
     - [ ] HNY_instance
     - [ ] IDoYN
     - [ ] engineWorkPPT (웹에 *.pck 올려서 로딩, 폰으로 리모콘)
     - [ ] JustRacing (VR Racing, RaceTonight 병합)
     - [ ] 맵찔이 맵 (연동)
     - [ ] GoodMorningWorld
     - [ ] STTMic + DrawScribbleDeluxe 병합 (녹음본 시간에 맞춰 텍스트 표시, 텍스트를 눌러 녹음구간 선택)
     - [ ] MafiaLibrary
     - [ ] phonecap (폰에서 구성하기, 웹에서 전체 모양보기)
     - [ ] 상담센터용 업무관리자 (workflow_assistant)
     - [ ] VRShooter (폰에서 게임 플레이, 웹에서 관전 또는 3인칭 구경)
     - [ ] 작업관리툴 (DIYFreeChat, work_time, MutexUser, workflow_assistant 병합)
       - [ ] Nakama 서버 기본 설정을 최대한 활용하는 구조로 구성
     - [ ] Climber (주사위를 굴리며 바벨탑을 올라가는 게임)
     - [ ] your_orchestra (Oculus 지휘자, 나머지 관중)
     - [ ] 지체발달장애꼬마의 술래잡기

- 버전별 계획서
  - [ ] 0.x버전 작업 예정
    - [ ] 콘텐츠 뷰어(ionic) 컨트롤러 구성
    - [ ] Todo 메인 기능 추가 (채팅방을 통한 업무 지시까지)
  - [ ] 1.x버전 작업 예정
    - [ ] 기본 기능에서 발생하는 오류 처리
    - [ ] 앱 기본 계획서 따라가기(앱 내장 기능)
  - [ ] 2.x버전 작업 예정
    - [ ] 사설 플러그인 설정기능
    - [ ] 사용자가 QR 코드 정보를 구성할 수 있는 페이지 (QR 이미지 제공, 데이터 보여주기)
    - [ ] 커뮤니티 페이지 구성 및 커뮤니티 페이지와 데이터 연동기능
    - [ ] 앱 기본 계획서 따라가기(웹과 연동이 필요한 것들)
  - [ ] 3.x버전 작업 예정
    - [ ] 2.x버전 앱을 구성하며 필요하다고 생각되는 추가 기능들 생성
    - [ ] 채널 내 메시지간 데이터 링크
    - [ ] UDP 대체가능한 통신들을 WebRTC를 활용하여 구성하기
      - [ ] WebRTC 시그널 서버를 커뮤니티 서버에 동봉하기
    - [ ] 콘텐츠 뷰어(Godot)에서 ionic 기능 및 일부 자료 열람 가능한 추가 구조
    - [ ] 디자인상 복잡해지거나 구성이 필요하지 않으나 만일을 대비하기 위한 기능 토글 버튼(웹앱)
      - 예를 들면 노트북 카메라 밖에 없는 상황을 고려해 만능 연결 버튼을 웹앱에 띄울 수 있도록 토글함
      - 이 때 토글된 버튼들에 주황색으로 표기

## 끄적끄적
- [ ] ina: 할머니 할아버지가 되서 손자 손녀랑 같이 게임할 수 있는거 만들어주세요

## 기능 일람
- [x] github를 겨냥한 자체 서버, 한개 노드 아래에서 다중 서버 운용됨
  - [x] 이메일 아이디 / 기기uid 비밀번호
    - [x] QR코드로 다른 기기 접속 허용하기
    - [ ] 기기 변경시 사용자 인계 후 영구적으로 계정 이어받기 (계정 비밀번호 변경처리)
    - [ ] ~~휴대폰 검토 불가시 이메일 발송으로 통한 로그인 허용~~
    - [ ] exim4를 이용한 발송전용 이메일 구성
      - [x] 고도엔진을 통한 메일 발송처리 성공
    - [x] 이메일 발송시 토큰으로 관리하기 (시간제한걸기)
    - [ ] 메일링크로 진입하여 진입 진위여부를 검토한 후 회원가입 처리화면으로 보내기
    - [x] 앱에서만 로그인 가능
      - [x] 웹에서는 앱으로부터 로그인정보 연동받기
  - [x] 사용자 관리
    - [x] 최초 로그인시 사용자 프로필 페이지 연결
      - [x] 프로필 정보가 있거나 최초 로그인이 아니면 무시
  - [x] 파일 관리
    - [x] 동작 테스트 필수 (릴리즈 상태에서)
    - [x] ionic과 godot 엔진간 파일 공유 가능, 파일이 사용자 데이터로 분류됨
- [ ] 게시물 id 관리를 진행하고 id로 게시물 들어가기 기능 구성
  - [ ] Ionic PWA에서 deeplink 기능 관리하기
- [x] Nakama 기본 서버를 최대로 활용한 기능 구현
  - [x] 사용자가 사설 서버 등록 및 이용 가능

## Android 빌드 작업보조 정보글
- 광고 정보를 Application에 추가 작성
```xml
<manifest>
    <application
        android:usesCleartextTraffic="true"/>
        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="@string/admob_app_id"/>

        ...

    </application>
    <-- For apps targeting Android 13 or higher & IMA SDK version 3.24.0 or lower -->
    <uses-permission android:name="com.google.android.gms.permission.AD_ID"/>
</manifest>
```
- android/app/src/main/res/values/strings.xml 에 다음 줄 추가
```xml
<string name="admob_app_id">[APP_ID]</string>
```
이 때, [APP_ID]는 ~이 들어간 광고 앱 아이디로 교체
- android/app/build.gradle 에 추가
```gradle
implementation 'com.google.android.gms:play-services-ads:21.5.0'
```
- Capacitor Admob 의 올바른 동작을 위해 빌드 전에 다음 명령 진행
```bash
npx cap update
```
- [빌드시 android 12 버전보다 높게 출시하는 것으로 오류가 난 경우 AndroidManifest에 다음 내용을 추가](https://stackoverflow.com/questions/68678008/apps-targeting-android-12-and-higher-required-to-specify-an-explicit-value-for)
```xml
<activity android:exported="true"/>
```
- [백그라운드 모드 안드로이드 권한 설정](https://stackoverflow.com/questions/69101863/background-mode-not-quite-working-ionic-app-sleeps-after-5-minutes)
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>  
<!-- <uses-permission android:name="android.permission.ACCESS_BACKGROUND_SERVICE"/>   -->
<uses-permission android:name="android.permission.WAKE_LOCK" />  
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />  
```
- Android 12부터는 예약된 알람이 제대로 동작하지 않을 수 있음
```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```
- 최초 Android 플랫폼 설치 후 오류시 다음 코드 진행
```bash
npm install jetifier
npx jetify
npx cap sync android
```
- 빌드 후에 android.support.v4.* 관련 오류가 뜬다면 위 jetify를 행동을 다시 합니다.
- Android 빌드 후 버전 정보 변경 (수동): android/variables.gradle
```gradle
    minSdkVersion = 22,
    cordovaAndroidVersion = '10.1.2',
```
## 고도 프레임 사용방법
- Godot-html은 백그라운드가 켜져있더라도 액션이 멈춤, 통신을 ionic에 의존해야함
- Component 중복 링크 불가로 엔진 부르기를 할 때 아래 코드를 직접 사용하는 것으로 대체합니다
```html
<div id="godot-main-frame" class="full_screen"></div>
```
```javascript
ionViewWillEnter() {
  this.app.CreateGodotIFrame('godot-main-frame', { key: value, ... });
}
```
- GodotViewer 구성 제한사항
  - 사용자가 별도 클래스를 생성한 경우 .pck 파일에 포함되지 않음
  - Singleton이 설정된 경우 정상적으로 동작하지 않음 (싱글톤 없는 씬)
  - InputMap 관련 정보를 받아올 수 없음
  - 직접 명시했을 뿐, project.godot 및 환경 설정에 포함되는 모든 정보들을 이용할 수 없음
  - InputMouse 류 행동과 InputTouch 류 행동을 분리, 상호간 시뮬레이션 하지 않음
- 예상했던대로, modal 및 nav.push로 고도 HTML5 개체를 불렀다가 돌아가거나, nav.root으로 이전 기록을 삭제하는 경우 고도 HTML5 개체도 삭제됨
  - 또한, nav.root 에서 페이지에 돌아올 수 있도록 구성된 경우 백그라운드에서 계속 운용
  - iframe 개체를 지워도 고도엔진 개체 삭제 (정지)
  - iframe 개체가 hidden 되더라도 백그라운드에서 진행됨 (숨기기 무의미)
- 앱을 빌드할 때 버전을 관리하면
  - android/app/build.gradle 확인


## 사용중인 알림 아이디
- 10: 커뮤니티 서버 클라이언트
- 11: 랜덤채팅
- 12: 사설 그룹채팅

## 사용중인 포트
- 7350-7352: Nakama
### 커뮤니티 서버 포트
- 12000: SingleAct_카운터
- 12010: Exim4
- 12011: Minichat 병합, 모바일 사설 서버
- 12012: sc1_custom 페이지
- 12020: WebLink
### 모바일 사설 서버 포트
- 12021: engineppt

## License
MIT
- [x] 제작자의 짧은 글귀
- [x] 번역가의 짧은 글귀
- [x] 코드 라이선스 고지
  - Ionic 6, Capacitor, Godot engine, p5js, Nakama
### CCL CC-BY-SA (저작자 표시-변경금지)
- [x] 콘텐츠 라이선스 고지
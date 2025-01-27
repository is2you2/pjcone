import { Injectable } from '@angular/core';
import { LanguageSettingService } from './language-setting.service';
import { P5ToastService } from './p5-toast.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';
import * as p5 from "p5";
import { IndexedDBService } from './indexed-db.service';
import { LoadingController, ModalController, NavController, mdTransitionAnimation } from '@ionic/angular';
import { isPlatform } from './app.component';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { VoiceRecorder } from '@langx/capacitor-voice-recorder';
import { IonModal } from '@ionic/angular/common';
import { P5LoadingService } from './p5-loading.service';

export var isDarkMode = false;
/** 파일 입출 크기 제한 */
export const FILE_BINARY_LIMIT = 80000;

/** 컨텐츠 제작자 기록 틀 */
export interface ContentCreatorInfo {
  /** 콘텐츠 작성 당시 사용한 이름 */
  display_name?: string;
  /** 등록일자 */
  timestamp: number;
  /** 시간 보여주기용 */
  timeDisplay?: string;
  /** 앱 내 편집기를 제외한 직접 만든 파일 외  
   * loaded: 외부에서 파일을 가져온 경우  
   * camera: 카메라 직접 촬영
   */
  various?: 'loaded' | 'camera' | 'voidDraw' | 'link' | 'long_text' | 'textedit' | 'shared';
  /** 콘텐츠 뷰어에서 최초 게시자 알리기 용 */
  publisher?: string;
  /** 공유되는 서버 기반 uid */
  user_id?: string;
  /** 서버인 경우 나인지 검토 */
  is_me?: boolean;
  /** 정보 표시 여부 */
  hidden?: boolean;
}

/** 간략한 서버 관련 정보 */
interface ServerInfoShort {
  user_id?: string;
  cdn_port?: number;
  apache_port?: number;
}

/** 뷰어 동작 호완을 위한 틀 */
export interface FileInfo {
  filename?: string;
  /** 재등록을 위한 이름 덮어쓰기 */
  override_name?: string;
  /** 재등록을 위한 경로 덮어쓰기 */
  override_path?: string;
  /** 서버에 등록되는 파일 이름 덮어쓰기 */
  override_filename?: string;
  /** blob 파일 형식 (blob.type) */
  type?: string;
  file_ext?: string;
  /** 전체 파일 크기 */
  size?: number;
  /** 썸네일 구분용 헤더 */
  typeheader?: string;
  /** 작업 참여자, 또는 이 작업과 연관된 사람들 */
  content_related_creator?: ContentCreatorInfo[];
  /** 콘텐츠를 업로드한 사람, 또는 제작자 */
  content_creator?: ContentCreatorInfo;
  /** 파일 분할 크기 */
  partsize?: number;
  path?: string;
  /** sync_load 행동시 로컬에 맞는 경로 구성, 우선순위가 높은 경로 */
  alt_path?: string;
  base64?: any;
  blob?: any;
  /** 간소화 썸네일 (ObjectURL) */
  thumbnail?: any;
  /** 뷰어 구분자 */
  viewer?: string;
  /** 직접 파일이 아닌 url 링크로 받은 경우 */
  url?: string;
  /** 요청을 취소하기 위해 연결시킴 */
  cont?: AbortController;
}

/** 고도엔진과 공유되는 키값 */
interface GodotFrameKeys {
  /** 불러오게될 pck의 경로, 받아서 ionic -> godot 복제를 시도한다 */
  path: string;
  /** 썸네일 생성을 위한 기존 경로 */
  alt_path?: string;
  /** 배경 이미지, p5 에서 불러올 수 있는 주소로 제공 */
  background?: string;
  /** **사용금지**  
   * 썸네일 미지원 패키지로부터 썸네일을 생성시 실행됨, ViewerEX 전용
   */
  create_thumbnail_p5?: Function;
  /** **사용금지**  
   * 고도 프레임을 새로 생성할 때 자동으로 실행됨
   */
  quit_godot?: Function;
  /** 고도 프레임이 종료될 때 콜백 */
  quit_ionic?: Function;
  /** **사용금지**  
   * 패키지 불러오기 상태를 반환함 (Client 기본값)
   */
  update_load?: Function;
  /** 해당 채널의 정보 (채널 채팅에서 직접 열람시) */
  channel_info?: any;
  /** **사용 금지**  
   * 현재 채널에서 수신받은 메시지 (고도 프로젝트에서 생성됨, 자동완성용)  
   * received_msg(_msg) => { ...수신된 메시지로 고도엔진에서 행동함 }
   */
  received_msg?: Function;
  /** 아케이드 열람 전용, 아케이드용 프레임 생성을 위해 존재함 */
  force?: boolean;
  /** 아케이드 전용, 아케이드 웹 소켓으로 서버에 전송  
   * @param string 문자열 보내기
   */
  ws_send?: Function;
  /** **사용금지**  
   * 아케이드 전용, 아케이드 웹 소켓으로부터 받음  
   * @param string 문자열 받기
   */
  ws_recv?: Function;
  /** 아케이드 전용, WebRTC 송신
   * @param string 문자열 보내기
   */
  webrtc_send?: Function;
  /** **사용금지**  
   * 아케이드 전용, WebRTC 수신
   */
  webrtc_receive?: Function;
  /** QRCode 빠른 진입 열기 */
  open_modal?: Function;
  /** **사용금지**  
   * 플랫폼 검토: 데스크탑/모바일 여부
   */
  isMobile?: boolean;
  /** 고도엔진과 상호작용하기 위한 값들, 고도엔진에서 JavaScript.get_interface('window')[id]로 접근 */
  [id: string]: any;
}

/** 첨부파일 행동시 사용되는 사용자 정보 */
interface AttachUserInfo {
  /** 사용자 uid (서버 사용시) */
  user_id?: string;
  /** 기본으로 표시되는 사용자 이름 */
  display_name: string;
}

/** 어느 페이지에든 행동할 가능성이 있는 공용 함수 모음 */
@Injectable({
  providedIn: 'root'
})
export class GlobalActService {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    private p5loading: P5LoadingService,
  ) {
    isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      isDarkMode = event.matches ? true : false;
    });
    this.useLocalAddress = localStorage.getItem('useQRCodeBasic') == 'true';
    window.onfocus = () => {
      let keys = Object.keys(this.windowOnFocusAct);
      for (let key of keys) this.windowOnFocusAct[key]();
    }
    window.onblur = () => {
      let keys = Object.keys(this.WindowOnBlurAct);
      for (let key of keys) this.WindowOnBlurAct[key]();
    }
    const togFullscrAct = () => {
      if (document.fullscreenElement) {
        this.ArcadeWithFullScreen = true;
      } else { // 전체화면 종료시
        this.ArcadeWithFullScreen = false;
      }
    }
    document.onfullscreenchange = togFullscrAct;
    document['onwebkitfullscreenchange'] = togFullscrAct;
    document['onmozfullscreenchange'] = togFullscrAct;
    document['onMSFullscreenChange'] = togFullscrAct;
  }

  /** 앱으로 돌아왔을 경우 행동 */
  windowOnFocusAct: { [id: string]: Function } = {};
  /** 다른 앱으로 전환했을 때 행동하는 목록 구성 */
  WindowOnBlurAct: { [id: string]: Function } = {};

  /** 해야할 일 캔버스 */
  p5todo: p5;
  p5todoStopCanvas: Function;
  p5todoPlayCanvas: Function;
  p5todoAddtodo: Function;
  p5removeTodo: Function;
  p5FilteringTodos: Function;

  /** PIP 동작 연계를 위한 비디오 개체 기억하기 */
  PIPLinkedVideoElement: HTMLVideoElement;

  /** 포털 탭 페이지를 보고있는지, 페이지를 벗어났는지 추적 */
  FocusOnPortal = true;
  /** 포털 화면을 벗어날 때 행동 (WillLeave) */
  FocusOnPortalLeaveAct: Function;

  /** 데스크탑 환경인지 여부 */
  ShowHint: boolean;
  /** 페이지별 단축키 관리자 */
  p5key: p5;
  p5KeyShortCut: any;
  /** 자식 페이지 진입시 끄기 */
  portalHint = true;
  /** 단축키 동작 막기 */
  BlockMainShortcut = false;
  initialize() {
    const load_env = localStorage.getItem('ShowHint');
    if (load_env !== null) this.ShowHint = load_env == '1';
    if (this.ShowHint === undefined) this.ShowHint = isPlatform == 'DesktopPWA';
    if (!this.p5toast.HTMLEncode)
      this.p5toast.HTMLEncode = this.HTMLEncode;
    this.p5key = new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.noLoop();
        this.p5KeyShortCut = {};
      }
      p.keyPressed = (ev) => {
        if (this.BlockMainShortcut) return;
        if (!this.p5KeyShortCut) return;
        switch (ev['code']) {
          case 'Backspace':
            if (this.p5KeyShortCut['Backspace'])
              this.p5KeyShortCut['Backspace']();
            break;
          case 'Backquote':
            if (this.p5KeyShortCut['Backquote'])
              this.p5KeyShortCut['Backquote']();
            break;
          // 메뉴 나열순
          case 'Digit1': // 보여지는 리스트 메뉴 최상단부터 아래로
          case 'Digit2':
          case 'Digit3':
          case 'Digit4':
          case 'Digit5':
          case 'Digit6':
          case 'Digit7':
          case 'Digit8':
          case 'Digit9':
          case 'Digit0':
          case 'Numpad1': // 넘패드 숫자도 동일하게 처리
          case 'Numpad2':
          case 'Numpad3':
          case 'Numpad4':
          case 'Numpad5':
          case 'Numpad6':
          case 'Numpad7':
          case 'Numpad8':
          case 'Numpad9':
          case 'Numpad0':
            if (this.p5KeyShortCut['Digit']) {
              const exact_index = (Number(ev['code'].slice(-1)) - 1 + 10) % 10;
              this.p5KeyShortCut['Digit'](exact_index);
            }
            break;
          // 메인 하단 탭
          case 'KeyQ': // 채널
          case 'KeyW': // 할 일
          case 'KeyE': // 오락
          case 'KeyR': // 사설 SNS or 설정
          case 'KeyT': // 설정
            if (this.p5KeyShortCut['BottomTab'])
              this.p5KeyShortCut['BottomTab'](ev['code'].slice(-1));
            break;
          case 'KeyA': // 추가류 (Add)
            if (this.p5KeyShortCut['AddAct'])
              this.p5KeyShortCut['AddAct']();
            break;
          case 'KeyS': // 키간 사이 행동 (S Key)
            if (this.p5KeyShortCut['SKeyAct'])
              this.p5KeyShortCut['SKeyAct'](ev);
            break;
          case 'KeyD': // 삭제류 (Delete)
            if (this.p5KeyShortCut['DeleteAct'])
              this.p5KeyShortCut['DeleteAct']();
            break;
          case 'KeyF': // 키간 사이 행동 (S Key)
            if (this.p5KeyShortCut['FKeyAct'])
              this.p5KeyShortCut['FKeyAct']();
            break;
          case 'Escape': // 페이지 돌아가기 (navCtrl.pop()) / modal은 기본적으로 동작함
            if (this.p5KeyShortCut['Escape'])
              this.p5KeyShortCut['Escape']();
            break;
          case 'KeyZ': // 되돌리기 등 그림판 하단 탭 행동
          case 'KeyX':
          case 'KeyC':
          case 'KeyV':
            if (this.p5KeyShortCut['HistoryAct'])
              this.p5KeyShortCut['HistoryAct'](ev);
            break;
        }
        switch (ev['key']) {
          case 'Enter': // 발송 등
            if (this.p5KeyShortCut['EnterAct'])
              this.p5KeyShortCut['EnterAct'](ev);
            break;
        }
      }
    });
  }

  /** 언어가 준비된 후에 동작할 것들 */
  afterLangInit() {
    this.NeedBackgroundMode = isPlatform != 'DesktopPWA';
    if (this.NeedBackgroundMode) this.ToggleBackgroundMode();
  }

  /** 모달이 켜진 상태에서 페이지 전환은 오류가 생기므로 모든 모달 제거하기를 진행함 */
  async RemoveAllModals(Callback: Function = () => { }) {
    let topModal: any = 'init';
    while (topModal) {
      topModal = await this.modalCtrl.getTop();
      if (topModal) await topModal.dismiss();
    }
    if (Callback) Callback();
  }

  /** 브라우저에서 딥 링크마냥 행동하기
   * @returns GET 으로 작성된 key-value 쌍
  */
  CatchGETs(address: string) {
    /** 입력된 주소 */
    const sepElement = address.split('?');
    if (sepElement.length > 1) {
      const CatchGETs = sepElement[1].split('&');
      let gets = {};
      for (let i = 0, j = CatchGETs.length; i < j; i++) {
        const KeyVal = CatchGETs[i].split('=');
        if (!gets[KeyVal[0]])
          gets[KeyVal[0]] = [];
        gets[KeyVal[0]].push(decodeURIComponent(KeyVal[1]));
      }
      return gets;
    }
  }

  /** 하단 탭을 다시 눌렀을 때 행동에 대해서 */
  PortalBottonTabAct = {
    Todo: undefined as Function,
    Subscribes: undefined as Function,
    Arcade: undefined as Function,
    Community: undefined as Function,
  };

  /** 문자열을 받아서 QR코드 이미지로 돌려주기  
   * 선택적 반환: QRCode 이미지 또는 오류 메시지
   */
  readasQRCodeFromString(str: any) {
    try {
      let qr: string = new QRCode({
        content: str,
        padding: 4,
        width: 8,
        height: 8,
        color: isDarkMode ? "#bbb" : '#444',
        background: isDarkMode ? "#111" : '#fff',
        ecl: "M",
      }).svg();
      return this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(qr)}`);
    } catch (e) {
      console.log('readasQRCodeFromString: ', e);
      this.p5toast.show({
        text: `${this.lang.text['GlobalAct']['failed_to_gen_qr']}: ${e}`,
      });
    }
  }

  godot_splash: p5;
  /** 실행중인 iframe-godot 개체를 기억하여 2개 이상 생성될 경우 이전에 진행중인 객체를 삭제, 마지막 실행기만 기억하기 */
  godot: HTMLIFrameElement;
  godot_window: any;
  /** 고도엔진 URL 주소 기억 */
  GodotCache = {};
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @param keys 고도엔진 iframe.window에 작성될 값들
   */
  private CreateGodotIFrame(_frame_name: string, keys: GodotFrameKeys, run_quit_act = false): Promise<any> {
    return new Promise(async (done: any) => {
      let refresh_it_loading = async () => {
        try {
          if (window['godot'] != 'godot')
            throw 'No godot';
          if (!this.godot_window['start_load_pck'])
            throw 'No act ready';
          await this.indexed.GetGodotIndexedDB();
          done();
        } catch (e) {
          setTimeout(() => {
            refresh_it_loading();
          }, 1000);
        }
      }
      if (this.godot_window && this.godot_window['quit_godot'])
        this.godot_window.quit_godot();
      if (this.godot_window && this.godot_window['quit_ionic'] && run_quit_act)
        this.godot_window.quit_ionic();
      if (this.godot_splash) this.godot_splash.remove();
      if (this.godot) this.godot.remove();
      window['godot'] = '';
      // 고도엔진 직접 불러오기 처리
      {
        {
          let keys = Object.keys(this.GodotCache);
          keys.forEach(key => {
            URL.revokeObjectURL(this.GodotCache[key]);
            delete this.GodotCache[key];
          });
        }
        let audio = await fetch('assets/html/index.audio.worklet.js');
        let audioBlob = await audio.blob();
        let audioURL = URL.createObjectURL(audioBlob);
        this.GodotCache['audio'] = audioURL;
        let wasm = await fetch('assets/html/index.wasm');
        let wasmBlob = await wasm.blob();
        let wasmURL = URL.createObjectURL(wasmBlob);
        this.GodotCache['wasm'] = wasmURL;
        let pck = await fetch('assets/html/index.pck');
        let pckBlob = await pck.blob();
        let pckURL = URL.createObjectURL(pckBlob);
        this.GodotCache['pck'] = pckURL;
        let png = await fetch('assets/html/index.png');
        let pngBlob = await png.blob();
        let pngURL = URL.createObjectURL(pngBlob);
        this.GodotCache['png'] = pngURL;
        let js = await fetch('assets/html/index.js');
        let jsText = await js.text();
        jsText = jsText.replace('`${loadPath}.audio.worklet.js`', `'${audioURL}'`)
          .replace(/`\${loadPath}\.wasm`/g, `'${wasmURL}'`)
          .replace('this.config.mainPack || `${exe}.pck`;', `'${pckURL}'`);
        let jsBlob = new Blob([jsText], { type: 'application/javascript' });
        let jsURL = URL.createObjectURL(jsBlob);
        this.GodotCache['js'] = jsURL;
        let html = await fetch('assets/html/index.html');
        let htmlText = await html.text();
        htmlText = htmlText.replace('<script src="index.js"></script>', `<script src="${jsURL}"></script>`)
          .replace('src="index.png"', `src="${pngURL}"`);
        let htmlBlob = new Blob([htmlText], { type: 'text/html' });
        let htmlURL = URL.createObjectURL(htmlBlob);
        this.GodotCache['html'] = htmlURL;
      }
      let _godot = document.createElement('iframe');
      _godot.id = 'godot';
      _godot.setAttribute("src", this.GodotCache['html']);
      _godot.setAttribute("frameborder", "0");
      _godot.setAttribute('class', 'full_screen');
      _godot.setAttribute('allow', 'fullscreen; encrypted-media');
      _godot.setAttribute('scrolling', 'no');
      _godot.setAttribute('withCredentials', 'true');
      keys['isMobile'] = isPlatform != 'DesktopPWA';
      // ionic-viewer 로부터 받은 경우 썸네일 만들기 행동 추가
      if (_frame_name.indexOf('content_viewer_canvas') >= 0)
        keys['create_thumbnail_p5'] = async (base64: string, info: FileInfo = undefined) => {
          {
            let keys = Object.keys(this.GodotCache);
            keys.forEach(key => {
              URL.revokeObjectURL(this.GodotCache[key]);
              delete this.GodotCache[key];
            });
          }
          new p5((p: p5) => {
            p.setup = () => {
              p.noCanvas();
              p.pixelDensity(1);
              p.loadImage('data:image/png;base64,' + base64, async v => {
                let canvas = p.createCanvas(v.width, v.height);
                p.image(v, 0, 0)
                p.textSize(16);
                p.textWrap(p.CHAR);
                let margin_ratio = p.height / 24;
                p.push()
                p.translate(margin_ratio / 6, margin_ratio / 6);
                p.fill(0)
                p.text(this.godot_window['filename'],
                  margin_ratio, margin_ratio,
                  p.width - margin_ratio * 2, p.height - margin_ratio * 2);
                p.filter(p.BLUR, 3, false);
                p.pop();
                p.fill(255);
                p.text(this.godot_window['filename'],
                  margin_ratio, margin_ratio,
                  p.width - margin_ratio * 2, p.height - margin_ratio * 2);
                let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
                try {
                  if (!keys['alt_path'] && !keys['path']) throw '경로 없는 파일';
                  await this.indexed.saveBase64ToUserPath(base64, `${(keys['alt_path'] || keys['path'])}_thumbnail.png`);
                  this.modulate_thumbnail(info, '');
                } catch (e) {
                  console.log('p.saveFrames: ', e);
                }
                p.remove();
              }, e => {
                console.error('create_thumbnail_load thumbnail failed: ', e);
                p.remove();
              });
            }
          });
        }
      keys['fullscr_tog'] = (force?: boolean) => {
        this.ArcadeWithFullScreen = force ?? !this.ArcadeWithFullScreen;
      }
      let frame = document.getElementById(_frame_name);
      frame.appendChild(_godot);
      this.godot_window = _godot.contentWindow || _godot.contentDocument;
      let _keys = Object.keys(keys);
      _keys.forEach(key => this.godot_window[key] = keys[key]);
      this.godot = _godot;
      await refresh_it_loading();
    });
  }

  /** 전체화면처리 */
  ToggleFullScreen(force?: boolean) {
    this.ArcadeWithFullScreen = force ?? !this.ArcadeWithFullScreen;
    let target = this.godot ?? document.documentElement;
    if (this.ArcadeWithFullScreen) {
      // 전체화면 모드로 전환
      if (target.requestFullscreen) {
        target.requestFullscreen();
      } else if (target['mozRequestFullScreen']) { // Firefox
        target['mozRequestFullScreen']();
      } else if (target['webkitRequestFullscreen']) { // Chrome, Safari, Opera
        target['webkitRequestFullscreen']();
      } else if (target['msRequestFullscreen']) { // IE/Edge
        target['msRequestFullscreen']();
      }
    } else if (document.fullscreenElement) {
      // 전체화면 모드 종료
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document['mozCancelFullScreen']) { // Firefox
        document['mozCancelFullScreen']();
      } else if (document['webkitExitFullscreen']) { // Chrome, Safari, Opera
        document['webkitExitFullscreen']();
      } else if (document['msExitFullscreen']) { // IE/Edge
        document['msExitFullscreen']();
      }
    }
  }

  /** Arcade 페이지에서 게임이 불러와졌는지 여부 검토 */
  ArcadeLoaded = false;
  /** 정확히는, true 일 때 하단 탭을 숨깁니다 */
  ArcadeWithFullScreen = false;
  /** WebRTC 순환 참조 우회 */
  WebRTCService: any;
  async CreateArcadeFrame(FileInfo: FileInfo) {
    this.ArcadeLoaded = true;
    // 데스크탑에서는 전체화면으로 진입
    const CachePath = 'tmp_files/duplicate/arcade.pck';
    await this.CreateGodotIFrameWithDuplicateAct(FileInfo, 'arcade_pck_loaded', {
      path: CachePath,
      force: true,
      ws_send: (msg: string) => {
        if (this.ArcadeWS) try {
          this.ArcadeWS.send(msg);
        } catch (e) {
          console.log('아케이드 WS 메시지 발송 실패: ', e);
        }
      },
      webrtc_send: (msg: string) => {
        this.WebRTCService.send(msg);
      },
      open_modal: () => {
        this.GetHeaderAddress().then(address => {
          this.ArcadeQRAddress = `${address}?arcade=wss://127.0.0.1:12013,${this.ArcadeSocketId}`;
          this.ArcadeQRCodeSRC = this.readasQRCodeFromString(this.ArcadeQRAddress);
          this.OpenArcadeQRCode();
        });
      }
    });
  }

  /** 고도엔진 IFrame 생성하기 (IndexedDB 구현 오류를 )
   * @param targetFile 생성하려는 대상 파일 (고도엔진 IndexedDB에 복제하게됨)
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @param FailedCallback 아케이드에서 미리 열람한 경우, 열람 실패 콜백
   * @param keys 고도엔진 iframe.window에 작성될 값들
   */
  async CreateGodotIFrameWithDuplicateAct(target: FileInfo, _frame_name: string, keys: GodotFrameKeys, AfterCallback?: Function, FailedCallback?: Function): Promise<any> {
    if (this.ArcadeLoaded && !keys.force) {
      this.p5toast.show({
        text: this.lang.text['Arcade']['ArcadeOpened'],
      });
      if (FailedCallback) FailedCallback();
    } else {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['Arcade']['TryingDownload'] });
      loading.present();
      try {
        if (target.blob) throw '준비된 blob 정보';
        if (!target.url) throw '파일 정보에 URL이 없음';
        let res = await fetch(target.url, { signal: target.cont?.signal });
        if (res.ok) {
          target.blob = await res.blob();
        } else throw `${res.statusText} (${res.status})`;
      } catch (e) {
        console.log('pck 열람 오류: ', e);
      }
      loading.dismiss();
      const SavePath = `godot/app_userdata/Client/${keys.path}`;
      let SuccessCreateIndexedDB = false;
      if (this.indexed.godotDB) {
        try {
          await this.indexed.GetGodotIndexedDB();
          await this.indexed.saveBlobToUserPath(target.blob, SavePath, this.indexed.godotDB);
          SuccessCreateIndexedDB = true;
        } catch (e) {
          console.log('내부 파일 없음: ', e);
        }
      }
      await this.CreateGodotIFrame(_frame_name, keys, true);
      if (!SuccessCreateIndexedDB) {
        try { // 내부에 파일이 있는지 검토
          await this.indexed.GetGodotIndexedDB();
          await this.indexed.saveBlobToUserPath(target.blob, SavePath, this.indexed.godotDB);
        } catch (e) { }
        await this.CreateGodotIFrame(_frame_name, keys);
      }
      if (AfterCallback) AfterCallback();
      // 아케이드에서 생성된거라면 WebRTC 행동받기 함수 생성
      if (keys.force)
        this.WebRTCService.dataChannelOnMsgAct = (msg: string) => {
          if (this.godot_window && this.godot_window['webrtc_recv'])
            this.godot_window['webrtc_recv'](msg);
        }
      this.godot_window['start_load_pck']();
    }
  }

  /** URL 주소로부터 pck 파일 열기, 빠른 진입 공유용으로 이곳에 구성됨 */
  async OpenGodotFromURL() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['Arcade']['TryingDownload'] });
    loading.present();
    let clipboardURL = await this.GetValueFromClipboard();
    try {
      switch (clipboardURL.type) {
        case 'text/plain':
          let targetURL = clipboardURL.value;
          if (targetURL.split('.').pop() != 'pck') throw 'Invalid type';
          let res = await fetch(targetURL)
          if (res.ok) {
            let blob = await res.blob();
            this.CreateArcadeFrame({
              blob: blob,
            });
            this.CreateInfoSocket(targetURL);
          } else throw `${res.statusText} (${res.status})`;
          break;
        default:
          throw 'Invalid type';
      }
    } catch (e) {
      console.log('URL 고도파일 실행 실패: ', e);
      this.p5toast.show({
        text: `${this.lang.text['Arcade']['FailedToDownloadGodot']}: ${e}`,
      });
    }
    loading.dismiss();
  }

  /** 모바일 여부를 검토 */
  NeedBackgroundMode = false;
  /** 모바일인 경우, 빈 미디어를 반복재생하여 백그라운드 모드를 모방함 */
  IsBackgroundMode = false;
  private BackgroundAudioDiv: HTMLDivElement;
  /** 백그라운드 모드를 위한 오디오 관리 */
  private BGModeAudio: HTMLAudioElement;
  /** 백그라운드 모드 토글 */
  ToggleBackgroundMode() {
    this.IsBackgroundMode = !this.IsBackgroundMode;
    this.BackgroundAudioDiv?.remove();
    this.BackgroundAudioDiv = null;
    this.BGModeAudio?.pause();
    this.BGModeAudio?.remove();
    this.BGModeAudio = null;
    if (this.IsBackgroundMode) {
      this.BackgroundAudioDiv = document.createElement('div');
      this.BGModeAudio = new Audio('assets/empty.ogg');
      this.BGModeAudio.hidden = true;
      this.BGModeAudio.loop = true;
      this.BGModeAudio.play();
      this.BackgroundAudioDiv.appendChild(this.BGModeAudio);
      this.p5loading.update({
        id: 'toggle_bgmode',
        message: this.lang.text['Arcade']['BGModeOn'],
        progress: null,
        forceEnd: 1000,
      });
    } else {
      this.p5loading.update({
        id: 'toggle_bgmode',
        message: this.lang.text['Arcade']['BGModeOff'],
        progress: 1,
        forceEnd: 1000,
      });
    }
  }

  /** 아케이드용 웹소켓 클라이언트 */
  ArcadeWS: WebSocket;
  SelectArcadeTab: Function;
  ArcadeLoadingCtrl: HTMLIonLoadingElement;
  /** true 가 되면 ArcadeWS.onmessage 행동이 고도 엔진으로만 전달됨 */
  BackgroundWorkDone = false;
  /** 주소가 있어 공유 가능한 pck 인 경우  
   * 서버측 regInfo 에 등록하여 다른 사람과 공유할 수 있도록 구성하기
   */
  CreateInfoSocket(url: string) {
    this.ArcadeWS = new WebSocket('wss://127.0.0.1:12013');
    this.ArcadeWS.onopen = () => {
      let json = {
        type: 'initInfo',
        arcade_url: url,
      }
      this.ArcadeWS.send(JSON.stringify(json));
    }
    this.CreateArcadeWSOnMsgAct();
    this.CreateArcadeWSCloseAct();
  }

  CreateArcadeWSOnMsgAct() {
    let channel_id: string;
    this.ArcadeWS.onmessage = (ev) => {
      let data: string;
      if (typeof ev.data == 'string')
        data = ev.data;
      else data = ev.data.text();
      if (this.godot_window && this.godot_window['ws_recv'] && this.BackgroundWorkDone) {
        this.godot_window['ws_recv'](data);
        return;
      }
      try {
        let json = JSON.parse(data);
        switch (json.type) {
          case 'req_info':
            const arcade_url: string = json.arcade_url;
            let start_from_url = async () => {
              try {
                if (this.SelectArcadeTab) this.SelectArcadeTab();
                let res = await fetch(arcade_url);
                if (res.ok) {
                  let blob = await res.blob();
                  this.CreateArcadeFrame({
                    blob: blob,
                  });
                } else throw res;
              } catch (e) {
                console.log('빠른 진입 시작 오류: ', e);
              }
            }
            start_from_url();
            break;
          case 'init_id':
            channel_id = json.id;
            this.ArcadeWS.send(JSON.stringify({
              type: 'join',
              channel: channel_id,
            }));
            this.ArcadeSocketId = json.socketId;
            // this.loadingCtrl.create({ message: this.lang.text['voidDraw']['WaitingConnection'] })
            //   .then(v => {
            //     this.ArcadeLoadingCtrl = v;
            //     this.ArcadeLoadingCtrl.present();
            //   });
            break;
          case 'socket_react': // nakama.socket_react
            switch (json['act']) {
              case 'WEBRTC_REPLY_INIT_SIGNAL':
                if (this.ArcadeLoadingCtrl)
                  this.ArcadeLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Reply'];
                this.WebRTCService.WEBRTC_REPLY_INIT_SIGNAL(json['data_str'], {
                  client: this.ArcadeWS,
                  channel: channel_id,
                });
                if (json['data_str'] == 'EOL') {
                  if (this.ArcadeLoadingCtrl)
                    this.ArcadeLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Offer'];
                  this.WebRTCService.CreateAnswer({
                    client: this.ArcadeWS,
                    channel: channel_id,
                  });
                }
                if (this.ArcadeLoadingCtrl)
                  this.ArcadeLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Ice'];
                break;
              case 'WEBRTC_REPLY_INIT_SIGNAL_PART':
                this.WebRTCService.WEBRTC_REPLY_INIT_SIGNAL_PART({
                  client: this.ArcadeWS,
                  channel: channel_id,
                });
                break;
              case 'WEBRTC_ICE_CANDIDATES':
                this.WebRTCService.WEBRTC_ICE_CANDIDATES(json['data_str'], {
                  client: this.ArcadeWS,
                  channel: channel_id,
                });
                if (this.ArcadeLoadingCtrl)
                  this.ArcadeLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_datachannel'];
                this.ArcadeWS.send(JSON.stringify({
                  type: 'init_end',
                  channel: channel_id,
                }));
                break;
              case 'WEBRTC_INIT_REQ_SIGNAL':
                this.WebRTCService.WEBRTC_INIT_REQ_SIGNAL({
                  client: this.ArcadeWS,
                  channel: channel_id,
                });
                break;
              case 'WEBRTC_RECEIVE_ANSWER':
                this.WebRTCService.WEBRTC_RECEIVE_ANSWER(json['data_str'], {
                  client: this.ArcadeWS,
                  channel: channel_id,
                });
                break;
            }
            break;
          default:
            break;
        }
      } catch (e) { }
    }
  }

  CreateArcadeWSCloseAct() {
    this.ArcadeWS.onerror = (e) => {
      console.log('아케이드 소켓 오류: ', e);
      this.ArcadeWS.close();
    }
    this.ArcadeWS.onclose = () => {
      this.ArcadeSocketId = null;
      this.BackgroundWorkDone = false;
      this.WebRTCService.close_webrtc();
      this.ArcadeQRAddress = null;
      this.ArcadeQRCodeSRC = null;
      this.ArcadeWS.onopen = null;
      this.ArcadeWS.onmessage = null;
      this.ArcadeWS.onclose = null;
      this.ArcadeWS = null;
    }
  }

  /** 글로벌에서 사용할 수 있도록 개체를 기억함 */
  ArcadeObject = {
    QRCode: undefined as IonModal,
  };
  ArcadeQRAddress: string;
  ArcadeSocketId: string;
  ArcadeQRCodeSRC: any;

  /** 아케이드 페이지 QRCode 모달 생성하기 */
  OpenArcadeQRCode() {
    this.ArcadeObject['QRCode'].onDidDismiss().then(() => {
      this.RestoreShortCutAct('arcade-qrcode');
    });
    this.StoreShortCutAct('arcade-qrcode');
    this.ArcadeObject['QRCode'].present();
  }

  /** 빠른 진입 등으로 소켓 정보를 아는 경우 소켓 정보로 참여하기 */
  JoinArcadeWithSocketInfo(json: any) {
    this.ArcadeSocketId = json.socketId;
    if (this.ArcadeWS) {
      this.p5toast.show({
        text: this.lang.text['Arcade']['AlreadyUseWS'],
      });
      return;
    }
    this.ArcadeWS = new WebSocket(json.server);
    this.ArcadeWS.onopen = () => {
      let json = {
        type: 'reqInfo',
        socketId: this.ArcadeSocketId,
      }
      this.ArcadeWS.send(JSON.stringify(json));
    }
    this.CreateArcadeWSOnMsgAct();
    this.CreateArcadeWSCloseAct();
  }

  /** 파일의 부분 base64 정보 받기 */
  req_file_part_base64(file_info: any, index: number, path: string): string {
    let binary = '';
    let bytes = new Uint8Array(file_info.contents.slice(index * FILE_BINARY_LIMIT, (index + 1) * FILE_BINARY_LIMIT));
    for (let i = 0, j = bytes.byteLength; i < j; i++)
      binary += String.fromCharCode(bytes[i]);
    let base64 = btoa(binary);
    this.indexed.saveTextFileToUserPath(JSON.stringify({ type: 'upload', index: index }), `${path}.history`);
    return base64;
  }

  /** 파일 파트 저장하기 */
  save_file_part(path: string, index: number, base64: string) {
    this.indexed.saveBase64ToUserPath(',' + base64, `${path}_part/${index}.part`);
    this.indexed.saveTextFileToUserPath(JSON.stringify({ type: 'download', index: index }), `${path}.history`);
  }

  /** 사용된 함수들 삭제 */
  remove_req_file_info(msg: any, path: string) {
    delete msg.content['transfer_index'];
    this.indexed.removeFileFromUserPath(`${path}.history`);
  }

  /** 메시지에 썸네일 콘텐츠를 생성 */
  async modulate_thumbnail(msg_content: FileInfo, ObjectURL: string, cont?: AbortController) {
    try { // 대안 썸네일이 있다면 보여주고 끝내기
      let blob = await this.indexed.loadBlobFromUserPath(`${msg_content['path']}_thumbnail.png`, 'image/png');
      const FileURL = URL.createObjectURL(blob);
      msg_content['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(FileURL);
      setTimeout(() => {
        URL.revokeObjectURL(FileURL);
        if (ObjectURL) URL.revokeObjectURL(ObjectURL);
      }, 100);
      return;
    } catch (e) { }
    switch (msg_content['viewer']) {
      case 'image':
        try {
          if (msg_content['size'] > 5000000) return;
          if (!msg_content['url']) throw 'No URL';
          let res = await fetch(msg_content['url'], { method: 'HEAD', signal: cont?.signal });
          if (res.ok) msg_content['thumbnail'] = msg_content['url'];
          else throw 'Not ok';
        } catch (e) {
          if (ObjectURL) msg_content['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(ObjectURL);
        }
        break;
      case 'text':
        if (msg_content['url']) {
          let text = await fetch(msg_content['url'], { signal: cont?.signal }).then(r => r.text());
          msg_content['text'] = text.substring(0, 45).split('\n');
        } else new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.loadStrings(ObjectURL, v => {
              const all_text = v.join('\n');
              const reduce_len = all_text.substring(0, 45);
              msg_content['text'] = reduce_len.split('\n');
              URL.revokeObjectURL(ObjectURL);
              p.remove();
            }, e => {
              console.log('텍스트 열람 불가: ', e);
              msg_content['text'] = [this.lang.text['ChatRoom']['downloaded']];
              URL.revokeObjectURL(ObjectURL);
              p.remove();
            });
          }
        });
        break;
    }
    if (ObjectURL) setTimeout(() => {
      URL.revokeObjectURL(ObjectURL);
    }, 100);
  }

  /** 콘텐츠 카테고리 분류  
   * type 키를 검토한 후 file_ext 를 이용하여 검토
   */
  set_viewer_category(msg_content: any) {
    try { // 자동지정 타입이 있는 경우
      this.set_viewer_category_from_ext(msg_content);
      if (msg_content.viewer == 'disabled') {
        if (msg_content['type'].indexOf('image/') == 0) // 분류상 이미지
          msg_content['viewer'] = 'image';
        else if (msg_content['type'].indexOf('audio/') == 0) // 분류상 소리
          msg_content['viewer'] = 'audio';
        else if (msg_content['type'].indexOf('video/') == 0) // 분류상 비디오
          msg_content['viewer'] = 'video';
        else if (msg_content['type'].indexOf('text/') == 0) // 분류상 텍스트 문서
          msg_content['viewer'] = 'text';
        else throw "자동지정되지 않은 타입";
      }
    } catch (e) { // 자동지정 타입이 없는 경우
      console.log('불확실한 타입 지정: ', e, '/ type: ', msg_content['type']);
    }
  }

  /** 파일 이름의 확장자 부분으로부터 뷰어 카테고리를 분류 */
  set_viewer_category_from_ext(info: any) {
    switch (info['file_ext']) {
      // 모델링류
      // case 'obj': // obj, stl 이 p5.loadModel 에 의해 불러와지지 않음을 확인
      // case 'stl':
      // case 'glb':
      // case 'gltf':
      case 'blend':
        info['viewer'] = 'blender';
        break;
      // 고도엔진 패키지 파일
      case 'pck':
        info['viewer'] = 'godot';
        break;
      // 이미지류
      case 'png':
      case 'jpeg':
      case 'jpg':
      case 'webp':
      case 'gif':
      case 'svg':
        info['viewer'] = 'image';
        break;
      // 사운드류
      case 'wav':
      case 'ogg':
      case 'mp3':
      case 'aac':
        info['viewer'] = 'audio';
        break;
      // 비디오류
      case 'mp4':
      case 'ogv':
        info['viewer'] = 'video';
        break;
      // 웹 미디어 병행가능한 구성
      case 'webm':
        try {
          if (info['type'].indexOf('video/') == 0)
            info['viewer'] = 'video';
          else info['viewer'] = 'audio';
        } catch (e) {
          console.log('파일 확장자 검토 오류: ', e, '/', info);
          info['viewer'] = 'disabled';
        }
        break;
      // 코드류
      case 'sh': // Shell
      case 'c': // C
      case 'cs': // C#
      case 'ts': // Typescript
      case 'js': // Javascript
      case 'cc': // C++
      case 'php':
      case 'h': // 헤더파일
      case 'cpp': // C++
      case 'rs': // rust
      case 'java':
      case 'gd': // Godot script
      case 'shader': // 고도엔진 셰이더
      case 'py': // Python
      case 'ino': // Arduino
      case 'pde': // Processing
      case 'asm': // 어셈블리
      case 'bas': // 베이직
      case 'pas': // 파스칼
      case 'asp': // MS WebScript
      case 'html':
      case 'xml':
      case 'css':
      case 'scss':
      case 'pl': // Perl
      case 'md': // 마크다운
      case 'markdown': // 마크다운
      case 'prop': // 설정 파일
      case 'properties': // 설정 파일
      case 'json': // 코드는 아니지만 구문 강조가 있으면 좋음
      case 'yml':
        info['viewer'] = 'code';
        break;
      // 텍스트류
      case 'csv': // Table
      case 'conf': // 설정 파일
      case 'log':
      case 'txt':
      case 'gitignore':
        info['viewer'] = 'text';
        break;
      case 'pdf':
        info['viewer'] = 'pdf';
        break;
      default: // 뷰어 제한 파일 (파일 오프너 활용됨)
        info['viewer'] = 'disabled';
        break;
    }
  }

  /** base64 정보를 반환하는 간단한 코드 */
  GetBase64ThroughFileReader(file: any): Promise<string> {
    return new Promise((done, error) => {
      let reader: any = new FileReader();
      reader = reader._realReader ?? reader;
      reader.onload = (ev: any) => {
        reader.onload = null;
        reader.onerror = null;
        done(ev.target.result.replace(/"|\\|=/g, ''));
      }
      reader.onerror = (ev: any) => {
        reader.onload = null;
        reader.onerror = null;
        error(ev);
      }
      reader.readAsDataURL(file);
    });
  }

  /** base64를 넣어서 blob 받기
   * @param base64 자료
   * @param type 파일 타입
   */
  Base64ToBlob(base64: string, type = ''): Blob {
    let byteStr = atob(base64.split(',')[1]);
    let arrayBuffer = new ArrayBuffer(byteStr.length);
    let int8Array = new Int8Array(arrayBuffer);
    for (let i = 0, j = byteStr.length; i < j; i++)
      int8Array[i] = byteStr.charCodeAt(i);
    let blob = new Blob([int8Array], { type: type });
    return blob;
  }

  /** 병행 스토리지 서버에 파일 업로드 시도
   * @param address 해당 서버 주소
   * @returns 등록된 주소 반환
   */
  async upload_file_to_storage(file: FileInfo, info: ServerInfoShort, protocol: string, address: string, useCustomServer: boolean, loadingId?: string, override_try_msg?: string): Promise<string> {
    const actId = loadingId || `upload_file_to_storage_${Date.now()}`;
    let Catched = false;
    let CatchedAddress: string;
    if (useCustomServer)
      CatchedAddress = await this.try_upload_to_user_custom_fs(file, info?.user_id, actId, override_try_msg);
    let progress: any;
    try { // 사설 연계 서버에 업로드 시도
      if (CatchedAddress) {
        Catched = true;
        throw '사용자 지정서버에서 이미 성공함'
      };
      const upload_time = new Date().getTime();
      const only_filename = file.filename.substring(0, file.filename.lastIndexOf('.'));
      const filename = file.override_name || `${info?.user_id.replace(/\//g, '_')}_${upload_time}_${only_filename}.${file.file_ext}`;
      const path = file.override_path ?? `${info?.user_id}/${upload_time}`.replace(/_/g, '/');
      CatchedAddress = `${protocol}//${address}:${info?.apache_port || 9002}/cdn/`;
      const startPath = filename.replace(/\//g, '_');
      progress = setInterval(async () => {
        try {
          const res = await fetch(`${protocol}//${address}:${info?.cdn_port || 9001}/filesize/${startPath}`, { method: "POST" });
          const currentSize = Number(await res.text());
          const progress = currentSize / file.size;
          const progressPercent = Math.floor(progress * 100);
          this.p5loading.update({
            id: actId,
            message: `${override_try_msg ? override_try_msg + ': ' : ''}${file.filename}: ${progressPercent || 0}%`,
            progress: progress,
          });
        } catch (e) {
          console.log('파일 크기 측정 오류: ', e);
        }
      }, 700);
      let formData = new FormData();
      const _file = new File([file.blob], filename);
      formData.append("files", _file);
      formData.append("path", path);
      formData.append("filename", file.override_filename || `${only_filename}.${file.file_ext}`);
      let up_res = await fetch(`${protocol}//${address}:${info?.cdn_port || 9001}/cdn/${filename}`, { method: "POST", body: formData });
      const received = await up_res.text();
      CatchedAddress += received;
      if (!up_res.ok) throw '업로드 단계에서 실패';
      this.p5loading.update({
        id: actId,
        message: `${override_try_msg ? override_try_msg + ': ' : ''}${file.filename}: 100%`,
        progress: 1,
      });
      clearInterval(progress);
      const res = await fetch(CatchedAddress, { method: 'HEAD' });
      if (!loadingId) this.p5loading.remove(actId);
      if (res.ok) Catched = true;
      else throw '요청 실패';
    } catch (e) {
      clearInterval(progress);
      this.p5loading.update({
        id: actId,
        message: `${this.lang.text['GlobalAct']['CancelingUpload']}: ${file.filename}`,
        forceEnd: 350,
      });
      console.log('cdn 파일 업로드 단계 실패:', e);
    }
    return Catched ? CatchedAddress : undefined;
  }

  /** 해당 주소의 파일 삭제 요청 (cdn 기반 파일) */
  async remove_file_from_storage(url: string, info: ServerInfoShort) {
    try {
      let sep = url.split('/cdn/');
      let target_file_name = sep.pop();
      let target_address = sep.shift();
      let lastIndex = target_address.lastIndexOf(':');
      if (lastIndex > 5) target_address = target_address.substring(0, lastIndex);
      await fetch(`${target_address}:${info?.cdn_port || 9001}/remove/${target_file_name}`, { method: "POST" });
    } catch (e) {
      console.log('remove_file_from_storage: ', e);
    }
  }

  /** 해당 키워드가 포함된 모든 파일 삭제 요청 (cdn 기반 파일)  
   * 채널 삭제 또는 계정 삭제 등 일괄 삭제 처리가 필요할 때 사용됩니다
   * @param target_address 해당 서버 주소 (protocol://address 까지) (FFS는 포함되지 않음)
   * @param target_id 인덱스 키 값
   */
  async remove_files_from_storage_with_key(target_address: string, target_id: string, info: ServerInfoShort) {
    try {
      if (!target_address) throw '대상 주소 없음';
      let lastIndex = target_address.lastIndexOf(':');
      if (lastIndex > 5) target_address = target_address.substring(0, lastIndex);
      await fetch(`${target_address}:${info?.cdn_port || 9001}/remove_key/${target_id}`, { method: "POST" });
    } catch (e) {
      console.log('remove_files_from_storage_with_key: ', e);
      throw e;
    }
  }

  /** 사용자 지정 서버에 업로드 시도 */
  async try_upload_to_user_custom_fs(file: FileInfo, user_id: string, loadingId?: string, override_try_msg?: string, override_ffs_str?: string) {
    const actId = loadingId || `try_upload_to_user_custom_fs_${Date.now()}`;
    await this.p5loading.update({
      id: actId,
      message: `${this.lang.text['Settings']['TryToFallbackFS']}: ${file.filename}`,
      progress: null,
    });
    const upload_time = new Date().getTime();
    const only_filename = file.filename.substring(0, file.filename.lastIndexOf('.'));
    const filename = file.override_name || `${user_id.replace(/\//g, '_')}_${upload_time}_${only_filename}.${file.file_ext}`;
    const path = file.override_path ?? `${user_id}/${upload_time}`.replace(/_/g, '/');
    let formData = new FormData();
    const _file = new File([file.blob], filename);
    formData.append("files", _file);
    formData.append("path", path);
    formData.append("filename", file.override_filename || `${only_filename}.${file.file_ext}`);
    if (!override_ffs_str)
      override_ffs_str = localStorage.getItem('fallback_fs');
    let progress: any;
    try { // 사용자 지정 서버 업로드 시도 우선
      if (!override_ffs_str) throw '사용자 지정 서버 없음';
      const split_fullAddress = override_ffs_str.split('://');
      const address = split_fullAddress.pop().split(':');
      let protocol = split_fullAddress.pop();
      if (protocol) {
        protocol += ':';
      } else protocol = this.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
      let CatchedAddress = `${protocol}//${address[0]}:${address[1] || 9002}/cdn/`;
      const startPath = filename.replace(/\//g, '_');
      progress = setInterval(async () => {
        try {
          const res = await fetch(`${protocol}//${address[0]}:9001/filesize/${startPath}`, { method: "POST" });
          const currentSize = Number(await res.text());
          const progress = currentSize / file.size;
          const progressPercent = Math.floor(progress * 100);
          this.p5loading.update({
            id: actId,
            message: `${override_try_msg ? override_try_msg + ': ' : ''}${file.filename}: ${progressPercent || 0}%`,
            progress: progress,
          });
        } catch (e) {
          console.log('FFS 파일 크기 측정 오류: ', e);
        }
      }, 700);
      const up_res = await fetch(`${protocol}//${address[0]}:9001/cdn/${filename}`, { method: "POST", body: formData });
      const received = await up_res.text();
      CatchedAddress += received;
      if (!up_res.ok) throw '업로드 단계에서 실패';
      this.p5loading.update({
        id: actId,
        message: `${override_try_msg ? override_try_msg + ': ' : ''}${file.filename}: 100%`,
        progress: 1,
      });
      clearInterval(progress);
      const res = await fetch(CatchedAddress, { method: 'HEAD' });
      if (!loadingId) this.p5loading.remove(actId);
      if (res.ok) return CatchedAddress;
      else throw '요청 실패';
    } catch (e) {
      clearInterval(progress);
      this.p5loading.remove(actId);
      return undefined;
    }
  }

  /** 웹 페이지 링크와 관련된 간단한 정보 수집 (서버 요청)  
   * 서버 주소와 무관하게 FFS 에서 우선적으로 처리를 시도함
   * @param msg 메시지 양식
   * @param reqAddress 요청하려는 서버 주소 (FFS 이후에 동작)
   * @returns 서버로부터 받은 정보 json
   */
  async GetHrefThumbnail(url: string, reqAddress?: string, cont?: AbortController) {
    let result = null;
    if (url.indexOf('https://') != 0 && url.indexOf('http://') != 0) {
      let checkProt = this.checkProtocolFromAddress(url);
      url = (checkProt ? 'https://' : 'http://') + url;
    }
    // FFS 가 준비되어있다면 해당 서버에 먼저 요청 시도
    try {
      let ffs_stored = localStorage.getItem('fallback_fs');
      let sep = ffs_stored.split('://');
      let sep_header = sep.shift();
      let sep_address = sep.pop();
      let getOnlyAddress = sep_address.split(':').pop();
      if (!getOnlyAddress) throw '지정된 FFS 없음';
      let res = await fetch(`${sep_header || this.checkProtocolFromAddress(getOnlyAddress) ? 'https' : 'http'}://${getOnlyAddress}:9001/get-page-info?url=${encodeURIComponent(url)}`, { signal: cont.signal });
      if (res.ok) {
        let json = await res.json();
        result = json;
      } else throw 'FFS 우회 실패';
    } catch (e) {
      if (!reqAddress) throw '대상 서버 없음';
      // 그게 아니라면 해당 서버에 요청 시도
      try {
        let res = await fetch(`${reqAddress}/get-page-info?url=${encodeURIComponent(url)}`, { signal: cont.signal });
        if (res.ok) {
          let json = await res.json();
          result = json;
        } else throw `${res.statusText} (${res.status})`;
      } catch (e) {
        console.log('GetHrefThumbnail: ', e);
      }
    }
    return result;
  }

  /** 입력된 주소가 IP주소로 구성되어있는지 검토
   * @returns boolean: 주소가 dns 형식으로 ssl 사용이 예상되면 true, 주소가 ip 주소로 비보안이 예상되면 false
   */
  checkProtocolFromAddress(address: string) {
    return Boolean(address.replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, ''));
  }

  /** JSBlend 파일 캐싱  
   * URL 주소를 기억하고 있다가 제거될 때 링크 제거
   */
  JSBlendCache = {};
  /** BlenderCtrl 사용을 기억함 */
  BlenderLoadingCtrl: HTMLIonLoadingElement;
  BlenderCanvasInside: p5.Renderer;
  /** blender 파일 읽기 후 특정 개체에 넣기 */
  load_blender_file(canvasDiv: HTMLElement, FileInfo: FileInfo, OnLoaded: Function, OnFailedToLoad: Function, cont?: AbortController): p5 {
    return new p5((p: p5) => {
      /** 수집된 광원 */
      let lights = [];
      /** 수집된 메쉬들 */
      let meshes = [];
      /** 수집된 카메라 */
      let cameras = [];
      /** 텍스처 이미지 불러오기 [데이터 id로 분류]: p5.Image */
      let texture_images = {};
      let LogDiv: p5.Element;
      p.setup = async () => {
        let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight, p.WEBGL);
        canvas.parent(canvasDiv);
        this.BlenderLoadingCtrl = await this.loadingCtrl.create({ message: this.lang.text['ContentViewer']['OnLoadContent'] });
        this.BlenderLoadingCtrl.present();
        this.BlenderCanvasInside = canvas;
        p.textureMode(p.NORMAL);
        p.textureWrap(p.REPEAT);
        p.clear(255, 255, 255, 0);
        p.pixelDensity(1);
        let blob: Blob;
        try {
          blob = await this.indexed.loadBlobFromUserPath(FileInfo.path, FileInfo.type || '');
        } catch (e) {
          try {
            let from_url = await fetch(FileInfo.url, { signal: cont?.signal });
            blob = await from_url.blob();
          } catch (e) {
            console.log('뷰어에서 파일 불러오기 실패: ', e);
            this.BlenderLoadingCtrl.dismiss();
            OnFailedToLoad();
          }
        }
        // js.blend 페이지 불러오기
        let keys = Object.keys(this.JSBlendCache);
        keys.forEach(key => {
          URL.revokeObjectURL(this.JSBlendCache[key]);
          delete this.JSBlendCache[key];
        });
        try { // 오프라인 동작 호환을 위해 iframe 에 필요한 구성요소를 blob URL 로 구성함
          let js = await fetch('assets/js.blend/build/js.blend.js', { signal: cont?.signal });
          let jsBlob = await js.blob();
          let jsURL = URL.createObjectURL(jsBlob);
          this.JSBlendCache['js'] = jsURL;
          let three = await fetch('assets/js.blend/example/three.js', { signal: cont?.signal });
          let threeBlob = await three.blob();
          let threeURL = URL.createObjectURL(threeBlob);
          this.JSBlendCache['three'] = threeURL;
          let index = await fetch('assets/js.blend/index.html', { signal: cont?.signal });
          let indexText = await index.text();
          indexText = indexText.replace('src="./build/js.blend.js"', `src="${jsURL}"`).replace('src="./example/three.js"', `src="${threeURL}"`);
          let indexBlob = new Blob([indexText], { type: 'text/html' });
          let indexURL = URL.createObjectURL(indexBlob);
          this.JSBlendCache['index'] = indexURL;
        } catch (e) {
          console.log('블렌더 페이지 불러오기 실패: ', e);
        }
        let jsBlend = p.createElement('iframe');
        jsBlend.elt.id = 'jsBlend';
        jsBlend.elt.setAttribute("src", this.JSBlendCache['index']);
        jsBlend.elt.setAttribute("frameborder", "0");
        jsBlend.elt.setAttribute('class', 'full_screen');
        jsBlend.elt.setAttribute('allow', 'fullscreen; encrypted-media');
        jsBlend.elt.setAttribute('scrolling', 'no');
        jsBlend.elt.setAttribute('withCredentials', 'true');
        jsBlend.hide();
        canvasDiv.appendChild(jsBlend.elt);
        jsBlend.elt.contentWindow['TARGET_FILE'] = blob;
        // 불러오기 로딩 관련 로그 보여주기
        jsBlend.elt.onload = async () => {
          if (!blob) { // 파일이 열리지 않음 알림
            this.p5toast.show({
              text: this.lang.text['ContentViewer']['CannotOpenText'],
            });
            return;
          }
          LogDiv = p.createDiv()
          LogDiv.parent(canvasDiv);
          LogDiv.id('logDiv');
          LogDiv.style('position', 'absolute');
          LogDiv.style('top', '0');
          LogDiv.style('left', '0');
          LogDiv.style('width', '100%');
          LogDiv.style('height', '100%');
          LogDiv.style('max-height', `${canvasDiv.clientHeight}px`);
          LogDiv.style('pointer-events', 'none');
          this.BlenderLoadingCtrl.dismiss();
          // 페이지에서 처리 실패가 일어나면 코드가 멈춰버리므로 loading 구성이 분리됨
          let blend = await jsBlend.elt.contentWindow['JSBLEND'](blob);
          this.BlenderLoadingCtrl = await this.loadingCtrl.create({ message: this.lang.text['ContentViewer']['OnLoadContent'] });
          this.BlenderLoadingCtrl.present();
          // 모든 개체를 돌며 개체에 맞는 생성 동작
          const RATIO = 100;
          /** 블랜더 파일 (ArrayBuffer) */
          let blenderFile = blend.file.AB;
          // 내장 파일 불러오기 (PackedFiles)
          if (blend.file.objects.PackedFile)
            for (let i = 0, j = blend.file.objects.PackedFile.length; i < j; i++) {
              let PackedFile = blend.file.objects.PackedFile[i];
              let data_address = PackedFile.data['__data_address__'];
              let data_size = PackedFile.size;
              let ImageBuffer = blenderFile.slice(data_address, data_address + data_size);
              let blob = new Blob([ImageBuffer]);
              let ImageTextureURL = URL.createObjectURL(blob);
              p.loadImage(ImageTextureURL, v => {
                texture_images[PackedFile.data['__data_address__']] = v;
                URL.revokeObjectURL(ImageTextureURL);
              }, e => {
                console.log('텍스쳐 불러오기 실패: ', e);
                URL.revokeObjectURL(ImageTextureURL);
              });
            }
          /** 개체별 UV 누적정보 */
          let UVPositionList = blend.file.objects.vec2f;
          /** 현재 개체가 참고하게될 UV 정보 시작점 */
          let UVPositionIndex = 0;
          /** 파일에 준비된 메쉬들(정보 검토용) */
          let Meshes = blend.file.objects.Mesh;
          /** 모든 개체의 점 위치 정보 나열 */
          let MeshVertexPositions = blend.file.objects.vec3f;
          /** 현재 개체가 참고하게될 점 정보 시작점 */
          let MeshVertexIndex = 0;
          /** 모든 개체의 선 구성 정보 나열 */
          let MeshEdgeData = blend.file.objects.vec2i;
          /** 현재 개체가 참고하게될 선 정보의 시작점 */
          let MeshEdgeIndex = 0;
          // 모델 정보 불러오기
          for (let i = 0, j = blend.file.objects.Object.length; i < j; i++) {
            /** 이 개체의 정보 */
            let obj = blend.file.objects.Object[i];
            this.BlenderLoadingCtrl.message = `${this.lang.text['ContentViewer']['ReadObject']}: ${obj.aname}`;
            // 공통 정보
            let location = p.createVector(
              -obj.loc[0] * RATIO,
              -obj.loc[2] * RATIO,
              obj.loc[1] * RATIO
            );
            let rotation = p.createVector(
              obj.rot[0],
              obj.rot[2],
              -obj.rot[1]
            );
            switch (obj.type) {
              case 1: // mesh
                { // 모델 정보 기반으로 Geometry 개체 만들기
                  {
                    // 충돌체 및 임시 개체 무시 (https://docs.godotengine.org/en/4.1/tutorials/assets_pipeline/importing_scenes.html)
                    let suffixes = ['noimp', 'colonly', 'convcolonly', 'navmesh'];
                    let ignore_mesh = false;
                    for (let i = 0, j = suffixes.length; i < j; i++)
                      if (obj.aname.indexOf(suffixes[i], obj.aname.length - suffixes[i].length) !== -1) {
                        ignore_mesh = true;
                        break;
                      }
                    if (!ignore_mesh) // 숨겨진 개체인지 검토 (object-hidden)
                      ignore_mesh = obj.base_flag == 448;
                    if (ignore_mesh) continue;
                  }
                  /** 이 메쉬가 몇번째로 등록된 메쉬인지 검토 */
                  let MeshIndex = null;
                  for (let k = 0, l = Meshes.length; k < l; k++)
                    if (Meshes[k].address == obj.data.address) {
                      MeshIndex = k;
                      break;
                    }
                  try { // 이 개체의 UV 정보 위치 잡기
                    let StackIndex = -1;
                    for (let k = 0, l = UVPositionList.length; k < l; k++)
                      if (UVPositionList[k].address) {
                        StackIndex++;
                        if (StackIndex == MeshIndex) {
                          UVPositionIndex = k;
                          break;
                        }
                      }
                  } catch (e) { }
                  /** 모델의 정점 정보 수집 (position) */
                  let vertex_id: any;
                  try { // 이 개체의 점 정보 잡기
                    let StackIndex = -1;
                    let CatchIndex = false;
                    let l = MeshVertexPositions.length;
                    for (let k = 0; k < l; k++)
                      if (MeshVertexPositions[k].address) {
                        StackIndex++;
                        if (!CatchIndex) {
                          if (StackIndex == MeshIndex) {
                            MeshVertexIndex = k;
                            CatchIndex = true;
                          }
                        } else { // 정보 길이 검토
                          vertex_id = MeshVertexPositions.slice(MeshVertexIndex, k);
                          break;
                        }
                      }
                    if (!vertex_id)
                      vertex_id = MeshVertexPositions.slice(MeshVertexIndex, l);
                  } catch (e) { }
                  /** 각 정점간 연결 정보 (x: 시작점, y: 대상점) */
                  let edge_id: any;
                  try { // 이 개체의 선 정보 잡기
                    let StackIndex = -1;
                    let CatchIndex = false;
                    let l = MeshEdgeData.length;
                    for (let k = 0; k < l; k++)
                      if (MeshEdgeData[k].address) {
                        StackIndex++;
                        if (!CatchIndex) {
                          if (StackIndex == MeshIndex) {
                            MeshEdgeIndex = k;
                            CatchIndex = true;
                          }
                        } else { // 정보 길이 검토
                          edge_id = MeshEdgeData.slice(MeshEdgeIndex, k);
                          break;
                        }
                      }
                    if (!edge_id)
                      edge_id = MeshEdgeData.slice(MeshEdgeIndex, l);
                  } catch (e) { }
                  let shape: any; // p5.Geometry
                  /** 각 면과 관련된 정보 */
                  let qface_info: any;
                  if (obj.data.ldata.layers.length) {
                    for (let i = 0, j = obj.data.ldata.layers.length; i < j; i++)
                      switch (obj.data.ldata.layers[i].type) {
                        case 11: // 면을 구성하는 점 정보가 나열됨
                          qface_info = obj.data.ldata.layers[i].data;
                          break;
                        default:
                          // console.log(obj.data.ldata.layers[i].type, '_ldata 준비되지 않음: ', obj.data.ldata.layers[i]);
                          break;
                      }
                  } else qface_info = obj.data.ldata.layers.data;
                  // 정보 기반 그리기 행동
                  p['beginGeometry']();
                  p.push();
                  p.translate(location);
                  p.scale(
                    obj.size[0],
                    obj.size[2],
                    obj.size[1]
                  );
                  let hasRot = obj.rot[0] + obj.rot[1] + obj.rot[2];
                  if (hasRot) {  // 각도가 설정되어있다면
                    LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-warning-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['MayGimbalLock']}</div>`;
                    p.rotate(p.HALF_PI, rotation);
                  }
                  try { // 정점 관계도 사용 구간
                    /** 정점간 관계도 구축 (선으로 연결되는지 여부 수집) */
                    let vertex_linked = [];
                    for (let i = 0, j = vertex_id.length; i < j; i++)
                      vertex_linked.push([]);
                    for (let i = 0, j = edge_id.length; i < j; i++) {
                      let edge_id_start = edge_id[i].x ?? edge_id[i].v1;
                      let edge_id_end = edge_id[i].y ?? edge_id[i].v2;
                      vertex_linked[edge_id_start].push(edge_id_end);
                      vertex_linked[edge_id_end].push(edge_id_start);
                    }
                    // 면 생성하기
                    for (let h = qface_info.length - 1, i = h,
                      head_id = undefined, last_id = undefined;
                      i >= 0; i--) {
                      /** 현재 사용할 정점 */
                      let current_id = qface_info[i]['i'];
                      // 가장 처음에 시작할 때, 그리기 시작
                      let vertexTargetX = vertex_id[current_id].x ?? vertex_id[current_id]['co'][0];
                      let vertexTargetY = vertex_id[current_id].y ?? vertex_id[current_id]['co'][1];
                      let vertexTargetZ = vertex_id[current_id].z ?? vertex_id[current_id]['co'][2];
                      if (last_id === undefined) {
                        p.beginShape();
                        p.vertex(
                          -vertexTargetX * RATIO,
                          -vertexTargetZ * RATIO,
                          vertexTargetY * RATIO,
                          UVPositionList[UVPositionIndex + i].x,
                          -UVPositionList[UVPositionIndex + i].y
                        );
                        head_id = current_id;
                        last_id = current_id;
                        continue;
                      } // 아래, 처음 이후 그리기 동작
                      try {
                        // 현재 정점이 이전 정점으로부터 그려질 수 있는지 검토
                        let checkIfCanLinked = vertex_linked[last_id].includes(current_id);
                        if (!checkIfCanLinked) throw '마지막 점으로부터 그릴 수 없음';
                        p.vertex(
                          -vertexTargetX * RATIO,
                          -vertexTargetZ * RATIO,
                          vertexTargetY * RATIO,
                          UVPositionList[UVPositionIndex + i].x,
                          -UVPositionList[UVPositionIndex + i].y
                        );
                        let checkIfCanClosed = false;
                        // 시작점이 곧 마지막 점이 아니라면, 시작점으로 돌아갈 수 있는지 여부 확인
                        if (last_id != head_id)
                          checkIfCanClosed = vertex_linked[current_id].includes(head_id);
                        if (checkIfCanClosed) throw '돌아갈 수 있는데 돌아가지 않는다면 새 시작점으로 인식';
                      } catch (e) { // 새 시작점으로 인식
                        p.endShape(p.CLOSE);
                        last_id = undefined;
                        continue;
                      }
                      last_id = current_id;
                    }
                  } catch (e) {
                    console.log('메쉬 정보 불러오기 오류: ', e);
                    LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['LoadMeshFailed']}: ${e}</div>`;
                  }
                  p.pop();
                  shape = p['endGeometry']();
                  // 머터리얼 정보 받아오기
                  let imgtex_id: any;
                  let base_color: p5.Color;
                  let emission_color: p5.Color;
                  let emission_strength: number = 0;
                  try {
                    if (!obj.data.mat.length) throw 'no_mat';
                    for (let i = 0, j = obj.data.mat.length; i < j; i++) {
                      // 머터리얼 기반 색상 찾기
                      try {
                        let _BaseColor = obj.data.mat[i].nodetree.nodes.first.next.inputs.first.default_value.value;
                        base_color = p.color(
                          (_BaseColor[0] || 0) * 255,
                          (_BaseColor[1] || 0) * 255,
                          (_BaseColor[2] || 0) * 255,
                          (_BaseColor[3] || 0) * 255
                        );
                      } catch (e) {
                        console.log('베이스 색상 가져오기 실패: ', e);
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['FailedGetBaseColor']}: ${e}</div>`;
                      }
                      try {
                        let _EmissionColor = obj.data.mat[i].nodetree.nodes.first.next.inputs.last.prev.default_value.value;
                        emission_strength = obj.data.mat[i].nodetree.nodes.first.next.inputs.last.default_value.value;
                        emission_color = p.color(
                          (_EmissionColor[0] || 0) * 255,
                          (_EmissionColor[1] || 0) * 255,
                          (_EmissionColor[2] || 0) * 255,
                          (_EmissionColor[3] || 0) * 255
                        );
                      } catch (e) {
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['FailedGetEmitColor']}: ${e}</div>`;
                      }
                      // 이미지 텍스처 재질 받기
                      if (obj.data.mat[i].nodetree.nodes.last.id) { // 내장 이미지 파일을 읽어내기
                        let packedfile = obj.data.mat[i].nodetree.nodes.last.id.packedfile;
                        if (!packedfile) throw 'unpacked';
                        imgtex_id = packedfile.data['__data_address__'];
                      }
                    }
                  } catch (e) {
                    switch (e) {
                      case 'unpacked': // 파일에 내장되지 않음(링크 파일)
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-warning-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['LinkedTexFile']}</div>`;
                        break;
                      case 'no_mat':
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-medium-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['NoMaterial']}</div>`;
                        break;
                      default: // 정의되지 않은 오류
                        console.log(obj.aname, '_재질 정보 불러오기 오류: ', e);
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${e}</div>`;
                        break;
                    }
                  }
                  // shade 옵션 (Flat/Smooth)
                  shape['computeNormals']();
                  // 개체 정보 누적
                  meshes.push({
                    id: obj.data.address,
                    name: obj.data.aname,
                    color: base_color,
                    emissionColor: emission_color,
                    emissionStrength: emission_strength,
                    texture: imgtex_id,
                    mesh: shape,
                  });
                }
                break;
              case 10: { // lamp
                // 빛의 종류 구분이 필요
                if (lights.length < 5) {
                  LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-warning-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['OnWorkReadLightMode']}</div>`;
                  // 빛 정보 구분이 어려우므로 일단 포인트 조명으로 통일
                  lights.push({
                    type: 'point',
                    loc: location,
                    rot: rotation,
                    color: p.color(255, 255, 255),
                  });
                } else LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-medium-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['ReachLightLimit']}</div>`;
              }
              // case 0: // empty
              //   break;
              // case 11: // camera
              //   break;
              // case 25: // Armature
              //   break;
              default: // 준비되지 않은 데이터 필터용
                break;
            }
            await new Promise(res => setTimeout(res, 0));
          }
          this.BlenderLoadingCtrl.dismiss();
          setTimeout(() => {
            LogDiv.remove()
          }, 8000);
          OnLoaded();
          let keys = Object.keys(this.JSBlendCache);
          keys.forEach(key => {
            URL.revokeObjectURL(this.JSBlendCache[key]);
            delete this.JSBlendCache[key];
          });
          jsBlend.elt.onload = null;
        };
        p.camera(0, 0, -(p.height / 2) / p.tan(p.PI * 30.0 / 180.0), 0, 0, 0, 0, 1, 0);
      }
      p.draw = () => {
        p.clear(255, 255, 255, 0);
        p.orbitControl();
        if (lights.length) {
          for (let i = 0, j = lights.length; i < j; i++) {
            switch (lights[i].type) {
              case 'point':
                p.pointLight(lights[i].color, lights[i].loc);
                break;
              default:
                break;
            }
          }
        } else // 빛이 없다면 기본 빛 부여
          p.directionalLight(128, 128, 128, -1, 1, 1);
        p.ambientLight(128);
        for (let i = 0, j = meshes.length; i < j; i++) {
          p.push();
          if (meshes[i].texture) {
            p.noStroke();
            if (texture_images[meshes[i].texture]) {
              p.texture(texture_images[meshes[i].texture]);
            }
          } else {
            if (meshes[i].color) {
              p.noStroke();
              p.ambientMaterial(meshes[i].color);
            } else {
              p.stroke(0);
              p.fill(0);
            }
          }
          if (meshes[i].emissionStrength) {
            p.noStroke();
            p.emissiveMaterial(meshes[i].emissionColor);
          }
          p.model(meshes[i].mesh);
          p.pop();
        }
      }
      p.windowResized = () => {
        setTimeout(() => {
          canvasDiv.style.maxHeight = (window.innerHeight - (this.ArcadeWithFullScreen ? 0 : (56 - 45))) + 'px';
          LogDiv?.style('max-height', `${canvasDiv.clientHeight}px`);
          p.resizeCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
        }, 50);
      }
    });
  }

  /** 마지막에 등록된 단축키 캐싱 */
  private CacheShortCut = {};
  /** 마지막에 등록된 단축키 저장하기 */
  StoreShortCutAct(key: string) {
    this.CacheShortCut[key] = this.p5KeyShortCut;
    this.p5KeyShortCut = {};
  }

  /** 지금 연결된 주소 받기 */
  GetConnectedAddress() {
    const address = `${location.protocol}//${location.host}${window['sub_path']}`;
    return address;
  }

  /** QRCode 양식 사용 여부 */
  useLocalAddress = false;
  /** 사용자가 주소를 직접 */
  CustomLocalAddress: string;
  /** QR코드 생성시 사용할 주소 검토
   * @param address 사용할 주소, 없으면 현재 연결된 주소 사용
   * @param [force=false] 강제로 github 주소 송출
   * @returns 현재 연결 주소 또는 github 주소
   */
  async GetHeaderAddress() {
    let header_address: string;
    try {
      if (this.CustomLocalAddress) return this.CustomLocalAddress;
      if (!this.useLocalAddress) throw '강제로 github 주소 발생시키기';
      let address = this.GetConnectedAddress();
      let cont = new AbortController();
      const id = setTimeout(() => {
        cont.abort('주소 검토 시간 초과');
        cont = null;
      }, 250);
      let res = await fetch(address, { method: 'HEAD', signal: cont.signal });
      clearTimeout(id);
      if (res.ok) header_address = address;
      else throw '주소 없음';
    } catch (e) {
      header_address = 'https://is2you2.github.io/pjcone_pwa/';
    }
    return header_address;
  }

  /** 마지막에 등록된 단축키 다시 사용하기  
   * @param [save=false] 가져오긴 하나 기록은 삭제하지 않을 경우 true
   */
  RestoreShortCutAct(key: string) {
    if (this.CacheShortCut[key] && Object.keys(this.CacheShortCut[key]).length)
      this.p5KeyShortCut = this.CacheShortCut[key];
    delete this.CacheShortCut[key];
  }

  /** 모든 등록된 단축키 삭제 */
  ClearShortCutAct() {
    let keys = Object.keys(this.CacheShortCut);
    for (let key of keys) delete this.CacheShortCut[key];
  }

  /** 나카마 서비스 받아오기 */
  CallbackNakama: any;
  /** 카메라로 찍은 후 사진 정보 돌려주기
   * @param path 이름은 여기서 지정되고 직전 폴더까지 구성
   */
  async from_camera(path: string, userInfo: AttachUserInfo, loadingId?: string) {
    const actId = loadingId || `from_camera_${Date.now()}`;
    let result: FileInfo = {};
    this.p5loading.update({
      id: actId,
      message: this.lang.text['ChatRoom']['LoadImageFromCamera'],
    })
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      let time = new Date();
      result.filename = `Camera_${time.toLocaleString().replace(/[:|.|\/]/g, '_')}.${image.format}`;
      result.file_ext = image.format;
      result.base64 = 'data:image/jpeg;base64,' + image.base64String;
      this.p5loading.update({
        id: actId,
        image: result.base64,
      });
      result.thumbnail = this.sanitizer.bypassSecurityTrustUrl(result.base64);
      result.type = `image/${image.format}`;
      result.typeheader = 'image';
      result.content_related_creator = [{
        user_id: userInfo.user_id,
        timestamp: new Date().getTime(),
        display_name: userInfo.display_name,
        various: 'camera',
      }];
      result.content_creator = {
        user_id: userInfo.user_id,
        timestamp: new Date().getTime(),
        display_name: userInfo.display_name,
        various: 'camera',
      };
      result['path'] = `${path}${result['filename']}`;
      result['viewer'] = 'image';
      let raw = await this.indexed.saveBase64ToUserPath(result.base64, result['path']);
      result.blob = new Blob([raw], { type: result['type'] });
      result.size = result.blob.size;
    } catch (e) {
      this.p5loading.update({
        id: actId,
        message: `${this.lang.text['GlobalAct']['ErrorFromCamera']}: ${e}`,
        image: null,
      });
      console.log('카메라 행동 실패: ', e);
      throw e;
    }
    this.p5loading.remove(actId);
    return result;
  }

  /** Blob 파일 구조화시키기 기본틀 */
  selected_blobFile_callback_act(blob: any, path: string, userInfo: AttachUserInfo, various: string = 'loaded', contentRelated: ContentCreatorInfo[] = []): FileInfo {
    let this_file: FileInfo = {};
    this_file['filename'] = blob['name'];
    this_file['file_ext'] = blob.name.split('.').pop() || blob.type || this.lang.text['ChatRoom']['unknown_ext'];
    this_file['size'] = blob['size'];
    this_file['type'] = blob.type || blob.type_override;
    this_file['path'] = `${path}${this_file['filename']}`;
    this_file['blob'] = blob;
    this_file['content_related_creator'] = [
      ...contentRelated, {
        user_id: userInfo.user_id,
        timestamp: new Date().getTime(),
        display_name: userInfo.display_name,
        various: various as any,
      }];
    this_file['content_creator'] = {
      user_id: userInfo.user_id,
      timestamp: new Date().getTime(),
      display_name: userInfo.display_name,
      various: various as any,
    };
    this.set_viewer_category(this_file);
    return this_file;
  }

  /** 그림판 결과물 정보 후처리 작업 */
  async voidDraw_fileAct_callback(v: any, path: string, userInfo: AttachUserInfo, related_creators?: any) {
    let this_file: FileInfo = {};
    this_file['filename'] = v.data['name'];
    this_file['file_ext'] = 'png';
    this_file['type'] = 'image/png';
    this_file['viewer'] = 'image';
    if (related_creators) {
      this_file['content_related_creator'] = related_creators;
      this_file['content_creator'] = {
        user_id: userInfo.user_id,
        timestamp: new Date().getTime(),
        display_name: userInfo.display_name,
        various: 'voidDraw',
      };
    } else {
      this_file['content_related_creator'] = [{
        user_id: userInfo.user_id,
        timestamp: new Date().getTime(),
        display_name: userInfo.display_name,
        various: 'voidDraw',
      }];
      this_file['content_creator'] = {
        timestamp: new Date().getTime(),
        display_name: this.CallbackNakama.users.self['display_name'],
        various: 'voidDraw',
      };
    }
    this_file['typeheader'] = 'image';
    this_file['path'] = `${path}${this_file['filename']}`;
    this_file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
    let raw = await this.indexed.saveBase64ToUserPath(v.data['img'], this_file.path);
    let blob = new Blob([raw], { type: this_file['type'] })
    this_file.blob = new File([blob], v.data['name']);
    this_file.size = this_file.blob.size;
    this.p5loading.remove(v.data['loadingCtrl']);
    return this_file;
  }

  /** 새 텍스트 파일을 생성할 때 사용하는 이름 */
  TextEditorNewFileName(): string {
    let newDate = new Date();
    let year = newDate.getUTCFullYear();
    let month = ("0" + (newDate.getMonth() + 1)).slice(-2);
    let date = ("0" + newDate.getDate()).slice(-2);
    let hour = ("0" + newDate.getHours()).slice(-2);
    let minute = ("0" + newDate.getMinutes()).slice(-2);
    let second = ("0" + newDate.getSeconds()).slice(-2);
    return `texteditor_${year}-${month}-${date}_${hour}-${minute}-${second}.txt`;
  }

  /** 텍스트 파일 편집 후 후처리 */
  TextEditorAfterAct(data: any, userInfo: AttachUserInfo) {
    let this_file: FileInfo = {};
    this_file.content_creator = {
      user_id: userInfo.user_id,
      timestamp: new Date().getTime(),
      display_name: userInfo.display_name,
      various: 'textedit',
    };
    this_file.content_related_creator = [];
    this_file.content_related_creator.push(this_file.content_creator);
    this_file.blob = data.blob;
    this_file.path = data.path;
    this_file.size = data.blob['size'];
    this_file.filename = data.blob.name || this.TextEditorNewFileName();
    this_file.file_ext = this_file.filename.split('.').pop();
    this_file.viewer = 'text';
    switch (this_file.file_ext) {
      case 'html':
        this_file.type = 'text/html';
        this_file.viewer = 'code';
        break;
      default: // 구분이 없다면 평문으로 처리
        this_file.type = 'text/plain';
        break;
    }
    this_file.typeheader = 'text';
    return this_file;
  }

  /** FFS 등 지정된 사이트의 연결을 빠르게 허용할 수 있도록 구성 */
  open_custom_site(targetAddress: string, port?: number) {
    try {
      let sep = targetAddress.split('://');
      let without_protocol = sep.pop();
      let GetwithoutPort = without_protocol.split(':');
      if (GetwithoutPort.length > 1) GetwithoutPort.pop();
      let checkProtocol = undefined;
      try {
        checkProtocol = sep[0] == 'https' || sep[0] == 'wss';
      } catch (e) {
        checkProtocol = this.checkProtocolFromAddress(GetwithoutPort[0]);
      }
      GetwithoutPort[0] = '//' + GetwithoutPort[0];
      GetwithoutPort.unshift(checkProtocol ? 'https' : 'http');
      window.open(GetwithoutPort.join(':') + `:${port || 9001}`, '_blank');
    } catch (e) { }
  }

  /** 웹 사이트 주소 열기 */
  open_link(_link: string) {
    if (_link.indexOf('https://') != 0 && _link.indexOf('http://') != 0) {
      let checkProt = this.checkProtocolFromAddress(_link);
      _link = (checkProt ? 'https://' : 'http://') + _link;
    }
    if (_link) window.open(_link, '_blank');
    const activeElement = document.activeElement;
    if (activeElement) activeElement['blur']();
  }

  /** 클립보드에 기록된 정보 불러오기 (이미지/텍스트)
   * @returns 이미지 또는 텍스트
   */
  async GetValueFromClipboard(loadingId?: string) {
    let result = {
      type: 'text/plain' as 'image/png' | 'text/plain' | 'error',
      value: '' as any,
    };
    const actId = loadingId || `clipboardAct`;
    await this.p5loading.update({
      id: actId,
      message: this.lang.text['GlobalAct']['ClipboardPaste'],
      image: null,
      forceEnd: null,
    });
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (let item of clipboardItems) {
        for (let type of item.types) {
          let value = await item.getType(type);
          if (type == 'image/png') {
            result.type = type;
            let file = new File([value], 'image.png', { type: type });
            result.value = file;
            const FileURL = URL.createObjectURL(file);
            this.p5loading.update({
              id: actId,
              image: FileURL,
            });
            setTimeout(() => {
              URL.revokeObjectURL(FileURL);
            }, 100);
            break;
          }
          if (type == 'text/plain') {
            result.type = type;
            result.value = await value.text();
            break;
          }
        }
      }
      this.p5loading.remove(actId);
      return result;
    } catch (e) {
      console.error('클립보드에서 불러오기 오류: ', e);
      this.p5toast.show({
        text: `${this.lang.text['GlobalAct']['FailedToReadClipboard']}: ${e}`,
      });
      result.type = 'error';
      result.value = e;
      this.p5loading.remove(actId);
      return result;
    }
  }

  /** 클립보드에 내용 복사하기
   * @param type 종류
   * @param value 복사하려는 값 (Blob / String): 기본으로 이걸 쓰세요 text/plain
   * @param filename 이미지인 경우 파일 이름 명시
   */
  async WriteValueToClipboard(type: string, value: any, filename?: string, loadingId?: string) {
    if (!value) return;
    const actId = loadingId || 'clipboardAct';
    await this.p5loading.update({
      id: actId,
      message: this.lang.text['GlobalAct']['ClipboardCopy'],
      image: null,
      forceEnd: null,
    });
    try {
      let data = {};
      let _value = value;
      switch (type) {
        case 'text/plain':
          _value = new Blob([value], { type: type });
          value = this.truncateString(value, 80);
          break;
        case 'image/png':
          const FileURL = URL.createObjectURL(_value);
          this.p5loading.update({
            id: actId,
            image: FileURL,
          });
          setTimeout(() => {
            URL.revokeObjectURL(FileURL);
          }, 100);
          break;
      }
      data[type] = _value;
      await navigator.clipboard.write([
        new ClipboardItem(data)
      ]);
      this.p5loading.update({
        id: actId,
        message: `${this.lang.text['GlobalAct']['PCClipboard']}: ${filename || value}`,
      });
      this.p5loading.remove(actId);
    } catch (e) {
      console.log('클립보드에 복사하기 오류: ', e);
      this.p5toast.show({
        text: `${this.lang.text['GlobalAct']['ClipboardFailed']}: ${e}`
      });
      this.p5loading.update({
        id: actId,
        forceEnd: 350
      });
      throw e;
    }
  }

  /** 문자열 제한하기 */
  truncateString(str: string, maxlength: number) {
    return (str?.length > maxlength) ? str.slice(0, maxlength - 1) + '…' : str;
  }

  /** 웹 소켓 클라이언트 발송 대기 시간 통합 관리용 */
  WebsocketRetryTerm = 70;

  /** HTML 내 특수 문자 허용 */
  HTMLEncode(str: any) {
    str = [...str];
    let i = str.length, aRet = [];
    while (i--) {
      let iC = str[i].codePointAt(0);
      if (iC < 65 || iC > 127 || (iC > 90 && iC < 97)) {
        aRet[i] = '&#' + iC + ';';
      } else {
        aRet[i] = str[i];
      }
    }
    return aRet.join('');
  }

  /** HTML 내 특수문자를 평문으로 변환 */
  HTMLDecode(str: string): string {
    // 이름 기반 HTML 엔티티 매핑
    const htmlEntities: { [key: string]: string } = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&apos;': "'",
      // 필요한 다른 HTML 엔티티들을 추가할 수 있습니다.
    };
    // 이름 기반 엔티티 디코딩
    str = str.replace(/&[a-zA-Z]+;/g, match => {
      return htmlEntities[match] || match;  // 매치되는 엔티티가 있으면 디코딩하고, 없으면 그대로 반환
    });
    // 숫자 기반 HTML 엔티티(&#<숫자>; 형식) 디코딩
    str = str.replace(/&#(\d+);/g, (match, codePoint) => {
      return String.fromCodePoint(Number(codePoint));  // 숫자 엔티티 처리
    });
    return str;
  }

  /** 페이지에서 음성 녹음을 사용중이라면 추가 녹음을 진행하지 못함 */
  useVoiceRecording = '';
  /** 음성녹음을 멈추고 저장된 값을 돌려주기 */
  async StopAndSaveVoiceRecording() {
    try {
      let data = await VoiceRecorder.stopRecording();
      this.useVoiceRecording = null;
      let blob = this.Base64ToBlob(`${data.value.mimeType},${data.value.recordDataBase64}`);
      blob['name'] = `${this.lang.text['ChatRoom']['VoiceRecord']}.${data.value.mimeType.split('/').pop().split(';')[0]}`;
      blob['type_override'] = data.value.mimeType;
      return blob;
    } catch (e) {
      this.useVoiceRecording = null;
      this.p5toast.show({
        text: `${this.lang.text['AddPost']['FailedToSaveVoice']}:${e}`,
      });
      throw e;
    }
  }
  /** 즉석 통화 교신에 사용되는 웹소켓 클라이언트 */
  InstantCallWSClient: WebSocket;
  /** 즉석 통화에서 웹소켓 서버에 연결한 후 다른 사용자를 기다림 */
  WaitingConnect = false;
  /** 상대방과 통화가 연결되었음 */
  InitEnd = false;
  /** 상대방이 교신 준비를 위해 들어온 경우 */
  PeerConnected = false;
  /** 즉석 통화 정보 교신을 위해 메시지 보내기 */
  InstantCallSend(msg: string) {
    if (this.InstantCallWSClient && this.InstantCallWSClient.readyState == this.InstantCallWSClient.OPEN)
      this.InstantCallWSClient.send(msg);
  }

  /** Modal.Dismiss 행동 모방을 위해 구성  
   * 페이지를 진입할 때 state.dismiss 에 키워드를 넣으면 페이지를 벗어날 때 해당 키워드로 행동을 실행함
   * ```js
   * PageDismissAct[key] = Function;  
   * ```
   * 행동을 등록할 때 행동 끝에 해당 키값을 제거해야함
   */
  PageDismissAct = {};
  /** ModalController 대체를 위한 구성
   * @param page 라우팅 주소 입력
   * @param _state navParams를 대체함
   */
  ActLikeModal(page: string, _state?: any) {
    /** 다른 사람의 프로필 정보 열기 */
    this.RemoveAllModals(() => {
      this.navCtrl.navigateForward(page, {
        animation: mdTransitionAnimation,
        state: _state,
      });
    });
  }
}

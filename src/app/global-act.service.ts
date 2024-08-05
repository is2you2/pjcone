import { Injectable } from '@angular/core';
import { LanguageSettingService } from './language-setting.service';
import { P5ToastService } from './p5-toast.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';
import * as p5 from "p5";
import { IndexedDBService } from './indexed-db.service';
import { LoadingController } from '@ionic/angular';

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
}

/** 뷰어 동작 호완을 위한 틀 */
export interface FileInfo {
  name?: string;
  filename?: string;
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
  /** 고도엔진과 상호작용하기 위한 값들, 고도엔진에서 JavaScript.get_interface('window')[id]로 접근 */
  [id: string]: any;
}

/** 어느 페이지에든 행동할 가능성이 있는 공용 함수 모음 */
@Injectable({
  providedIn: 'root'
})
export class GlobalActService {

  constructor(
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
  ) {
    isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      isDarkMode = event.matches ? true : false;
    });
  }

  /** 해야할 일 캔버스 */
  p5todo: p5;

  /** PIP 동작 연계를 위한 비디오 개체 기억하기 */
  PIPLinkedVideoElement: HTMLVideoElement;

  /** 페이지별 단축키 관리자 */
  p5key: p5;
  initialize() {
    this.p5key = new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.noLoop();
        p['KeyShortCut'] = {};
      }
      p.keyPressed = (ev) => {
        switch (ev['code']) {
          case 'Backquote':
            if (p['KeyShortCut']['Backquote'])
              p['KeyShortCut']['Backquote']();
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
            if (p['KeyShortCut']['Digit']) {
              let exact_index = (Number(ev['code'].slice(-1)) - 1 + 10) % 10;
              p['KeyShortCut']['Digit'](exact_index);
            }
            break;
          // 메인 하단 탭
          case 'KeyQ': // 채널
          case 'KeyW': // 할 일
          case 'KeyE': // 오락
          case 'KeyR': // 사설 SNS or 설정
          case 'KeyT': // 설정
            if (p['KeyShortCut']['BottomTab'])
              p['KeyShortCut']['BottomTab'](ev['code'].slice(-1));
            break;
          case 'KeyA': // 추가류 (Add)
            if (p['KeyShortCut']['AddAct'])
              p['KeyShortCut']['AddAct']();
            break;
          case 'KeyS': // 키간 사이 행동 (S Key)
            if (p['KeyShortCut']['SKeyAct'])
              p['KeyShortCut']['SKeyAct']();
            break;
          case 'KeyD': // 삭제류 (Delete)
            if (p['KeyShortCut']['DeleteAct'])
              p['KeyShortCut']['DeleteAct']();
            break;
          case 'KeyF': // 키간 사이 행동 (S Key)
            if (p['KeyShortCut']['FKeyAct'])
              p['KeyShortCut']['FKeyAct']();
            break;
          case 'Enter': // 발송 등
          case 'NumpadEnter':
            if (p['KeyShortCut']['EnterAct'])
              p['KeyShortCut']['EnterAct']();
            break;
          case 'Escape': // 페이지 돌아가기 (navCtrl.pop()) / modal은 기본적으로 동작함
            if (p['KeyShortCut']['Escape'])
              p['KeyShortCut']['Escape']();
            break;
          case 'KeyZ': // 되돌리기 등 그림판 하단 탭 행동
          case 'KeyX':
          case 'KeyC':
          case 'KeyV':
            if (p['KeyShortCut']['HistoryAct'])
              p['KeyShortCut']['HistoryAct'](ev['code'].slice(-1));
            break;
        }
      }
    });
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
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _act_name 로딩할 pck 파일의 이름
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @param keys 고도엔진 iframe.window에 작성될 값들
   * @param [without_splash=false] 스플래시를 끄는 경우 사용(게시물 내 로딩시)
   * @returns iframe 개체 돌려주기
   */
  CreateGodotIFrame(_frame_name: string, keys: GodotFrameKeys, waiting_key = '', without_splash = false): Promise<any> {
    let ready_to_show = false;
    return new Promise(async (done: any) => {
      let refresh_it_loading = async () => {
        try {
          if (window['godot'] != 'godot')
            throw 'No godot';
          if (waiting_key && !this.godot_window[waiting_key])
            throw 'No act ready';
          ready_to_show = true;
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
      if (this.godot_splash) this.godot_splash.remove();
      if (this.godot) this.godot.remove();
      window['godot'] = '';
      let _godot = document.createElement('iframe');
      _godot.id = 'godot';
      _godot.setAttribute("src", "assets/html/index.html");
      _godot.setAttribute("frameborder", "0");
      _godot.setAttribute('class', 'full_screen');
      _godot.setAttribute('allow', 'fullscreen; encrypted-media');
      _godot.setAttribute('scrolling', 'no');
      _godot.setAttribute('withCredentials', 'true');
      if (_frame_name == 'content_viewer_canvas')
        keys['create_thumbnail_p5'] = async (base64: string, info: FileInfo = undefined) => {
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
      let frame = document.getElementById(_frame_name);
      frame.appendChild(_godot);
      this.godot_window = _godot.contentWindow || _godot.contentDocument;
      let _keys = Object.keys(keys);
      _keys.forEach(key => this.godot_window[key] = keys[key]);
      this.godot = _godot;
      if (!without_splash)
        this.godot_splash = new p5((p: p5) => {
          let icon: p5.Image;
          let background: p5.Image;
          let loading_size = 8;
          let loading_corner = 2;
          let loading_dist = 6;
          let backgroundWidth: number;
          let backgroundHeight: number;
          p.setup = () => {
            let canvas = p.createCanvas(frame.clientWidth, frame.clientHeight);
            canvas.parent(frame);
            canvas.style('position: fixed;');
            p.imageMode(p.CENTER);
            p.rectMode(p.CENTER);
            p.noStroke();
            p['CurrentLoaded'] = 0;
            p['LoadLength'] = 1;
            this.godot_window['update_load'] = (current: number, length: number) => {
              p['CurrentLoaded'] = current;
              p['LoadLength'] = length;
            }
            p.loadImage('assets/icon/favicon.png', v => {
              icon = v;
            });
            p.pixelDensity(1);
            if (keys.background)
              p.loadImage(keys.background, v => {
                background = v;
                if (v.width > v.height) {
                  backgroundHeight = p.height;
                  backgroundWidth = v.width / v.height * p.height;
                } else {
                  backgroundWidth = p.width;
                  backgroundHeight = v.height / v.width * p.width;
                }
              });
          }
          let FadeLerp = 2;
          let loadingRot = 0;
          let splash_bg_color = isDarkMode ? 80 : 200;
          let loading_box = isDarkMode ? 200 : 80;
          let loading_bar = isDarkMode ? 40 : 160;
          p.draw = () => {
            p.clear(255, 255, 255, 255);
            let CurrentFade = p.constrain(255 * FadeLerp, 0, 255);
            p.background(splash_bg_color,);
            p.tint(255, CurrentFade);
            if (background) p.image(background, p.width / 2, p.height / 2, backgroundWidth, backgroundHeight);
            if (icon) p.image(icon, p.width / 2, p.height / 2);
            p.push();
            p.translate(p.width / 2, p.height / 2 + 80);
            loadingRot += .07;
            p.rotate(loadingRot);
            p.fill(loading_box, p.constrain(255 * FadeLerp, 0, 255));
            p.push();
            p.translate(-loading_dist, -loading_dist);
            p.rotate(-loadingRot * 2);
            p.rect(0, 0, loading_size, loading_size, loading_corner);
            p.pop();
            p.push();
            p.translate(loading_dist, -loading_dist);
            p.rotate(-loadingRot * 2);
            p.rect(0, 0, loading_size, loading_size, loading_corner);
            p.pop();
            p.push();
            p.translate(-loading_dist, loading_dist);
            p.rotate(-loadingRot * 2);
            p.rect(0, 0, loading_size, loading_size, loading_corner);
            p.pop();
            p.push();
            p.translate(loading_dist, loading_dist);
            p.rotate(-loadingRot * 2);
            p.rect(0, 0, loading_size, loading_size, loading_corner);
            p.pop();
            p.pop();
            p.push();
            p.translate(p.width / 2, p.height / 2 + 120);
            p.stroke(loading_bar, CurrentFade);
            p.strokeWeight(3);
            p.line(-30, 0, 30, 0);
            p.stroke(loading_box, CurrentFade);
            p.line(-30, 0, p.lerp(-30, 30, p['CurrentLoaded'] / p['LoadLength']), 0);
            p.pop();
            if (ready_to_show) {
              FadeLerp -= .04;
              if (FadeLerp <= 0)
                p.remove();
            }
          }
          p.windowResized = () => {
            p.resizeCanvas(frame.clientWidth, frame.clientHeight);
          }
        });
      await refresh_it_loading();
    });
  }

  /** 파일 경로를 큐에 추가하고 계속하여 정보를 받습니다  
   * 여기서 추가한 것은 반드시 큐를 제거해야함
   * @returns 파일 전체 길이 (number) / FILE_BINARY_LIMIT 기준
   */
  async req_file_info(path: string): Promise<any> {
    return new Promise(async (done) => {
      let info = await this.indexed.GetFileInfoFromDB(path);
      done(info);
    });
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
  async modulate_thumbnail(msg_content: FileInfo, ObjectURL: string) {
    try { // 대안 썸네일이 있다면 보여주고 끝내기
      let blob = await this.indexed.loadBlobFromUserPath(`${msg_content['path']}_thumbnail.png`, 'image/png');
      let FileURL = URL.createObjectURL(blob);
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
          if (!msg_content['url']) throw 'No URL';
          let res = await fetch(msg_content['url']);
          if (res.ok) msg_content['thumbnail'] = msg_content['url'];
          else throw 'Not ok';
        } catch (e) {
          if (ObjectURL) msg_content['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(ObjectURL);
        }
        break;
      case 'text':
        if (msg_content['url']) {
          let text = await fetch(msg_content['url']).then(r => r.text());
          msg_content['text'] = text.split('\n');
        } else new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.loadStrings(ObjectURL, v => {
              msg_content['text'] = v;
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
        if (info['type']) {
          if (info['type'].indexOf('audio/') == 0)
            info['viewer'] = 'audio';
          else if (info['type'].indexOf('video/') == 0)
            info['viewer'] = 'video';
        } else info['viewer'] = 'disabled';
        break;
      // 코드류
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
        done(ev.target.result.replace(/"|\\|=/g, ''));
      }
      reader.onerror = (ev: any) => {
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
   * @param file ev.target.files[i] / blob
   * @param address 해당 서버 주소
   * @returns 등록된 주소 반환
   */
  async upload_file_to_storage(file: any, user_id: string, protocol: string, address: string, useCustomServer: boolean, loading?: HTMLIonLoadingElement): Promise<string> {
    let innerLoading: HTMLIonLoadingElement;
    if (!loading) innerLoading = await this.loadingCtrl.create({ message: this.lang.text['Settings']['TryToFallbackFS'] });
    else innerLoading = loading;
    innerLoading.present();
    let Catched = false;
    let CatchedAddress: string;
    if (useCustomServer)
      CatchedAddress = await this.try_upload_to_user_custom_fs(file, user_id, innerLoading);
    innerLoading.message = this.lang.text['GlobalAct']['CheckCdnServer'];
    try { // 사설 연계 서버에 업로드 시도
      if (CatchedAddress) {
        Catched = true;
        throw '사용자 지정서버에서 이미 성공함'
      };
      let upload_time = new Date().getTime();
      let only_filename = file.filename.substring(0, file.filename.lastIndexOf('.'));
      let filename = `${user_id}_${only_filename}_${upload_time}.${file.file_ext}`;
      CatchedAddress = `${protocol}//${address}:9002/cdn/${filename}`;
      let progress = setInterval(async () => {
        let res = await fetch(`${protocol}//${address}:9001/filesize/${filename}`, { method: "POST" });
        let currentSize = Number(await res.text());
        let progressPercent = Math.floor(currentSize / file.size * 100);
        innerLoading.message = `${file.filename}: ${progressPercent}%`;
      }, 700);
      let formData = new FormData();
      let _file = new File([file.blob], filename);
      formData.append("files", _file);
      await fetch(`${protocol}//${address}:9001/cdn/${filename}`, { method: "POST", body: formData });
      clearInterval(progress);
      let res = await fetch(CatchedAddress);
      if (res.ok) Catched = true;
    } catch (e) {
      innerLoading.message = this.lang.text['GlobalAct']['CancelingUpload'];
      console.warn('cdn 파일 업로드 단계 실패:', e);
    }
    innerLoading.dismiss();
    return Catched ? CatchedAddress : undefined;
  }

  /** 해당 주소의 파일 삭제 요청 (cdn 기반 파일) */
  async remove_file_from_storage(url: string) {
    let sep = url.split('/cdn/');
    let target_file_name = sep.pop();
    let target_address = sep.shift();
    let lastIndex = target_address.lastIndexOf(':');
    if (lastIndex > 5) target_address = target_address.substring(0, lastIndex);
    await fetch(`${target_address}:9001/remove/${target_file_name}`, { method: "POST" });
  }

  /** 해당 키워드가 포함된 모든 파일 삭제 요청 (cdn 기반 파일)  
   * 채널 삭제 또는 계정 삭제 등 일괄 삭제 처리가 필요할 때 사용됩니다
   * @param target_address 해당 서버 주소 (protocol://address 까지) (FFS는 포함되지 않음)
   * @param target_id 인덱스 키 값
   */
  async remove_files_from_storage_with_key(target_address: string, target_id: string) {
    let lastIndex = target_address.lastIndexOf(':');
    if (lastIndex > 5) target_address = target_address.substring(0, lastIndex);
    await fetch(`${target_address}:9001/remove_key/${target_id}`, { method: "POST" });
  }

  /** 사용자 지정 서버에 업로드 시도 */
  async try_upload_to_user_custom_fs(file: any, user_id: string, loading?: HTMLIonLoadingElement) {
    let innerLoading: HTMLIonLoadingElement;
    if (!loading) innerLoading = await this.loadingCtrl.create({ message: this.lang.text['Settings']['TryToFallbackFS'] });
    else innerLoading = loading;
    let upload_time = new Date().getTime();
    let only_filename = file.filename.substring(0, file.filename.lastIndexOf('.'));
    let filename = `${user_id}_${only_filename}_${upload_time}.${file.file_ext}`;
    let formData = new FormData();
    let _file = new File([file.blob], filename);
    formData.append("files", _file);
    let CatchedAddress: string;
    let fallback = localStorage.getItem('fallback_fs');
    let progress: any;
    try { // 사용자 지정 서버 업로드 시도 우선
      if (!fallback) throw '사용자 지정 서버 없음';
      let address = fallback.split(':');
      let checkProtocol = address[0].replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, '');
      let protocol = checkProtocol ? 'https:' : 'http:';
      CatchedAddress = `${protocol}//${address[0]}:${address[1] || 9002}/cdn/${filename}`;
      progress = setInterval(async () => {
        let res = await fetch(`${protocol}//${address}:9001/filesize/${filename}`, { method: "POST" });
        let currentSize = Number(await res.text());
        let progressPercent = Math.floor(currentSize / file.size * 100);
        loading.message = `${file.filename}: ${progressPercent}%`;
      }, 700);
      await fetch(`${protocol}//${address[0]}:9001/cdn/${filename}`, { method: "POST", body: formData });
      clearInterval(progress);
      let res = await fetch(CatchedAddress);
      if (!loading) innerLoading.dismiss();
      if (res.ok) return CatchedAddress;
    } catch (e) {
      clearInterval(progress);
      if (!loading) innerLoading.dismiss();
      return undefined;
    }
  }

  /** blender 파일 읽기 후 특정 개체에 넣기 */
  load_blender_file(canvasDiv: HTMLElement, FileInfo: FileInfo, loading: HTMLIonLoadingElement, OnLoaded: Function, OnFailedToLoad: Function): p5 {
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
        p['canvas'] = canvas;
        p.textureMode(p.NORMAL);
        p.textureWrap(p.REPEAT);
        p.clear(255, 255, 255, 0);
        p.pixelDensity(1);
        let blob: Blob;
        try {
          blob = await this.indexed.loadBlobFromUserPath(FileInfo.path, FileInfo.type || '');
        } catch (e) {
          try {
            let from_url = await fetch(FileInfo.url);
            blob = await from_url.blob();
          } catch (e) {
            console.log('뷰어에서 파일 불러오기 실패: ', e);
            OnFailedToLoad();
          }
        }
        // js.blend 페이지 불러오기
        let jsBlend = p.createElement('iframe');
        jsBlend.elt.id = 'jsBlend';
        jsBlend.elt.setAttribute("src", "assets/js.blend/index.html");
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
            if (loading) loading.dismiss();
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
          let blend = await jsBlend.elt.contentWindow['JSBLEND'](blob);
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
            if (loading) loading.message = `${this.lang.text['ContentViewer']['ReadObject']}: ${obj.aname}`;
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
                          _BaseColor[0] * 255,
                          _BaseColor[1] * 255,
                          _BaseColor[2] * 255,
                          _BaseColor[3] * 255
                        );
                      } catch (e) {
                        console.log('베이스 색상 가져오기 실패: ', e);
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['FailedGetBaseColor']}: ${e}</div>`;
                      }
                      try {
                        let _EmissionColor = obj.data.mat[i].nodetree.nodes.first.next.inputs.last.prev.default_value.value;
                        emission_strength = obj.data.mat[i].nodetree.nodes.first.next.inputs.last.default_value.value;
                        emission_color = p.color(
                          _EmissionColor[0] * 255,
                          _EmissionColor[1] * 255,
                          _EmissionColor[2] * 255,
                          _EmissionColor[3] * 255
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
          if (loading) loading.dismiss();
          setTimeout(() => {
            LogDiv.elt.remove();
          }, 8000);
          OnLoaded();
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
          canvasDiv.style.maxHeight = (window.innerHeight - 56 - 45) + 'px';
          if (LogDiv) LogDiv.style('max-height', `${canvasDiv.clientHeight}px`);
          p.resizeCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
        }, 50);
      }
    });
  }
}

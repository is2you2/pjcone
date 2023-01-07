import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { IndexedDBService } from './indexed-db.service';
import { P5ToastService } from './p5-toast.service';

/** 고도엔진과 공유되는 키값 */
interface GodotFrameKeys {
  /** 공식 패키지 이름 */
  act: string;
  /** 패키지 이름 입력 */
  title: string;
  /** 고도엔진에서 다운로드가 필요한 경우 반응용, 사용금지 */
  accept?: any;
  /** 패키지 불러오기 행동 실패시 실행됨 */
  failed: any;
  [id: string]: any;
}

/** 어느 페이지에든 행동할 가능성이 있는 공용 함수 모음 */
@Injectable({
  providedIn: 'root'
})
export class GlobalActService {

  constructor(
    private indexed: IndexedDBService,
    private p5toast: P5ToastService,
  ) { }


  /** 브라우저에서 딥 링크마냥 행동하기
   * @returns GET 으로 작성된 key-value 쌍
  */
  CatchGETs() {
    /** 입력된 주소 */
    const ADDRESS = location.href;
    const sepElement = ADDRESS.split('?');
    if (sepElement.length > 1) {
      const CatchGETs = sepElement[1].split('&');
      let gets = {};
      for (let i = 0, j = CatchGETs.length; i < j; i++) {
        const KeyVal = CatchGETs[i].split('=');
        if (!gets[KeyVal[0]])
          gets[KeyVal[0]] = [];
        gets[KeyVal[0]].push(KeyVal[1]);
      }
      return gets;
    }
  }

  /** 실행중인 iframe-godot 개체를 기억하여 2개 이상 생성될 경우 이전에 진행중인 객체를 삭제, 마지막 실행기만 기억하기 */
  private godot: HTMLIFrameElement;
  /** 마지막에 기록된 프레임 id */
  private last_frame_name: string;
  /** 고도엔진이 시작하자마자 로딩할 내용과 고도 결과물을 담을 iframe id를 전달  
   * 이 함수는 고도엔진이 실행되는 페이지의 ionViewWillEnter()에서 진행되어야 합니다
   * @param _act_name 로딩할 pck 파일의 이름
   * @param _frame_name 고도 결과물을 담으려는 div id
   * @param keys 고도엔진 iframe.window에 작성될 값들
   * @returns iframe 개체 돌려주기
   */
  CreateGodotIFrame(_frame_name: string, keys: GodotFrameKeys) {
    if (this.last_frame_name == _frame_name && this.godot.isConnected) return;
    if (this.godot) this.godot.remove();
    this.last_frame_name = _frame_name;
    let _godot = document.createElement('iframe');
    _godot.id = 'godot';
    _godot.setAttribute("src", "assets/html/index.html");
    _godot.setAttribute("frameborder", "0");
    _godot.setAttribute('class', 'full_screen');
    let frame = document.getElementById(_frame_name);
    frame.appendChild(_godot);
    let _godot_window = _godot.contentWindow || _godot.contentDocument;
    let _keys = Object.keys(keys);
    _keys.forEach(key => _godot_window[key] = keys[key]);
    this.godot = _godot;
    return _godot;
  }

  /**
   * indexedDB에 저장된 파일을 사용자가 접근 가능한 곳으로 저장함
   * @param filename 저장될 파일 이름
   * @param path indexedDB 파일 경로
   */
  DownloadFile_from_indexedDB(filename: string, path: string) {
    if (isPlatform == 'DesktopPWA')
      this.indexed.loadFileFromUserPath(path, (e, v) => {
        if (e && v) {
          var link = document.createElement("a");
          link.download = filename;
          link.href = v;
          link.click();
          link.remove();
        }
      });
    else if (isPlatform != 'MobilePWA')
      this.p5toast.show({
        text: '지원하지 않는 기능입니다.',
      });
  }
}

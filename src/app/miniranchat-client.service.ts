import { Injectable } from '@angular/core';
import { NavController, mdTransitionAnimation } from '@ionic/angular';
import * as p5 from 'p5';
import { NakamaService } from './nakama.service';
import { P5ToastService } from './p5-toast.service';
import { LanguageSettingService } from './language-setting.service';
import { isPlatform } from './app.component';
import { GlobalActService } from './global-act.service';
import { LocalNotiService } from './local-noti.service';

/** 기존 MiniRanchat과 서버를 공유하는 랜챗 클라이언트  
 * 해당 프로젝트의 동작 방식 역시 모방되어있다.
 */
@Injectable({
  providedIn: 'root'
})
export class MiniranchatClientService {

  constructor(
    private navCtrl: NavController,
    public nakama: NakamaService,
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
    private global: GlobalActService,
    private noti: LocalNotiService,
  ) {
    this.noti.Sq_client = this;
  }

  client: WebSocket;
  /** pid */
  uuid: string;
  /** 내 사용자 이름 */
  MyUserName: string;
  /** 참여된 채널 */
  JoinedChannel: string;

  // 'idle' | 'linked' | 'unlinked' | 'custom'
  status = 'idle';

  /** 사용자 입력과 관련된 것들 */
  userInput = {
    /** 채팅, 로그 등 대화창에 표기되는 모든 것 */
    logs: [],
    /** 작성 텍스트 */
    text: '',
    /** 마지막 메시지 썸네일 구성 */
    last_message: {},
  }

  /** 지금 연결된 사람 수 */
  ConnectedNow = 0;
  /** 상호작용 함수들 */
  funcs = {
    onopen: (v: any) => console.warn('OnOpen 설정 안됨: ', v),
    onclose: (v: any) => console.warn('OnClose 설정 안됨: ', v),
    onmessage: (v: any) => console.warn('OnMessage 설정 안됨: ', v),
  };

  /**
   * 클라이언트 연결 시도
   * @param _Address 기본값: 메인 소켓 서버, 사설 서버 주소로 변경 가능
   */
  initialize(_Address?: string) {
    const PORT: number = 12013;
    this.cacheAddress = _Address;
    // https 홈페이지에서 비보안 연결 시도시 시작 끊기
    if (location.protocol == 'https:' && _Address.indexOf('ws://') == 0) {
      this.p5toast.show({
        text: this.lang.text['MinimalChat']['cannot_join'],
      });
      this.disconnect();
      return;
    }
    this.client = new WebSocket(`${_Address}:${PORT}`);
    this.client.onopen = (ev) => {
      this.funcs.onopen(ev);
      this.IsConnected = true;
    }
    this.client.onclose = (ev) => {
      this.funcs.onclose(ev);
      this.IsConnected = false;
      this.status = 'idle';
      this.RemoveListeners();
    }
    this.client.onerror = (e) => {
      console.error('MiniranchatClientService 오류 발생: ', e);
      // 혹시라도 자체 서명 사이트에 접근중이라면 허용처리를 할 수 있게 사이트 연결
      if (_Address.indexOf('wss://') == 0 && (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')) {
        let GetwithoutProtocol = _Address.split('://');
        window.open(`https://${GetwithoutProtocol.pop()}:9001`, '_blank');
      }
      this.disconnect();
    }
    this.client.onmessage = (ev) => {
      if (typeof ev.data == 'string')
        this.funcs.onmessage(ev.data);
      else
        ev.data.text().then((v: any) => {
          this.funcs.onmessage(v);
        });
    }
  }

  /** 이벤트 리스너 직접 삭제처리 */
  RemoveListeners() {
    if (this.FFSClient)
      this.FFSClient.onopen = null;
    if (this.client) {
      this.client.onopen = null;
      this.client.onclose = null;
      this.client.onerror = null;
      this.client.onmessage = null;
    }
  }

  send(msg: string) {
    if (this.client && this.client.readyState == this.client.OPEN) this.client.send(msg);
    else this.disconnect();
  }

  /** 광장 채널에서 전용으로 사용할 FFS 서버 덮어쓰기 주소 */
  FallbackOverrideAddress: string;
  /** FFS를 사용하는 경우 전송된 파일들을 전부 기억해두었다가 접속을 끊을 때 전부 삭제요청 보내기 */
  FFS_Urls = [];
  /** 분할 파일 받기시 진행도 표시를 위해 준비됨  
   * DownloadPartManager[uuid][temp_id] = counter;
   */
  DownloadPartManager = {};
  /** 재접속을 위한 빠른 버튼 보여주기 */
  p5canvas: p5;
  p5OnDediMessage: Function;

  cacheAddress = '';
  /** 페이지는 벗어났으나 계속 연결을 유지중일 때 생성 */
  CreateRejoinButton() {
    if (this.p5canvas) {
      this.p5OnDediMessage = null;
      this.p5canvas.remove();
    }
    this.p5canvas = new p5((p: p5) => {
      p.noCanvas();
      p.setup = () => {
        let float_button = p.createDiv(`<ion-icon style="width: 36px; height: 36px" name="chatbox-ellipses-outline"></ion-icon>`);
        float_button.style("position: absolute; right: 0; bottom: 56px; z-index: 1");
        float_button.style("width: 64px; height: 64px");
        float_button.style("text-align: center; align-content: center");
        float_button.style("cursor: pointer");
        float_button.style("margin: 16px");
        float_button.style("padding-top: 6px");
        float_button.style("background-color: #8888");
        float_button.style("border-radius: 24px");
        // 메시지를 받으면 배경색이 변함
        this.p5OnDediMessage = (color: string) => {
          float_button.style(`background-color: #${color}88`);
        }
        float_button.elt.onclick = () => {
          this.RejoinGroupChat();
        };
      }
    });
  }

  RejoinGroupChat() {
    this.userInput.text = '';
    this.global.RemoveAllModals(() => {
      this.navCtrl.navigateForward('minimal-chat', {
        animation: mdTransitionAnimation,
        state: {
          address: this.cacheAddress,
          name: this.MyUserName,
        },
      });
    });
  }

  /** 연결중인 상태인지에 대한 boolean  
   * 연산 간소화를 위해 존재함
   */
  IsConnected = false;

  /** FFS 우선처리 서버에 연결하여  */
  FFSClient: WebSocket;
  /** pid */
  FFSuuid: string;
  /** 참여된 채널 */
  FFSJoinedChannel: string;
  /** 클라이언트 끊기 */
  disconnect(code = 1000, reason = 'user_close') {
    if (this.FFSClient) this.FFSClient.close(code, reason);
    if (this.client) this.client.close(code, reason);
    this.IsConnected = false;
    this.cacheAddress = '';
    this.uuid = null;
    if (this.p5canvas) {
      this.p5OnDediMessage = null;
      this.p5canvas.remove();
    }
    this.FFSClient = null;
    this.client = null;
    this.JoinedChannel = null;
    this.status = 'idle';
  }
}

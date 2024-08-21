import { Injectable } from '@angular/core';
import { AlertController, IonicSafeString, ModalController } from '@ionic/angular';
import * as p5 from 'p5';
import { MinimalChatPage } from './minimal-chat/minimal-chat.page';
import { NakamaService } from './nakama.service';
import { GlobalActService } from './global-act.service';
import { P5ToastService } from './p5-toast.service';
import { LanguageSettingService } from './language-setting.service';
import { LocalNotiService } from './local-noti.service';
import { isPlatform } from './app.component';
import { LocalNotifications } from '@capacitor/local-notifications';

/** 기존 MiniRanchat과 서버를 공유하는 랜챗 클라이언트  
 * 해당 프로젝트의 동작 방식 역시 모방되어있다.
 */
@Injectable({
  providedIn: 'root'
})
export class MiniranchatClientService {

  constructor(
    private modalCtrl: ModalController,
    public nakama: NakamaService,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
    private noti: LocalNotiService,
    private alertCtrl: AlertController,
  ) { }

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
    }
    this.client.onerror = (e) => {
      console.error('MiniranchatClientService 오류 발생: ', e);
      // 혹시라도 자체 서명 사이트에 접근중이라면 허용처리를 할 수 있게 사이트 연결
      if (_Address.indexOf('wss://') == 0) {
        let GetwithoutProtocol = _Address.split('://');
        window.open(`https://${GetwithoutProtocol.pop()}:9001`, '_system');
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

  /** 알림 클릭시 모바일앱 행동요령 등록 */
  RegisterNotificationReact() {
    this.noti.Sq_client = this;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') return;
    LocalNotifications.addListener('localNotificationActionPerformed', (ev: any) => {
      try {
        let ActType = ev['notification']['extra']['type'];
        switch (ev['actionId']) {
          case 'tap': // 알림을 탭함, 해당 알림에 해당하는 페이지를 열기
            switch (ActType) {
              case 'AllUserNotification': // 서버 전체 공지
                let image_form = `<img *ngIf="${ev['notification']['extra'].image}" src="${ev['notification']['extra'].image}" alt="noti_image" style="border-radius: 8px">`;
                let text_form = `<div>${ev['notification']['extra'].body}</div>`;
                let result_form = ev['notification']['extra'].image ? image_form + text_form : text_form;
                this.alertCtrl.create({
                  header: ev['notification']['extra'].title,
                  message: new IonicSafeString(result_form),
                  backdropDismiss: false,
                  buttons: [{
                    text: this.lang.text['Nakama']['LocalNotiOK'],
                    handler: () => {
                      this.nakama.servers[ev['notification']['extra'].isOfficial][ev['notification']['extra'].target].client.deleteNotifications(
                        this.nakama.servers[ev['notification']['extra'].isOfficial][ev['notification']['extra'].target].session, [ev['notification']['extra'].noti_id]);
                    }
                  }]
                }).then(v => v.present());
                break;
              case 'MinimalChatPage': // 그룹 채널채팅
                this.RejoinGroupChat();
                break;
              case 'ChatRoomPage': // 채널 채팅
                let _cid = ev['notification']['extra']['id'];
                let _is_official = ev['notification']['extra']['isOfficial'];
                let _target = ev['notification']['extra']['target'];
                this.nakama.go_to_chatroom_without_admob_act(this.nakama.channels_orig[_is_official][_target][_cid]);
                break;
              case 'AddTodoMenuPage': // 해야할 일
                this.nakama.open_add_todo_page(ev['notification']['extra']['data']);
                break;
              case 'NakamaReqContTitle': // 그룹 진입 알림 요청
                let this_server = this.nakama.servers[ev['notification']['extra'].isOfficial][ev['notification']['extra'].Target];
                let msg = '';
                msg += `${this.lang.text['Nakama']['ReqContServer']}: ${ev['notification']['extra'].serverName}<br>`;
                msg += `${this.lang.text['Nakama']['ReqContUserName']}: ${ev['notification']['extra'].userName}`;
                this.alertCtrl.create({
                  header: this.lang.text['Nakama']['ReqContTitle'],
                  message: msg,
                  buttons: [{
                    text: this.lang.text['Nakama']['ReqContAccept'],
                    handler: () => {
                      this_server.client.addGroupUsers(this_server.session, ev['notification']['extra'].group_id, [ev['notification']['extra'].user_id])
                        .then(v => {
                          if (!v) console.warn('밴인 경우인 것 같음, 확인 필요');
                          this_server.client.deleteNotifications(this_server.session, [ev['notification']['extra'].noti_id])
                            .then(b => {
                              if (b) this.nakama.update_notifications(ev['notification']['extra'].isOfficial, ev['notification']['extra'].Target);
                              else console.warn('알림 지우기 실패: ', b);
                            });
                        });
                    }
                  }, {
                    text: this.lang.text['Nakama']['ReqContReject'],
                    handler: () => {
                      this_server.client.kickGroupUsers(this_server.session, ev['notification']['extra'].group_id, [ev['notification']['extra'].user_id])
                        .then(async b => {
                          if (!b) console.warn('그룹 참여 거절을 kick한 경우 오류');
                          await this_server.client.deleteNotifications(this_server.session, [ev['notification']['extra'].noti_id]);
                          this.nakama.update_notifications(ev['notification']['extra'].isOfficial, ev['notification']['extra'].Target);
                        })
                    },
                    cssClass: 'redfont',
                  }],
                }).then(v => v.present());
                break;
            }
            break;
          case 'reply': // 알림에서 답장을 보냄
            let inputText = ev['inputValue'];
            this.noti.ClearNoti(ev['notification']['id']);
            switch (ActType) {
              case 'MinimalChatPage': // 그룹 채널 채팅에 답장하기
                let data = {
                  msg: inputText.trim(),
                }
                data['name'] = this.MyUserName;
                this.send(JSON.stringify(data));
                break;
            }
            break;
        }
      } catch (e) {
        console.warn('알림 실패에 대해서: ', e);
      }
    });
  }

  send(msg: string) {
    if (this.client && this.client.readyState == this.client.OPEN) this.client.send(msg);
    else this.disconnect();
  }

  /** FFS를 사용하는 경우 전송된 파일들을 전부 기억해두었다가 접속을 끊을 때 전부 삭제요청 보내기 */
  FFS_Urls = [];
  /** 분할 파일 받기시 진행도 표시를 위해 준비됨  
   * DownloadPartManager[uuid][temp_id] = counter;
   */
  DownloadPartManager = {};
  /** 재접속을 위한 빠른 버튼 보여주기 */
  p5canvas: p5;
  cacheAddress = '';
  /** 페이지는 벗어났으나 계속 연결을 유지중일 때 생성 */
  CreateRejoinButton() {
    if (this.p5canvas) this.p5canvas.remove();
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
        p['OnDediMessage'] = (color: string) => {
          float_button.style(`background-color: #${color}88`);
        }
        float_button.elt.onclick = () => {
          this.RejoinGroupChat();
        };
      }
    });
  }

  RejoinGroupChat() {
    this.modalCtrl.create({
      component: MinimalChatPage,
      componentProps: {
        address: this.cacheAddress,
        name: this.MyUserName || this.nakama.users.self['display_name'],
      },
    }).then(v => {
      this.global.StoreShortCutAct();
      v.onDidDismiss().then(() => {
        this.global.RestoreShortCutAct();
      });
      v.present();
    });
  }

  /** 연결중인 상태인지에 대한 boolean  
   * 연산 간소화를 위해 존재함
   */
  IsConnected = false;

  /** 클라이언트 끊기 */
  disconnect(code = 1000, reason = 'user_close') {
    if (this.client) this.client.close(code, reason);
    this.IsConnected = false;
    this.cacheAddress = '';
    this.uuid = undefined;
    if (this.p5canvas) this.p5canvas.remove();
    this.client = undefined;
    this.JoinedChannel = undefined;
    this.status = 'idle';
  }
}

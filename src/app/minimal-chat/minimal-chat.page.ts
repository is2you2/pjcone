// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { ILocalNotificationAction, ILocalNotificationActionType } from '@awesome-cordova-plugins/local-notifications/ngx';
import { IonInput, ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';
import { StatusManageService } from '../status-manage.service';
import { LanguageSettingService } from '../language-setting.service';
import { LocalGroupServerService } from '../local-group-server.service';
import { isPlatform } from '../app.component';
import { GlobalActService, isDarkMode } from '../global-act.service';
import clipboard from 'clipboardy';
import { P5ToastService } from '../p5-toast.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IndexedDBService } from '../indexed-db.service';

/** MiniRanchat 에 있던 기능 이주, 대화창 구성 */
@Component({
  selector: 'app-minimal-chat',
  templateUrl: './minimal-chat.page.html',
  styleUrls: ['./minimal-chat.page.scss'],
})
export class MinimalChatPage implements OnInit {

  constructor(
    public client: MiniranchatClientService,
    public modalCtrl: ModalController,
    private device: Device,
    private noti: LocalNotiService,
    private title: Title,
    private params: NavParams,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private local_server: LocalGroupServerService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
  ) { }

  uuid = this.device.uuid;
  header_title: string;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'ranchat';
  iconColor = 'd8d8d8';
  lnId = 11;
  /** 새 대화 버튼 disabled 토글 */
  req_refreshed = false;
  minimal_chat_log: HTMLElement;
  /** 그룹사설서버 여부 */
  isCustomDedicated = false;
  isLocalAddress = false;
  SelectedAddress = '';
  addresses: any[];
  isMobileApp = false;
  QRCodeSRC: any;

  reply_act: ILocalNotificationAction[];

  /** 이 창 열기(알림 상호작용) */
  open_this = (ev: any) => {
    // 알림 아이디가 같으면 진입 허용
    if (ev['id'] == this.lnId) {
      this.modalCtrl.create({
        component: MinimalChatPage,
        componentProps: {
          address: this.params.get('address'),
          name: this.params.get('name'),
        },
      }).then(v => v.present());
    }
  }

  /** 주인장이 공유할 IP주소를 선택합니다  
   * 자체 서버가 있다면 그 주소를, 아니라면 비보안 주소를 생성합니다
   */
  async SelectOtherAddress(ev: any) {
    let address_text: string = ev.detail.value;
    let extract = address_text.substring(address_text.indexOf('(') + 1, address_text.indexOf(')'));
    try { // 사용자 지정 서버 업로드 시도 우선
      let HasLocalPage = `${location.protocol}//${extract}:8080`;
      const cont = new AbortController();
      const id = setTimeout(() => {
        cont.abort();
      }, 500);
      let res = await fetch(HasLocalPage, { signal: cont.signal });
      clearTimeout(id);
      if (res.ok) this.SelectedAddress = `${location.protocol}//${extract}:8080/?group_dedi=ws://${extract}`;
    } catch (e) {
      this.SelectedAddress = `http://pjcone.ddns.net/?group_dedi=ws://${extract}`;
    }
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
  }

  /** 그룹채팅인지 랜덤채팅인지 분류 */
  target = 'dedicated_groupchat';

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.replaceState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.modalCtrl.dismiss();
    };
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.isMobileApp = isPlatform == 'Android' || isPlatform == 'iOS';
    this.local_server.funcs.onCheck = (v: any) => {
      let keys = Object.keys(v);
      let results: any[] = [];
      keys.forEach(key => {
        if (v[key]['ipv4Addresses'].length)
          v[key]['ipv4Addresses'].forEach((_address: any) => {
            results.push({
              address: _address,
              key: key,
            });
          });
        this.addresses = results;
      });
    }
    if (this.client.p5canvas) this.client.p5canvas.remove();
    this.local_server.check_addresses();
    this.header_title = this.lang.text['MinimalChat']['header_title_ranchat'];
    let get_address = this.params.get('address');
    let name = this.params.get('name');
    if (get_address) {
      this.target = 'dedicated_groupchat';
      this.lnId = 12;
      this.header_title = this.lang.text['MinimalChat']['header_title_group'];
      this.client.status[this.target] = 'custom';
      this.Header = 'simplechat';
      this.isCustomDedicated = true;
      this.isLocalAddress = get_address == 'ws://127.0.0.1';
      // 서버 주인 외의 사람이 진입한 경우 공유를 용이하게 QRCode를 즉시 게시
      if (!this.isLocalAddress) {
        this.SelectedAddress = `${location.protocol}//${location.host}/?group_dedi=ws://${get_address}`;
        this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
      }
    }
    this.noti.RemoveListener(`send${this.target}`);
    this.noti.RemoveListener(`reconn${this.target}`);
    this.noti.RemoveListener(`exit${this.target}`);
    this.noti.ClearNoti(this.lnId);
    this.title.setTitle(get_address ? this.lang.text['MinimalChat']['WebTitle_group'] : this.lang.text['MinimalChat']['WebTitle_ran']);
    this.noti.Current = this.Header;
    this.minimal_chat_log = document.getElementById('minimal_chat_div');
    this.minimal_chat_log.onscroll = (_ev: any) => {
      if (this.minimal_chat_log.scrollHeight == this.minimal_chat_log.scrollTop + this.minimal_chat_log.clientHeight)
        this.scroll_down();
    }
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/simplechat.png`);

    if (!this.client.client[this.target] || this.client.client[this.target].readyState != this.client.client[this.target].OPEN
      && !(this.client.p5canvas && this.client.p5canvas['OnDediMessage'])) {
      this.noti.SetListener(`send${this.target}`, (v: any, eopts: any) => {
        this.noti.ClearNoti(v['id']);
        this.send(eopts['text']);
      });
      this.noti.SetListener(`reconn${this.target}`, (v: any) => {
        this.noti.ClearNoti(v['id']);
        this.join_ranchat();
      });
      this.noti.SetListener(`exit${this.target}`, (v: any) => {
        this.noti.ClearNoti(v['id']);
        this.quit_chat();
      });
      this.reply_act = [{
        id: `send${this.target}`,
        type: ILocalNotificationActionType.INPUT,
        title: this.lang.text['MinimalChat']['Noti_Reply'],
      }];
      this.client.userInput[this.target].logs.length = 0;
      let joinMessage = { color: isDarkMode ? 'bbb' : '444', text: this.client.status[this.target] == 'custom' ? this.lang.text['MinimalChat']['joinChat_group'] : this.lang.text['MinimalChat']['joinChat_ran'] };
      this.client.userInput[this.target].logs.push(joinMessage);
      this.client.userInput[this.target].last_message = joinMessage;
      this.client.initialize(this.target, get_address);
    }
    this.client.funcs[this.target].onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        let isMe = this.uuid == data['uid'];
        let target = isMe ? (name || this.lang.text['MinimalChat']['name_me']) : (data['name'] || (this.client.status[this.target] == 'custom' ? this.lang.text['MinimalChat']['name_stranger_group'] : this.lang.text['MinimalChat']['name_stranger_ran']));
        let color = data['uid'] ? (data['uid'].replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6) : isDarkMode ? '888888' : '444444';
        if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage'](color);
        if (data['msg']) {
          let getMessage = { color: color, text: data['msg'], target: target };
          this.client.userInput[this.target].logs.push(getMessage);
          this.client.userInput[this.target].last_message = getMessage;
        }
        else if (data['type']) {
          if (data['type'] == 'join') {
            let UserJoin = { color: color, text: this.lang.text['MinimalChat']['user_join_comment'], target: target };
            this.client.userInput[this.target].logs.push(UserJoin);
            this.client.userInput[this.target].last_message = UserJoin;
          } else {
            let UserLeave = { color: color, text: this.lang.text['MinimalChat']['user_out_comment'], target: target };
            this.client.userInput[this.target].logs.push(UserLeave);
            this.client.userInput[this.target].last_message = UserLeave;
          }
        }
        let alert_this: any = 'certified';
        if (data['count']) this.client.ConnectedNow[this.target] = data['count'];
        if (data['msg'])
          this.noti.PushLocal({
            id: this.lnId,
            title: target,
            body: data['msg'],
            group_ln: 'simplechat',
            extra_ln: {
              page: {
                component: 'MinimalChatPage',
                componentProps: {
                  address: this.params.get('address'),
                  name: this.params.get('name'),
                  noti_id: this.Header,
                },
              },
            },
            smallIcon_ln: 'simplechat',
            iconColor_ln: this.iconColor,
            autoCancel_ln: true,
            // actions_ln: this.reply_act,
          }, this.Header, this.open_this);
        else if (data['type']) {
          let isJoin = data['type'] == 'join';
          if (!isJoin) alert_this = 'pending';
          this.noti.PushLocal({
            id: this.lnId,
            title: isJoin ? this.lang.text['MinimalChat']['user_join'] : this.lang.text['MinimalChat']['user_out'],
            body: target + ` | ${isJoin ? this.lang.text['MinimalChat']['user_join_comment'] : this.lang.text['MinimalChat']['user_out_comment']}`,
            group_ln: 'simplechat',
            extra_ln: {
              page: {
                component: 'MinimalChatPage',
                componentProps: {
                  address: this.params.get('address'),
                  name: this.params.get('name'),
                  noti_id: this.Header,
                },
              },
            },
            smallIcon_ln: 'simplechat',
            iconColor_ln: this.iconColor,
            autoCancel_ln: true,
          }, this.Header, this.open_this);
        }
        this.statusBar.settings[this.target] = alert_this;
        setTimeout(() => {
          if (this.statusBar.settings[this.target] == alert_this)
            this.statusBar.settings[this.target] = 'online';
        }, 250);
      } catch (e) {
        switch (v) {
          case 'GOT_MATCHED':
            this.statusBar.settings[this.target] = 'certified';
            setTimeout(() => {
              if (this.statusBar.settings[this.target] == 'certified')
                this.statusBar.settings[this.target] = 'online';
            }, 250);
            this.client.userInput[this.target].logs.length = 0;
            let GotMatched = { color: isDarkMode ? '8bb' : '488', text: this.lang.text['MinimalChat']['meet_someone'] };
            this.client.userInput[this.target].logs.push(GotMatched);
            this.client.userInput[this.target].last_message = GotMatched;
            this.client.status[this.target] = 'linked';
            this.noti.PushLocal({
              id: this.lnId,
              title: this.lang.text['MinimalChat']['meet_someone'],
              group_ln: 'simplechat',
              // actions_ln: [{
              //   id: `send${this.target}`,
              //   type: ILocalNotificationActionType.INPUT,
              //   title: this.lang.text['MinimalChat']['Noti_Greeting']
              // }],
              extra_ln: {
                page: {
                  component: 'MinimalChatPage',
                  componentProps: {
                    address: this.params.get('address'),
                    name: this.params.get('name'),
                    noti_id: this.Header,
                  },
                },
              },
              autoCancel_ln: true,
              smallIcon_ln: 'simplechat',
              iconColor_ln: this.iconColor,
            }, this.Header, this.open_this);
            break;
          case 'PARTNER_OUT':
            this.statusBar.settings[this.target] = 'pending';
            setTimeout(() => {
              if (this.statusBar.settings[this.target] == 'pending')
                this.statusBar.settings[this.target] = 'online';
            }, 250);
            let UserLeave = { color: isDarkMode ? 'b88' : '844', text: this.lang.text['MinimalChat']['leave_someone'] };
            this.client.userInput[this.target].logs.push(UserLeave);
            this.client.userInput[this.target].last_message = UserLeave;
            this.client.status[this.target] = 'unlinked';
            this.noti.PushLocal({
              id: this.lnId,
              title: this.lang.text['MinimalChat']['leave_someone'],
              group_ln: 'simplechat',
              extra_ln: {
                page: {
                  component: 'MinimalChatPage',
                  componentProps: {
                    address: this.params.get('address'),
                    name: this.params.get('name'),
                    noti_id: this.Header,
                  },
                },
              },
              autoCancel_ln: true,
              smallIcon_ln: 'simplechat',
              iconColor_ln: this.iconColor,
            }, this.Header, this.open_this);
            break;
          default:
            let sep = v.split(':');
            this.client.ConnectedNow[this.target] = parseInt(sep[1]);
            break;
        }
      }
      this.auto_scroll_down();
    }
    this.client.funcs[this.target].onclose = (_v: any) => {
      this.statusBar.settings[this.target] = 'missing';
      setTimeout(() => {
        this.statusBar.settings[this.target] = 'offline';
      }, 1500);
      let failedJoin = { color: 'faa', text: this.lang.text['MinimalChat']['failed_to_join'] };
      this.client.userInput[this.target].logs.push(failedJoin);
      this.client.userInput[this.target].last_message = failedJoin;
      this.noti.PushLocal({
        id: this.lnId,
        title: this.lang.text['MinimalChat']['failed_to_join'],
        group_ln: 'simplechat',
        extra_ln: {
          page: {
            component: 'MinimalChatPage',
            componentProps: {
              address: this.params.get('address'),
              name: this.params.get('name'),
              noti_id: this.Header,
            },
          },
        },
        // actions_ln: [{
        //   id: `exit${this.target}`,
        //   title: this.lang.text['MinimalChat']['exit_chat'],
        //   launch: false,
        // }],
        autoCancel_ln: true,
        smallIcon_ln: 'simplechat',
        iconColor_ln: this.iconColor,
      }, this.Header, this.open_this);
      if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage']('ff0000');
    }
    this.client.funcs[this.target].onopen = (_v: any) => {
      this.statusBar.settings[this.target] = 'online';
      if (get_address) {
        let count = {
          uid: this.uuid,
          name: name,
          type: 'join',
        }
        this.client.send(this.target, JSON.stringify(count));
      }
      this.client.funcs[this.target].onclose = (_v: any) => {
        this.statusBar.settings[this.target] = 'missing';
        setTimeout(() => {
          this.statusBar.settings[this.target] = 'offline';
        }, 1500);
        let text = this.lang.text['MinimalChat']['cannot_join'];
        let GotMessage = { color: 'faa', text: text };
        this.client.userInput[this.target].logs.push(GotMessage);
        this.client.userInput[this.target].last_message = GotMessage;
        this.noti.PushLocal({
          id: this.lnId,
          title: text,
          group_ln: 'simplechat',
          extra_ln: {
            page: {
              component: 'MinimalChatPage',
              componentProps: {
                address: this.params.get('address'),
                name: this.params.get('name'),
                noti_id: this.Header,
              },
            },
          },
          // actions_ln: [{
          //   id: `exit${this.target}`,
          //   title: this.lang.text['MinimalChat']['exit_chat'],
          //   launch: false,
          // }],
          autoCancel_ln: true,
          smallIcon_ln: 'simplechat',
          iconColor_ln: this.iconColor,
        }, this.Header, this.open_this);
        if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage']('ff0000');
      }
    }
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_qr_address() {
    this.mClipboard.copy(this.SelectedAddress)
      .catch(_e => {
        clipboard.write(this.SelectedAddress).then(() => {
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${this.SelectedAddress}`,
            });
        }).catch(_e => { });
      });
  }

  @ViewChild('minimalchat_input') minimalchat_input: IonInput;

  ionViewDidEnter() {
    setTimeout(() => {
      this.scroll_down();
    }, 0);
  }

  scroll_down() {
    let scrollHeight = this.minimal_chat_log.scrollHeight;
    this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
  }

  /** 랜덤채팅에 참여하기, 대화 끊고 다시 연결 */
  join_ranchat() {
    if (this.client.client[this.target].readyState == this.client.client[this.target].OPEN) {
      this.client.send(this.target, 'REQ_REGROUPING');
      this.client.status[this.target] = 'unlinked';
      this.client.userInput[this.target].logs.length = 0;
      let WaitingMsg = { color: isDarkMode ? 'bbb' : '444', text: this.lang.text['MinimalChat']['waiting_someone'] };
      this.client.userInput[this.target].logs.push(WaitingMsg);
      this.client.userInput[this.target].last_message = WaitingMsg;
      let scrollHeight = this.minimal_chat_log.scrollHeight;
      this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      this.focus_on_input();
      this.req_refreshed = true;
      setTimeout(() => {
        this.req_refreshed = false;
      }, 1000);
    } else { // 서버 연결중 아닐 때
      let text = this.lang.text['MinimalChat']['cannot_start'];
      let CannotMsg = { color: 'faa', text: text };
      this.client.userInput[this.target].logs.push(CannotMsg);
      this.client.userInput[this.target].last_message = CannotMsg;
      this.noti.PushLocal({
        id: this.lnId,
        title: text,
        group_ln: 'simplechat',
        extra_ln: {
          page: {
            component: 'MinimalChatPage',
            componentProps: {
              address: this.params.get('address'),
              name: this.params.get('name'),
              noti_id: this.Header,
            },
          },
        },
        // actions_ln: [{
        //   id: `exit${this.target}`,
        //   title: this.lang.text['MinimalChat']['exit_chat'],
        //   launch: false,
        // }],
        autoCancel_ln: true,
        smallIcon_ln: 'simplechat',
        iconColor_ln: this.iconColor,
      }, this.Header, this.open_this);
    }
  }

  /** 모바일 키보드 높이 맞추기용 */
  focus_on_input(force?: number) {
    this.minimalchat_input.setFocus();
    this.auto_scroll_down(force);
  }

  auto_scroll_down(force?: number) {
    setTimeout(() => {
      let scrollHeight = this.minimal_chat_log.scrollHeight;
      if (scrollHeight < this.minimal_chat_log.scrollTop + this.minimal_chat_log.clientHeight + 120) {
        this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
    }, force || 0);
  }

  /** 메시지 보내기 */
  send(text?: string) {
    this.statusBar.settings[this.target] = 'certified';
    setTimeout(() => {
      if (this.statusBar.settings[this.target] == 'certified')
        this.statusBar.settings[this.target] = 'online';
    }, 250);
    let data = {
      uid: this.uuid,
      msg: text || this.client.userInput[this.target].text,
    }
    if (!data.msg.trim()) return;
    let name = this.params.get('name');
    if (name) data['name'] = name;
    this.client.send(this.target, JSON.stringify(data));
    this.client.userInput[this.target].text = '';
    this.focus_on_input();
  }

  /** 채팅 앱 종료하기 */
  quit_chat() {
    this.client.funcs[this.target].onclose = () => {
      this.statusBar.settings[this.target] = 'missing';
      setTimeout(() => {
        this.statusBar.settings[this.target] = 'offline';
      }, 1500);
      let LeaveMsg = { color: isDarkMode ? 'ffa' : '884', text: this.client.status[this.target] == 'custom' ? this.lang.text['MinimalChat']['leave_chat_group'] : this.lang.text['MinimalChat']['leave_chat_ran'] };
      this.client.userInput[this.target].logs.push(LeaveMsg);
      this.client.userInput[this.target].last_message = LeaveMsg;
      let scrollHeight = this.minimal_chat_log.scrollHeight;
      this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
    this.noti.RemoveListener(`send${this.target}`);
    this.noti.RemoveListener(`reconn${this.target}`);
    this.noti.RemoveListener(`exit${this.target}`);
    this.noti.ClearNoti(this.lnId);
    this.client.disconnect(this.target);
    this.indexed.GetFileListFromDB('tmp_files/dedi_chat', list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    if (this.params.get('address') == 'ws://127.0.0.1')
      this.local_server.stop();
    this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.noti.Current = undefined;
    if (this.client.IsConnected) this.client.CreateRejoinButton();
  }
}

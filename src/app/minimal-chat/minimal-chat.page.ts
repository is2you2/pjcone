// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { ILocalNotificationAction, ILocalNotificationActionType } from '@awesome-cordova-plugins/local-notifications/ngx';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';
import * as p5 from 'p5';
import { StatusManageService } from '../status-manage.service';
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';
import { LocalGroupServerService } from '../local-group-server.service';
import { isPlatform } from '../app.component';
import { GlobalActService, isDarkMode } from '../global-act.service';

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
    private nakama: NakamaService,
    private local_server: LocalGroupServerService,
    private global: GlobalActService,
  ) { }

  uuid = this.device.uuid;
  header_title: string;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'ranchat';
  iconColor = 'd8d8d8';
  lnId = 11;
  /** 새 대화 버튼 disabled 토글 */
  req_refreshed = false;
  content_panel: HTMLElement;
  /** 그룹사설서버 여부 */
  isCustomDedicated = false;
  isLocalAddress = false;
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

  /** 주인장이 공유할 IP주소를 선택합니다 */
  SelectOtherAddress(ev: any) {
    let address_text: string = ev.detail.value;
    let extract = address_text.substring(address_text.indexOf('(') + 1, address_text.indexOf(')'));
    this.QRCodeSRC = this.global.readasQRCodeFromId({
      type: 'group_dedi',
      value: {
        address: `ws://${extract}`,
      }
    });
  }

  /** 그룹채팅인지 랜덤채팅인지 분류 */
  target: 'dedicated_groupchat' | 'community_ranchat' = 'community_ranchat';
  ngOnInit() {
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
    this.local_server.check_addresses();
    this.nakama.removeBanner();
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
      if (!this.isLocalAddress)
        this.QRCodeSRC = this.global.readasQRCodeFromId({
          type: 'group_dedi',
          value: {
            address: get_address,
          }
        });
    }
    this.noti.RemoveListener(`send${this.target}`);
    this.noti.RemoveListener(`reconn${this.target}`);
    this.noti.RemoveListener(`exit${this.target}`);
    this.noti.ClearNoti(this.lnId);
    this.title.setTitle(get_address ? this.lang.text['MinimalChat']['WebTitle_group'] : this.lang.text['MinimalChat']['WebTitle_ran']);
    this.noti.Current = this.Header;
    this.content_panel = document.getElementById('content');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/simplechat.png`);

    if (!this.client.client[this.target] || this.client.client[this.target].readyState != this.client.client[this.target].OPEN) {
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
      // 사설 서버 주소입력에 따른 분기 설정구간
      if (get_address) { // 사설 서버인 경우
      } else { // 일반 랜덤채팅인 경우
        this.reply_act.push({
          id: `reconn${this.target}`,
          title: this.lang.text['MinimalChat']['new_chat'],
          launch: false,
        });
      }
      this.client.userInput[this.target].logs.length = 0;
      this.client.userInput[this.target].logs.push({ color: isDarkMode ? 'bbb' : '444', text: this.client.status[this.target] == 'custom' ? this.lang.text['MinimalChat']['joinChat_group'] : this.lang.text['MinimalChat']['joinChat_ran'] });
      this.client.initialize(this.target, get_address);
    }
    this.client.funcs[this.target].onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        let isMe = this.uuid == data['uid'];
        let target = isMe ? (name || this.lang.text['MinimalChat']['name_me']) : (data['name'] || (this.client.status[this.target] == 'custom' ? this.lang.text['MinimalChat']['name_stranger_group'] : this.lang.text['MinimalChat']['name_stranger_ran']));
        let color = data['uid'] ? (data['uid'].replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6) : isDarkMode ? '888' : '444';
        if (data['msg'])
          this.client.userInput[this.target].logs.push({ color: color, text: data['msg'], target: target });
        else if (data['type']) {
          if (data['type'] == 'join')
            this.client.userInput[this.target].logs.push({ color: color, text: this.lang.text['MinimalChat']['user_join_comment'], target: target });
          else
            this.client.userInput[this.target].logs.push({ color: color, text: this.lang.text['MinimalChat']['user_out_comment'], target: target });
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
            this.client.userInput[this.target].logs.push({ color: isDarkMode ? '8bb' : '488', text: this.lang.text['MinimalChat']['meet_someone'] });
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
            this.client.userInput[this.target].logs.push({ color: isDarkMode ? 'b88' : '844', text: this.lang.text['MinimalChat']['leave_someone'] });
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
              // actions_ln: [{
              //   id: `reconn${this.target}`,
              //   title: this.lang.text['MinimalChat']['new_chat']
              // }, {
              //   id: `exit${this.target}`,
              //   title: this.lang.text['MinimalChat']['exit_chat'],
              //   launch: false,
              // }],
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
      this.focus_on_input();
    }
    this.client.funcs[this.target].onclose = (_v: any) => {
      this.statusBar.settings[this.target] = 'missing';
      setTimeout(() => {
        this.statusBar.settings[this.target] = 'offline';
      }, 1500);
      this.client.userInput[this.target].logs.push({ color: 'faa', text: this.lang.text['MinimalChat']['failed_to_join'] });
      this.focus_on_input();
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
        this.client.userInput[this.target].logs.push({ color: 'faa', text: text });
        this.focus_on_input();
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
  }

  ionViewDidEnter() {
    setTimeout(() => {
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  /** 랜덤채팅에 참여하기, 대화 끊고 다시 연결 */
  join_ranchat() {
    if (this.client.client[this.target].readyState == this.client.client[this.target].OPEN) {
      this.client.send(this.target, 'REQ_REGROUPING');
      this.client.status[this.target] = 'unlinked';
      this.client.userInput[this.target].logs.length = 0;
      this.client.userInput[this.target].logs.push({ color: isDarkMode ? 'bbb' : '444', text: this.lang.text['MinimalChat']['waiting_someone'] });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.focus_on_input();
      this.req_refreshed = true;
      setTimeout(() => {
        this.req_refreshed = false;
      }, 1000);
    } else { // 서버 연결중 아닐 때
      let text = this.lang.text['MinimalChat']['cannot_start'];
      this.client.userInput[this.target].logs.push({ color: 'faa', text: text });
      this.focus_on_input();
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
    setTimeout(() => {
      this.content_panel.scrollIntoView({ block: 'start' });
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
      this.client.userInput[this.target].logs.push({ color: isDarkMode ? 'ffa' : '884', text: this.client.status[this.target] == 'custom' ? this.lang.text['MinimalChat']['leave_chat_group'] : this.lang.text['MinimalChat']['leave_chat_ran'] });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.noti.RemoveListener(`send${this.target}`);
    this.noti.RemoveListener(`reconn${this.target}`);
    this.noti.RemoveListener(`exit${this.target}`);
    this.noti.ClearNoti(this.lnId);
    this.client.disconnect(this.target);
    this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.noti.Current = undefined;
  }
}

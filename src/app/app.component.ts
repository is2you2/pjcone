// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { AlertController, ModalController, Platform } from '@ionic/angular';
import { IndexedDBService } from './indexed-db.service';
import { LocalNotiService } from './local-noti.service';
import { MinimalChatPage } from './minimal-chat/minimal-chat.page';
import { NakamaService } from './nakama.service';
import { ChatRoomPage } from './portal/subscribes/chat-room/chat-room.page';
import { WscService } from './wsc.service';
import { AdMob } from "@capacitor-community/admob";
import { AddTodoMenuPage } from './portal/main/add-todo-menu/add-todo-menu.page';
import { GlobalActService } from './global-act.service';
import { LanguageSettingService } from './language-setting.service';
/** 페이지가 돌고 있는 플렛폼 구분자 */
export var isPlatform: 'Android' | 'iOS' | 'DesktopPWA' | 'MobilePWA' = 'DesktopPWA';
/** 소켓서버용 */
export const SOCKET_SERVER_ADDRESS: string = 'pjcone.ddns.net'; // http:// 와 같은 헤더 없이 주소만
/** 이미지 등 자료 링크용(웹 사이트 host) */
export const SERVER_PATH_ROOT: string = 'https://is2you2.github.io/';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    private platform: Platform,
    router: Router,
    ngZone: NgZone,
    noti: LocalNotiService,
    client: WscService,
    bgmode: BackgroundMode,
    private nakama: NakamaService,
    indexed: IndexedDBService,
    private modalCtrl: ModalController,
    global: GlobalActService,
    alertCtrl: AlertController,
    lang: LanguageSettingService,
  ) {
    if (platform.is('desktop'))
      isPlatform = 'DesktopPWA';
    else if (platform.is('mobileweb'))
      isPlatform = 'MobilePWA';
    else if (platform.is('android'))
      isPlatform = 'Android';
    else if (platform.is('iphone'))
      isPlatform = 'iOS';
    noti.initialize();
    this.init_admob();
    client.initialize();
    // 모든 사용자가 수신할 수 있는 알림
    client.received['all_noti'] = (ev) => {
      noti.PushLocal({
        id: 2,
        title: lang.text.Administrator['AssistServNoti'],
        body: ev['text'],
        smallIcon_ln: 'icon_mono',
        iconColor_ln: 'ffd94e',
        image: ev['img'],
      }, undefined);
    }
    // 관리자 전용 알림 설정
    client.received['admin_noti'] = (ev: any) => {
      client.is_admin = true;
      noti.PushLocal({
        id: 0,
        title: lang.text['Administrator']['AdminNotiTitle'],
        body: lang.text['Administrator'][ev['text']],
        smallIcon_ln: 'icon_mono',
        iconColor_ln: 'ffd94e',
        autoCancel_ln: true,
        timeoutAfter_ln: 8000,
      }, undefined);
      setTimeout(() => {
        noti.ClearNoti(0);
      }, 8000);
    };
    indexed.initialize(() => {
      nakama.initialize();
    });
    // 모바일 기기 특정 설정
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
        ngZone.run(() => {
          // Example url: https://beerswift.app/tabs/tab2
          // slug = /tabs/tab2
          const slug = event.url.split(".app").pop();
          if (slug) {
            router.navigateByUrl(slug);
          }
          // If no match, do nothing - let regular routing
          // logic take over
        });
      });
    }
    noti.SetListener('click', (ev: any) => {
      if (ev.data.page) {
        let page: any;
        let props: any = ev.data.page.componentProps;
        let noti_id: string;
        switch (ev.data.page.component) {
          case 'ChatRoomPage': {
            page = ChatRoomPage;
            let _cid = props['info']['id'];
            let _is_official = props['info']['isOfficial'];
            let _target = props['info']['target'];
            noti_id = props['info']['noti_id'];
            props = {
              info: nakama.channels_orig[_is_official][_target][_cid]
            };
          }
            break;
          case 'MinimalChatPage':
            page = MinimalChatPage;
            noti_id = props['noti_id'];
            break;
          case 'AddTodoMenuPage':
            page = AddTodoMenuPage;
            props = {
              godot: global.godot.contentWindow || global.godot.contentDocument,
              data: props['data'],
            };
            noti_id = JSON.parse(props['data'])['id'];
            break;
          case 'NakamaReqContTitle': // 서버 진입 알림
            let this_server = nakama.servers[props.data.isOfficial][props.data.Target];
            let msg = '';
            msg += `${lang.text['Nakama']['ReqContServer']}: ${props.data.serverName}<br>`;
            msg += `${lang.text['Nakama']['ReqContUserName']}: ${props.data.userName}`;
            alertCtrl.create({
              header: lang.text['Nakama']['ReqContTitle'],
              message: msg,
              buttons: [{
                text: lang.text['Nakama']['ReqContAccept'],
                handler: () => {
                  this_server.client.addGroupUsers(this_server.session, props.data.group_id, [props.data.user_id])
                    .then(v => {
                      if (!v) console.warn('밴인 경우인 것 같음, 확인 필요');
                      this_server.client.deleteNotifications(this_server.session, [props.data.noti_id])
                        .then(b => {
                          if (b) nakama.update_notifications(props.data.isOfficial, props.data.Target);
                          else console.warn('알림 지우기 실패: ', b);
                        });
                    });
                }
              }, {
                text: lang.text['Nakama']['ReqContReject'],
                handler: () => {
                  this_server.client.kickGroupUsers(this_server.session, props.data.group_id, [props.data.user_id])
                    .then(b => {
                      if (!b) console.warn('그룹 참여 거절을 kick한 경우 오류');
                      this_server.client.deleteNotifications(this_server.session, [props.data.noti_id]);
                      nakama.update_notifications(props.data.isOfficial, props.data.Target);
                    })
                }
              }],
            }).then(v => v.present());
            return;
          default:
            console.warn('준비된 페이지가 아님: ', ev.data.page.component);
            break;
        }
        if (noti_id == noti.Current) return;
        this.waiting_open_page(ev, page, props);
      }
    });
    bgmode.enable();
  }

  /** 앱이 꺼진 상태에서 알림 클릭시 바로 동작하지 않기 때문에 페이지 열기 가능할 때까지 기다림  
   * 당장은 방법이 없어보이나, 함수를 일단 분리해둠
   */
  waiting_open_page(ev: any, page: any, props: any) {
    if (window['godot'] == 'godot') {
      this.modalCtrl.create({
        component: page,
        componentProps: props,
      }).then(v => {
        switch (ev.data.page.component) {
          case 'ChatRoomPage':
            this.nakama.go_to_chatroom_without_admob_act(v);
            break;
          default:
            console.warn('준비된 페이지 행동 없음: ', ev.data.page.component);
            v.present();
            break;
        }
      });
    } else {
      console.log('retry open notification clicked..');
      setTimeout(() => {
        this.waiting_open_page(ev, page, props);
      }, 1000);
    }
  }

  init_admob() {
    this.platform.ready().then(() => {
      AdMob.initialize({
        testingDevices: [],
        initializeForTesting: true,
      });
    });
  }
}

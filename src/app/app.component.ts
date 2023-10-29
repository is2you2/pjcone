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
import { AdMob } from "@capacitor-community/admob";
import { LanguageSettingService } from './language-setting.service';
import { GlobalActService } from './global-act.service';
/** 페이지가 돌고 있는 플렛폼 구분자 */
export var isPlatform: 'Android' | 'iOS' | 'DesktopPWA' | 'MobilePWA' = 'DesktopPWA';
/** Nativefier로 실행중인지 검토하기 */
export var isNativefier = false;
/** 이미지 등 자료 링크용(웹 사이트 host) */
export const SERVER_PATH_ROOT: string = 'https://is2you2.github.io/';
import * as p5 from 'p5';
window['p5'] = p5;

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
    bgmode: BackgroundMode,
    private nakama: NakamaService,
    indexed: IndexedDBService,
    private modalCtrl: ModalController,
    alertCtrl: AlertController,
    private lang: LanguageSettingService,
    global: GlobalActService,
  ) {
    if (platform.is('desktop'))
      isPlatform = 'DesktopPWA';
    else if (platform.is('mobileweb'))
      isPlatform = 'MobilePWA';
    else if (platform.is('android'))
      isPlatform = 'Android';
    else if (platform.is('iphone'))
      isPlatform = 'iOS';
    isNativefier = platform.is('electron');
    indexed.initialize(() => {
      // 앱 재시작시 자동으로 동기화할 수 있도록 매번 삭제
      let init = global.CatchGETs(location.href) || {};
      global.initialize();
      nakama.AddressToQRCodeAct(init);
      noti.initialize();
      noti.load_settings();
    });
    lang.Callback_nakama = () => {
      nakama.initialize();
      nakama.check_if_online();
      lang.isFirstTime = false;
    }
    this.init_admob();
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
      try { // 페이지 연결 행동이 필요한 알림
        let page: any;
        let props: any = ev.data.page.componentProps;
        let noti_id: string;
        switch (ev.data.page.component) {
          case 'ChatRoomPage':
            noti_id = props['info']['noti_id'];
            break;
          case 'MinimalChatPage':
            page = MinimalChatPage;
            noti_id = props['noti_id'];
            break;
          case 'AddTodoMenuPage':
            props = {
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
          case 'AllUserNotification':
            break;
          default:
            console.warn('준비된 페이지가 아님: ', ev.data.page.component);
            break;
        }
        if (noti_id == noti.Current) return;
        this.waiting_open_page(ev, page, props);
      } catch (e) { // 페이지 연결이 없는 알림
        switch (ev.data.type) {
          case 'AllUserNotification':
            alertCtrl.create({
              header: ev.data.title,
              message: `<img *ngIf="${ev.data.image}" src="${ev.data.image}" alt="noti_image" style="border-radius: 2px">
<div>${ev.data.body}</div>`,
              buttons: [{
                text: '확인',
                handler: () => {
                  nakama.servers[ev.data.isOfficial][ev.data.target].client.deleteNotifications(
                    nakama.servers[ev.data.isOfficial][ev.data.target].session, [ev.data.noti_id]);
                }
              }]
            }).then(v => v.present());
            break;
          default:
            console.log('준비된 알림 행동 없음: ', ev.data);
            break;
        }
      }
    });
    bgmode.enable();
    nakama.on_socket_connected['connection_check'] = () => {
      nakama.check_if_online();
    }
    nakama.on_socket_disconnected['connection_check'] = () => {
      nakama.check_if_online();
    }
  }

  /** 앱이 꺼진 상태에서 알림 클릭시 바로 동작하지 않기 때문에 페이지 열기 가능할 때까지 기다림  
   * 당장은 방법이 없어보이나, 함수를 일단 분리해둠
   */
  async waiting_open_page(ev: any, page: any, props: any) {
    try {
      if (window['godot'] != 'godot') throw '고도엔진 준비되지 않음';
      let modal = await this.modalCtrl.create({
        component: page,
        componentProps: props,
      });
      switch (ev.data.page.component) {
        case 'ChatRoomPage':
          if (!this.lang.text['ChatRoom']['YouReadHereLast']) throw 'ChatRoomPage 번역 준비중';
          if (props.info.noti_id) {
            let _cid = props['info']['id'];
            let _is_official = props['info']['isOfficial'];
            let _target = props['info']['target'];
            props = {
              info: this.nakama.channels_orig[_is_official][_target][_cid]
            };
            throw 'ChatRoomPage props 재정비';
          }
          this.nakama.go_to_chatroom_without_admob_act(props.info);
          break;
        case 'MinimalChatPage':
          if (!this.lang.text['MinimalChat']['leave_chat_group']) throw 'MinimalChatPage 번역 준비중';
          modal.present();
          break;
        case 'AddTodoMenuPage':
          if (!this.lang.text['TodoDetail']['WIP']) throw 'AddTodoMenuPage 번역 준비중';
          this.nakama.open_add_todo_page(props['data']);
          break;
        default:
          console.warn('준비된 페이지 행동 없음: ', ev.data.page.component);
          modal.present();
          break;
      }
    } catch (e) {
      console.log('retry open notification clicked because... : ', e);
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

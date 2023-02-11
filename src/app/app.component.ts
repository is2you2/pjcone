// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { ModalController, Platform } from '@ionic/angular';
import { IndexedDBService } from './indexed-db.service';
import { LocalNotiService } from './local-noti.service';
import { MinimalChatPage } from './minimal-chat/minimal-chat.page';
import { NakamaService } from './nakama.service';
import { ChatRoomPage } from './portal/subscribes/chat-room/chat-room.page';
import { WscService } from './wsc.service';
import { AdMob } from "@capacitor-community/admob";
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
    nakama: NakamaService,
    indexed: IndexedDBService,
    modalCtrl: ModalController,
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
        title: '커뮤니티 알림',
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
        title: '커뮤니티 관리자',
        body: ev['text'],
        smallIcon_ln: 'icon_mono',
        iconColor_ln: 'ffd94e',
        autoCancel_ln: true,
        timeoutAfter_ln: 8000,
      }, undefined);
      setTimeout(() => {
        noti.CancelNotificationById(0);
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
          case 'ChatRoomPage':
            page = ChatRoomPage;
            let _cid = ev.data.page.componentProps['info']['id'];
            let _is_official = ev.data.page.componentProps['info']['isOfficial'];
            let _target = ev.data.page.componentProps['info']['target'];
            noti_id = ev.data.page.componentProps['info']['noti_id'];
            props = {
              info: nakama.channels_orig[_is_official][_target][_cid]
            };
            break;
          case 'MinimalChatPage':
            page = MinimalChatPage;
            noti_id = ev.data.page.componentProps['noti_id'];
            break;
          default:
            console.warn('준비된 페이지가 아님: ', ev.data.page.component);
            break;
        }
        if (noti_id == noti.Current) return;
        modalCtrl.create({
          component: page,
          componentProps: props,
        }).then(v => {
          switch (ev.data.page.component) {
            case 'ChatRoomPage':
              nakama.go_to_chatroom_without_admob_act(v);
              break;
            default:
              console.warn('준비된 페이지 행동 없음: ', ev.data.page.component);
              v.present();
              break;
          }
        });
      }
    });
    bgmode.enable();
  }

  init_admob() {
    this.platform.ready().then(() => {
      AdMob.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: true,
      });
    });
  }
}

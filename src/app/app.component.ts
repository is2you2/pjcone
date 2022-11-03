import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Platform } from '@ionic/angular';
import { IndexedDBService } from './indexed-db.service';
import { LocalNotiService } from './local-noti.service';
import { NakamaService } from './nakama.service';
import { WscService } from './wsc.service';
/** 페이지가 돌고 있는 플렛폼 구분자 */
export var isPlatform: 'Android' | 'iOS' | 'DesktopPWA' | 'MobilePWA' = 'DesktopPWA';
/** 커뮤니티 서버 덮어쓰기 */
export var ADDRESS_OVERRIDE: string;
/** 커뮤니티 서버 주소 헤더 */
export var SOCKET_HEADER = 'wss';
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
  constructor(platform: Platform,
    router: Router,
    ngZone: NgZone,
    noti: LocalNotiService,
    client: WscService,
    bgmode: BackgroundMode,
    nakama: NakamaService,
    indexed: IndexedDBService,
  ) {
    if (platform.is('desktop'))
      isPlatform = 'DesktopPWA';
    else if (platform.is('mobileweb'))
      isPlatform = 'MobilePWA';
    else if (platform.is('android'))
      isPlatform = 'Android';
    else if (platform.is('iphone'))
      isPlatform = 'iOS';
    ADDRESS_OVERRIDE = localStorage.getItem('wsc_address_override');
    if (ADDRESS_OVERRIDE) SOCKET_HEADER = 'ws';
    noti.initialize();
    indexed.initialize(() => {
      client.initialize();
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
    bgmode.enable();
  }
}

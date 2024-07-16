import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Platform } from '@ionic/angular';
import { IndexedDBService } from './indexed-db.service';
import { LocalNotiService } from './local-noti.service';
import { NakamaService } from './nakama.service';
import { LanguageSettingService } from './language-setting.service';
import { GlobalActService } from './global-act.service';
import { LocalNotifications } from "@capacitor/local-notifications";
/** 페이지가 돌고 있는 플렛폼 구분자 */
export var isPlatform: 'Android' | 'iOS' | 'DesktopPWA' | 'MobilePWA' = 'DesktopPWA';
/** Nativefier로 실행중인지 검토하기 */
export var isNativefier = false;
/** 이미지 등 자료 링크용(웹 사이트 host) */
export const SERVER_PATH_ROOT: string = 'https://is2you2.github.io/';
import * as p5 from 'p5';
import { MiniranchatClientService } from './miniranchat-client.service';
window['p5'] = p5;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    platform: Platform,
    router: Router,
    ngZone: NgZone,
    noti: LocalNotiService,
    nakama: NakamaService,
    indexed: IndexedDBService,
    client: MiniranchatClientService,
    lang: LanguageSettingService,
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
      if (isPlatform == 'Android') // 알림 권한 설정
        LocalNotifications.checkPermissions().then(async v => {
          if (v.display != 'granted')
            await LocalNotifications.requestPermissions();
        });
      noti.load_settings();
      indexed.GetFileListFromDB('tmp_files', list => {
        list.forEach(path => indexed.removeFileFromUserPath(path));
      });
    });
    lang.Callback_nakama = () => {
      nakama.initialize();
      nakama.check_if_online();
      lang.isFirstTime = false;
      client.RegisterNotificationReact();
      noti.RegisterNofiticationActionType();
    }
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
    nakama.on_socket_connected['connection_check'] = () => {
      nakama.check_if_online();
    }
    nakama.on_socket_disconnected['connection_check'] = () => {
      nakama.check_if_online();
    }
  }
}

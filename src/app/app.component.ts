import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { IndexedDBService } from './indexed-db.service';
import { LocalNotiService } from './local-noti.service';
import { NakamaService } from './nakama.service';
import { LanguageSettingService } from './language-setting.service';
import { GlobalActService } from './global-act.service';
/** 페이지가 돌고 있는 플렛폼 구분자 */
export var isPlatform: 'Android' | 'iOS' | 'DesktopPWA' | 'MobilePWA' = 'DesktopPWA';
/** Nativefier로 실행중인지 검토하기 */
export var isNativefier = false;
/** 이미지 등 자료 링크용(웹 사이트 host) */
export const SERVER_PATH_ROOT: string = 'https://is2you2.github.io/';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(
    platform: Platform,
    noti: LocalNotiService,
    nakama: NakamaService,
    indexed: IndexedDBService,
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
    indexed.initialize(async () => {
      lang.Callback_nakama = () => {
        nakama.initialize();
        lang.Callback_nakama = null;
      }
      try {
        let blob = await indexed.loadBlobFromUserPath('translate.csv', '');
        let OverrideURL = URL.createObjectURL(blob);
        lang.load_selected_lang(OverrideURL);
      } catch (e) {
        lang.load_selected_lang();
      }
      // 앱 재시작시 자동으로 동기화할 수 있도록 매번 삭제
      let init = global.CatchGETs(location.href) || {};
      global.initialize();
      nakama.AddressToQRCodeAct(init);
      noti.initialize();
      noti.load_settings();
      indexed.GetFileListFromDB('tmp_files', list => {
        list.forEach(path => indexed.removeFileFromUserPath(path));
      });
    });
  }
}

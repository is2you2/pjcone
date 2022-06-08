import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { LocalNotiService } from './local-noti.service';
import { NakamaclientService } from './nakamaclient.service';

export var isPlatform: 'Android' | 'iOS' | 'Desktop' = 'Desktop';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(platform: Platform,
    public nakama: NakamaclientService,
    public noti: LocalNotiService,
  ) {
    if (platform.is('desktop') || platform.is('mobileweb'))
      isPlatform = 'Desktop';
    else if (platform.is('android'))
      isPlatform = 'Android';
    else if (platform.is('iphone'))
      isPlatform = 'iOS';
    console.log('시작할 때 플랫폼은', isPlatform);
    this.nakama.initialize();
    noti.initialize();
  }

  /** 브라우저에서 딥 링크마냥 행동하기
   * @returns GET 으로 작성된 key-value 쌍
  */
  CatchGETs() {
    /** 입력된 주소 */
    const ADDRESS = location.href;
    const sepElement = ADDRESS.split('?');
    if (sepElement.length > 1) {
      const CatchGETs = sepElement[1].split('&');
      let gets = {};
      for (let i = 0, j = CatchGETs.length; i < j; i++) {
        const KeyVal = CatchGETs[i].split('=');
        gets[KeyVal[0]] = KeyVal[1];
      }
      return gets;
    }
  }
}

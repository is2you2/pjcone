import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { LocalNotiService } from './local-noti.service';
import { NakamaclientService } from './nakamaclient.service';

export var isPlatform: 'Android' | 'iOS' | 'Browser' = 'Browser';

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
      isPlatform = 'Browser';
    else if (platform.is('android'))
      isPlatform = 'Android';
    else if (platform.is('iphone'))
      isPlatform = 'iOS';
    console.log('시작할 때 플랫폼은', isPlatform);
    // if (isPlatform == 'Android')
    //   statusBar.styleLightContent();
    // else if (isPlatform == 'iOS') statusBar.styleDefault();
    this.nakama.initialize();
    noti.initialize();
  }
}

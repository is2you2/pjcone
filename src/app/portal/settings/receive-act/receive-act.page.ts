import { Component, OnInit } from '@angular/core';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { isPlatform } from 'src/app/app.component';

@Component({
  selector: 'app-receive-act',
  templateUrl: './receive-act.page.html',
  styleUrls: ['./receive-act.page.scss'],
})
export class ReceiveActPage implements OnInit {

  constructor(
    private bgmode: BackgroundMode,
  ) { }

  settings = {
    /** 알림 소리 사용 여부 */
    sound: true,
    /** 알림 진동 사용 여부 */
    vibrate: false,
  }

  cant_dedicated = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.isBatteryOptimizationsShowed = Boolean(localStorage.getItem('ShowDisableBatteryOptimizations'));
  }

  isBatteryOptimizationsShowed = false;
  setDisableBatteryOptimizations() {
    this.bgmode.disableBatteryOptimizations();
    this.isBatteryOptimizationsShowed = true;
    localStorage.setItem('ShowDisableBatteryOptimizations', 'true');
  }
}

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

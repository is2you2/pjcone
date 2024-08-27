import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { LocalNotiService } from 'src/app/local-noti.service';

@Component({
  selector: 'app-noti-alert',
  templateUrl: './noti-alert.page.html',
  styleUrls: ['./noti-alert.page.scss'],
})
export class NotiAlertPage implements OnInit {

  constructor(
    public noti: LocalNotiService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.pushState(null, null, window.location.href);
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        window.onpopstate = null;
        this.BackButtonPressed = true;
        this.navCtrl.back();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
  }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
    let target = [
      'icon_mono',
      'diychat',
      'todo',
      'simplechat',
    ];
    this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
      this.toggle_silent_set(target[index]);
    }
  }

  toggle_silent_set(key: string) {
    this.noti.change_silent_settings(key);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    delete this.global.p5key['KeyShortCut']['Digit'];
  }
}

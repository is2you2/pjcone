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

  ngOnInit() { }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
    let target = [
      'icon_mono',
      'diychat',
      'todo',
      'simplechat',
      'engineppt',
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

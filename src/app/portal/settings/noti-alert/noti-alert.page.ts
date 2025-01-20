import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
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
    public global: GlobalActService,
    private navCtrl: NavController,
    private indexed: IndexedDBService,
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
    const target = [
      'icon_mono',
      'diychat',
      'todo',
      'simplechat',
    ];
    this.global.p5KeyShortCut['Digit'] = (index: number) => {
      if (target.length > index)
        this.toggle_silent_set(target[index]);
      else {
        switch (index) {
          case 4:
            this.toggle_simplify();
            break;
        }
      }
    }
  }

  toggle_silent_set(key: string) {
    this.noti.change_silent_settings(key);
  }

  toggle_simplify() {
    this.noti.settings.simplify = !this.noti.settings.simplify;
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.noti.settings), 'notification_settings.json');
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Escape'];
    delete this.global.p5KeyShortCut['Digit'];
  }
}

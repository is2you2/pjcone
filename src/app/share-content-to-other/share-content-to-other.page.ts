import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from '../language-setting.service';
import { ModalController, NavParams } from '@ionic/angular';
import { StatusManageService } from '../status-manage.service';
import { NakamaService } from '../nakama.service';

@Component({
  selector: 'app-share-content-to-other',
  templateUrl: './share-content-to-other.page.html',
  styleUrls: ['./share-content-to-other.page.scss'],
})
export class ShareContentToOtherPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private navParams: NavParams,
    public modalCtrl: ModalController,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
  ) { }

  channels: any[];


  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.replaceState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.modalCtrl.dismiss();
    };
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.channels = this.navParams.get('channels');
  }

  go_to_chatroom(channel: any) {
    let FileInfo = this.navParams.get('file');
    delete FileInfo['db'];
    this.nakama.go_to_chatroom_without_admob_act(channel, FileInfo);
    this.modalCtrl.dismiss(true);
  }
}

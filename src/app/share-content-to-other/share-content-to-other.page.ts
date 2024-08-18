import { Component, OnDestroy, OnInit } from '@angular/core';
import { LanguageSettingService } from '../language-setting.service';
import { ModalController, NavParams } from '@ionic/angular';
import { StatusManageService } from '../status-manage.service';
import { NakamaService } from '../nakama.service';
import { GlobalActService } from '../global-act.service';

@Component({
  selector: 'app-share-content-to-other',
  templateUrl: './share-content-to-other.page.html',
  styleUrls: ['./share-content-to-other.page.scss'],
})
export class ShareContentToOtherPage implements OnInit, OnDestroy {

  constructor(
    public lang: LanguageSettingService,
    private navParams: NavParams,
    public modalCtrl: ModalController,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    private global: GlobalActService,
  ) { }

  ngOnDestroy(): void {
    delete this.global.p5key['KeyShortCut']['Digit'];
  }

  channels: any[];


  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.replaceState(null, null, window.location.href);
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        this.BackButtonPressed = true;
        this.modalCtrl.dismiss();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.channels = this.navParams.get('channels');
    this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
      if (this.nakama.channels.length > index)
        this.go_to_chatroom(this.nakama.channels[index]);
    };
  }

  go_to_chatroom(channel: any) {
    let FileInfo = this.navParams.get('file');
    delete FileInfo['db'];
    this.nakama.go_to_chatroom_without_admob_act(channel, FileInfo);
    this.modalCtrl.dismiss(true);
  }
}

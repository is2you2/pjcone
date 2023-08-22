import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from '../language-setting.service';
import { ModalController, NavParams } from '@ionic/angular';
import { StatusManageService } from '../status-manage.service';

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
  ) { }

  channels: any[];

  ngOnInit() {
    this.channels = this.navParams.get('channels');
  }

  go_to_chatroom(channel: any) {
    console.log('무엇을 받았는가: ', channel);
  }
}

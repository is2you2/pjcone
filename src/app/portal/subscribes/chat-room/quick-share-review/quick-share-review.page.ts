import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-quick-share-review',
  templateUrl: './quick-share-review.page.html',
  styleUrls: ['./quick-share-review.page.scss'],
})
export class QuickShareReviewPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private navParams: NavParams,
    public modalCtrl: ModalController,
    private nakama: NakamaService,
    private p5toast: P5ToastService,
    private global: GlobalActService,
  ) { }

  servers = [];
  groups = [];
  rtcserver = [];

  async ngOnInit() {
    let received = this.navParams.get('data');
    let init = this.global.CatchGETs(received);
    let json = await this.nakama.AddressToQRCodeAct(init, true);
    for (let i = 0, j = json.length, k = 0; i < j; i++)
      switch (json[i].type) {
        case 'server':
          this.servers.push(json[i]);
          break;
        case 'group':
          this.groups.push(json[i]);
          break;
        case 'rtcserver':
          this.rtcserver.push(json[i]);
          break;
      }
  }

  async apply_selected() {
    let selected = [];
    for (let i = 0, j = this.servers.length; i < j; i++)
      if (this.servers[i].grant)
        selected.push(this.servers[i]);
    for (let i = 0, j = this.groups.length; i < j; i++)
      if (this.groups[i].grant)
        selected.push(this.groups[i]);
    for (let i = 0, j = this.rtcserver.length; i < j; i++)
      if (this.rtcserver[i].grant)
        selected.push(this.rtcserver[i]);
    await this.nakama.act_from_QRInfo(selected);
    this.p5toast.show({
      text: this.lang.text['QuickQRShare']['success_received'],
      lateable: true,
    });
    this.modalCtrl.dismiss();
  }
}

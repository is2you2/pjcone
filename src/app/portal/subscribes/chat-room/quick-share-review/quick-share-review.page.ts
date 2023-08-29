import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
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
  ) { }

  servers = [];
  groups = [];

  ngOnInit() {
    let received = this.navParams.get('data');
    for (let i = 0, j = received.length; i < j; i++)
      switch (received[i].type) {
        case 'server':
          received[i].value.name = decodeURIComponent(received[i].value.name);
          this.servers.push(received[i]);
          break;
        case 'group':
          received[i].name = decodeURIComponent(received[i].name);
          this.groups.push(received[i]);
          break;
        default:
          console.warn('예상하지 않은 타입값: ', received[i]);
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
    await this.nakama.act_from_QRInfo(JSON.stringify(selected).trim());
    this.p5toast.show({
      text: this.lang.text['QuickQRShare']['success_received'],
      lateable: true,
    });
    this.modalCtrl.dismiss();
  }
}

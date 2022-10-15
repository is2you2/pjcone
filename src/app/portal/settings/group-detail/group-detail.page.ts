import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ModalController, NavParams } from '@ionic/angular';
import * as QRCode from "qrcode-svg";
import { P5ToastService } from 'src/app/p5-toast.service';
import { NakamaService } from 'src/app/nakama.service';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
})
export class GroupDetailPage implements OnInit {

  constructor(
    private navParams: NavParams,
    private sanitizer: DomSanitizer,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
  ) { }

  QRCodeSRC: any;
  info: any;
  is_removable = false;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.readasQRCodeFromId();
    this.is_removable =
      this.nakama.servers[this.info.server['isOfficial']][this.info.server['target']].session.user_id == this.info['owner'];
  }

  readasQRCodeFromId() {
    try {
      let except_img = { ...this.info };
      delete except_img.img;
      let qr: string = new QRCode({
        content: `[${JSON.stringify(except_img)}]`,
        padding: 4,
        width: 16,
        height: 16,
        color: "#bbb",
        background: "#111",
        ecl: "M",
      }).svg();
      this.QRCodeSRC = this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(qr)}`);
    } catch (e) {
      this.p5toast.show({
        text: `QRCode 생성 실패: ${e}`,
      });
    }
  }

  remove_group() {
    this.nakama.remove_group_list(this.info, this.info.server['isOfficial'], this.info.server['target'], () => {
      this.modalCtrl.dismiss();
    });
  }
}

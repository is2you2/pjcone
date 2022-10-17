import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NavController } from '@ionic/angular';
import * as QRCode from "qrcode-svg";
import { SOCKET_SERVER_ADDRESS } from 'src/app/app.component';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-link-account',
  templateUrl: './link-account.page.html',
  styleUrls: ['./link-account.page.scss'],
})
export class LinkAccountPage implements OnInit {

  constructor(
    private sanitizer: DomSanitizer,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private navCtrl: NavController,
  ) { }

  ngOnInit() {
    this.websocket = new WebSocket(`wss://${SOCKET_SERVER_ADDRESS}:12020`);
    this.websocket.onmessage = (msg: any) => {
      msg.data.text().then(v => {
        try {
          let json = JSON.parse(v);
          if (!json.uuid) throw new Error("uuid 받기 실패");
          this.nakama.uuid = json.uuid;
          this.p5toast.show({
            text: '사용자 연결에 성공했습니다.',
          });
          if (localStorage.getItem('is_online'))
            this.nakama.init_all_sessions();
          this.navCtrl.back();
        } catch (_e) {
          this.createQRCode({
            type: 'link',
            value: v,
          });
        }
      });
    }
  }

  QRCodeSRC: any;
  websocket: any;

  /** 그룹ID를 QRCode로 그려내기 */
  createQRCode(info: any) {
    try {
      let qr: string = new QRCode({
        content: `[${JSON.stringify(info)}]`,
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

  ionViewWillLeave() {
    this.websocket.close();
  }
}

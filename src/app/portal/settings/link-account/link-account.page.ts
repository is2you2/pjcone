import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NavController } from '@ionic/angular';
import * as QRCode from "qrcode-svg";
import { SOCKET_SERVER_ADDRESS } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WscService } from 'src/app/wsc.service';

const HEADER = 'LinkAccount';

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
    private wsc: WscService,
    private indexed: IndexedDBService,
  ) { }

  ngOnInit() {
    this.wsc.disconnected[HEADER] = () => {
      this.navCtrl.back();
    }
    this.websocket = new WebSocket(`${this.wsc.socket_header}://${this.wsc.address_override || SOCKET_SERVER_ADDRESS}:12020`);
    this.websocket.onmessage = (msg: any) => {
      msg.data.text().then(v => {
        try {
          let json = JSON.parse(v);
          if (!json.uuid) throw new Error("uuid 받기 실패");
          this.nakama.uuid = json.uuid;
          this.p5toast.show({
            text: '사용자 연결에 성공했습니다.',
          });
          this.nakama.users.self['online'] = true;
          this.nakama.init_all_sessions();
          setTimeout(() => {
            this.navCtrl.back();
          }, 500);
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
    delete this.wsc.disconnected[HEADER];
    this.websocket.close();
  }
}

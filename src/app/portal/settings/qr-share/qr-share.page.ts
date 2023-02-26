import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { isPlatform, SOCKET_SERVER_ADDRESS } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WscService } from 'src/app/wsc.service';
import * as p5 from "p5";
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';

const HEADER = 'QRShare';

@Component({
  selector: 'app-qr-share',
  templateUrl: './qr-share.page.html',
  styleUrls: ['./qr-share.page.scss'],
})
export class QrSharePage implements OnInit {

  constructor(
    private wsc: WscService,
    private p5toast: P5ToastService,
    private navCtrl: NavController,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private codescan: BarcodeScanner,
  ) { }

  HideSender = false;
  ShowQRInfo = false;
  QRCodeSRC: any;
  websocket: WebSocket;
  lines: string;

  ngOnInit() {
    let isBrowser = isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA';
    this.HideSender = !isBrowser;
    this.wsc.disconnected[HEADER] = () => {
      this.navCtrl.back();
    }
    this.websocket = new WebSocket(`${this.wsc.socket_header}://${this.wsc.address_override || SOCKET_SERVER_ADDRESS}:12020`);
    this.websocket.onmessage = (msg: any) => {
      msg.data.text().then(v => {
        try {
          let json = JSON.parse(v);
          if (!json.uuid) throw new Error("uuid 받기 실패");
          this.p5toast.show({
            text: this.lang.text['LinkAccount']['link_account_succ'],
            lateable: true,
          });
          setTimeout(() => {
            this.navCtrl.back();
          }, 500);
        } catch (_e) {
          this.QRCodeSRC = this.global.readasQRCodeFromId({
            type: 'link',
            value: v,
          });
        }
      });
    }
    this.read_info();
  }

  read_info() {
    let show = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/quick_datashare.txt`, v => {
          this.lines = v.join('\n');
          p.remove();
        }, e => {
          console.error('빠른 QR 정보 공유 설명서 파일 불러오기 실패: ', e);
          p.remove();
        });
      }
    }
    new p5(show);
  }

  /** 사용자가 선택한 발신 데이터 */
  selected_data = {};
  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
    }).then(v => {
      if (!v.cancelled) {
        let pid = v.text.trim();
        console.log('뭘 받았습니까: ', pid);
      }
    }).catch(_e => {
      console.error(_e);
      this.p5toast.show({
        text: this.lang.text['Subscribes']['CameraPermissionDenied'],
      });
    });
  }

  ionViewWillLeave() {
    delete this.wsc.disconnected[HEADER];
  }
}

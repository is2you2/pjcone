import { Component, OnInit } from '@angular/core';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import clipboard from 'clipboardy';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { P5ToastService } from 'src/app/p5-toast.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { ToolServerService } from 'src/app/tool-server.service';

@Component({
  selector: 'app-link-qr',
  templateUrl: './link-qr.page.html',
  styleUrls: ['./link-qr.page.scss'],
})
export class LinkQrPage implements OnInit {

  constructor(
    private global: GlobalActService,
    private mClipboard: Clipboard,
    private p5toast: P5ToastService,
    public lang: LanguageSettingService,
    private toolServer: ToolServerService,
  ) { }

  QRCodeSRC: any;
  addresses: any[];
  SelectedAddress: string;

  ngOnInit() {
    this.addresses = this.toolServer.addresses;
  }

  SelectTargetNetwork() {
    this.SelectedAddress = '192.168.6.44';
    this.QRCodeSRC = this.global.readasQRCodeFromString(``);
  }

  /** 주인장이 공유할 IP주소를 선택합니다  
   * 자체 서버가 있다면 그 주소를, 아니라면 비보안 주소를 생성합니다
   */
  async SelectOtherAddress(ev: any) {
    let address_text: string = ev.detail.value;
    let extract = address_text.substring(address_text.indexOf('(') + 1, address_text.indexOf(')'));
    try { // 사용자 지정 서버 업로드 시도 우선
      let HasLocalPage = `${location.protocol}//${extract}:8080/`;
      const cont = new AbortController();
      const id = setTimeout(() => {
        cont.abort();
      }, 500);
      let res = await fetch(HasLocalPage, { signal: cont.signal });
      clearTimeout(id);
      if (res.ok) this.SelectedAddress = `${location.protocol}//${extract}:8080/www/?voidDraw=${extract}`;
    } catch (e) {
      this.SelectedAddress = `http://localhost:8080/www/?voidDraw=${extract}`
    }
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_address() {
    this.mClipboard.copy(this.SelectedAddress)
      .catch(_e => {
        clipboard.write(this.SelectedAddress).then(() => {
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${this.SelectedAddress}`,
            });
        }).catch(_e => { });
      });
  }
}

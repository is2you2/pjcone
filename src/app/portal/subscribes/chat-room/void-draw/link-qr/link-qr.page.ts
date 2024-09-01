import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NavParams } from '@ionic/angular';
import { SERVER_PATH_ROOT } from 'src/app/app.component';

@Component({
  selector: 'app-link-qr',
  templateUrl: './link-qr.page.html',
  styleUrls: ['./link-qr.page.scss'],
})
export class LinkQrPage implements OnInit {

  constructor(
    private global: GlobalActService,
    private mClipboard: Clipboard,
    public navParams: NavParams,
    public lang: LanguageSettingService,
  ) { }

  QRCodeSRC: any;
  SelectedAddress: string;

  ngOnInit() { }

  async ionViewWillEnter() {
    let extract = this.navParams.data.address;
    try { // 사용자 지정 서버 업로드 시도 우선
      let sep = extract.split('://');
      let only_address = sep.pop();
      let protocol = sep.pop() == 'wss' || this.global.checkProtocolFromAddress(only_address);
      let HasLocalPage = `${protocol ? 'https:' : 'http:'}//${only_address}:${protocol ? 8443 : 8080}/`;
      const cont = new AbortController();
      const id = setTimeout(() => {
        cont.abort();
      }, 500);
      let res = await fetch(HasLocalPage, { signal: cont.signal });
      clearTimeout(id);
      if (res.ok) this.SelectedAddress = `${protocol ? 'https:' : 'http:'}//${only_address}:${protocol ? 8443 : 8080}/www/?voidDraw=${extract},${this.navParams.data.channel}`;
      else throw '주소 없음';
    } catch (e) {
      this.SelectedAddress = `${SERVER_PATH_ROOT}?voidDraw=${extract},${this.navParams.data.channel}`
    }
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_address(text: string) {
    this.mClipboard.copy(text)
      .catch(_e => {
        this.global.WriteValueToClipboard('text/plain', text);
      });
  }
}

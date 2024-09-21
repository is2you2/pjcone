import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-link-qr',
  templateUrl: './link-qr.page.html',
  styleUrls: ['./link-qr.page.scss'],
})
export class LinkQrPage implements OnInit {

  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  QRCodeSRC: any;
  SelectedAddress: string;

  navParams: any;

  ngOnInit() {
    this.route.queryParams.subscribe(async _p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        this.navParams = navParams || {};
        await new Promise(res => setTimeout(res, 100)); // init 지연
        this.initialize();
      } catch (e) {
        console.log('그림판 정보 받지 못함: ', e);
      }
    });
  }

  async initialize() {
    let extract = this.navParams.address;
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
      if (res.ok) this.SelectedAddress = `${protocol ? 'https:' : 'http:'}//${only_address}:${protocol ? 8443 : 8080}${window['sub_path']}?voidDraw=${extract},${this.navParams.channel}`;
      else throw '주소 없음';
    } catch (e) {
      this.SelectedAddress = `${SERVER_PATH_ROOT}?voidDraw=${extract},${this.navParams.channel}`
    }
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_address(text: string) {
    this.global.WriteValueToClipboard('text/plain', text);
  }

  ionViewWillLeave() {
    if (this.global.PageDismissAct['link-qr']) this.global.PageDismissAct['link-qr']();
  }
}

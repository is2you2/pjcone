import { Component, OnInit } from '@angular/core';
import * as p5 from 'p5';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-qrcode-gen',
  templateUrl: './qrcode-gen.page.html',
  styleUrls: ['./qrcode-gen.page.scss'],
})
export class QrcodeGenPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
  ) { }

  /** 정보글 불러오기 */
  info: string;
  QRCode: any;
  userInput: string;

  ngOnInit() {
    this.load_info_strings();
  }

  load_info_strings() {
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/qrcode-gen.txt`, (v: string[]) => {
          this.info = v.join('\n');
          p.remove();
        }, e => {
          console.error('load qrcode-gen info failed: ', e);
          p.remove();
        });
      }
    });
  }

  textarea_changed(_ev: any) {
    this.QRCode = this.global.readasQRCodeFromString(this.userInput);
  }

}

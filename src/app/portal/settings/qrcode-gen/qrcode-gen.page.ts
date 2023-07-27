import { Component, OnInit } from '@angular/core';
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
  QRCode: any;
  userInput: string;

  ngOnInit() { }

  textarea_changed(_ev: any) {
    this.QRCode = this.global.readasQRCodeFromString(this.userInput);
  }

}

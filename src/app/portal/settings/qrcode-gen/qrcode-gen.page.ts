import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import clipboard from 'clipboardy';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';


@Component({
  selector: 'app-qrcode-gen',
  templateUrl: './qrcode-gen.page.html',
  styleUrls: ['./qrcode-gen.page.scss'],
})
export class QrcodeGenPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
  ) { }

  /** 정보글 불러오기 */
  QRCode: any;
  userInput: string;

  async ngOnInit() {
    let paste: string;
    try {
      paste = await this.mClipboard.paste();
    } catch (e) {
      paste = await clipboard.read();
    }
    this.userInput = paste;
    this.textarea_changed();
  }

  textarea_changed(_ev?: any) {
    if (this.userInput)
      this.QRCode = this.global.readasQRCodeFromString(this.userInput);
    else this.QRCode = undefined;
  }

}

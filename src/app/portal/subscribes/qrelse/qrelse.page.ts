// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';

@Component({
  selector: 'app-qrelse',
  templateUrl: './qrelse.page.html',
  styleUrls: ['./qrelse.page.scss'],
})
export class QRelsePage implements OnInit {

  constructor(
    private navParams: NavParams,
    public modalCtrl: ModalController,
    public lang: LanguageSettingService,
    private nakama: NakamaService,
  ) {
  }

  /** 바코드 결과물에 대해 */
  info = 'QR코드 또는 바코드를 인식하였으나 이 앱에서 사용하는 구성이 아닙니다.';
  /** 바코드 스캔 결과물 */
  result: any = {};

  ngOnInit() {
    this.result = this.navParams.get('result');
    this.result.text = this.result.content.split('\n');
    for (let i = 0, j = this.result.text.length; i < j; i++) {
      this.result.text[i] = this.result.text[i].split(' ');
      for (let k = 0, l = this.result.text[i].length; k < l; k++) {
        let tmp = {}; // [i][k]
        tmp['href'] = this.result.text[i][k].indexOf('http://') == 0 || this.result.text[i][k].indexOf('https://') == 0;
        tmp['text'] = this.result.text[i][k];
        this.result.text[i][k] = tmp;
      }
    }
  }
}

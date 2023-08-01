// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-creator',
  templateUrl: './creator.page.html',
  styleUrls: ['./creator.page.scss'],
})
export class CreatorPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
  ) { }

  info = {
    name: undefined,
  };

  isMobileApp = false;

  ngOnInit() {
    this.isMobileApp = isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA';
    // 기능 구현 전까지 숨기기
    this.isMobileApp = false;
    new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadJSON(`assets/data/infos/${this.lang.lang}/creator.json`, v => {
          this.info = v;
          p.remove();
        }, e => {
          console.error('번역가 정보 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
  }

  /** 개발자에게 커피를 사주세요 */
  inAppPurchaseClicked() {
    console.log('커피 버튼');
  }
}

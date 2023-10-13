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
  special_thanks_to = [];

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
    new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadJSON(`assets/data/infos/thanks_to.json`, v => {
          this.special_thanks_to = v;
          p.remove();
        }, e => {
          console.error('번역가 정보 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
  }

  /** 도움주신분들 제공링크 따라가기 */
  go_to_helper_page(url: string) {
    window.open(url, '_system');
  }

  /** 제작자 이미지를 눌러 홈페이지 이동 */
  go_to_creator_page() {
    window.open('https://is2you2.github.io/', '_system');
  }

  /** 개발자에게 커피를 사주세요 */
  inAppPurchaseClicked() {
    console.log('커피 버튼');
  }
}

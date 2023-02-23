// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
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

  ngOnInit() {
    new p5((p: p5) => {
      p.setup = () => {
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

}

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

  /** 번역가 페이지 정보 */
  info = {
    /** 번역가 표시명 */
    name: '정보 준비중',
    /** 긴 글 */
    text: '기능 준비중',
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

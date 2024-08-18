import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as p5 from "p5";
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-translator',
  templateUrl: './translator.page.html',
  styleUrls: ['./translator.page.scss'],
})
export class TranslatorPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private navCtrl: NavController,
  ) { }

  /** 번역가 페이지 정보 */
  info = {
    /** 프로필 이미지 */
    img: undefined,
    /** 번역가 표시명 */
    name: '정보 준비중',
    /** 긴 글 */
    text: '기능 준비중',
  };

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.pushState(null, null, window.location.href);
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        this.BackButtonPressed = true;
        this.navCtrl.back();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadJSON(`assets/data/infos/${this.lang.lang}/translator.json`, v => {
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

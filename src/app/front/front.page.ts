import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { isNativefier, isPlatform } from '../app.component';
import * as p5 from 'p5';
import { LanguageSettingService } from '../language-setting.service';

@Component({
  selector: 'app-front',
  templateUrl: './front.page.html',
  styleUrls: ['./front.page.scss'],
})
export class FrontPage implements OnInit {

  constructor(
    private navCtrl: NavController,
    public lang: LanguageSettingService,
  ) { }

  isPWA = false;
  alwaysStart = false;
  information = '';

  ngOnInit() { }

  ionViewDidEnter() {
    this.isPWA = (isPlatform == 'MobilePWA' || isPlatform == 'DesktopPWA') && !isNativefier;
    this.alwaysStart = Boolean(localStorage.getItem('auto_start'));
    let include_infos = location.href.indexOf('?') >= 0;
    if (!this.isPWA || this.alwaysStart || include_infos) // 무시하고 바로 시작하는 경우를 허용
      this.StartUse();
    else new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadStrings(`assets/data/infos/${this.lang.lang}/intro.txt`, v => {
          this.information = v.join('\n');
          p.remove();
        }, e => {
          console.error('번역가 정보 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
  }

  SetAlwaysStart() {
    localStorage.setItem('auto_start', 'on');
    this.StartUse();
  }

  StartUse() {
    this.navCtrl.navigateRoot('portal', {
      animated: true,
      animationDirection: 'back',
    });
  }
}

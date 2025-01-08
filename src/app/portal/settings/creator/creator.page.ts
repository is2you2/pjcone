import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as p5 from "p5";
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-creator',
  templateUrl: './creator.page.html',
  styleUrls: ['./creator.page.scss'],
})
export class CreatorPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  info = {
    name: undefined,
  };
  contributors = [];
  special_thanks_to = [];
  patreons = [];

  ngOnInit() {
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
        p.loadJSON(`assets/data/infos/contributors.json`, v => {
          this.contributors = v;
          p.remove();
        }, e => {
          console.error('기여자들 정보 불러오기 실패: ', e);
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
          console.error('도움주신분들 정보 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
    new p5((p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadJSON(`assets/data/infos/patreons.json`, v => {
          this.patreons = v;
          p.remove();
        }, e => {
          console.error('후원자 정보 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
  }

  /** 페이팔 페이지 열기 */
  open_patreon() {
    window.open('https://www.patreon.com/is2you2', '_blank');
  }

  ionViewDidEnter() {
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Escape'];
  }
}

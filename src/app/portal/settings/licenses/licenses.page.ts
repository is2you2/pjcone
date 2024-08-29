import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as p5 from "p5";
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';


@Component({
  selector: 'app-licenses',
  templateUrl: './licenses.page.html',
  styleUrls: ['./licenses.page.scss'],
})
export class LicensesPage implements OnInit, OnDestroy {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.pushState(null, null, window.location.href);
      if (window.onpopstate) window.onpopstate = null;
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        window.onpopstate = null;
        this.BackButtonPressed = true;
        this.navCtrl.back();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.loadTexts();
  }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  /** 라이선스 문서 일람 */
  licenses = {
    godot: {
      engine: '',
      thirdparty: '',
    },
    jsblend: '',
    modules: '',
  };

  p5canvas: p5;
  loadTexts() {
    let loader = (p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadStrings('assets/data/docs/godot/godot.txt', (v: string[]) => {
          this.licenses.godot.engine = v.join('\n');
        });
        p.loadStrings('assets/data/docs/godot/thirdparty.txt', (v: string[]) => {
          this.licenses.godot.thirdparty = v.join('\n');
        });
        p.loadStrings('assets/data/docs/js.blend.txt', (v: string[]) => {
          this.licenses.jsblend = v.join('\n');
        });
        p.loadStrings('assets/data/docs/licenses.txt', (v: string[]) => {
          this.licenses.modules = v.join('\n');
        });
      }
    }
    this.p5canvas = new p5(loader);
  }

  /** 모든 라이선스 조회 */
  showMore = false;

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
  }

  ngOnDestroy(): void {
    this.p5canvas.remove();
  }

  /** 웹 사이트 주소 열기 */
  open_link(_link: string) {
    window.open(_link, '_blank');
  }
}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import * as p5 from "p5";
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';


@Component({
  selector: 'app-licenses',
  templateUrl: './licenses.page.html',
  styleUrls: ['./licenses.page.scss'],
})
export class LicensesPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  ngOnInit() {
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
      enet: '',
      freetype: '',
      mbedtls: '',
    },
    jsblend: '',
  };

  p5canvas: p5;
  loadTexts() {
    let loader = (p: p5) => {
      p.setup = () => {
        p.noCanvas();
        p.loadStrings('assets/data/docs/godot.txt', (v: string[]) => {
          this.licenses.godot.engine = v.join('\n');
        });
        p.loadStrings('assets/data/docs/FreeType.txt', (v: string[]) => {
          this.licenses.godot.freetype = v.join('\n');
        });
        p.loadStrings('assets/data/docs/enet.txt', (v: string[]) => {
          this.licenses.godot.enet = v.join('\n');
        });
        p.loadStrings('assets/data/docs/mbedtls.txt', (v: string[]) => {
          this.licenses.godot.mbedtls = v.join('\n');
        });
        p.loadStrings('assets/data/docs/js.blend.txt', (v: string[]) => {
          this.licenses.jsblend = v.join('\n');
        });
      }
    }
    this.p5canvas = new p5(loader);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.p5canvas.remove();
  }

  /** 웹 사이트 주소 열기 */
  open_link(_link: string) {
    window.open(_link, '_system');
  }
}

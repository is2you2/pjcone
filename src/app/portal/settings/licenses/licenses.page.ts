import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";


@Component({
  selector: 'app-licenses',
  templateUrl: './licenses.page.html',
  styleUrls: ['./licenses.page.scss'],
})
export class LicensesPage implements OnInit {

  constructor() { }

  ngOnInit() {
    this.loadTexts();
  }

  /** 라이선스 문서 일람 */
  licenses = {
    ionic: {
      cli: '',
      capacitor: '',
    },
    godot: {
      engine: '',
      enet: '',
      freetype: '',
      mbedtls: '',
    },
    p5js: '',
    nakama: '',
    notosans: '',
  };

  p5canvas: p5;
  loadTexts() {
    let loader = (p: p5) => {
      p.setup = () => {
        p.loadStrings('assets/data/docs/ioniccli.txt', (v: string[]) => {
          this.licenses.ionic.cli = v.join('\n');
        });
        p.loadStrings('assets/data/docs/capacitor.txt', (v: string[]) => {
          this.licenses.ionic.capacitor = v.join('\n');
        })
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
        p.loadStrings('assets/data/docs/p5js.txt', (v: string[]) => {
          this.licenses.p5js = v.join('\n');
        });
        p.loadStrings('assets/data/docs/nakama.txt', (v: string[]) => {
          this.licenses.nakama = v.join('\n');
        });
        p.loadStrings('assets/data/docs/OFL.txt', (v: string[]) => {
          this.licenses.notosans = v.join('\n');
        });
      }
    }
    this.p5canvas = new p5(loader);
  }

  ionViewWillLeave() {
    this.p5canvas.remove();
  }

  /** 웹 사이트 주소 열기ind */
  open_link(_link:string) {
    window.open(_link, '_system')
  }
}

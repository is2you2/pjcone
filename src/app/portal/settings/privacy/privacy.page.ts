import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";

/** Project: Cone, 개인정보처리방침 */
@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage implements OnInit {

  constructor() { }

  ngOnInit() {
    this.read_privacy();
  }

  lines: string;

  read_privacy() {
    let show = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${'ko'}/privacy.txt`, v => {
          this.lines = v.join('\n');
          p.remove();
        }, e => {
          console.error('개인정보 처리방침 파일 불러오기 실패: ', e);
          p.remove();
        });
      }
    }
    new p5(show);
  }
}

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

  lines: string[] = [];

  read_privacy() {
    let show = (p: p5) => {
      p.loadStrings(`assets/privacy.txt`, v => {
        this.lines = v;
      }, e => {
        console.error('개인정보 처리방침 파일 불러오기 실패: ', e);
      });
    }
    this.p5canvas = new p5(show);
  }

  p5canvas: p5;
  ionViewWillLeave() {
    this.p5canvas.remove();
  }

}

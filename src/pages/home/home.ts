import { Component } from '@angular/core';
import { NavController, IonicPage } from 'ionic-angular';
import * as p5 from "p5";

@IonicPage()
@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {

  notice: string[] = [];

  constructor(public navCtrl: NavController) {

  }

  ionViewWillEnter() {
    let sketch = (p5: p5) => {
      p5.setup = () => {
        p5.loadStrings('assets/data/notice.txt', v => {
          this.notice = v;
        })
      }
    }
    new p5(sketch);
  }
}

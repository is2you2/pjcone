import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from "p5";
import { IndexedDBService } from '../indexed-db.service';

@Component({
  selector: 'app-others-profile',
  templateUrl: './others-profile.page.html',
  styleUrls: ['./others-profile.page.scss'],
})
export class OthersProfilePage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
  ) { }

  info = {};
  tmp_img: any;
  is_owner = false;

  lerpVal: number;
  p5canvas: p5;
  ngOnInit() {
    this.info = this.navParams.get('info');
    console.log(this.info);

    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      let tmp_img = document.getElementById('profile_tmp_img');
      const LERP_SIZE = .025;
      p.draw = () => {
        if (this.info['status'] == 'online') {
          if (this.lerpVal < 1) {
            this.lerpVal += LERP_SIZE;
          } else {
            this.lerpVal = 1;
            p.noLoop();
          }
        } else {
          if (this.lerpVal > 0) {
            this.lerpVal -= LERP_SIZE;
          } else {
            this.lerpVal = 0;
            p.noLoop();
          }
        }
        img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)});`);
        tmp_img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)});`);
      }
    }
    this.p5canvas = new p5(sketch);
  }

  /** 부드러운 이미지 변환 */
  change_img_smoothly(_url: string) {
    this.tmp_img = _url;
    new p5((p: p5) => {
      let profile_tmp_img = document.getElementById('profile_tmp_img');
      let file_sel = document.getElementById('file_sel');
      const LERP_SIZE = .035;
      let lerpVal = 0;
      p.setup = () => {
        file_sel['value'] = '';
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.info['state'] ? 0 : .9}) contrast(${this.info['state'] ? 1 : 1.4}) opacity(${lerpVal})`);
      }
      p.draw = () => {
        if (lerpVal < 1) {
          lerpVal += LERP_SIZE;
        } else {
          lerpVal = 1;
          this.info['img'] = this.tmp_img;
          this.tmp_img = '';
          p.remove();
        }
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.info['state'] ? 0 : .9}) contrast(${this.info['state'] ? 1 : 1.4}) opacity(${lerpVal})`);
      }
    });
  }
}

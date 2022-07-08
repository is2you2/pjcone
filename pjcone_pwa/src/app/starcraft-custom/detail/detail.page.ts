import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import * as p5 from "p5";

@Component({
  selector: 'app-detail',
  templateUrl: './detail.page.html',
  styleUrls: ['./detail.page.scss'],
})
export class DetailPage implements OnInit {

  title: string;
  rename_title = {
    'Multi(R)': '캠페인식 컴까기: 협동전',
    'Mixed(O)': '캠페인식 컴까기: 외전',
    'Alpha': '캠페인식 컴까기: 맵 실험실'
  }
  list: string[];
  list_len: number;
  picked: number;
  root = SERVER_PATH_ROOT;

  constructor(
    params: NavParams,
    private modal: ModalController,
  ) {
    let data = params.data;
    if (!data['list'])
      location.href = SERVER_PATH_ROOT + 'starcraft_custom'
    this.title = data['title'];
    this.list = data['list'];
    this.list_len = this.list.length;
    this.picked = data['picked'];
  }

  ngOnInit() {
    this.load_details();
  }

  details: string[] = [];
  version_log: string[] = [];

  load_details() {
    let detail = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`${SERVER_PATH_ROOT}assets/data/sc1_custom/${this.title}/detail.txt`, v => {
          this.details = v;
        }, e => {
          console.error('load detail failed: ', e);
        });
        p.loadStrings(`${SERVER_PATH_ROOT}assets/data/sc1_custom/${this.title}/version_log.txt`, v => {
          this.version_log = v;
        }, e => {
          console.error('load version_log failed: ', e);
        });
        p.loadStrings(`${SERVER_PATH_ROOT}assets/data/sc1_custom/${this.title}/list.txt`, v => {
          this.download_list = v.filter(n => n);
        }, e => {
          console.error('load map list failed: ', e);
        })
      }
      p.keyPressed = () => {
        switch (p.keyCode) {
          case 37: // 왼쪽
          case 65: // A
            this.image_change_to(-1);
            break;
          case 39: // 오른쪽
          case 68: // D
            this.image_change_to(1);
            break;
        }
      }
    }
    this.p5canvas = new p5(detail);
  }
  p5canvas: p5;

  ionViewDidLeave() {
    this.p5canvas.remove();
  }

  image_change_to(i: number) {
    let calced = (this.picked + i) % this.list_len;
    if (calced < 0) calced = this.list_len - 1;
    this.picked = calced;
  }

  download_list: string[] = [];
  click_download(map: string) {
    let path = `${SERVER_PATH_ROOT}assets/data/sc1_custom/${this.title}/${map}`
    const a = document.createElement('a');
    a.href = path;
    a.download = map;
    a.click();
  }

  go_to_back() {
    this.modal.dismiss();
  }
}

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from "p5";
import { SERVER_PATH_ROOT } from 'src/app/app.component';

@Component({
  selector: 'app-guestbook',
  templateUrl: './guestbook.page.html',
  styleUrls: ['./guestbook.page.scss'],
})
export class GuestbookPage implements OnInit {

  root = SERVER_PATH_ROOT;
  title = 'Guest';
  list: string[];
  list_len: number;
  picked: number;

  constructor(
    params: NavParams,
    private modal: ModalController,
  ) {
    let data = params.data;
    console.log(data);
    this.list = data['list'];
    this.list_len = this.list.length;
    this.picked = data['picked'];
  }

  ngOnInit() {
    this.load_details();
  }

  load_details() {
    let detail = (p: p5) => {
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

  ionViewDidLeave(){
    this.p5canvas.remove();
  }

  image_change_to(i: number) {
    let calced = (this.picked + i) % this.list_len;
    if (calced < 0) calced = this.list_len - 1;
    this.picked = calced;
  }

  go_to_back() {
    this.modal.dismiss();
  }

}

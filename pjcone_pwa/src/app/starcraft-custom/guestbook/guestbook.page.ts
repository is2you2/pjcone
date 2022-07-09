import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from "p5";
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { WscService } from 'src/app/wsc.service';

/** 방명록 페이지 */
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

  /** csv 분할자 */
  SEPERATOR = '，';
  /** 방명록 일체 */
  guest_history: string[][] = [];

  constructor(
    params: NavParams,
    private modal: ModalController,
    public wsc: WscService,
  ) {
    let data = params.data;
    this.list = data['list'];
    this.list_len = this.list.length;
    this.picked = data['picked'];
  }

  ngOnInit() {
    this.load_details();
  }

  load_details() {
    let detail = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`${SERVER_PATH_ROOT}assets/data/sc1_custom/${this.title}/guest_history.txt`, v => {
          // 데이터형식: id, name, content, password, is_showing
          for (let i = 0, j = v.length; i < j; i++) {
            let csv_line: string[] = v[i].split(this.SEPERATOR);
            // 마지막 공백자 무시
            if (csv_line.length < 5) continue;
            // 엔터처리를 엔터로 바꾸기
            csv_line[2] = csv_line[2].split('\\n').join('\n');
            // 보여지는 날짜 생성기
            let get_date = new Date(parseInt(csv_line[0].split('-')[0]));
            let year = get_date.getFullYear();
            let month = ('0' + (get_date.getMonth() + 1)).slice(-2);
            let day = ('0' + get_date.getDay()).slice(-2);
            let hour = ('0' + get_date.getHours()).slice(-2);
            let minute = ('0' + get_date.getMinutes()).slice(-2);
            let second = ('0' + get_date.getSeconds()).slice(-2);
            csv_line.push(`${year}-${month}-${day} ${hour}:${minute}:${second}`);
            console.log('csv_line: ', csv_line);
            this.guest_history.push(csv_line);
          }
          this.guest_history = this.guest_history.reverse();
          console.log(this.guest_history);
        }, e => {
          console.error('load detail failed: ', e);
        });
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

  /** 현재 작성/수정중인 게시물 내용물 */
  write_data: string[] = [];
  /** 방명록 작성 */
  apply_data() {
    let now = new Date().getTime();
    let id = now.toString() + '_';
    const ID_STR = '0123456789ABCDEF';
    for (let i = 0; i < 8; i++) {
      let rand = Math.floor(Math.random() * ID_STR.length);
      id += ID_STR.charAt(rand);
    }
    console.log('새 작성 아이디: ', id);
    console.log('현재 내용 작성하기: ', this.write_data);
  }
  /** 수정중인 게시물 표기 */
  selected_modifying: string;
  /** 방명록 수정 진입 */
  modify_data(id: string) {
    console.log('이 아이디로 수정 진행: ', id);
  }

  /** 방명록 삭제 */
  delete_data(id: string) {
    console.log('방명록 삭제: ', id);
  }

  go_to_back() {
    this.modal.dismiss();
  }

}

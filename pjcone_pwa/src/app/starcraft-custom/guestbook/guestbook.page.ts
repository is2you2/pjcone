import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
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
  SEP_CHAR = '，';
  /** 종합 방명록 리스트 (file + cache) */
  total_history: string[][] = [];
  /** 방명록 일체 */
  guest_history: string[][] = [];

  constructor(
    params: NavParams,
    private modal: ModalController,
    public alert: AlertController,
    public wsc: WscService,
  ) {
    this.list = params.data['list'];
    this.list_len = this.list.length;
    this.picked = params.data['picked'];
  }

  ngOnInit() {
    this.load_details();
    let refresh = {
      act: 'sc1_custom',
      target: 'cache_refresh'
    }
    this.wsc.send(JSON.stringify(refresh));
    this.wsc.received = (v) => {
      let json = JSON.parse(v);
      switch (json['act']) {
        case 'refresh':
          let caches: string[][] = [];
          for (let i = 0, j = json['data'].length; i < j; i++)
            caches.push(json['data'][i].split(this.SEP_CHAR));
          this.total_history = [...caches.reverse(), ...this.guest_history];
          break;
        default:
          break;
      }
    }
  }

  load_details() {
    let detail = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`${SERVER_PATH_ROOT}assets/data/sc1_custom/${this.title}/guest_history.txt`, v => {
          this.guest_history.length = 0;
          // 데이터형식: id, name, content, password, is_showing
          for (let i = 0, j = v.length; i < j; i++) {
            let csv_line: string[] = v[i].split(this.SEP_CHAR);
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
            this.guest_history.push(csv_line);
          }
          this.guest_history = this.guest_history.reverse();
          this.total_history = [...this.guest_history];
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

  /** 현재 작성중인 게시물 내용물 */
  write_data: string[] = [];
  /** 비밀번호 없이 진행여부 */
  with_no_password: boolean = false;
  /** 방명록 작성 */
  apply_data() {
    // 이름 작성 여부 검토
    if (!this.write_data[1]) {
      this.alert.create({
        header: '이름 공란',
        message: '이름 자리를 비워두셨어요',
        buttons: ['그러네']
      }).then(v => {
        v.present();
      });
      return;
    }
    // 비밀번호 여부 검토
    if (!this.write_data[3] && !this.with_no_password) {
      this.write_data[3] = '';
      this.alert.create({
        header: '비밀번호 공란',
        message: '비밀번호 없이 작성은 가능하나, 향후에 수정/삭제가 불가능합니다.',
        buttons: [{
          handler: () => {
            this.with_no_password = true;
          },
          text: '그렇게 합시다!',
        }],
      }).then(v => {
        v.present();
      });
      return;
    }
    if (!this.write_data[2]) this.write_data[2] = '';
    // 게시물 ID 생성하기
    let now = new Date().getTime();
    let id = now.toString() + '-';
    const ID_STR = '0123456789ABCDEF';
    for (let i = 0; i < 8; i++) {
      let rand = Math.floor(Math.random() * ID_STR.length);
      id += ID_STR.charAt(rand);
    }
    this.write_data[0] = id;
    // 기본 데이터 배정
    this.write_data[4] = 'true';
    let json = {
      act: 'sc1_custom',
      target: 'write_guestbook',
      form: this.write_data.join(this.SEP_CHAR),
    }
    this.wsc.send(JSON.stringify(json));
    this.write_data.length = 0;
  }
  /** 수정중인 게시물 표기 */
  selected_modifying: string;
  /** 현재 수정중인 게시물 내용물 */
  rewrite_data: string[] = [];
  /** 수정중인 대상 (default: -1) */
  isModifyMode: number = -1;
  /** 방명록 수정 진입 */
  modify_data(i: number) {
    this.isModifyMode = i;
    let target = [...this.total_history[i]];
    target[3] = '';
    this.rewrite_data = target;
  }
  /** 수정된 내용 반영 */
  apply_rewrite_data(i: number) {
    // 이름 작성 여부 검토
    if (!this.rewrite_data[1]) {
      this.alert.create({
        header: '이름 공란',
        message: '이름 자리를 비워두셨어요',
        buttons: ['그러네']
      }).then(v => {
        v.present();
      });
      return;
    }
    // 비밀번호 검토
    if (this.rewrite_data[3] != this.guest_history[i][3]) {
      this.rewrite_data[3] = '';
      this.alert.create({
        header: '비밀번호 불일치',
        message: '틀렸어요!',
        buttons: [{
          text: '앗..',
        }],
      }).then(v => {
        v.present();
      });
      return;
    }
    if (!this.rewrite_data[2]) this.rewrite_data[2] = '';
    this.rewrite_data.length = 5;
    let json = {
      act: 'sc1_custom',
      target: 'modify_guestbook',
      form: this.rewrite_data.join(this.SEP_CHAR),
    }
    this.wsc.send(JSON.stringify(json));
    this.rewrite_data.length = 0;
    this.isModifyMode = -1;
  }

  cancel_rewrite() {
    this.rewrite_data.length = 0;
    this.isModifyMode = -1;
  }

  /** 방명록 삭제 */
  delete_data(id: string, index: number) {
    this.alert.create({
      header: '비밀번호 확인',
      inputs: [{
        name: 'pwd',
        placeholder: '게시물 비밀번호 입력',
      }],
      buttons: [{
        handler: (v) => {
          if (v['pwd'] == this.guest_history[index][3]) {
            // 게시물 삭제 요청
            let json = {
              act: 'sc1_custom',
              target: 'remove_guestbook',
              form: id
            }
            this.wsc.send(JSON.stringify(json));
          } else { // 향후 p5toast로 변경할 것
            this.alert.create({
              header: '비밀번호 불일치',
              message: '틀렸어요',
              buttons: ['헉']
            }).then(v => v.present());
          }
        },
        text: '삭제!',
      }]
    }).then(v => v.present());
  }

  go_to_back() {
    this.modal.dismiss();
    this.wsc.received = () => { };
  }

}

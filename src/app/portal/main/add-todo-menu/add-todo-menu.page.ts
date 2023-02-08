// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import * as p5 from "p5";
import { P5ToastService } from 'src/app/p5-toast.service';
import { IonicViewerPage } from '../../subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { DomSanitizer } from '@angular/platform-browser';
import { IndexedDBService } from 'src/app/indexed-db.service';

@Component({
  selector: 'app-add-todo-menu',
  templateUrl: './add-todo-menu.page.html',
  styleUrls: ['./add-todo-menu.page.scss'],
})
export class AddTodoMenuPage implements OnInit {
  @ViewChild('Calendar') Calendar: any;

  constructor(
    private navParams: NavParams,
    public modalCtrl: ModalController,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private sanitizer: DomSanitizer,
    private indexed: IndexedDBService,
  ) { }

  /** 작성된 내용 */
  userInput = {
    /** 해야할 일 아이디  
     * 로컬에서 생성하면 일시 정보로 생성  
     * 리모트에서 생성하면 'isOfficial/target/channel_id/msg_id' 로 생성됨
     */
    id: undefined,
    /** 간략한 제목 설정 */
    title: undefined,
    /** 작성일시 */
    written: undefined,
    /** 기한 */
    limit: undefined,
    /** 사용자에게 보여지는 기한 문자열 */
    limitDisplay: undefined,
    /** 이 업무가 연동되어 행해진 기록들 */
    logs: [],
    /** 상세 내용 */
    description: undefined,
    /** 어디에서 작성한 데이터인지  
     * local: 내가 내 폰에서, remote: 서버를 거쳐서 지시
     */
    type: 'local',
    /** remote 정보인 경우 서버, 채널, 작성자 정보 포함됨  
     * keys: isOfficial, target, channel_id, sender_id
     */
    remote: undefined,
    /** 첨부 이미지 정보 */
    attach: {},
  };

  ImageURL: any;
  ngOnInit() { }

  ionViewWillEnter() {
    let tomorrow = new Date(new Date().getTime() + 86400000);
    this.Calendar.value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60 * 1000).toISOString();
    this.userInput.limit = tomorrow.toISOString();
    this.userInput.limitDisplay = tomorrow.toLocaleString(this.lang.lang);
    this.userInput.limitDisplay = this.userInput.limitDisplay.substring(0, this.userInput.limitDisplay.lastIndexOf(':'));
    // 미리 지정된 데이터 정보가 있는지 검토
    let data = this.navParams.get('data');
    if (data) {
      switch (data['type']) {
        case 'local': // 로컬에서 작성된 개인의 해야할 일 (로컬에 저장된 파일 경로)
          console.log('로컬 생성된 정보로 내용을 수정할 수 있음: ');
          break;
        case 'order': // 채팅방에서 지시 형태로 생성된 할 일
          console.log('누군가로부터 지시받음: ');
          break;
        default:
          console.warn('예상하지 못한 기존 정보 형식: ', data);
          break;
      }
    }
    this.follow_resize();
  }

  ionViewDidEnter() {
    this.show_count_timer();
  }

  isCalendarHidden = true;
  /** 달력 켜기끄기 */
  toggle_calendar() {
    this.p5resize.windowResized();
    this.isCalendarHidden = !this.isCalendarHidden;
  }

  /** 기한 변경됨 */
  limit_change(ev: any) {
    this.userInput.limit = ev.detail.value;
    this.userInput.limitDisplay = new Date(ev.detail.value).toLocaleString(this.lang.lang);
    this.userInput.limitDisplay = this.userInput.limitDisplay.substring(0, this.userInput.limitDisplay.lastIndexOf(':'))
    this.limitTimeP5Display = new Date(this.userInput.limit).getTime();
  }

  p5resize: p5;
  /** 창 조절에 따른 최대 화면 크기 조정 */
  follow_resize() {
    setTimeout(() => {
      let sketch = (p: p5) => {
        let mainTable = document.getElementById('main_table');
        let mainDiv = document.getElementById('main_div');
        let buttons_table = document.getElementById('bottom_buttons');
        p.setup = () => {
          setTimeout(() => {
            p.windowResized();
          }, 100);
          p.noLoop();
        }
        p.windowResized = () => {
          setTimeout(() => {
            mainDiv.setAttribute('style', `max-width: ${mainTable.parentElement.offsetWidth}px; max-height: ${mainTable.parentElement.clientHeight - buttons_table.offsetHeight}px`);
          }, 0);
        }
      }
      this.p5resize = new p5(sketch);
    }, 50);
  }

  p5timer: p5;
  limitTimeP5Display: number;
  show_count_timer() {
    this.userInput.written = new Date().toISOString(); // 테스트용
    this.p5timer = new p5((p: p5) => {
      let startAnimLerp = 0;
      let startTime = new Date(this.userInput.written).getTime();
      this.limitTimeP5Display = new Date(this.userInput.limit).getTime();
      let currentTime: number;
      let color: p5.Color = p.color('#888');
      p.setup = () => {
        let timerDiv = document.getElementById('p5timer');
        let canvas = p.createCanvas(timerDiv.clientWidth, timerDiv.clientHeight);
        canvas.id('timer');
        canvas.style('position', 'inherit');
        canvas.style('width', '100%');
        canvas.style('height', '100%');
        canvas.parent(timerDiv);
        p.noStroke();
      }
      let checkCurrent = () => {
        // currentTime = new Date().getTime();
        currentTime = new Date().getTime();
        let lerpVal = p.map(currentTime, startTime, this.limitTimeP5Display, 0, 1);
        if (lerpVal <= .7) {
          color = p.color('#888');
        } else if (lerpVal > .7)
          color = p.lerpColor(p.color('#888'), p.color('#800'), p.map(lerpVal, .7, 1, 0, 1) * startAnimLerp);
      }
      p.draw = () => {
        checkCurrent();
        p.clear(255, 255, 255, 255);
        p.push();
        p.fill(color);
        if (startAnimLerp < 1) {
          startAnimLerp += .04;
          if (startAnimLerp >= 1)
            startAnimLerp = 1;
          p.rect(0, 0, p.lerp(0, p.map(currentTime, startTime, this.limitTimeP5Display, 0, p.width), easeOut(startAnimLerp)), p.height);
        } else {
          p.rect(0, 0, p.map(currentTime, startTime, this.limitTimeP5Display, 0, p.width), p.height);
        }
        p.pop();
      }
      let easeOut = (t: number) => {
        return Flip(p.sq(Flip(t)));
      }
      let Flip = (t: number) => {
        return 1 - t;
      }
    });
  }

  /** 참조 이미지 첨부 */
  select_attach_image() {
    document.getElementById('file_sel').click();
  }

  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    this.userInput.attach['filename'] = ev.target.files[0]['name'];
    this.userInput.attach['file_ext'] = ev.target.files[0]['name'].substring(ev.target.files[0]['name'].lastIndexOf('.'));
    this.userInput.attach['filesize'] = ev.target.files[0]['size'];
    this.userInput.attach['type'] = ev.target.files[0]['type'];
    this.userInput.attach['viewer'] = 'image';
    reader.onload = (ev: any) => {
      this.indexed.saveFileToUserPath(ev.target.result.replace(/"|\\|=/g, ''), 'todo/add_tmp.attach');
    };
    this.ImageURL = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(ev.target.files[0]));
    reader.readAsDataURL(ev.target.files[0]);
  }

  /** 이미지를 뷰어에서 보기 */
  go_to_ionic_viewer() {
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: this.userInput.attach,
        path: this.userInput.id ? `todo/${this.userInput.id}.attach` : 'todo/add_tmp.attach',
      }
    }).then(v => v.present());
  }

  /** 이 해야할 일 정보를 저장 */
  saveData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: '표시명을 작성하여야 합니다.',
      });
      return;
    }
    this.navParams.get('godot')['add_todo'](JSON.stringify(this.userInput));
    // this.userInput.id = '';
    this.userInput.written = new Date().toISOString();
    console.log('이 자리에서 해야할 일 아이디 생성', this.userInput);
    this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    this.indexed.removeFileFromUserPath('todo/add_tmp.attach');
    if (this.ImageURL)
      URL.revokeObjectURL(this.ImageURL);
    this.p5resize.remove();
    this.p5timer.remove();
  }
}

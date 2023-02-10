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
import { NakamaService } from 'src/app/nakama.service';

interface LogForm {
  /** 이 로그를 발생시킨 사람, 리모트인 경우에만 넣기, 로컬일 경우 비워두기 */
  creator?: string;
  /** 로그 생성 시점 */
  createTime?: number;
  /** 번역코드 */
  translateCode?: string;
  /** 사용자에게 보여지는 문자열 */
  displayText?: string;
}

/** 서버에서 채널로 생성한 경우 */
interface RemoteInfo {
  isOfficial?: string;
  target?: string;
  channel_id?: string;
  sender_id?: string;
}

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
    private nakama: NakamaService,
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
    /** 일의 중요도, 가시화 기한의 색상에 영향을 줌 */
    importance: '0',
    /** 이 업무가 연동되어 행해진 기록들 */
    logs: [] as LogForm[],
    /** 상세 내용 */
    description: undefined,
    /** remote 정보인 경우 서버, 채널, 작성자 정보 포함됨  
     * keys: isOfficial, target, channel_id, sender_id
     */
    remote: undefined as RemoteInfo,
    /** 첨부 이미지 정보 */
    attach: {},
  };

  /** 사용자에게 보여지는 기한 문자열, 저장시 삭제됨 */
  limitDisplay: string;
  ImageURL: any;
  ngOnInit() { }

  /** 하단에 보여지는 버튼 */
  buttonDisplay = {
    saveTodo: this.lang.text['TodoDetail']['buttonDisplay_add'],
  }

  /** 이 할 일을 내가 만들었는지 */
  isOwner = true;
  isModify = false;
  ionViewWillEnter() {
    // 미리 지정된 데이터 정보가 있는지 검토
    let received_data = this.navParams.get('data');
    if (received_data) { // 이미 있는 데이터 조회
      this.buttonDisplay.saveTodo = this.lang.text['TodoDetail']['buttonDisplay_modify'];
      this.isModify = true;
    } else { // 새로 만드는 경우
      let tomorrow = new Date(new Date().getTime() + 86400000);
      this.userInput.limit = tomorrow.getTime();
    }
    this.userInput = { ...this.userInput, ...received_data };
    // 첨부 이미지가 있음
    if (this.userInput.attach['type'])
      this.indexed.loadBlobFromUserPath(`todo/${this.userInput.id}/attach.img`, this.userInput.attach['type'], (b) => {
        if (this.ImageURL)
          URL.revokeObjectURL(this.ImageURL);
        this.ImageURL = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(b));
      });
    // 수정 가능 여부 검토
    if (this.userInput['remote']) {
      this.isOwner = false;
    }
    // 로그 정보 게시
    if (this.userInput.logs.length) {
      this.userInput.logs.forEach(_log => _log.displayText = this.lang.text['TodoDetail'][_log.translateCode] || _log.translateCode);
    }
    let date_limit = new Date(this.userInput.limit);
    this.Calendar.value = new Date(date_limit.getTime() - date_limit.getTimezoneOffset() * 60 * 1000).toISOString();
    this.limitDisplay = date_limit.toLocaleString(this.lang.lang);
    this.limitDisplay = this.limitDisplay.substring(0, this.limitDisplay.lastIndexOf(':'));
    this.isLimitChangable = true;
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

  isLogsHidden = true;
  /** 기록 리스트 켜고 끄기 */
  toggle_logs() {
    this.isLogsHidden = !this.isLogsHidden;
  }

  isLimitChangable = false;
  /** 기한 변경됨 */
  limit_change(ev: any) {
    if (!this.isLimitChangable) return;
    this.userInput.limit = ev.detail.value;
    this.limitDisplay = new Date(ev.detail.value).toLocaleString(this.lang.lang);
    this.limitDisplay = this.limitDisplay.substring(0, this.limitDisplay.lastIndexOf(':'))
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
  /** 평소 기한 가시화 색상 */
  normal_color = '#888b';
  alert_color = '#0bbb';
  AlertLerpStartFrom = .8;
  show_count_timer() {
    this.p5timer = new p5((p: p5) => {
      let startAnimLerp = 0;
      let startTime = new Date(this.userInput.written).getTime();
      this.limitTimeP5Display = new Date(this.userInput.limit).getTime();
      let currentTime: number;
      let color = p.color(this.normal_color);
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
      let lerpVal = 0;
      let checkCurrent = () => {
        currentTime = new Date().getTime();
        if (this.limitTimeP5Display < currentTime)
          lerpVal = 1;
        else lerpVal = p.map(currentTime, startTime, this.limitTimeP5Display, 0, 1, true);
        if (lerpVal <= this.AlertLerpStartFrom) {
          color = p.color(this.normal_color);
        } else if (lerpVal > this.AlertLerpStartFrom)
          color = p.lerpColor(p.color(this.normal_color), p.color(this.alert_color), p.map(lerpVal, this.AlertLerpStartFrom, 1, 0, 1) * startAnimLerp);
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
          p.rect(0, 0, p.lerp(0, p.width, lerpVal * easeOut(startAnimLerp)), p.height);
        } else {
          p.rect(0, 0, p.lerp(0, p.width, lerpVal), p.height);
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

  @ViewChild('ImporantSel') ImporantSel: any;
  ImporantSelClicked() {
    this.ImporantSel.open();
  }
  /** 중요도 변경됨 */
  ImporantSelChanged(ev: any) {
    this.userInput.importance = ev.detail.value;
    switch (this.userInput.importance) {
      case '0': // 메모
        this.normal_color = '#888b';
        this.alert_color = '#0bbb';
        this.AlertLerpStartFrom = .8;
        break;
      case '1': // 기억해야함
        this.normal_color = '#888b';
        this.alert_color = '#dddd0cbb';
        this.AlertLerpStartFrom = .5;
        break;
      case '2': // 중요함
        this.normal_color = '#dddd0cbb';
        this.alert_color = '#800b';
        this.AlertLerpStartFrom = .4;
        break;
    }
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
      this.userInput.attach['img'] = ev.target.result.replace(/"|\\|=/g, '');
      this.indexed.saveFileToUserPath(this.userInput.attach['img'], 'todo/add_tmp.attach');
    };
    if (this.ImageURL)
      URL.revokeObjectURL(this.ImageURL);
    this.ImageURL = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(ev.target.files[0]));
    reader.readAsDataURL(ev.target.files[0]);
  }

  /** 이미지를 뷰어에서 보기 */
  go_to_ionic_viewer() {
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: this.userInput.attach,
        path: this.userInput.id ? `todo/${this.userInput.id}/attach.img` : 'todo/add_tmp.attach',
      }
    }).then(v => v.present());
  }

  isButtonClicked = false;
  /** 이 해야할 일 정보를 저장 */
  saveData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: this.lang.text['TodoDetail']['needDisplayName'],
      });
      return;
    }
    this.isButtonClicked = true;
    if (!this.userInput.id)
      this.userInput.id = new Date().toISOString().replace(/[:|.]/g, '_');
    let copy_img = this.userInput.attach['img'];
    delete this.userInput.attach['img'];
    if (copy_img)
      this.indexed.saveFileToUserPath(copy_img, `todo/${this.userInput.id}/attach.img`);
    this.userInput.written = new Date().getTime();
    this.userInput.limit = new Date(this.userInput.limit).getTime();
    this.userInput.logs.push({
      creator: this.userInput.remote ?
        this.nakama.servers[this.userInput.remote.isOfficial][this.userInput.remote.target].session.user_id
        : '',
      createTime: new Date().getTime(),
      translateCode: this.isModify ? 'ModifyTodo' : 'CreateTodo',
    });
    this.isLogsHidden = true;
    this.userInput.logs.forEach(log => {
      delete log.displayText;
    });
    this.navParams.get('godot')['add_todo'](JSON.stringify(this.userInput));
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), `todo/${this.userInput.id}/info.todo`, () => {
      this.modalCtrl.dismiss();
    });
  }

  /** 이 해야할 일의 상태 업데이트 */
  taskUpdate() {
    console.log('상태가 업데이트됨');
  }

  /** 이 해야할 일 삭제 */
  deleteData() {
    this.indexed.GetFileListFromDB(`todo/${this.userInput.id}`, (v) => {
      v.forEach(_path => this.indexed.removeFileFromUserPath(_path));
      this.navParams.get('godot')['remove_todo'](JSON.stringify(this.userInput));
      this.modalCtrl.dismiss();
    });
  }

  ionViewWillLeave() {
    this.indexed.removeFileFromUserPath('todo/add_tmp.attach');
    if (this.ImageURL)
      URL.revokeObjectURL(this.ImageURL);
    this.p5resize.remove();
    this.p5timer.remove();
  }
}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import * as p5 from "p5";
import { P5ToastService } from 'src/app/p5-toast.service';

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
  ) { }

  /** 작성된 내용 */
  userInput = {
    title: undefined,
    /** 기한 */
    limit: undefined,
    /** 사용자에게 보여지는 문자열 */
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
  };

  ngOnInit() { }

  ionViewWillEnter() {
    let tomorrow = new Date(new Date().getTime() + 86400000);
    this.Calendar.value = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60 * 1000).toISOString();
    this.userInput.limit = tomorrow.toISOString();
    this.userInput.limitDisplay = tomorrow.toLocaleString();
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
    } else { // 새 해야할 일 생성
      console.log('새 해야할 일 생성');
    }
    this.follow_resize();
  }

  isCalendarHidden = true;
  /** 달력 켜기끄기 */
  toggle_calendar() {
    this.p5canvas.windowResized();
    this.isCalendarHidden = !this.isCalendarHidden;
  }

  /** 기한 변경됨 */
  limit_change(ev: any) {
    this.userInput.limit = ev.detail.value;
    this.userInput.limitDisplay = new Date(ev.detail.value).toLocaleString();
  }

  p5canvas: p5;
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
      this.p5canvas = new p5(sketch);
    }, 50);
  }

  /** 이 해야할 일 정보를 저장 */
  saveData() {
    console.log('저장하기 테스트: ', this.userInput);
    if (!this.userInput.title) {
      this.p5toast.show({
        text: '표시명을 작성하여야 합니다.',
      });
      return;
    }
    this.navParams.get('godot')['add_todo'](JSON.stringify(this.userInput));
    this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    this.p5canvas.remove();
  }
}

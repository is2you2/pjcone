// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { isPlatform } from 'src/app/app.component';
import { P5ToastService } from 'src/app/p5-toast.service';
import clipboard from "clipboardy";
import * as p5 from "p5";
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
})
export class NotificationPage implements OnInit {

  constructor(
    private p5toast: P5ToastService,
    public lang: LanguageSettingService,
  ) { }

  userInput = {
    img_url: undefined,
    text: undefined,
  }

  info_text = '';

  cant_use_clipboard = false;
  ngOnInit() {
    console.warn('모든 서버와 연결이 끊어졌을 경우 화면 나가기');
    this.cant_use_clipboard = isPlatform != 'DesktopPWA';
    console.warn('최고 관리자가 아닌 경우 관리 권한 없음 알림, 나가기');
    // if (!this.client.is_admin) {
    //   this.p5toast.show({
    //     text: this.lang.text['Administrator']['OnlyForAdmin'],
    //   });
    //   this.navCtrl.back();
    // }
    new p5((p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/administrator_notification.txt`, (v: string[]) => {
          this.info_text = v.join('\n');
          p.remove();
        }, e => {
          console.error('관리자 알림 불러오기 실패: ', e);
          p.remove();
        });
      }
    });
  }

  imageURL_disabled = false;
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    this.imageURL_disabled = true;
    clipboard.read().then(v => {
      if (v.indexOf('http') == 0) {
        this.userInput.img_url = v;
      } else if (v.indexOf('data:image') == 0) {
        this.p5toast.show({
          text: this.lang.text['Administrator']['CannotUseDataURL'],
        });
      } else {
        this.p5toast.show({
          text: this.lang.text['Profile']['copyURIFirst'],
        });
      }
    });
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  send() {
    if (!this.userInput.text) return;
    console.warn('나카마 서버로 모든 사용자에게 알림 보내기');
    // this.client.send(JSON.stringify({
    //   act: 'global_noti',
    //   img: this.userInput.img_url,
    //   text: this.userInput.text,
    // }));
    delete this.userInput.img_url;
    delete this.userInput.text;
  }
}

import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WscService } from 'src/app/wsc.service';
import clipboard from "clipboardy";

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
})
export class NotificationPage implements OnInit {

  constructor(
    private client: WscService,
    private nakama: NakamaService,
    private p5toast: P5ToastService,
    private navCtrl: NavController,
  ) { }

  userInput = {
    img_url: undefined,
    text: undefined,
  }

  cant_use_clipboard = false;
  ngOnInit() {
    this.cant_use_clipboard = isPlatform != 'DesktopPWA';
    if (!this.client.is_admin) {
      this.p5toast.show({
        text: '관리자 전용메뉴입니다',
      });
      this.navCtrl.back();
    }
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
          text: '데이터 URL은 사용할 수 없습니다.',
        });
      } else {
        this.p5toast.show({
          text: '먼저 웹 페이지에서 이미지 주소를 복사해주세요',
        });
      }
    });
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  send() {
    if (!this.userInput.text) return;
    this.client.send(JSON.stringify({
      act: 'global_noti',
      img: this.userInput.img_url,
      text: this.userInput.text,
    }));
    delete this.userInput.img_url;
    delete this.userInput.text;
  }
}

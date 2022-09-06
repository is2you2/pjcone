import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  constructor(
    private nakama: NakamaService,
    private p5toast: P5ToastService,
  ) { }

  userInput = {
    name: undefined,
    email: undefined,
    img: 'assets/icon/favicon.png',
    content: {
      type: undefined,
      path: undefined,
    },
  }

  p5canvas: p5;
  ngOnInit() {
    this.is_online = Boolean(localStorage.getItem('is_online'));
    this.userInput.email = localStorage.getItem('email');
    this.check_onlineable();
    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      const LERP_SIZE = .025;
      p.draw = () => {
        if (this.is_online) {
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
      }
    }
    this.p5canvas = new p5(sketch);
  }

  change_img() {
    console.log('이미지 변경 클릭됨');
  }

  change_content() {
    console.log('표시 콘텐츠 수정 클릭');
  }

  /** 사용자 온라인 여부 */
  is_online: boolean;
  /** 채도 변화자 */
  lerpVal: number;
  toggle_online() {
    this.is_online = !this.is_online;
    this.check_onlineable();
    this.p5canvas.loop();
  }

  check_onlineable() {
    if (this.is_online) {
      if (this.userInput.email) {
        localStorage.setItem('email', this.userInput.email);
        this.nakama.init_session(() => {
          this.is_online = false;
        });
        localStorage.setItem('is_online', 'yes');
      } else {
        this.p5toast.show({
          text: '이메일 주소가 있어야 온라인으로 전환하실 수 있습니다.',
          force: true,
        });
        this.is_online = false;
        localStorage.removeItem('is_online');
        return;
      }
    } else localStorage.removeItem('is_online');
  }

  ionViewWillLeave() {
    if (this.userInput.email)
      localStorage.setItem('email', this.userInput.email);
    else localStorage.removeItem('email');
    this.p5canvas.remove();
  }
}

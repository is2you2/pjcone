import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
})
export class ProfilePage implements OnInit {

  constructor(
    private nakama: NakamaService,
    private statusBar: StatusManageService,
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
    if (this.is_online) {
      if (this.userInput.email) {
        localStorage.setItem('email', this.userInput.email);
        this.nakama.init_all_sessions((v: boolean) => {
          if (v) {
            this.p5toast.show({
              text: '로그인되었습니다.',
              force: true,
            });
          } else this.is_online = false;
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
    } else {
      let IsOfficials = Object.keys(this.statusBar.groupServer);
      IsOfficials.forEach(_is_official => {
        let Targets = Object.keys(this.statusBar.groupServer[_is_official]);
        Targets.forEach(_target => {
          if (this.statusBar.groupServer[_is_official][_target] == 'online') {
            this.statusBar.groupServer[_is_official][_target] = 'pending';
            this.statusBar.settings['groupServer'] = 'pending';
          }
        });
      })
      localStorage.removeItem('is_online');
    }
    this.p5canvas.loop();
  }

  ionViewWillLeave() {
    if (this.userInput.email)
      localStorage.setItem('email', this.userInput.email);
    else localStorage.removeItem('email');
    this.p5canvas.remove();
  }
}

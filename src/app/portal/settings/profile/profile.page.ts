import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
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
    private indexed: IndexedDBService,
  ) { }

  userInput = {
    /** nakama.display_name 에 해당함 */
    name: undefined,
    email: undefined,
    img: undefined,
    content: {
      type: undefined,
      path: undefined,
    },
  }

  p5canvas: p5;
  ngOnInit() {
    this.is_online = Boolean(localStorage.getItem('is_online'));
    this.userInput.name = localStorage.getItem('name');
    let anyServers = this.nakama.get_all_servers();
    if (anyServers.length) // 연결된 서버 있으면 이름 받아오기
      for (let i = 0, j = anyServers.length; i < j; i++) {
        anyServers[i].client.getAccount(anyServers[i].session)
          .then(v => {
            this.userInput.name = v.user.display_name;
          });
        break;
      }
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
    this.indexed.loadTextFromUserPath('servers/self/profile.txt', (v: any) => {
      this.userInput = { ...this.userInput, ...JSON.parse(v) };
    });
  }

  change_img() {
    document.getElementById('file_sel').click();
  }

  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.userInput.img = ev.target.result;
      this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), 'servers/self/profile.txt');
    }
    reader.readAsDataURL(ev.target.files[0]);
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
        localStorage.setItem('name', this.userInput.name);
        this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), 'servers/self/profile.txt');
        this.nakama.init_all_sessions((v: boolean) => {
          if (v) {
            this.p5toast.show({
              text: '로그인되었습니다.',
            });
          } else this.is_online = false;
        });
        localStorage.setItem('is_online', 'yes');
      } else {
        this.p5toast.show({
          text: '이메일 주소가 있어야 온라인으로 전환하실 수 있습니다.',
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
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), 'servers/self/profile.txt');
    if (this.userInput.email)
      localStorage.setItem('email', this.userInput.email);
    else localStorage.removeItem('email');
    if (this.userInput.name) { // 이름이 있으면 모든 서버에 이름 업데이트
      let servers = this.nakama.get_all_servers();
      for (let i = 0, j = servers.length; i < j; i++)
        servers[i].client.updateAccount(servers[i].session, {
          display_name: this.userInput.name,
        });
      localStorage.setItem('name', this.userInput.name);
    } else localStorage.removeItem('name');
    this.p5canvas.remove();
  }
}

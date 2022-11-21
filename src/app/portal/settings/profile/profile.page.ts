import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import clipboard from "clipboardy";
import { isPlatform } from 'src/app/app.component';
import { ModalController } from '@ionic/angular';

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
    private modalCtrl: ModalController,
  ) { }

  /** 부드러운 이미지 교체를 위한 이미지 임시 배정 */
  tmp_img: string;
  /** 사용자 주소 입력 */
  url_input: string;

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
    this.userInput.email = localStorage.getItem('email');
    this.cant_use_clipboard = isPlatform != 'DesktopPWA';
    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      let tmp_img = document.getElementById('profile_tmp_img');
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
        tmp_img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)});`);
      }
    }
    this.p5canvas = new p5(sketch);
    this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
      let addition = {};
      if (e && v) addition = JSON.parse(v);
      this.userInput = { ...this.userInput, ...addition };
      this.receiveDataFromServer();
    });
  }

  /** 서버 중 한곳으로부터 데이터 수신받기 */
  receiveDataFromServer() {
    let anyServers = this.nakama.get_all_server();
    if (anyServers.length) // 연결된 서버 있으면 이름 받아오기
      for (let i = 0, j = anyServers.length; i < j; i++) {
        // 프로필 불러오기
        anyServers[i].client.getAccount(anyServers[i].session)
          .then(v => {
            this.userInput.name = v.user.display_name;
          });
        // 프로필 이미지 불러오기
        anyServers[i].client.readStorageObjects(anyServers[i].session, {
          object_ids: [{
            collection: 'user_public',
            key: 'profile_image',
            user_id: anyServers[i].session.user_id,
          }],
        }).then(v => {
          if (!v.objects.length) return;
          this.change_img_smoothly(v.objects[0].value['img']);
        });
        break;
      }
  }

  /** 부드러운 이미지 변환 */
  change_img_smoothly(_url: string) {
    this.tmp_img = _url;
    new p5((p: p5) => {
      let profile_tmp_img = document.getElementById('profile_tmp_img');
      let file_sel = document.getElementById('file_sel');
      const LERP_SIZE = .035;
      let lerpVal = 0;
      p.setup = () => {
        file_sel['value'] = '';
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.is_online ? 0 : .9}) contrast(${this.is_online ? 1 : 1.4}) opacity(${lerpVal})`);
      }
      p.draw = () => {
        if (lerpVal < 1) {
          lerpVal += LERP_SIZE;
        } else {
          lerpVal = 1;
          this.userInput.img = this.tmp_img;
          // 아래, 서버 이미지 업로드
          let servers = this.nakama.get_all_server();
          this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), 'servers/self/profile.json');
          this.tmp_img = '';
          for (let i = 0, j = servers.length; i < j; i++) {
            servers[i].client.writeStorageObjects(servers[i].session, [{
              collection: 'user_public',
              key: 'profile_image',
              value: { img: this.userInput.img },
              permission_read: 2,
              permission_write: 1,
            }]).then(_v => {
            }).catch(e => {
              console.error('inputImageSelected_err: ', e);
            });
          }
          p.remove();
        }
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.is_online ? 0 : .9}) contrast(${this.is_online ? 1 : 1.4}) opacity(${lerpVal})`);
      }
    });
  }

  change_img_from_file() { document.getElementById('file_sel').click(); }
  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.nakama.limit_image_size(ev, (v) => { this.change_img_smoothly(v['canvas'].toDataURL()) });
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
        localStorage.setItem('is_online', 'yes');
        this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), 'servers/self/profile.json');
        this.nakama.init_all_sessions((v: boolean, _o, _t) => {
          if (v) {
            this.p5toast.show({
              text: '로그인되었습니다.',
            });
            this.receiveDataFromServer();
          } else if (v === undefined) {
            this.nakama.servers[_o][_t].client.writeStorageObjects(
              this.nakama.servers[_o][_t].session, [{
                collection: 'user_public',
                key: 'profile_image',
                value: { img: this.userInput.img },
                permission_read: 2,
                permission_write: 1,
              }]).then(_v => {
              }).catch(e => {
                console.error('inputImageSelected_err: ', e, _o, _t);
              });
          }
        });
      } else {
        this.p5toast.show({
          text: '이메일 주소가 있어야 온라인으로 전환하실 수 있습니다.',
        });
        this.is_online = false;
        localStorage.removeItem('is_online');
      }
    } else {
      let IsOfficials = Object.keys(this.statusBar.groupServer);
      IsOfficials.forEach(_is_official => {
        let Targets = Object.keys(this.statusBar.groupServer[_is_official]);
        Targets.forEach(_target => {
          if (this.statusBar.groupServer[_is_official][_target] == 'online') {
            this.statusBar.groupServer[_is_official][_target] = 'pending';
            this.nakama.catch_group_server_header('pending');
            if (this.nakama.servers[_is_official][_target].session)
              this.nakama.servers[_is_official][_target].client.sessionLogout(
                this.nakama.servers[_is_official][_target].session,
                this.nakama.servers[_is_official][_target].session.token,
                this.nakama.servers[_is_official][_target].session.refresh_token,
              );
            if (this.nakama.servers[_is_official][_target].socket)
              this.nakama.servers[_is_official][_target].socket.disconnect(true);
          }
        });
      });
      localStorage.removeItem('is_online');
    }
    this.p5canvas.loop();
  }

  /** 클립보드 사용가능 여부 */
  cant_use_clipboard = false;
  imageURL_disabled = false;
  imageURL_placeholder = '눌러서 외부이미지 주소 붙여넣기';
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    if (isPlatform != 'DesktopPWA') return;
    this.imageURL_disabled = true;
    clipboard.read().then(v => {
      if (v.indexOf('http') == 0) {
        this.change_img_smoothly(v);
      } else if (v.indexOf('data:image') == 0) {
        this.nakama.limit_image_size({
          target: { result: [v] },
        }, (rv) => this.change_img_smoothly(rv['canvas'].toDataURL()));
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

  ionViewWillLeave() {
    this.userInput.img = this.tmp_img || this.userInput.img;
    if (this.userInput.email)
      localStorage.setItem('email', this.userInput.email);
    else localStorage.removeItem('email');
    if (this.userInput.name) { // 이름이 있으면 모든 서버에 이름 업데이트
      let servers = this.nakama.get_all_server();
      for (let i = 0, j = servers.length; i < j; i++) {
        servers[i].client.updateAccount(servers[i].session, {
          display_name: this.userInput.name,
        });
        servers[i].client.writeStorageObjects(servers[i].session, [{
          collection: 'user_public',
          key: 'profile_image',
          value: { img: this.userInput.img },
          permission_read: 2,
          permission_write: 1,
        }])
      }
      localStorage.setItem('name', this.userInput.name);
    } else localStorage.removeItem('name');
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.userInput), 'servers/self/profile.json');
    this.p5canvas.remove();
  }

  go_back() {
    if (this.modalCtrl['injector']['source'] != 'ProfilePageModule')
      this.modalCtrl.dismiss();
  }
}

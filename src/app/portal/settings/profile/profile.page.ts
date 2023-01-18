import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
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
    public nakama: NakamaService,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private modalCtrl: ModalController,
  ) { }

  /** 부드러운 이미지 교체를 위한 이미지 임시 배정 */
  tmp_img: string;
  /** 사용자 주소 입력 */
  url_input: string;
  /** 들어오기 직전 프로필 정보 백업 */
  original_profile = {};

  p5canvas: p5;
  ngOnInit() {
    if (!this.nakama.users.self['img']) {
      this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
        if (e && v) this.nakama.users.self['img'] = v.replace(/"|\\|=/g, '');
        this.original_profile = { ...this.nakama.users.self };
      });
    } else this.original_profile = { ...this.nakama.users.self };
    this.nakama.socket_reactive['profile'] = (img_url: string) => {
      this.change_img_smoothly(img_url);
    }
    this.cant_use_clipboard = isPlatform != 'DesktopPWA';
    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      let tmp_img = document.getElementById('profile_tmp_img');
      const LERP_SIZE = .025;
      p.draw = () => {
        if (this.nakama.users.self['online']) {
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
  }

  /** 부드러운 이미지 변환 */
  change_img_smoothly(_url: string) {
    new p5((p: p5) => {
      let profile_tmp_img = document.getElementById('profile_tmp_img');
      let file_sel = document.getElementById('file_sel');
      const LERP_SIZE = .035;
      let lerpVal = 0;
      p.setup = () => {
        file_sel['value'] = '';
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.nakama.users.self['online'] ? 0 : .9}) contrast(${this.nakama.users.self['online'] ? 1 : 1.4}) opacity(${lerpVal})`);
        this.tmp_img = _url;
      }
      p.draw = () => {
        if (lerpVal < 1) {
          lerpVal += LERP_SIZE;
        } else {
          lerpVal = 1;
          this.nakama.users.self['img'] = this.tmp_img;
          this.sync_to_all_server();
          p.remove();
        }
        profile_tmp_img.setAttribute('style', `filter: grayscale(${this.nakama.users.self['online'] ? 0 : .9}) contrast(${this.nakama.users.self['online'] ? 1 : 1.4}) opacity(${lerpVal})`);
      }
    });
  }

  /** 모든 서버에 프로필 변경됨 고지 및 동기화 */
  sync_to_all_server() {
    console.warn('변경전 이미지를 tmp로, 변경 후 이미지는 즉시 적용 처리 필요');
    let servers = this.nakama.get_all_online_server();
    this.nakama.save_self_profile();
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.nakama.users.self['img']), 'servers/self/profile.img');
    this.tmp_img = '';
    for (let i = 0, j = servers.length; i < j; i++) {
      servers[i].client.writeStorageObjects(servers[i].session, [{
        collection: 'user_public',
        key: 'profile_image',
        value: { img: this.nakama.users.self['img'] },
        permission_read: 2,
        permission_write: 1,
      }]).then(v => {
        servers[i].client.updateAccount(servers[i].session, {
          avatar_url: v.acks[0].version,
        });
        let all_channels = this.nakama.rearrange_channels();
        all_channels.forEach(channel => {
          servers[i].socket.writeChatMessage(channel.id, {
            user: 'modify_img',
            noti: `사용자 이미지 변경: ${this.original_profile['display_name']}`,
          });
        });
      }).catch(e => {
        console.error('inputImageSelected_err: ', e);
      });
    }
  }

  change_img_from_file() { document.getElementById('file_sel').click(); }
  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.nakama.limit_image_size(ev, (v: any) => { this.change_img_smoothly(v['canvas'].toDataURL()) });
    }
    reader.readAsDataURL(ev.target.files[0]);
  }

  change_content() {
    console.log('표시 콘텐츠 수정 클릭');
  }

  can_auto_modified = false;
  ionViewDidEnter() {
    this.can_auto_modified = true;
  }
  /** 이메일 변경시 오프라인 처리 */
  email_modified() {
    if (this.can_auto_modified) {
      if (this.nakama.users.self['online'])
        this.toggle_online();
      this.nakama.users.self['online'] = false;
    }
  }
  /** 채도 변화자 */
  lerpVal: number;
  toggle_online() {
    this.nakama.users.self['online'] = !this.nakama.users.self['online'];
    if (this.nakama.users.self['online']) {
      if (this.nakama.users.self['email']) {
        this.nakama.save_self_profile();
        this.nakama.init_all_sessions();
      } else {
        this.p5toast.show({
          text: '이메일 주소가 있어야 온라인으로 전환하실 수 있습니다.',
        });
        this.nakama.users.self['online'] = false;
      }
    } else this.nakama.logout_all_server();
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

  async ionViewWillLeave() {
    delete this.nakama.socket_reactive['profile'];
    let keys = Object.keys(this.nakama.users.self);
    let isProfileChanged = false;
    for (let i = 0, j = keys.length; i < j; i++)
      if (this.nakama.users.self[keys[i]] != this.original_profile[keys[i]]) {
        isProfileChanged = true;
        break;
      }
    this.nakama.users.self['img'] = this.tmp_img || this.nakama.users.self['img'];
    if (isProfileChanged) {
      let servers = this.nakama.get_all_online_server();
      for (let i = 0, j = servers.length; i < j; i++) {
        let NeedAnnounceUpdate = false;
        if (this.nakama.users.self['display_name'] != this.original_profile['display_name'])
          await servers[i].client.updateAccount(servers[i].session, {
            display_name: this.nakama.users.self['display_name'],
          }).then(_v => {
            NeedAnnounceUpdate = true;
          });
        if (this.nakama.users.self['img'] != this.original_profile['img'])
          await servers[i].client.writeStorageObjects(servers[i].session, [{
            collection: 'user_public',
            key: 'profile_image',
            value: { img: this.nakama.users.self['img'] },
            permission_read: 2,
            permission_write: 1,
          }]).then(v => {
            servers[i].client.updateAccount(servers[i].session, {
              avatar_url: v.acks[0].version,
            });
            NeedAnnounceUpdate = true;
          });
        else if (!this.nakama.users.self['img'])
          await servers[i].client.deleteStorageObjects(servers[i].session, {
            object_ids: [{
              collection: 'user_public',
              key: 'profile_image',
            }]
          }).then(v => {
            if (!v) console.warn('내 프로필 이미지 삭제 실패 로그');
            delete this.nakama.users.self['avatar_url'];
            servers[i].client.updateAccount(servers[i].session, {
              avatar_url: '',
            });
            NeedAnnounceUpdate = true;
          });
        // 해당 서버 연결된 채널에 고지
        if (NeedAnnounceUpdate) {
          let all_channels = this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target];
          all_channels.forEach(channelId => {
            servers[i].socket.writeChatMessage(channelId, {
              user: 'modify_data',
              noti: `사용자 프로필 변경: ${this.original_profile['display_name']}`,
            });
          });
        }
      }
      this.nakama.save_self_profile();
    }
    this.p5canvas.remove();
  }

  go_back() {
    if (this.modalCtrl['injector']['source'] != 'ProfilePageModule')
      this.modalCtrl.dismiss();
  }
}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { LoadingController, ModalController, NavParams } from '@ionic/angular';
import * as p5 from "p5";
import { IndexedDBService } from '../indexed-db.service';
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';
import { P5ToastService } from '../p5-toast.service';
import { ChatRoomPage } from '../portal/subscribes/chat-room/chat-room.page';
import { StatusManageService } from "../status-manage.service";
import { FileInfo, GlobalActService } from '../global-act.service';

@Component({
  selector: 'app-others-profile',
  templateUrl: './others-profile.page.html',
  styleUrls: ['./others-profile.page.scss'],
})
export class OthersProfilePage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private nakama: NakamaService,
    public statusBar: StatusManageService,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private loadingCtrl: LoadingController,
  ) { }

  /** 다른 사용자의 정보 */
  info = {};
  group_info = {};
  /** 추가 생성 버튼 (알림 검토의 결과물) */
  additional_buttons = {};
  /** 사용자 이미지 */
  tmp_img: any;
  /** 그룹 관리자여부에 따라 그룹 관리 버튼 추가 */
  has_admin = false;
  /** 1:1 대화 버튼 생성여부 */
  CanCreateChat = true;

  lerpVal: number;
  p5canvas: p5;
  async ngOnInit() {
    this.nakama.removeBanner();
    this.info = this.navParams.get('info');
    this.has_admin = this.navParams.get('has_admin');
    this.group_info = this.navParams.get('group');
    this.isOfficial = this.group_info['server']['isOfficial'];
    this.target = this.group_info['server']['target'];
    this.user_content_id = `user_content_${this.info['user']['id']}`;
    this.nakama.load_other_user(this.info['user']['id'], this.isOfficial, this.target);
    this.nakama.socket_reactive['others-profile'] = (img_url: string) => {
      this.change_img_smoothly(img_url);
    };
    this.nakama.socket_reactive['others-online'] = () => {
      this.p5canvas.loop();
    };
    this.nakama.socket_reactive['other_user_content_update'] = () => {
      this.update_content_from_server();
    }
    setTimeout(async () => {
      let is_exist = await this.indexed.checkIfFileExist(`servers/${this.isOfficial}/${this.target}/users/${this.info['user']['id']}/content.pck`);
      if (is_exist)
        await this.global.CreateGodotIFrame(this.user_content_id, {
          title: 'ViewerEx',
          ext: 'pck',
          local_url: 'assets/data/godot/viewer.pck',
          path: `servers/${this.isOfficial}/${this.target}/users/${this.info['user']['id']}/content.pck`,
          force_logo: true,
        });
    }, 150);
    this.catch_user_noties();
    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      let tmp_img = document.getElementById('profile_tmp_img');
      const LERP_SIZE = .025;
      p.draw = () => {
        if (this.info['user']['online']) {
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

  user_content_id = '';

  async update_content_from_server() {
    this.global.last_frame_name = 'update_other_content';
    this.global.godot.remove();
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    let server = this.nakama.servers[this.isOfficial][this.target];
    let target_info: FileInfo;
    try {
      let getContent = await server.client.readStorageObjects(
        server.session, {
        object_ids: [{
          collection: 'user_public',
          key: 'main_content',
          user_id: this.info['user']['id'],
        }],
      });
      target_info = getContent.objects[0].value;
      let base64 = '';
      for (let i = 0, j = target_info.partsize; i < j; i++) {
        let part = await server.client.readStorageObjects(
          server.session, {
          object_ids: [{
            collection: 'user_public',
            key: `main_content_${i}`,
            user_id: this.info['user']['id'],
          }]
        });
        base64 += part.objects[i].value['data'];
      }
      await this.indexed.saveFileToUserPath(base64.replace(/"|=|\\/g, ''), `servers/${this.isOfficial}/${this.target}/users/${this.info['user']['id']}/content.pck`);
      await this.global.CreateGodotIFrame(this.user_content_id, {
        title: 'ViewerEx',
        ext: 'pck',
        local_url: 'assets/data/godot/viewer.pck',
        path: `servers/${this.isOfficial}/${this.target}/users/${this.info['user']['id']}/content.pck`,
        force_logo: true,
      });
    } catch (e) {
      await this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/users/${this.info['user']['id']}/content.pck`);
      this.global.godot.remove();
    }
    loading.dismiss();
  }

  isOfficial: string;
  target: string;
  /** 이 사용자와 관련된 알림 검토 (그룹 리액션 검토용) */
  catch_user_noties() {
    let hasNotifications = this.nakama.noti_origin[this.isOfficial] && this.nakama.noti_origin[this.isOfficial][this.target];
    if (hasNotifications) {
      let noti_ids = Object.keys(this.nakama.noti_origin[this.isOfficial][this.target]);
      noti_ids.forEach(noti_id => {
        if (this.nakama.noti_origin[this.isOfficial][this.target][noti_id]['sender_id'] == this.info['user']['id'])
          this.additional_buttons[this.nakama.noti_origin[this.isOfficial][this.target][noti_id]['code'].toString()] = noti_id;
      });
    }
  }

  /** 부드러운 이미지 변환 */
  change_img_smoothly(_url: string) {
    let updater = setInterval(() => { }, 110);
    setTimeout(() => {
      clearInterval(updater);
    }, 1500);
    new p5((p: p5) => {
      let profile_tmp_img = document.getElementById('profile_tmp_img');
      const LERP_SIZE = .035;
      let lerpVal = 0;
      p.setup = () => {
        profile_tmp_img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)}) opacity(${lerpVal})`);
        this.tmp_img = _url;
      }
      p.draw = () => {
        if (lerpVal < 1) {
          lerpVal += LERP_SIZE;
        } else {
          lerpVal = 1;
          this.info['user']['img'] = this.tmp_img;
          this.indexed.saveTextFileToUserPath(this.info['user']['img'], `servers/${this.isOfficial}/${this.target}/users/${this.info['user']['id']}/profile.img`)
          this.tmp_img = '';
          p.remove();
        }
        profile_tmp_img.setAttribute('style', `filter: grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)}) opacity(${lerpVal})`);
      }
    });
  }

  onDismissData = {};
  /** 알림에 의해 생성된 버튼들의 반응 */
  notification_react(code: number) {
    switch (code) {
      case 0: // 예약된 메시지
        break;
      case -1: // 오프라인이거나 채널에 없을 때 알림 받음
        // 모든 채팅에 대한건지, 1:1에 한정인지 검토 필요
        break;
      case -2: // 친구 요청 받음
        break;
      case -5: // 그룹 참가 요청 받음
        this.nakama.servers[this.isOfficial][this.target].client.addGroupUsers(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.group_info['group_id'] || this.group_info['id'], [this.info['user']['id']]
        ).then(v => {
          if (!v) console.warn('밴 유저에 대한것 같음, 확인 필요');
          this.p5toast.show({
            text: `${this.lang.text['OtherProfile']['added_to_group']}: ${this.info['user']['display_name'] || '이름 없는 사용자'}`,
          });
          this.nakama.servers[this.isOfficial][this.target].client.deleteNotifications(
            this.nakama.servers[this.isOfficial][this.target].session,
            [this.additional_buttons[code.toString()]]
          ).then(v => {
            if (!v) console.warn('알림 부정 검토 필요');
            delete this.additional_buttons[code.toString()];
            this.nakama.update_notifications(this.isOfficial, this.target);
            this.onDismissData = {
              id: this.info['user']['id'],
              act: 'accept_join',
            };
            this.info['status'] = 'online';
            this.p5canvas.loop();
          });
        });
        break;
      default:
        console.warn('예상하지 못한 알림 반응: ', code);
        break;
    }
  }

  lock_create_chat = false;
  /** 1:1 대화 생성하기 */
  create_chat() {
    if (!this.lock_create_chat) {
      this.lock_create_chat = true;
      this.nakama.join_chat_with_modulation(this.info['user']['id'], 2, this.isOfficial, this.target, (c) => {
        if (c)
          this.modalCtrl.create({
            component: ChatRoomPage,
            componentProps: {
              info: c,
            },
          }).then(v => {
            v.present();
            this.lock_create_chat = false;
          });
        else this.lock_create_chat = false;
      }, true);
    }
  }

  /** 그룹장이 이 사용자를 퇴출 */
  kick_user_from_group() {
    switch (this.info['state']) {
      case 0:
      case 1:
      case 2: // 그룹원을 강제 탈퇴
        this.after_announce_kick();
        break;
      case 3: // 그룹 입장 대기중인 경우
        this.nakama.servers[this.isOfficial][this.target].client.deleteNotifications(
          this.nakama.servers[this.isOfficial][this.target].session,
          [this.additional_buttons['-5']]
        ).then(v => {
          if (!v) console.warn('알림 부정 검토 필요');
          this.after_announce_kick();
          delete this.additional_buttons['-5'];
          this.nakama.update_notifications(this.isOfficial, this.target);
          this.info['status'] = 'missing';
          this.p5canvas.loop();
        });
        break;
      default:
        console.warn('예상하지 못한 그룹 사용자 상태: ', this.info);
        break;
    }
  }

  /** 사용자 퇴출 알림 후 */
  after_announce_kick() {
    this.nakama.servers[this.isOfficial][this.target].client.kickGroupUsers(
      this.nakama.servers[this.isOfficial][this.target].session,
      this.group_info['group_id'] || this.group_info['id'], [this.info['user']['id']]
    ).then(_v => {
      this.p5toast.show({
        text: `${this.lang.text['OtherProfile']['kicked_from_group']}: ${this.info['user']['display_name'] || '이름 없는 사용자'}`,
      });
      this.modalCtrl.dismiss({
        id: this.info['user']['id'],
        act: 'kick',
      });
    });
  }

  focus_on_content() {
    console.warn('콘텐츠 자세히보기 기능 준비중');
  }

  ionViewDidLeave() {
    delete this.nakama.socket_reactive['others-profile'];
    delete this.nakama.socket_reactive['others-online'];
    delete this.nakama.socket_reactive['other_user_content_update'];
    this.p5canvas.remove();
  }
}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService, MatchOpCode } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import clipboard from "clipboardy";
import { isPlatform } from 'src/app/app.component';
import { LoadingController, ModalController } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { FileInfo, GlobalActService } from 'src/app/global-act.service';

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
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private loadingCtrl: LoadingController,
  ) { }

  /** 부드러운 이미지 교체를 위한 이미지 임시 배정 */
  tmp_img: string;
  /** 사용자 주소 입력 */
  url_input: string;
  /** 들어오기 직전 프로필 정보 백업 */
  original_profile = {};

  p5canvas: p5;
  ngOnInit() {
    this.nakama.removeBanner();
    this.file_sel_id = `self_profile_${new Date().getTime()}`;
    this.content_sel_id = `self_content_${new Date().getTime()}`;
    this.original_profile = JSON.parse(JSON.stringify(this.nakama.users.self));
    if (!this.nakama.users.self['img']) {
      this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
        if (e && v) this.nakama.users.self['img'] = v.replace(/"|\\|=/g, '');
      });
    }
    this.nakama.socket_reactive['profile'] = (img_url: string) => {
      this.change_img_smoothly(img_url);
    }
    setTimeout(() => {
      this.check_user_content();
    }, 150);
    this.nakama.socket_reactive['self_profile_content_update'] = () => {
      this.update_content_from_server();
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

  async check_user_content() {
    try {
      let is_exist = await this.indexed.checkIfFileExist('servers/self/content.pck');
      if (is_exist) {
        await this.global.CreateGodotIFrame('my_content', {
          title: 'ViewerEx',
          ext: 'pck',
          local_url: 'assets/data/godot/viewer.pck',
          path: 'servers/self/content.pck',
          force_logo: true,
        });
      } else throw '로컬에 준비된 파일 없음';
    } catch (e) {
      this.update_content_from_server();
    }
  }

  async update_content_from_server() {
    let load_user_content: FileInfo = { path: 'servers/self/content.pck', }
    let servers = this.nakama.get_all_online_server();
    let is_saved = false;
    for (let i = 0, j = servers.length; i < j; i++) {
      try {
        let blob = await this.nakama.sync_load_file(load_user_content, servers[i].info.isOfficial, servers[i].info.target,
          'user_public', servers[i].session.user_id, 'main_content');
        is_saved = Boolean(blob);
        break;
      } catch (e) {
        continue;
      }
    }
    if (is_saved) {
      this.global.last_frame_name = 'content_updated';
      this.global.godot.remove();
      await this.global.CreateGodotIFrame('my_content', {
        title: 'ViewerEx',
        ext: 'pck',
        local_url: 'assets/data/godot/viewer.pck',
        path: 'servers/self/content.pck',
        force_logo: true,
      });
    }
  }

  change_content() {
    document.getElementById(this.content_sel_id).click();
  }
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      this.global.last_frame_name = 'content_update';
      this.global.godot.remove();
      let this_file: FileInfo = {};
      this_file.filename = ev.target.files[0].name;
      this_file.file_ext = ev.target.files[0].name.split('.')[1] || ev.target.files[0].type || this.lang.text['ChatRoom']['unknown_ext'];
      if (this_file.file_ext != 'pck') {
        this.p5toast.show({
          text: this.lang.text['EngineWorksPPT']['FileExtPck'],
        });
        return;
      }
      this_file.size = ev.target.files[0].size;
      this_file.type = ev.target.files[0].type;
      this_file.typeheader = ev.target.files[0].type.split('/')[0];
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
      this_file.base64 = base64;
      this_file.path = 'servers/self/content.pck';
      loading.present();
      let servers = this.nakama.get_all_online_server();
      if (servers.length)
        for (let i = 0, j = servers.length; i < j; i++) {
          try {
            await this.nakama.sync_save_file(this_file, servers[i].info.isOfficial, servers[i].info.target, 'user_public', 'main_content');
            await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
              encodeURIComponent('content'));
            let all_channels = Object.keys(this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]);
            if (all_channels)
              all_channels.forEach((channelId: any) => {
                servers[i].socket.writeChatMessage(channelId, {
                  user_update: 'modify_content',
                  noti_form: `: ${this.original_profile['display_name']}`,
                });
              });
          } catch (e) {
            continue;
          }
        }
      else {
        await this.indexed.saveFileToUserPath(base64, this_file.path);
      }
      loading.dismiss();
      await this.global.CreateGodotIFrame('my_content', {
        title: 'ViewerEx',
        ext: 'pck',
        local_url: 'assets/data/godot/viewer.pck',
        path: 'servers/self/content.pck',
        force_logo: true,
      });
    }
  }

  async remove_content() {
    await this.indexed.removeFileFromUserPath('servers/self/content.pck');
    let servers = this.nakama.get_all_online_server();
    let server_len = servers.length;
    let loading: HTMLIonLoadingElement;
    if (server_len) {
      loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
    }
    for (let i = 0, j = servers.length; i < j; i++) {
      try {
        let getContent = await servers[i].client.readStorageObjects(
          servers[i].session, {
          object_ids: [{
            collection: 'user_public',
            key: 'main_content',
            user_id: servers[i].session.user_id,
          }],
        });
        let file_info: FileInfo = getContent.objects[0].value;
        for (let k = 0, l = file_info.partsize; k < l; k++)
          await servers[i].client.deleteStorageObjects(
            servers[i].session, {
            object_ids: [{
              collection: 'user_public',
              key: `main_content_${k}`,
            }],
          });
        await servers[i].client.deleteStorageObjects(
          servers[i].session, {
          object_ids: [{
            collection: 'user_public',
            key: 'main_content',
          }],
        });
      } catch (e) {
      }
      let all_channels = Object.keys(this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]);
      if (all_channels.length)
        all_channels.forEach((channelId: any) => {
          if (this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target][channelId]['status'] != 'missing')
            servers[i].socket.writeChatMessage(channelId, {
              user_update: 'remove_content',
              noti_form: `: ${this.original_profile['display_name']}`,
            });
        });
      await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
        encodeURIComponent('content'));
    }
    this.global.last_frame_name = 'content_removed';
    this.global.godot.remove();
    if (server_len) loading.dismiss();
  }

  /** 부드러운 이미지 변환 */
  change_img_smoothly(_url: string) {
    new p5((p: p5) => {
      let profile_tmp_img = document.getElementById('profile_tmp_img');
      let file_sel = document.getElementById(this.file_sel_id);
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
      }]).then(async v => {
        await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
          encodeURIComponent('image'));
        await servers[i].client.updateAccount(servers[i].session, {
          avatar_url: v.acks[0].version,
        });
        let all_channels = this.nakama.rearrange_channels();
        all_channels.forEach(async channel => {
          await servers[i].socket.writeChatMessage(channel.id, {
            user_update: 'modify_img',
            noti_form: `: ${this.original_profile['display_name']}`,
          });
        });
      }).catch(e => {
        console.error('inputImageSelected_err: ', e);
      });
    }
  }

  file_sel_id = '';
  content_sel_id = '';
  change_img_from_file() { document.getElementById(this.file_sel_id).click(); }
  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let updater = setInterval(() => { }, 110);
    setTimeout(() => {
      clearInterval(updater);
    }, 1500);
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v: any) => { this.change_img_smoothly(v['canvas'].toDataURL()) });
  }

  /** 온라인 전환 자동처리 가능여부 */
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
      delete this.nakama.users.self['password'];
    }
  }
  /** 채도 변화자 */
  lerpVal: number;
  toggle_online() {
    this.nakama.users.self['online'] = !this.nakama.users.self['online'];
    if (this.nakama.users.self['online']) {
      try {
        if (!this.nakama.users.self['email']) {
          this.p5toast.show({
            text: this.lang.text['Profile']['need_email'],
          });
          throw '이메일 공백';
        }
        if (!this.nakama.users.self['password']) {
          this.p5toast.show({
            text: this.lang.text['Profile']['need_password'],
          });
          throw '비밀번호 공백';
        }
        this.nakama.save_self_profile();
        this.nakama.init_all_sessions();
      } catch (e) {
        this.nakama.users.self['online'] = false;
      }
    } else {
      delete this.nakama.users.self['password'];
      this.nakama.logout_all_server();
    }
    this.p5canvas.loop();
  }

  /** 클립보드 사용가능 여부 */
  cant_use_clipboard = false;
  imageURL_disabled = false;
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    if (isPlatform != 'DesktopPWA') return;
    this.imageURL_disabled = true;
    clipboard.read().then(v => {
      if (v.indexOf('http') == 0) {
        this.change_img_smoothly(v);
      } else if (v.indexOf('data:image') == 0) {
        this.nakama.limit_image_size(v, (rv) => this.change_img_smoothly(rv['canvas'].toDataURL()));
      } else {
        this.p5toast.show({
          text: this.lang.text['Profile']['copyURIFirst'],
        });
        this.change_img_smoothly('');
      }
    });
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  async ionViewWillLeave() {
    delete this.nakama.socket_reactive['profile'];
    delete this.nakama.socket_reactive['self_profile_content_update'];
    let keys = Object.keys(this.nakama.users.self);
    let isProfileChanged = false;
    for (let i = 0, j = keys.length; i < j; i++)
      if (keys[i] != 'img' && this.nakama.users.self[keys[i]] != this.original_profile[keys[i]]) {
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
          }).then(async _v => {
            NeedAnnounceUpdate = true;
            await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
              encodeURIComponent('info'));
          });
        // 해당 서버 연결된 채널에 고지
        if (NeedAnnounceUpdate && this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]) {
          let all_channels = Object.keys(this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]);
          if (all_channels)
            all_channels.forEach((channelId: any) => {
              servers[i].socket.writeChatMessage(channelId, {
                user_update: 'modify_data',
                noti_form: this.original_profile['display_name'] == this.nakama.users.self['display_name']
                  ? `: ${this.original_profile['display_name']}`
                  : `: ${this.original_profile['display_name']} -> ${this.nakama.users.self['display_name']}`,
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

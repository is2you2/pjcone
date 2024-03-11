// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonAccordionGroup, IonModal, IonToggle, LoadingController, ModalController, NavController, NavParams } from '@ionic/angular';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MatchOpCode, NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import clipboard from "clipboardy";
import { isNativefier, isPlatform } from 'src/app/app.component';
import * as p5 from 'p5';
import { FileInfo, GlobalActService } from 'src/app/global-act.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';

@Component({
  selector: 'app-group-server',
  templateUrl: './group-server.page.html',
  styleUrls: ['./group-server.page.scss'],
})
export class GroupServerPage implements OnInit {

  constructor(
    public nakama: NakamaService,
    private p5toast: P5ToastService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private modalCtrl: ModalController,
    public global: GlobalActService,
    private loadingCtrl: LoadingController,
    private mClipboard: Clipboard,
    private navCtrl: NavController,
    private navParams: NavParams,
  ) { }

  info: string;
  servers: ServerInfo[];

  /** 서버 정보가 있는 경우 uid 받기 */
  session_uid = '';

  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true);

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
    let sketch = (p: p5) => {
      let img = document.getElementById('profile_img');
      let tmp_img = document.getElementById('profile_tmp_img');
      const LERP_SIZE = .025;
      p.setup = () => {
        p.noCanvas();
      }
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
    this.announce_update_profile = this.original_profile['display_name'] !== undefined;

    if (this.navParams.data['target']) {
      let isOfficial = this.navParams.get('isOfficial');
      let target = this.navParams.get('target');
      try {
        this.session_uid = this.nakama.servers[isOfficial][target].session.user_id;
      } catch (e) { } // 로컬 채널은 uid 설정 무시
    }
  }

  ionViewWillEnter() {
    this.ServersList.value = this.ToggleOnline.checked ? 'open' : undefined;
    if (!this.nakama.users.self['email'])
      (document.getElementById('email_input').childNodes[1].childNodes[1].childNodes[1] as HTMLElement).focus();
  }

  link_group(_is_official: string, _target: string) {
    if (this.isOverrideButtonPressed) {
      this.isOverrideButtonPressed = false;
      return;
    }
    if (this.statusBar.groupServer[_is_official][_target] == 'offline')
      this.nakama.link_group(_is_official, _target);
    else this.nakama.servers[_is_official][_target].socket.disconnect(true);
  }

  /** 사설서버 주소 사용자 input */
  dedicated_info: ServerInfo = {
    name: undefined,
    address: undefined,
    target: undefined,
    port: undefined,
    useSSL: undefined,
    isOfficial: undefined,
    key: undefined,
  }
  /** 사설서버 등록 중복 방지 토글 */
  add_custom_tog = false;
  /** 사설서버 등록하기 */
  add_custom_dedicated() {
    if (this.add_custom_tog) return;

    if (!this.dedicated_info.name) {
      this.p5toast.show({
        text: this.lang.text['GroupServer']['NeedSetDIsplayName'],
      });
      return;
    }
    this.add_custom_tog = true;

    let AddrPort = (this.dedicated_info.address || '192.168.0.1').split(':');
    this.dedicated_info.address = AddrPort[0];
    this.dedicated_info.port = Number(AddrPort[1]) || 7350;
    this.dedicated_info.useSSL = (window.location.protocol == 'https:') && !isNativefier;
    this.dedicated_info.useSSL = this.dedicated_info.useSSL || Boolean(this.dedicated_info.address.replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, ''));
    this.dedicated_info.key = this.dedicated_info.key || 'defaultkey';

    this.nakama.add_group_server(this.dedicated_info, () => {
      this.servers = this.nakama.get_all_server_info(true);
      this.link_group(this.dedicated_info.isOfficial, this.dedicated_info.target);
      this.dedicated_info.name = undefined;
      this.dedicated_info.address = undefined;
      this.dedicated_info.target = undefined;
      this.dedicated_info.port = undefined;
      this.dedicated_info.key = undefined;
      this.dedicated_info.useSSL = undefined;
      this.dedicated_info.isOfficial = undefined;
    });
    this.RegisterNewServer.dismiss();
    setTimeout(() => {
      this.add_custom_tog = false;
    }, 1000);
  }

  /** 버튼이 눌렸는지를 검토하여 행동을 분리 */
  isOverrideButtonPressed = false;
  async remove_server(_is_official: string, _target: string) {
    this.isOverrideButtonPressed = true;
    // 그룹서버 리스트 정리
    try {
      await this.nakama.remove_server(_is_official, _target);
    } catch (e) {
      console.log('서버 삭제 오류: ', e);
    }
    this.servers = this.nakama.get_all_server_info(true);
  }

  announce_update_profile = true;

  async ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    if (this.nakama.on_socket_disconnected['group_unlink_by_user'])
      delete this.nakama.on_socket_disconnected['group_unlink_by_user'];
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
            try {
              await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
                encodeURIComponent('info'));
            } catch (e) { }
          });
        // 해당 서버 연결된 채널에 고지
        if (NeedAnnounceUpdate && this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]) {
          let all_channels = Object.keys(this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]);
          if (all_channels)
            all_channels.forEach((channelId: any) => {
              if (this.announce_update_profile)
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

  /** 부드러운 이미지 교체를 위한 이미지 임시 배정 */
  tmp_img: string;
  /** 사용자 주소 입력 */
  url_input: string;
  /** 들어오기 직전 프로필 정보 백업 */
  original_profile = {};

  p5canvas: p5;

  async check_user_content() {
    try {
      let is_exist = await this.indexed.checkIfFileExist('servers/self/content.pck');
      if (is_exist) {
        await this.global.CreateGodotIFrame('my_content', {
          ext: 'pck',
          path: 'servers/self/content.pck',
        });
      } else throw '로컬에 준비된 파일 없음';
    } catch (e) {
      console.log('check_user_content: ', e);
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
        console.log('update_content_from_server: ', e);
        continue;
      }
    }
    if (is_saved) {
      this.global.godot.remove();
      await this.global.CreateGodotIFrame('my_content', {
        ext: 'pck',
        path: 'servers/self/content.pck',
      });
    }
  }

  change_content() {
    document.getElementById(this.content_sel_id).click();
  }
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      this.global.godot.remove();
      let this_file: FileInfo = {};
      this_file.filename = ev.target.files[0].name;
      this_file.file_ext = ev.target.files[0].name.split('.').pop() || ev.target.files[0].type || this.lang.text['ChatRoom']['unknown_ext'];
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
      this_file.blob = ev.target.files[0];
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
                if (this.announce_update_profile)
                  servers[i].socket.writeChatMessage(channelId, {
                    user_update: 'modify_content',
                    noti_form: `: ${this.original_profile['display_name']}`,
                  });
              });
          } catch (e) {
            console.log('inputFileSelected: ', e);
            continue;
          }
        }
      else await this.indexed.saveBlobToUserPath(ev.target.files[0], this_file.path);
      loading.dismiss();
      await this.global.CreateGodotIFrame('my_content', {
        ext: 'pck',
        path: 'servers/self/content.pck',
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
        console.log('remove_content: ', e);
      }
      try {
        let all_channels = Object.keys(this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]);
        if (all_channels.length)
          all_channels.forEach((channelId: any) => {
            if (this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target][channelId]['status'] != 'missing')
              if (this.announce_update_profile)
                servers[i].socket.writeChatMessage(channelId, {
                  user_update: 'remove_content',
                  noti_form: `: ${this.original_profile['display_name']}`,
                });
          });
      } catch (e) {
        console.log('변경을 알릴 채널 없음: ', e);
      }
      await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
        encodeURIComponent('content'));
    }
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
        p.noCanvas();
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
        try {
          await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
            encodeURIComponent('image'));
        } catch (e) { }
        await servers[i].client.updateAccount(servers[i].session, {
          avatar_url: v.acks[0].version,
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
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
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
  @ViewChild('ToggleOnline') ToggleOnline: IonToggle;
  @ViewChild('ServersList') ServersList: IonAccordionGroup;
  async toggle_online() {
    this.nakama.users.self['online'] = this.ToggleOnline.checked;
    if (this.ToggleOnline.checked) {
      this.announce_update_profile = false;
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
        await this.nakama.init_all_sessions();
        if (!this.servers.length) { // 사설 서버가 없다면 개발 테스트 서버로 연결
          await this.nakama.WatchAdsAndGetDevServerInfo();
          this.servers = this.nakama.get_all_server_info(true);
        }
      } catch (e) {
        this.nakama.users.self['online'] = false;
        this.ToggleOnline.checked = false;
      }
    } else {
      this.nakama.logout_all_server();
      delete this.nakama.users.self['password'];
      this.nakama.save_groups_with_less_info();
      this.nakama.rearrange_channels();
    }
    this.ServersList.value = this.ToggleOnline.checked ? 'open' : undefined;
    this.p5canvas.loop();
  }

  imageURL_disabled = false;
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    this.imageURL_disabled = true;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      clipboard.read().then(v => {
        this.check_if_clipboard_available(v);
      });
    } else {
      this.mClipboard.paste().then(v => {
        this.check_if_clipboard_available(v);
      }, e => {
        console.log('클립보드 자료받기 오류: ', e);
      });
    }
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  check_if_clipboard_available(v: string) {
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
  }

  @ViewChild('RegisterNewServer') RegisterNewServer: IonModal;

  OpenNewServerForm() {
    this.RegisterNewServer.present();
  }

  copy_id() {
    this.mClipboard.copy(this.session_uid)
      .catch(_e => clipboard.write(this.session_uid));
  }

  async go_back() {
    try {
      await this.modalCtrl.dismiss();
    } catch (e) { }
  }
}

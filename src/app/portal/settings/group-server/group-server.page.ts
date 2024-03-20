// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonModal, LoadingController, ModalController, NavController, NavParams } from '@ionic/angular';
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
    public global: GlobalActService,
    private loadingCtrl: LoadingController,
    private mClipboard: Clipboard,
    private navCtrl: NavController,
    private navParams: NavParams,
    private modalCtrl: ModalController,
  ) { }

  info: string;
  servers: ServerInfo[];

  /** 서버 정보가 있는 경우 uid 받기 */
  session_uid = '';

  BackButtonPressed = false;
  gsCanvasDiv: HTMLElement;
  ngOnInit() {
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.navCtrl.back();
    };

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
      this.p5canvas['ChangeImageSmooth'](img_url);
    }
    setTimeout(() => {
      this.check_user_content();
    }, 150);
    this.nakama.socket_reactive['self_profile_content_update'] = () => {
      this.update_content_from_server();
    }
    this.announce_update_profile = this.original_profile['display_name'] !== undefined;

    if (this.navParams.data['target']) {
      let isOfficial = this.navParams.get('isOfficial');
      let target = this.navParams.get('target');
      try {
        this.session_uid = this.nakama.servers[isOfficial][target].session.user_id;
      } catch (e) { } // 로컬 채널은 uid 설정 무시
    }
  }

  /** 모바일 PWA 여부를 검토하여 하단 modal 시작 높이를 조정 */
  isMobilePWA = false;
  CanAddTestServer = false;
  OnlineToggle = false;
  ShowServerList = false;
  ionViewWillEnter() {
    this.gsCanvasDiv = document.getElementById('GroupServerCanvasDiv');
    this.OnlineToggle = this.nakama.users.self['online'];
    this.p5canvas = new p5((p: p5) => {
      const LERP_SIZE = .025;
      let nameDiv: p5.Element;
      let nameEditDiv: p5.Element;
      let selected_image: p5.Element;
      /** 변경 전 이미지 */
      let trashed_image: p5.Element;
      let FadeOutTrashedLerp = 1;
      p.setup = () => {
        p.noCanvas();
        p.pixelDensity(1);
        let imgDiv = p.createDiv();
        const IMAGE_SIZE = '156px';
        // 사용자 이미지
        imgDiv.style('width', IMAGE_SIZE);
        imgDiv.style('height', IMAGE_SIZE);
        imgDiv.style('position', 'absolute');
        imgDiv.style('top', '120px');
        imgDiv.style('left', '50%');
        imgDiv.style('transform', 'translateX(-50%)');
        imgDiv.style('border-radius', IMAGE_SIZE);
        imgDiv.style('background-image', 'url(assets/data/avatar.svg)');
        imgDiv.style('background-position', 'center');
        imgDiv.style('background-repeat', 'no-repeat');
        imgDiv.style('background-size', 'cover');
        imgDiv.parent(this.gsCanvasDiv);
        imgDiv.elt.onclick = () => {
          this.change_img_from_file();
        }
        // 온라인 표시등
        let OnlineLamp = p.createDiv();
        const LAMP_SIZE = '36px';
        OnlineLamp.style('background-color', this.OnlineToggle ? this.statusBar.colors['online'] : this.statusBar.colors['offline']);
        OnlineLamp.style('width', LAMP_SIZE);
        OnlineLamp.style('height', LAMP_SIZE);
        OnlineLamp.style('position', 'absolute');
        OnlineLamp.style('top', '128px');
        OnlineLamp.style('left', `${this.gsCanvasDiv.clientWidth / 2 + 38}px`);
        OnlineLamp.style('border-radius', LAMP_SIZE);
        OnlineLamp.parent(this.gsCanvasDiv);
        OnlineLamp.elt.onclick = () => {
          this.toggle_online();
        }
        p['OnlineLamp'] = OnlineLamp;
        // 부드러운 이미지 전환
        selected_image = p.createImg(this.nakama.users.self['img'], 'profile_img');
        selected_image.style('width', IMAGE_SIZE);
        selected_image.style('height', IMAGE_SIZE);
        selected_image.style('border-radius', IMAGE_SIZE);
        selected_image.style('position', 'absolute');
        selected_image.style('object-fit', 'cover');
        if (!this.nakama.users.self['img'])
          selected_image.hide();
        selected_image.parent(imgDiv);
        trashed_image = p.createImg(undefined, 'before_img');
        trashed_image.style('width', IMAGE_SIZE);
        trashed_image.style('height', IMAGE_SIZE);
        trashed_image.style('border-radius', IMAGE_SIZE);
        trashed_image.style('position', 'absolute');
        trashed_image.style('object-fit', 'cover');
        trashed_image.hide();
        trashed_image.parent(imgDiv);
        p['ChangeImageSmooth'] = (url: string) => {
          if (!url) {
            trashed_image.elt.src = selected_image.elt.src;
            trashed_image.show();
          } else {
            trashed_image.elt.src = undefined;
            trashed_image.hide();
          }
          selected_image.elt.src = url;
          FadeOutTrashedLerp = 1;
          p.loop();
          this.nakama.users.self['img'] = url;
          this.sync_to_all_server();
          let file_sel = document.getElementById(this.file_sel_id);
          file_sel['value'] = '';
          if (url) {
            selected_image.show();
          } else selected_image.hide();
        }
        const NAME_DECK_Y = 330;
        const NAME_SIZE = '36px';
        // 사용자 이름 (display)
        nameDiv = p.createDiv(this.nakama.users.self['display_name'] || this.lang.text['Profile']['noname_user']);
        nameDiv.style('position', 'absolute');
        nameDiv.style('top', `${NAME_DECK_Y}px`);
        nameDiv.style('left', '50%');
        nameDiv.style('font-size', NAME_SIZE);
        nameDiv.style('font-weight', 'bold');
        nameDiv.style('transform', 'translateX(-50%)');
        nameDiv.style('width', '80%');
        nameDiv.style('text-align', 'center');
        nameDiv.parent(this.gsCanvasDiv);
        nameDiv.elt.onclick = () => { // 편집 모드로 변경
          nameEditDiv.value(this.nakama.users.self['display_name'] ? nameDiv.html() : '');
          nameEditDiv.show();
          nameDiv.hide();
          nameEditDiv.elt.focus();
        }
        // 사용자 이름 (input)
        nameEditDiv = p.createInput();
        nameEditDiv.style('position', 'absolute');
        nameEditDiv.style('top', `${NAME_DECK_Y - 3}px`);
        nameEditDiv.style('left', '50%');
        nameEditDiv.style('transform', 'translateX(-50%)');
        nameEditDiv.style('font-size', NAME_SIZE);
        nameEditDiv.style('font-weight', 'bold');
        nameEditDiv.style('width', '80%');
        nameEditDiv.style('text-align', 'center');
        nameEditDiv.attribute('placeholder', this.lang.text['Profile']['name_placeholder'])
        nameDiv.style('text-align', 'center');
        nameEditDiv.parent(this.gsCanvasDiv);
        nameEditDiv.hide();
        nameEditDiv.elt.addEventListener('focusout', () => {
          this.nakama.users.self['display_name'] = nameEditDiv.value();
          nameDiv.html(`${nameEditDiv.value() || this.lang.text['Profile']['noname_user']}`);
          nameEditDiv.hide();
          nameDiv.show();
        });
        // 사용자 정보 입력
        let InputForm = p.createDiv();
        InputForm.style('position', 'absolute');
        InputForm.style('top', '480px');
        InputForm.style('left', '50%');
        InputForm.style('transform', 'translateX(-50%)');
        InputForm.style('width', '80%');
        InputForm.style('max-width', '384px');
        InputForm.style('height', '180px');
        InputForm.style('background-color', '#8888');
        InputForm.style('text-align', 'center');
        InputForm.style('border-radius', '24px');
        InputForm.parent(this.gsCanvasDiv);
        let EmailInput = p.createInput(this.nakama.users.self['email']);
        EmailInput.id('email_input');
        EmailInput.style('position', 'absolute');
        EmailInput.style('top', '28px');
        EmailInput.style('left', '50%');
        EmailInput.style('transform', 'translateX(-50%)');
        EmailInput.style('width', '50%');
        EmailInput.style('text-align', 'center');
        EmailInput.attribute('placeholder', 'test@example.com');
        EmailInput.parent(InputForm);
        EmailInput.elt.onchange = () => {
          this.nakama.users.self['email'] = EmailInput.value();
          this.email_modified();
        }
        p['EmailInput'] = EmailInput;
        let PasswordInput = p.createInput();
        PasswordInput.style('position', 'absolute');
        PasswordInput.style('top', '67px');
        PasswordInput.style('left', '50%');
        PasswordInput.style('transform', 'translateX(-50%)');
        PasswordInput.style('width', '50%');
        PasswordInput.style('text-align', 'center');
        PasswordInput.attribute('type', 'password');
        PasswordInput.attribute('placeholder', this.lang.text['Profile']['at_least']);
        PasswordInput.parent(InputForm);
        PasswordInput.elt.onchange = () => {
          this.nakama.users.self['password'] = PasswordInput.value();
        }
        p['PasswordInput'] = PasswordInput;
        if (this.OnlineToggle) {
          EmailInput.hide();
          PasswordInput.hide();
        }
        let LoginButton = p.createButton(this.OnlineToggle ? this.lang.text['Profile']['LogOut'] : this.lang.text['Profile']['login_toggle']);
        LoginButton.style('position', 'absolute');
        LoginButton.style('top', '112px');
        LoginButton.style('left', '50%');
        LoginButton.style('transform', 'translateX(-50%)');
        LoginButton.style('text-align', 'center');
        LoginButton.style('font-size', '24px');
        LoginButton.style('border-radius', '16px');
        LoginButton.style('padding', '12px 30px');
        LoginButton.attribute('placeholder', this.lang.text['Profile']['at_least']);
        LoginButton.parent(InputForm);
        LoginButton.elt.onclick = () => {
          this.toggle_online();
        }
        p['LoginButton'] = LoginButton;
      }
      p.draw = () => {
        if (FadeOutTrashedLerp > 0) {
          FadeOutTrashedLerp -= LERP_SIZE;
          trashed_image.style('opacity', `${FadeOutTrashedLerp}`);
          selected_image.style('opacity', `${1 - FadeOutTrashedLerp}`);
        }
        if (this.nakama.users.self['online']) {
          if (this.lerpVal < 1) {
            this.lerpVal += LERP_SIZE;
          } else {
            this.lerpVal = 1;
          }
        } else {
          if (this.lerpVal > 0) {
            this.lerpVal -= LERP_SIZE;
          } else {
            this.lerpVal = 0;
          }
        }
        selected_image.style('filter', `grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)})`);
        trashed_image.style('filter', `grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)})`);
        if (FadeOutTrashedLerp <= 0 && (this.lerpVal >= 1 || this.lerpVal <= 0))
          p.noLoop();
      }
      p.windowResized = () => {
        p['OnlineLamp'].style('left', `${this.gsCanvasDiv.clientWidth / 2 + 38}px`);
      }
    });
    this.ShowServerList = this.OnlineToggle;
    if (!this.nakama.users.self['email'])
      document.getElementById('email_input').focus();
    this.CanAddTestServer =
      Object.keys(this.nakama.servers['official']).length == 0
      && Object.keys(this.nakama.servers['unofficial']).length != 0;
    this.isMobilePWA = isPlatform == 'MobilePWA';
  }

  /** 사용자가 개발 테스트 서버를 사용하기를 원함 */
  async add_dev_test_server() {
    this.CanAddTestServer = !(await this.nakama.WatchAdsAndGetDevServerInfo(true));
    this.servers = this.nakama.get_all_server_info(true);
  }

  link_group(_is_official: string, _target: string) {
    if (this.isOverrideButtonPressed) {
      this.isOverrideButtonPressed = false;
      return;
    }
    if (this.statusBar.groupServer[_is_official][_target] == 'offline')
      this.nakama.link_group(_is_official, _target);
    else try {
      this.nakama.servers[_is_official][_target].socket.disconnect(true);
    } catch (e) {
      this.nakama.OnSocketDisconnect(_is_official, _target);
    }
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
  async change_img_from_file() {
    // 클립보드로부터 받아오기 시도 후 실패시 파일 선택
    if (this.nakama.users.self['img']) {
      this.p5canvas['ChangeImageSmooth']();
    } else try {
      let v = await clipboard.read();
      await this.check_if_clipboard_available(v);
    } catch (e) {
      try {
        let v = await this.mClipboard.paste();
        await this.check_if_clipboard_available(v);
      } catch (e) {
        document.getElementById(this.file_sel_id).click();
      }
    }
  }

  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let updater = setInterval(() => { }, 110);
    setTimeout(() => {
      clearInterval(updater);
    }, 1500);
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v: any) => { this.p5canvas['ChangeImageSmooth'](v['canvas'].toDataURL()) });
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
      this.p5canvas['PasswordInput'].value('');
    }
  }
  /** 채도 변화자 */
  lerpVal: number;
  async toggle_online() {
    this.OnlineToggle = !this.OnlineToggle;
    this.nakama.users.self['online'] = this.OnlineToggle;
    if (this.OnlineToggle) {
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
        this.p5canvas['EmailInput'].hide();
        this.p5canvas['PasswordInput'].hide();
        this.p5canvas['PasswordInput'].value('');
      } catch (e) {
        this.nakama.users.self['online'] = false;
        this.OnlineToggle = false;
      }
    } else {
      this.nakama.logout_all_server();
      this.p5canvas['EmailInput'].show();
      this.p5canvas['PasswordInput'].show();
      this.p5canvas['PasswordInput'].value('');
      delete this.nakama.users.self['password'];
      this.nakama.save_groups_with_less_info();
      this.nakama.rearrange_channels();
    }
    this.p5canvas['LoginButton'].html(this.OnlineToggle ? this.lang.text['Profile']['LogOut'] : this.lang.text['Profile']['login_toggle']);
    this.p5canvas['OnlineLamp'].style('background-color', this.OnlineToggle ? this.statusBar.colors['online'] : this.statusBar.colors['offline']);
    this.ShowServerList = this.OnlineToggle;
    this.p5canvas.loop();
  }

  async check_if_clipboard_available(v: string) {
    try {
      if (v.indexOf('http') == 0) {
        await new Promise((done, err) => {
          let img = document.createElement('img');
          img.src = v;
          img.onload = () => {
            this.p5canvas['ChangeImageSmooth'](v);
            img.remove();
            done(undefined);
          }
          img.onerror = () => {
            img.remove();
            err();
          }
        });
      } else throw 'URL 주소가 아님';
    } catch (e) {
      try {
        if (v.indexOf('data:image') == 0) {
          this.nakama.limit_image_size(v, (rv) => this.p5canvas['ChangeImageSmooth'](rv['canvas'].toDataURL()));
        } else throw 'DataURL 주소가 아님';
      } catch (e) {
        throw '사용불가 이미지';
      }
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

  /** 채널 채팅에서 넘어온 경우 modal 페이지임 */
  async go_back() {
    try {
      await this.modalCtrl.dismiss();
    } catch (e) { }
  }
}

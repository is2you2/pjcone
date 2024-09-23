import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonModal, NavController } from '@ionic/angular';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MatchOpCode, NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { isNativefier, isPlatform } from 'src/app/app.component';
import * as p5 from 'p5';
import { GlobalActService } from 'src/app/global-act.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-group-server',
  templateUrl: './group-server.page.html',
  styleUrls: ['./group-server.page.scss'],
})
export class GroupServerPage implements OnInit, OnDestroy {

  constructor(
    public nakama: NakamaService,
    private p5toast: P5ToastService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    public global: GlobalActService,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  info: string;
  servers: ServerInfo[];

  /** 서버 정보가 있는 경우 uid 받기 */
  session_uid = '';

  gsCanvasDiv: HTMLElement;
  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true);

    this.file_sel_id = `self_profile_${new Date().getTime()}`;
    this.original_profile = JSON.parse(JSON.stringify(this.nakama.users.self));
    if (!this.nakama.users.self['img']) {
      this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
        if (e && v) this.nakama.users.self['img'] = v.replace(/"|\\|=/g, '');
      });
    }
    this.nakama.socket_reactive['profile'] = (img_url: string) => {
      if (this.p5canvas) this.p5ChangeImageSmooth(img_url);
    }
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      if (navParams) {
        let isOfficial = navParams.isOfficial;
        let target = navParams.target;
        try {
          this.session_uid = this.nakama.servers[isOfficial][target].session.user_id;
        } catch (e) { } // 로컬 채널은 uid 설정 무시
      }
      this.initialize();
    });
  }

  /** 모바일 PWA 여부를 검토하여 하단 modal 시작 높이를 조정 */
  isMobilePWA = false;
  CanAddTestServer = false;
  OnlineToggle = false;
  ShowServerList = false;
  isClickDisplayNameEdit = false;
  initialize() {
    this.gsCanvasDiv = document.getElementById('GroupServerCanvasDiv');
    this.OnlineToggle = this.nakama.users.self['online'];
    this.p5canvas = new p5((p: p5) => {
      const LERP_SIZE = .025;
      let nameDiv: p5.Element;
      let nameSpan: p5.Element;
      let nameEditDiv: p5.Element;
      let selected_image: p5.Element;
      /** 변경 전 이미지 */
      let trashed_image: p5.Element;
      let FadeOutTrashedLerp = 1;
      /** 사용자 색상 표시 */
      let UserColorGradient: p5.Element;
      let user_rgb_color = '0, 0, 0';
      let userColorLerp = 0;
      let hasColorLerp = Boolean(this.session_uid);
      let imgDiv: p5.Element;
      let EditingName = false;
      let OnlineLamp: p5.Element;
      let LoginButton: p5.Element;
      let InputForm = p.createDiv();
      p.setup = () => {
        if (hasColorLerp) {
          let user_color = p.color(`#${(this.session_uid.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6)}`);
          user_rgb_color = `${p.red(user_color)}, ${p.green(user_color)}, ${p.blue(user_color)}`;
          UserColorGradient = p.createDiv();
          UserColorGradient.style('width', '100%');
          UserColorGradient.style('height', '100%');
          UserColorGradient.style('background-image', `linear-gradient(to top, rgba(${user_rgb_color}, 0), rgba(${user_rgb_color}, 0))`);
          UserColorGradient.parent(this.gsCanvasDiv);
        }
        p.noCanvas();
        p.pixelDensity(1);
        imgDiv = p.createDiv();
        const IMAGE_SIZE = 156;
        // 사용자 이미지
        imgDiv.style('width', `${IMAGE_SIZE}px`);
        imgDiv.style('height', `${IMAGE_SIZE}px`);
        imgDiv.style('position', 'absolute');
        imgDiv.style('top', '120px');
        imgDiv.style('left', '50%');
        imgDiv.style('transform', 'translateX(-50%)');
        imgDiv.style('border-radius', `${IMAGE_SIZE}px`);
        imgDiv.style('background-image', 'url(assets/data/avatar.svg)');
        imgDiv.style('background-position', 'center');
        imgDiv.style('background-repeat', 'no-repeat');
        imgDiv.style('background-size', 'cover');
        imgDiv.style('cursor', 'pointer');
        imgDiv.parent(this.gsCanvasDiv);
        imgDiv.elt.onclick = () => {
          this.change_img_from_file();
        }
        // 온라인 표시등
        OnlineLamp = p.createDiv();
        const LAMP_SIZE = '36px';
        OnlineLamp.style('background-color', this.OnlineToggle ? this.statusBar.colors['online'] : this.statusBar.colors['offline']);
        OnlineLamp.style('width', LAMP_SIZE);
        OnlineLamp.style('height', LAMP_SIZE);
        OnlineLamp.style('position', 'absolute');
        OnlineLamp.style('top', '8px');
        OnlineLamp.style('left', `${IMAGE_SIZE - 38}px`);
        OnlineLamp.style('border-radius', LAMP_SIZE);
        OnlineLamp.style('cursor', 'pointer');
        OnlineLamp.style('z-index', '1');
        OnlineLamp.parent(imgDiv);
        OnlineLamp.elt.onclick = () => {
          this.toggle_online();
        }
        // 부드러운 이미지 전환
        selected_image = p.createImg(this.nakama.users.self['img'], 'profile_img');
        selected_image.style('width', `${IMAGE_SIZE}px`);
        selected_image.style('height', `${IMAGE_SIZE}px`);
        selected_image.style('border-radius', `${IMAGE_SIZE}px`);
        selected_image.style('position', 'absolute');
        selected_image.style('object-fit', 'cover');
        if (!this.nakama.users.self['img'])
          selected_image.hide();
        selected_image.parent(imgDiv);
        trashed_image = p.createImg(undefined, 'before_img');
        trashed_image.style('width', `${IMAGE_SIZE}px`);
        trashed_image.style('height', `${IMAGE_SIZE}px`);
        trashed_image.style('border-radius', `${IMAGE_SIZE}px`);
        trashed_image.style('position', 'absolute');
        trashed_image.style('object-fit', 'cover');
        trashed_image.hide();
        trashed_image.parent(imgDiv);
        this.p5ChangeImageSmooth = (url: string) => {
          imgDiv.style('background-image', 'url(assets/data/avatar.svg)');
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
        // 사용자 정보 모음 div (밀림 구성 방지용)
        let ExceptPic = p.createDiv();
        ExceptPic.style('width', '100%');
        ExceptPic.style('position', 'absolute');
        ExceptPic.style('top', '330px');
        ExceptPic.style('display', 'flex');
        ExceptPic.style('flex-direction', 'column');
        ExceptPic.parent(this.gsCanvasDiv);
        const NAME_SIZE = '36px';
        // 사용자 이름 (display)
        nameDiv = p.createDiv();
        nameDiv.style('font-size', NAME_SIZE);
        nameDiv.style('font-weight', 'bold');
        nameDiv.style('align-self', 'center');
        nameDiv.style('width', '80%');
        nameDiv.style('text-align', 'center');
        nameDiv.parent(ExceptPic);
        nameSpan = p.createSpan(this.nakama.users.self['display_name'] || this.lang.text['Profile']['noname_user']);
        nameSpan.parent(nameDiv);
        let editSpan = p.createSpan('<ion-icon name="pencil-outline" style="width: 24px; height: 24px; margin-left: 8px"></ion-icon>');
        editSpan.parent(nameDiv);
        nameDiv.elt.onclick = () => { // 편집 모드로 변경
          EditingName = true;
          nameEditDiv.value(this.nakama.users.self['display_name'] ? nameSpan.html() : '');
          nameEditDiv.show();
          nameDiv.hide();
          nameEditDiv.elt.focus();
          this.isClickDisplayNameEdit = true;
        }
        // 사용자 이름 (input)
        nameEditDiv = p.createInput();
        nameEditDiv.style('font-size', NAME_SIZE);
        nameEditDiv.style('font-weight', 'bold');
        nameEditDiv.style('align-self', 'center');
        nameEditDiv.style('width', '80%');
        nameEditDiv.style('text-align', 'center');
        nameEditDiv.attribute('placeholder', this.lang.text['Profile']['name_placeholder'])
        nameDiv.style('text-align', 'center');
        nameEditDiv.parent(ExceptPic);
        nameEditDiv.hide();
        nameEditDiv.elt.addEventListener('input', () => {
          this.nakama.users.self['display_name'] = nameEditDiv.value();
        });
        nameEditDiv.elt.addEventListener('focusout', () => {
          EditingName = false;
          this.nakama.users.self['display_name'] = nameEditDiv.value();
          nameSpan.html(`${nameEditDiv.value() || this.lang.text['Profile']['noname_user']}`);
          nameEditDiv.hide();
          nameDiv.show();
        });
        // 사용자 UID
        if (this.session_uid) {
          let uuidDiv = p.createDiv(this.session_uid);
          uuidDiv.style('margin-top', '36px');
          uuidDiv.style('color', 'var(--ion-color-medium)');
          uuidDiv.style('width', '80%');
          uuidDiv.style('text-align', 'center');
          uuidDiv.style('align-self', 'center');
          uuidDiv.style('cursor', 'copy');
          uuidDiv.parent(ExceptPic);
          uuidDiv.elt.onclick = () => {
            this.copy_id();
          }
        }
        // 사용자 정보 입력
        InputForm.style('margin-top', '60px');
        InputForm.style('width', '80%');
        InputForm.style('align-self', 'center');
        InputForm.style('max-width', '384px');
        InputForm.style('height', '180px');
        InputForm.style('background-color', '#8888');
        InputForm.style('text-align', 'center');
        InputForm.style('border-radius', '24px');
        InputForm.style('display', 'flex');
        InputForm.style('flex-direction', 'column');
        InputForm.parent(ExceptPic);
        if (this.OnlineToggle) InputForm.hide();
        let EmailInput = p.createInput(this.nakama.users.self['email']);
        EmailInput.style('align-self', 'center');
        EmailInput.style('margin-top', '24px');
        EmailInput.style('width', '50%');
        EmailInput.style('text-align', 'center');
        EmailInput.attribute('placeholder', 'test@example.com');
        EmailInput.parent(InputForm);
        EmailInput.elt.onchange = () => {
          this.nakama.users.self['email'] = EmailInput.value();
          this.email_modified();
        }
        EmailInput.elt.onkeypress = (ev: any) => {
          if (ev.key == 'Enter') {
            PasswordInput.elt.focus();
          }
        }
        setTimeout(() => {
          if (!this.nakama.users.self['email'])
            EmailInput.elt.focus();
        }, 500);
        setTimeout(() => {
          if (!this.nakama.users.self['email'])
            EmailInput.elt.focus();
        }, 150);
        let PasswordInput = p.createInput();
        PasswordInput.style('margin-top', '10px');
        PasswordInput.style('align-self', 'center');
        PasswordInput.style('width', '50%');
        PasswordInput.style('text-align', 'center');
        PasswordInput.attribute('type', 'password');
        PasswordInput.attribute('placeholder', this.lang.text['Profile']['at_least']);
        PasswordInput.parent(InputForm);
        PasswordInput.elt.onchange = () => {
          this.nakama.users.self['password'] = PasswordInput.value();
        }
        PasswordInput.elt.onkeypress = (ev: any) => {
          if (ev.key == 'Enter') {
            this.nakama.users.self['password'] = PasswordInput.value();
            LoginButton.elt.disabled = true;
            this.toggle_online();
          }
        }
        this.p5PasswordInput = PasswordInput;
        LoginButton = p.createButton(this.OnlineToggle ? this.lang.text['Profile']['LogOut'] : this.lang.text['Profile']['login_toggle']);
        LoginButton.style('margin-top', '17px');
        LoginButton.style('align-self', 'center');
        LoginButton.style('text-align', 'center');
        LoginButton.style('font-size', '24px');
        LoginButton.style('border-radius', '16px');
        LoginButton.style('padding', '12px 30px');
        LoginButton.parent(InputForm);
        LoginButton.elt.onclick = () => {
          LoginButton.elt.disabled = true;
          this.toggle_online();
        }
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
        if (hasColorLerp && userColorLerp < 1)
          userColorLerp += LERP_SIZE;
        selected_image.style('filter', `grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)})`);
        trashed_image.style('filter', `grayscale(${p.lerp(0.9, 0, this.lerpVal)}) contrast(${p.lerp(1.4, 1, this.lerpVal)})`);
        if (hasColorLerp)
          UserColorGradient.style('background-image', `linear-gradient(to top, rgba(${user_rgb_color}, ${p.min(1, userColorLerp) / 2}), rgba(${user_rgb_color}, 0))`);
        if (FadeOutTrashedLerp <= 0 && (this.lerpVal >= 1 || this.lerpVal <= 0) && (!hasColorLerp || userColorLerp >= 1)) {
          if (this.nakama.users.self['img']) imgDiv.style('background-image', '');
          this.OnlineToggle = this.lerpVal >= 1;
          if (this.OnlineToggle) {
            InputForm.hide();
            LoginButton.html(this.lang.text['Profile']['LogOut']);
            OnlineLamp.style('background-color', this.statusBar.colors['online']);
          } else {
            InputForm.show();
            InputForm.style('display', 'flex');
            LoginButton.html(this.lang.text['Profile']['login_toggle']);
            OnlineLamp.style('background-color', this.statusBar.colors['offline']);
          }
          if (this.nakama.users.self['display_name']) {
            nameSpan.html(this.nakama.users.self['display_name']);
            nameEditDiv.value(this.nakama.users.self['display_name']);
          }
          this.ShowServerList = this.OnlineToggle;
          this.p5PasswordInput.value('');
          LoginButton.elt.disabled = false;
          p.noLoop();
        }
      }
      p.keyPressed = (ev: any) => {
        if (ev.code == 'Enter') {
          if (EditingName)
            nameEditDiv.elt.blur();
        }
      }
    });
    this.ShowServerList = this.OnlineToggle;
    this.CanAddTestServer =
      Object.keys(this.nakama.servers['official']).length == 0;
    this.isMobilePWA = isPlatform == 'MobilePWA';
  }

  /** 사용자가 개발 테스트 서버를 사용하기를 원함 */
  async add_dev_test_server() {
    this.CanAddTestServer = !(await this.nakama.WatchAdsAndGetDevServerInfo());
    this.servers = this.nakama.get_all_server_info(true);
  }

  async link_group(_is_official: string, _target: string) {
    if (this.isOverrideButtonPressed) {
      this.isOverrideButtonPressed = false;
      return;
    }
    if (this.statusBar.groupServer[_is_official][_target] == 'offline') {
      await this.nakama.link_group(_is_official, _target);
      this.original_profile = JSON.parse(JSON.stringify(this.nakama.users.self));
    } else try {
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

    let split_fullAddress = (this.dedicated_info.address || '192.168.0.1').split('://');
    let address = split_fullAddress.pop().split(':');
    let protocol = split_fullAddress.pop();
    if (protocol) {
      protocol += ':';
    } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
    this.dedicated_info.address = address[0];
    this.dedicated_info.port = Number(address[1]) || 7350;
    this.dedicated_info.useSSL = (window.location.protocol == 'https:') && !isNativefier;
    this.dedicated_info.useSSL = this.dedicated_info.useSSL || Boolean(protocol == 'https:');
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
    this.alertCtrl.create({
      header: this.lang.text['GroupServer']['RemoveAccountReally'],
      message: this.lang.text['ChatRoom']['CannotUndone'],
      buttons: [{
        text: this.lang.text['UserFsDir']['OK'],
        cssClass: 'redfont',
        handler: async () => {
          try {
            await this.nakama.remove_server(_is_official, _target);
          } catch (e) {
            console.log('서버 삭제 오류: ', e);
          }
          // 그룹서버 리스트 정리
          this.servers = this.nakama.get_all_server_info(true);
        }
      }]
    }).then(v => v.present());
  }

  /** 프로필이 변경됨 알림이 필요한지 여부 */
  announce_update_profile = false;

  async ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Escape'];
    if (this.nakama.on_socket_disconnected['group_unlink_by_user'])
      delete this.nakama.on_socket_disconnected['group_unlink_by_user'];
    delete this.nakama.socket_reactive['profile'];
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
        if (this.nakama.users.self['display_name'] != this.original_profile['display_name'])
          try {
            await servers[i].client.updateAccount(servers[i].session, {
              display_name: this.nakama.users.self['display_name'],
            });
            try {
              await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
                encodeURIComponent('info'));
            } catch (e) { }
          } catch (e) { }
        // 해당 서버 연결된 채널에 고지
        if (this.isClickDisplayNameEdit && this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]) {
          let all_channels = Object.keys(this.nakama.channels_orig[servers[i].info.isOfficial][servers[i].info.target]);
          if (all_channels) {
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
      }
      this.nakama.save_self_profile();
    }
  }

  ngOnDestroy() {
    this.route.queryParams['unsubscribe']();
    this.p5canvas.remove();
  }

  /** 부드러운 이미지 교체를 위한 이미지 임시 배정 */
  tmp_img: string;
  /** 사용자 주소 입력 */
  url_input: string;
  /** 들어오기 직전 프로필 정보 백업 */
  original_profile = {};

  p5canvas: p5;
  p5ChangeImageSmooth: Function;
  p5PasswordInput: p5.Element;

  /** 모든 서버에 프로필 이미지 변경됨을 고지 */
  async sync_to_all_server() {
    let servers = this.nakama.get_all_online_server();
    this.nakama.save_self_profile();
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.nakama.users.self['img']), 'servers/self/profile.img');
    this.tmp_img = '';
    for (let i = 0, j = servers.length; i < j; i++) {
      if (this.nakama.users.self['img']) {
        try {
          await servers[i].client.writeStorageObjects(servers[i].session, [{
            collection: 'user_public',
            key: 'profile_image',
            value: { img: this.nakama.users.self['img'] },
            permission_read: 2,
            permission_write: 1,
          }]);
          await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
            encodeURIComponent('image'));
        } catch (e) {
          console.log('inputImageSelected_err: ', e);
        }
      } else {
        try {
          await servers[i].client.deleteStorageObjects(servers[i].session, {
            object_ids: [{
              collection: 'user_public',
              key: 'profile_image',
            }]
          });
          await servers[i].socket.sendMatchState(this.nakama.self_match[servers[i].info.isOfficial][servers[i].info.target].match_id, MatchOpCode.EDIT_PROFILE,
            encodeURIComponent('image'));
        } catch (e) {
          console.error('inputImageSelected_err: ', e);
        }
      }
      try { // 현재 온라인인 사람들에게만 일시적으로 전달됨
        await servers[i].client.rpc(
          servers[i].session,
          'send_noti_all_fn', {
          user_id: servers[i].session.user_id,
          noti_id: MatchOpCode.USER_PROFILE_IMAGE_CHANGED,
          persistent: false,
        });
      } catch (e) {
        console.log('서버에 알리기 실패: ', e);
      }
      this.announce_update_profile = false;
    }
  }

  file_sel_id = '';
  async change_img_from_file() {
    // 클립보드로부터 받아오기 시도 후 실패시 파일 선택
    this.announce_update_profile = true;
    if (this.nakama.users.self['img']) {
      this.p5ChangeImageSmooth();
    } else try {
      let clipboard = await this.global.GetValueFromClipboard();
      switch (clipboard.type) {
        case 'text/plain':
          await this.check_if_clipboard_available(clipboard.value);
          break;
        case 'image/png':
          this.inputImageSelected({ target: { files: [clipboard.value] } })
          return;
      }
    } catch (e) {
      document.getElementById(this.file_sel_id).click();
    }
  }

  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let updater = setInterval(() => { }, 110);
    setTimeout(() => {
      clearInterval(updater);
    }, 1500);
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v: any) => { this.p5ChangeImageSmooth(v['canvas'].toDataURL()) });
    let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
    input.value = '';
  }

  /** 온라인 전환 자동처리 가능여부 */
  can_auto_modified = false;
  ionViewDidEnter() {
    this.can_auto_modified = true;
    this.global.p5KeyShortCut['Escape'] = () => {
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
      this.p5PasswordInput.value('');
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
        let count_server = await this.nakama.init_all_sessions();
        if (!count_server && this.nakama.AfterLoginAct.length)
          await this.nakama.WatchAdsAndGetDevServerInfo();
        this.original_profile = JSON.parse(JSON.stringify(this.nakama.users.self));
      } catch (e) {
        this.nakama.users.self['online'] = false;
        this.OnlineToggle = false;
      }
    } else {
      this.nakama.logout_all_server();
      delete this.nakama.users.self['password'];
      this.nakama.groups['official'] = {};
      this.nakama.groups['unofficial'] = {};
      this.nakama.save_groups_with_less_info();
      this.nakama.channels_orig['official'] = {};
      this.nakama.channels_orig['unofficial'] = {};
      this.nakama.rearrange_channels();
      this.nakama.posts_orig['official'] = {};
      this.nakama.posts_orig['unofficial'] = {};
      this.nakama.rearrange_posts();
      this.nakama.post_counter['official'] = {};
      this.nakama.post_counter['unofficial'] = {};
      this.nakama.save_post_counter();
      // 로컬에 저장된 서버 연관 파일들 전부 삭제
      let official_list = await this.indexed.GetFileListFromDB('servers/official');
      official_list.forEach(path => this.indexed.removeFileFromUserPath(path));
      let unofficial_list = await this.indexed.GetFileListFromDB('servers/unofficial');
      unofficial_list.forEach(path => this.indexed.removeFileFromUserPath(path));
    }
    this.p5canvas.loop();
  }

  async check_if_clipboard_available(v: string) {
    try {
      if (v.indexOf('http') == 0) {
        await new Promise((done, err) => {
          let img = document.createElement('img');
          img.src = v;
          img.onload = () => {
            this.p5ChangeImageSmooth(v);
            img.onload = null;
            img.onerror = null;
            img.remove();
            done(undefined);
          }
          img.onerror = () => {
            img.onload = null;
            img.onerror = null;
            img.remove();
            err();
          }
        });
      } else throw 'URL 주소가 아님';
    } catch (e) {
      try {
        if (v.indexOf('data:image') == 0) {
          this.nakama.limit_image_size(v, (rv) => this.p5ChangeImageSmooth(rv['canvas'].toDataURL()));
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
    this.global.WriteValueToClipboard('text/plain', this.session_uid);
  }
}

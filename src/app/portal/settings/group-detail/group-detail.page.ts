import { Component, OnDestroy, OnInit } from '@angular/core';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { Notification } from '@heroiclabs/nakama-js';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { GlobalActService } from 'src/app/global-act.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, NavController } from '@ionic/angular';
import * as p5 from 'p5';


@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
})
export class GroupDetailPage implements OnInit, OnDestroy {

  constructor(
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
  ) { }
  ngOnDestroy() {
    if (this.p5canvas) this.p5canvas.remove();
    delete this.nakama.socket_reactive['group_detail'];
    this.route.queryParams['unsubscribe']();
  }

  QRCodeSRC: any;
  /** 그룹 정보 */
  info: any;
  /** 내가 이 그룹의 방장인지 여부 */
  has_superadmin = false;
  /** 진입시 그룹 정보 */
  info_orig: any;

  isOfficial: string;
  target: string

  ngOnInit() {
    this.route.queryParams.subscribe(_p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        if (!navParams) return;
        this.info = navParams.info;
        this.file_sel_id = `group_detail_${this.info.id}_${new Date().getTime()}}`;
        this.info_orig = JSON.parse(JSON.stringify(navParams.info));
        this.nakama.socket_reactive['group_detail'] = this;
        this.global.GetHeaderAddress().then(address => {
          this.QRCodeSRC = this.global.readasQRCodeFromString(
            `${address}?group=${this.info.name},${this.info.id}`.replace(' ', '%20'));
        });
        if (!this.info.server) this.info.server = navParams.server;
        this.isOfficial = this.info.server['isOfficial'];
        this.target = this.info.server['target'];
        // 사용자 정보가 있다면 로컬 정보 불러오기 처리
        if (this.info['users'] && this.info['users'].length) {
          for (let i = 0, j = this.info['users'].length; i < j; i++)
            if (this.info['users'][i].is_me) { // 정보상 나라면
              // 정보를 로컬에 동기화
              this.info['users'][i]['user'] = this.nakama.users.self;
              this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
                if (e && v) this.nakama.users.self['img'] = v.replace(/"|\\|=/g, '');
              });
            } else if (this.info['users'][i]['user']['id']) { // 다른 사람들의 프로필 이미지
              this.info['users'][i]['user'] = this.nakama.load_other_user(this.info['users'][i]['user']['id'], this.isOfficial, this.target);
            } else this.info['users'].splice(i, 1);
        }
        try {
          this.has_superadmin = this.info['creator_id'] == this.nakama.servers[this.isOfficial][this.target].session.user_id;
        } catch (e) {
          console.log('check is admin failed: ', e);
          this.has_superadmin = false;
        }
        // 그룹 이미지 업데이트
        try {
          this.nakama.servers[this.isOfficial][this.target].client.readStorageObjects(
            this.nakama.servers[this.isOfficial][this.target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${this.info.id}`,
              user_id: this.info.creator_id,
            }]
          }).then(v => {
            if (v.objects.length) {
              this.nakama.groups[this.isOfficial][this.target][this.info.id]['img'] = v.objects[0].value['img'].replace(/"|=|\\/g, '');
              this.indexed.saveTextFileToUserPath(v.objects[0].value['img'], `servers/${this.isOfficial}/${this.target}/groups/${this.info.id}.img`);
            } else {
              if (this.info['status'] != 'missing') {
                delete this.nakama.groups[this.isOfficial][this.target][this.info.id]['img'];
                this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/groups/${this.info.id}.img`);
              }
            }
          });
        } catch (e) {
          console.log(e);
        }
      } catch (e) {
        console.log('그룹 상세 페이지 진입 오류: ', e);
      }
    });
  }

  ionViewDidEnter() {
    this.CreateDrop();
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  p5canvas: p5;
  CreateDrop() {
    let parent = document.getElementById('p5Drop_group_detail');
    if (!this.p5canvas)
      this.p5canvas = new p5((p: p5) => {
        p.setup = () => {
          let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
          canvas.parent(parent);
          p.pixelDensity(.1);
          canvas.drop(async (file: any) => {
            if (this.nakama.PromotedGroup[this.isOfficial][this.target][this.info.id]) // 권한이 있는 경우
              this.inputImageSelected({ target: { files: [file.file] } });
          });
        }
        p.mouseMoved = (ev: any) => {
          if (ev['dataTransfer']) {
            parent.style.pointerEvents = 'all';
            parent.style.backgroundColor = '#0008';
          } else {
            parent.style.pointerEvents = 'none';
            parent.style.backgroundColor = 'transparent';
          }
        }
      });
  }

  /** 그룹 사용자 리스트 업데이트 */
  update_from_notification(v: Notification) {
    switch (v.code) {
      case -4: // 그룹 참가 수락됨
      case -5: // 그룹 참가 신청
        this.update_GroupUsersList(v['server']['isOfficial'], v['server']['target']);
        break;
      default:
        console.warn('예상하지 못한 그룹 행동: ', v);
        break;
    }
  }

  /** 그룹 최대 인원 수 조정 */
  updateMemberMaximum() {
    if (!this.nakama.PromotedGroup[this.isOfficial][this.target][this.info.id]
      || this.info['status'] == 'missing' || this.info['status'] == 'offline') return;
    this.alertCtrl.create({
      header: this.lang.text['AddGroup']['MemberMaxLimit'],
      inputs: [{
        type: 'number',
        placeholder: this.info['max_count']
      }],
      buttons: [{
        text: this.lang.text['GroupDetail']['ChangeMaxCount'],
        handler: async (ev) => {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          let newCount = Number(ev['0']);
          try {
            await this.nakama.servers[this.isOfficial][this.target].client.rpc(
              this.nakama.servers[this.isOfficial][this.target].session,
              'update_group_info_fn', {
              group_id: this.info['id'],
              max_count: newCount,
            });
            this.info['max_count'] = newCount;
            if (newCount == 1) {
              this.nakama.channels_orig[this.isOfficial][this.target][this.info['channel_id']]['status'] = 'online';
            } else {
              await this.nakama.count_channel_online_member(this.nakama.channels_orig[this.isOfficial][this.target][this.info['channel_id']], this.isOfficial, this.target);
            }
          } catch (e) {
            console.log('채널 최대인원 변경 실패: ', e);
            this.p5toast.show({
              text: `${this.lang.text['GroupDetail']['FailedToChangeMax']}: ${e.statusText || e} (${e.status})`,
            });
          }
          loading.dismiss();
        }
      }]
    }).then(v => v.present());
  }

  /** 그룹 공개 여부를 검토함 */
  async update_group_open() {
    this.info['open'] = !this.info['open'];
    try {
      await this.nakama.servers[this.isOfficial][this.target].client.rpc(
        this.nakama.servers[this.isOfficial][this.target].session,
        'update_group_info_fn', {
        group_id: this.info['id'],
        open: this.info['open'],
      });
    } catch (e) {
      console.log('그룹 공개 토글 실패: ', e);
      this.p5toast.show({
        text: `${this.lang.text['GroupDetail']['FailedToChangeOpen']}: ${e.statusText || e} (${e.status})`,
      });
    }
  }

  async update_GroupUsersList(_is_official: string, _target: string) {
    let ul = await this.nakama.servers[_is_official][_target].client.listGroupUsers(
      this.nakama.servers[_is_official][_target].session, this.info['id']);
    let result = [];
    for (let i = 0, j = ul.group_users.length; i < j; i++) {
      // 내 정보인 경우
      if (ul.group_users[i].user.id == this.nakama.servers[_is_official][_target].session.user_id) {
        let form = {
          state: ul.group_users[i].state,
          user: this.nakama.users.self,
          is_me: true,
        };
        result.push(form);
      } else { // 다른 사람의 정보인 경우
        let user = this.nakama.load_other_user(ul.group_users[i].user.id, _is_official, _target);
        this.nakama.save_other_user(ul.group_users[i].user, _is_official, _target);
        let form = {
          state: ul.group_users[i].state,
          user: user,
        }
        result.push(form);
      }
    }
    this.info['users'] = result;
    return ul.group_users;
  }

  file_sel_id = '';
  /** ionic 버튼을 눌러 input-file 동작 */
  async buttonClickInputFile() {
    if (this.nakama.PromotedGroup[this.isOfficial][this.target][this.info.id]) { // 권한이 있는 경우
      if (this.info.img) {
        this.info.img = undefined;
        this.nakama.servers[this.isOfficial][this.target].client.deleteStorageObjects(
          this.nakama.servers[this.isOfficial][this.target].session, {
          object_ids: [{
            collection: 'group_public',
            key: `group_${this.info.id}`,
          }],
        }).then(_info => {
          this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/groups/${this.info['id']}.img`);
        });
      } else document.getElementById(this.file_sel_id).click();
    }
  }

  changeImageContextmenu() {
    let contextAct = async () => {
      if (this.nakama.PromotedGroup[this.isOfficial][this.target][this.info.id]) { // 권한이 있는 경우
        if (this.info.img) {
          this.info.img = undefined;
          this.nakama.servers[this.isOfficial][this.target].client.deleteStorageObjects(
            this.nakama.servers[this.isOfficial][this.target].session, {
            object_ids: [{
              collection: 'group_public',
              key: `group_${this.info.id}`,
            }],
          }).then(_info => {
            this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/groups/${this.info['id']}.img`);
          });
        } else try {
          let clipboard = await this.global.GetValueFromClipboard();
          switch (clipboard.type) {
            case 'text/plain':
              await this.check_if_clipboard_available(clipboard.value);
              break;
            case 'image/png':
              this.inputImageSelected({ target: { files: [clipboard.value] } });
              return;
          }
        } catch (e) {
          document.getElementById(this.file_sel_id).click();
        }
      }
    }
    contextAct();
    return false;
  }

  async inputImageSelected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => {
      this.info.img = v['canvas'].toDataURL();
      this.announce_update_group_image(this.info.img);
    });
    let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
    input.value = '';
  }

  announce_update_group_image(uri: string) {
    this.nakama.servers[this.isOfficial][this.target].client.writeStorageObjects(
      this.nakama.servers[this.isOfficial][this.target].session, [{
        collection: 'group_public',
        key: `group_${this.info.id}`,
        value: { img: uri },
        permission_read: 2,
        permission_write: 1,
      }]
    ).then(_info => {
      this.indexed.saveTextFileToUserPath(JSON.stringify(uri), `servers/${this.isOfficial}/${this.target}/groups/${this.info['id']}.img`);
    });
  }

  async check_if_clipboard_available(v: string) {
    try {
      if (v.indexOf('http') == 0) {
        await new Promise((done, err) => {
          let img = document.createElement('img');
          img.src = v;
          img.onload = () => {
            this.info.img = v;
            this.announce_update_group_image(v);
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
          this.nakama.limit_image_size(v, (rv) => {
            this.info.img = rv['canvas'].toDataURL()
            this.announce_update_group_image(this.info.img);
          });
        } else throw 'DataURL 주소가 아님';
      } catch (e) {
        throw '사용불가 이미지';
      }
    }
  }

  /** 그룹 삭제 (방장 권한) */
  remove_group() {
    this.need_edit = false;
    try {
      if (this.nakama.servers[this.isOfficial][this.target]) { // 서버가 아직 있다면
        // 그룹 생성자가 나라면
        if (this.info['creator_id'] == this.nakama.servers[this.isOfficial][this.target].session.user_id) {
          if (this.info['status'] == 'online')
            this.nakama.servers[this.isOfficial][this.target].socket.writeChatMessage(
              this.info['channel_id'], {
              gupdate: 'remove',
            }).then(async _m => {
              this.nakama.remove_group_list(this.info, this.isOfficial, this.target);
              this.after_remove_group();
            });
          else this.after_remove_group();
        } else throw this.lang.text['GroupDetail']['YouAreNotCreator'];
      } else { // 서버 기록이 먼저 삭제된 경우
        this.navCtrl.pop();
      }
    } catch (e) {
      console.log('remove_group: ', e);
      this.p5toast.show({
        text: e,
      });
    }
  }

  /** 삭제 알림 그 후에 */
  async after_remove_group() {
    this.RemoveGroupFilesFromServer(`${this.info['id']}`);
    this.leave_channel();
    this.navCtrl.pop();
  }

  /** 그룹 편집사항이 있는지, 그래서 편집해야하는지 여부 검토 */
  need_edit = false;
  edit_group() {
    if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online' && this.info['status'] != 'missing'
      && this.nakama.PromotedGroup[this.isOfficial][this.target][this.info.id])
      this.nakama.servers[this.isOfficial][this.target].client.updateGroup(
        this.nakama.servers[this.isOfficial][this.target].session,
        this.info['id'], {
        name: this.info['name'],
        lang_tag: this.info['lang_tag'],
        description: this.info['description'],
        open: this.info['open'],
      });
    this.nakama.groups[this.isOfficial][this.target][this.info['id']] = this.info;
    this.nakama.save_groups_with_less_info();
  }

  lock_modal_open = false;
  /** 사용자 프로필 열람 */
  open_user_profile(userInfo: any) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      if (userInfo['is_me']) {
        this.nakama.open_profile_page({
          isOfficial: this.isOfficial,
          target: this.target,
        });
        this.lock_modal_open = false;
      } else {
        this.nakama.open_others_profile({
          info: userInfo,
          group: this.info,
          has_admin: this.has_superadmin,
        });
        this.lock_modal_open = false;
      }
    }
  }

  /** 그룹 떠나기 */
  leave_group() {
    this.need_edit = false;
    delete this.nakama.PromotedGroup[this.isOfficial][this.target][this.info['id']];
    // 여기서의 status는 나의 상태, 가입 여부 및 방장 여부를 뜻한다
    if (this.info['status'] == 'online')
      this.after_leave_group(() => {
        this.leave_channel();
        this.nakama.groups[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
        this.nakama.save_groups_with_less_info(() => this.navCtrl.pop());
      });
    else if (this.info['status'] == 'pending')
      this.after_leave_group(() => {
        this.nakama.groups[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
        this.nakama.save_groups_with_less_info(() => this.navCtrl.pop());
      });
  }

  /** 그룹 나가기 행동 */
  async after_leave_group(_CallBack = () => { }) {
    try {
      await this.nakama.servers[this.isOfficial][this.target].client.leaveGroup(
        this.nakama.servers[this.isOfficial][this.target].session, this.info['id']);
    } catch (e) { }
    _CallBack();
    this.RemoveGroupFilesFromServer(`${this.info['id']}_${this.nakama.servers[this.isOfficial][this.target].session.user_id}`);
  }

  /** 서버에 업로드한 파일 삭제하기 */
  RemoveGroupFilesFromServer(target_key: string) {
    this.nakama.remove_channel_files(this.isOfficial, this.target, this.info['channel_id']);
    let server_info = this.nakama.servers[this.isOfficial][this.target].info;
    try { // FFS 파일 중 내 계정으로 올린 파일들 일괄 삭제 요청
      let fallback = localStorage.getItem('fallback_fs');
      if (!fallback) throw '사용자 지정 서버 없음';
      let split_fullAddress = fallback.split('://');
      let address = split_fullAddress.pop().split(':');
      let protocol = split_fullAddress.pop();
      if (protocol) {
        protocol += ':';
      } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
      let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
      // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
      this.global.remove_files_from_storage_with_key(target_address, target_key, {});
    } catch (e) { }
    try { // cdn 파일들 일괄 삭제처리
      let target_address = `${server_info.useSSL ? 'https' : 'http'}://${server_info.address}`;
      this.global.remove_files_from_storage_with_key(target_address, target_key, { cdn_port: server_info.cdn_port, apache_port: server_info.apache_port });
    } catch (e) { }
  }

  /** 그룹 채널에서 나오기 */
  leave_channel() {
    try {
      if (this.nakama.channels_orig[this.isOfficial][this.target][this.info['channel_id']]['status'] != 'missing')
        this.nakama.channels_orig[this.isOfficial][this.target][this.info['channel_id']]['status'] = 'missing';
    } catch (e) { }
  }

  copy_id() {
    this.global.WriteValueToClipboard('text/plain', this.info.id);
  }

  /** 시작 진입 주소 생성 */
  copy_startup_address() {
    let startup_address = encodeURI(`https://is2you2.github.io/pjcone_pwa/?group=${this.info['name']},${this.info['id']}`);
    this.global.WriteValueToClipboard('text/plain', startup_address);
  }

  ionViewWillLeave() {
    this.need_edit = this.info['description'] != this.info_orig['description'];
    if (this.need_edit)
      this.edit_group();
    delete this.global.p5KeyShortCut['Escape'];
  }
}

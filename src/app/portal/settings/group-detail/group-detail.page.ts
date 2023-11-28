// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { OthersProfilePage } from 'src/app/others-profile/others-profile.page';
import { Notification } from '@heroiclabs/nakama-js';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { GlobalActService } from 'src/app/global-act.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { GroupServerPage } from '../group-server/group-server.page';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from "clipboardy";
import { SERVER_PATH_ROOT, isPlatform } from 'src/app/app.component';


@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
})
export class GroupDetailPage implements OnInit {

  constructor(
    private navParams: NavParams,
    public nakama: NakamaService,
    public modalCtrl: ModalController,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private mClipboard: Clipboard,
  ) { }

  QRCodeSRC: any;
  /** 그룹 정보 */
  info: any;
  /** 내가 이 그룹의 방장인지 여부 */
  has_admin = false;
  /** 진입시 그룹 정보 */
  info_orig: any;

  isOfficial: string;
  target: string

  async ngOnInit() {
    this.info = this.navParams.get('info');
    this.file_sel_id = `group_detail_${this.info.id}_${new Date().getTime()}}`;
    this.info_orig = JSON.parse(JSON.stringify(this.navParams.get('info')));
    this.nakama.socket_reactive['group_detail'] = this;
    this.QRCodeSRC = this.global.readasQRCodeFromString(
      `${SERVER_PATH_ROOT}pjcone_pwa/?group=${this.info.name},${this.info.id}`);
    if (!this.info.server) this.info.server = this.navParams.get('server');
    this.isOfficial = this.info.server['isOfficial'];
    this.target = this.info.server['target'];
    try {
      this.has_admin = this.info['creator_id'] == this.nakama.servers[this.isOfficial][this.target].session.user_id;
    } catch (e) {
      console.log('check is admin failed: ', e);
      this.has_admin = false;
    }
    // 사용자 정보가 있다면 로컬 정보 불러오기 처리
    if (this.info['users'] && this.info['users'].length) {
      for (let i = 0, j = this.info['users'].length; i < j; i++)
        if (this.info['users'][i].is_me) { // 정보상 나라면
          this.info['users'][i]['user'] = this.nakama.users.self;
          this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
            if (e && v) this.nakama.users.self['img'] = v.replace(/"|\\|=/g, '');
          });
        } else if (this.info['users'][i]['user']['id']) { // 다른 사람들의 프로필 이미지
          this.info['users'][i]['user'] = this.nakama.load_other_user(this.info['users'][i]['user']['id'], this.isOfficial, this.target);
        } else this.info['users'].splice(i, 1);
    }
    // 그룹 이미지 업데이트
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
        delete this.nakama.groups[this.isOfficial][this.target][this.info.id]['img'];
        this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/groups/${this.info.id}.img`);
      }
    });
  }

  ionViewWillEnter() {
    this.nakama.removeBanner();
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

  update_GroupUsersList(_is_official: string, _target: string) {
    this.nakama.servers[_is_official][_target].client.listGroupUsers(
      this.nakama.servers[_is_official][_target].session, this.info['id']
    ).then(ul => {
      let result = [];
      for (let i = 0, j = ul.group_users.length; i < j; i++) {
        // 내 정보인 경우
        if (ul.group_users[i].user.id == this.nakama.servers[_is_official][_target].session.user_id) {
          let form = {
            state: ul.group_users[i].state,
            user: this.nakama.users.self,
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
    });
  }

  file_sel_id = '';
  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickInputFile() {
    if (this.has_admin)
      document.getElementById(this.file_sel_id).click();
  }
  async inputImageSelected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => {
      this.info.img = v['canvas'].toDataURL();
      this.announce_update_group_image(this.info.img);
    });
  }

  announce_update_group_image(uri: string) {
    this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.writeStorageObjects(
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, [{
        collection: 'group_public',
        key: `group_${this.info.id}`,
        value: { img: uri },
        permission_read: 2,
        permission_write: 1,
      }]
    ).then(_info => {
      this.indexed.saveTextFileToUserPath(JSON.stringify(uri), `servers/${this.info['server']['isOfficial']}/${this.info['server']['target']}/groups/${this.info['id']}.img`);
    });
  }

  imageURL_disabled = false;
  imageURL_placeholder = this.lang.text['Profile']['pasteURI'];
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
      this.info.img = v;
      this.imageURL_placeholder = v;
      this.announce_update_group_image(v);
    } else if (v.indexOf('data:image') == 0) {
      this.nakama.limit_image_size(v, (rv) => {
        this.info.img = rv['canvas'].toDataURL()
        this.announce_update_group_image(this.info.img);
      });
    } else {
      this.p5toast.show({
        text: this.lang.text['Profile']['copyURIFirst'],
      });
    }
  }

  remove_group() {
    this.need_edit = false;
    try {
      if (this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']]) { // 서버가 아직 있다면
        if (this.info['creator_id'] == this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session.user_id) {
          if (this.info['status'] == 'online')
            this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].socket.writeChatMessage(
              this.info['channel_id'], {
              gupdate: 'remove',
            }).then(_m => {
              this.after_remove_group();
            });
          else this.after_remove_group();
        } else {
          throw this.lang.text['GroupDetail']['YouAreNotCreator'];
        }
      } else { // 서버 기록이 먼저 삭제된 경우
        this.nakama.remove_group_list(this.info, this.info['server']['isOfficial'], this.info['server']['target']);
        this.modalCtrl.dismiss({ remove: true });
      }
    } catch (e) {
      console.log('remove_group: ', e);
      this.p5toast.show({
        text: e,
      });
    }
  }

  /** 삭제 알림 그 후에 */
  after_remove_group() {
    this.leave_channel();
    this.nakama.remove_group_list(this.info, this.info['server']['isOfficial'], this.info['server']['target']);
    this.modalCtrl.dismiss({ remove: true });
  }

  /** 그룹 편집사항이 있는지, 그래서 편집해야하는지 여부 검토 */
  need_edit = false;
  edit_group() {
    if (this.statusBar.groupServer[this.info['server']['isOfficial']][this.info['server']['target']] == 'online' && this.info['status'] != 'missing' && this.has_admin)
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.updateGroup(
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session,
        this.info['id'], {
        name: this.info['name'],
        lang_tag: this.info['lang_tag'],
        description: this.info['description'],
        open: this.info['open'],
      });
    this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']] = this.info;
    this.nakama.save_groups_with_less_info();
  }

  lock_modal_open = false;
  /** 사용자 프로필 열람 */
  open_user_profile(userInfo: any) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      if (userInfo['is_me']) {
        this.modalCtrl.create({
          component: GroupServerPage,
        }).then(v => {
          v.present();
          this.lock_modal_open = false;
        });
      } else {
        this.modalCtrl.create({
          component: OthersProfilePage,
          componentProps: {
            info: userInfo,
            group: this.info,
            has_admin: this.has_admin,
          }
        }).then(v => {
          v.onDidDismiss().then(v => {
            if (v.data) {
              if (v.data['id'])
                for (let i = 0, j = this.info['users'].length; i < j; i++)
                  if (this.info['users'][i]['user']['id'] == v.data['id']) {
                    switch (v.data['act']) {
                      case 'accept_join': // 그룹 참가 수락
                        this.info['users'][i].status = 'online';
                        break;
                      case 'kick': // 추방
                        this.info['users'].splice(i, 1);
                        break;
                      default:
                        console.warn('예상하지 못한 상대방 정보: ', v);
                        break;
                    }
                    break;
                  }
              if (v.data['dismiss'])
                this.modalCtrl.dismiss();
            }
          });
          v.present();
          this.lock_modal_open = false;
        });
      }
    }
  }

  /** 그룹 떠나기 */
  leave_group() {
    this.need_edit = false;
    if (this.info['status'] == 'online')
      this.after_leave_group(() => {
        this.leave_channel();
        this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']]['status'] = 'missing';
        this.nakama.save_groups_with_less_info(() => this.modalCtrl.dismiss({ leave: true }));
      });
    else if (this.info['status'] == 'pending') this.after_leave_group(() => {
      this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']]['status'] = 'missing';
      this.nakama.save_groups_with_less_info(() => this.modalCtrl.dismiss({ leave: true }));
    });
  }

  /** 그룹 나가기 행동 */
  after_leave_group(_CallBack = () => console.warn('after_leave_group_announce Func Null')) {
    this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.leaveGroup(
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, this.info['id'],
    ).then(v => {
      if (v) _CallBack();
      this.nakama.remove_channel_files(this.info['server']['isOfficial'], this.info['server']['target'], this.info['channel_id']);
    });
  }

  /** 그룹 채널에서 나오기 */
  leave_channel() {
    if (this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']] && this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']])
      if (this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['status'] != 'missing') {
        delete this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['img'];
        this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['status'] = 'missing';
        delete this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['info'];
      }
    this.nakama.save_channels_with_less_info();
  }

  copy_id() {
    this.mClipboard.copy(this.info.id)
      .catch(_e => clipboard.write(this.info.id));
  }

  /** 시작 진입 주소 생성 */
  copy_startup_address() {
    let startup_address = `https://is2you2.github.io/pjcone_pwa/?group=${this.info['name']},${this.info['id']}&open_subscribes=true`;
    this.mClipboard.copy(startup_address)
      .catch(_e => clipboard.write(startup_address));
  }

  ionViewWillLeave() {
    delete this.nakama.socket_reactive['group_detail'];
    this.need_edit = this.info['description'] != this.info_orig['description'];
    if (this.need_edit)
      this.edit_group();
  }
}

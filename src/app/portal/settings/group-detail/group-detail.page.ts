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


@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
})
export class GroupDetailPage implements OnInit, OnDestroy {

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
    this.nakama.removeBanner();
    this.info = this.navParams.get('info');
    this.file_sel_id = `group_detail_${this.info.id}_${new Date().getTime()}}`;
    this.info_orig = JSON.parse(JSON.stringify(this.navParams.get('info')));
    this.nakama.socket_reactive['group_detail'] = this;
    this.QRCodeSRC = this.global.readasQRCodeFromId({
      id: this.info.id,
      name: this.info.name,
      type: 'group',
    });
    if (!this.info.server) this.info.server = this.navParams.get('server');
    this.isOfficial = this.info.server['isOfficial'];
    this.target = this.info.server['target'];
    this.has_admin = this.statusBar.groupServer[this.isOfficial][this.target] == 'online';
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
      // 온라인일 경우
      if (this.has_admin) // 여기서만 has_admin이 온라인 여부처럼 동작함
        if (this.info['status'] != 'missing')
          this.state_to_status(this.isOfficial, this.target);
    }
  }

  /** 그룹원 상태를 그룹 사용자 상태에 덮어쓰기 */
  state_to_status(_is_official: string, _target: string) {
    for (let i = 0, j = this.info['users'].length; i < j; i++) {
      // 아래, 사용자별 램프 조정
      switch (this.info['users'][i].state) {
        case 0: // SuperAdmin
        case 1: // Admin
          this.info['users'][i].status = 'certified';
          break;
        case 2: // Member
          this.info['users'][i].status = 'online';
          break;
        case 3: // Request
          this.info['users'][i].status = 'pending';
          break;
        default:
          console.warn('존재하지 않는 나카마 그룹원의 상태: ', this.info['users'][i].state);
          break;
      }
      // 내 정보라면 방장 여부 검토
      if (this.info['users'][i]['is_me']) {
        if (this.info['creator_id'] == this.nakama.servers[_is_official][_target].session.user_id)
          this.has_admin = true;
        this.info['status'] = this.info['users'][i].status;
        if (this.info['status'] == 'certified')
          this.info['status'] = 'online';
        else this.has_admin = false;
      }
    }
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
      this.state_to_status(_is_official, _target);
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
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.writeStorageObjects(
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, [{
          collection: 'group_public',
          key: `group_${this.info.id}`,
          value: { img: this.info.img },
          permission_read: 2,
          permission_write: 1,
        }]
      ).then(_info => {
        this.indexed.saveTextFileToUserPath(JSON.stringify(this.info['img']), `servers/${this.info['server']['isOfficial']}/${this.info['server']['target']}/groups/${this.info['id']}.img`);
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].socket.writeChatMessage(
          this.info['channel_id'], {
          gupdate: 'image',
        });
      });
    });
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
      }).then(_v => {
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].socket.writeChatMessage(
          this.info['channel_id'], {
          gupdate: 'info',
          name: this.info['name'],
        });
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
            blockCreateChat: true,
          }
        }).then(v => {
          v.onDidDismiss().then(v => {
            if (v.data)
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

  ngOnDestroy(): void {
    delete this.nakama.users.self['img'];
  }
}

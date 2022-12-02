import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ModalController, NavParams } from '@ionic/angular';
import * as QRCode from "qrcode-svg";
import { P5ToastService } from 'src/app/p5-toast.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { ProfilePage } from '../profile/profile.page';
import { OthersProfilePage } from 'src/app/others-profile/others-profile.page';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
})
export class GroupDetailPage implements OnInit {

  constructor(
    private navParams: NavParams,
    private sanitizer: DomSanitizer,
    private p5toast: P5ToastService,
    public nakama: NakamaService,
    public modalCtrl: ModalController,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
  ) { }

  QRCodeSRC: any;
  /** 그룹 정보 */
  info: any;
  /** 내가 이 그룹의 방장인지 여부 */
  has_admin = false;
  /** 이 그룹의 서버에 연결되어 있는지 여부 */
  is_online = false;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.nakama.socket_reactive[-4] = this;
    this.nakama.socket_reactive[-5] = this;
    this.readasQRCodeFromId();
    let _is_official: string = this.info.server['isOfficial'];
    let _target: string = this.info.server['target'];
    this.is_online = this.statusBar.groupServer[_is_official][_target] == 'online';
    this.has_admin = this.is_online && this.nakama.servers[_is_official][_target].session.user_id == this.info['creator_id'];
    if (this.info['users']) // 사용자 정보가 있다면 로컬 정보 불러오기 처리
      for (let i = 0, j = this.info['users'].length; i < j; i++)
        if (this.info['users'][i].user.is_me) { // 정보상 나라면
          this.has_admin = this.info['creator_id'] == this.info['users'][i].user.id;
          this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
            if (e && v) this.info['users'][i]['img'] = JSON.parse(v)['img'];
          });
        } else // 다른 사람들의 프로필 이미지
          this.nakama.load_other_user_profile_image(this.info['users'][i].user.id, _is_official, _target)
            .then(_img => {
              if (this.info['users'][i])
                this.info['users'][i]['img'] = _img;
            });
    if (this.info['users'])
      for (let i = 0, j = this.info['users'].length; i < j; i++)
        this.info['users'][i]['status'] = this.info['status'];
    if (this.is_online) { // 서버로부터 정보를 받아옴
      if (this.info['status'] != 'missing')
        this.nakama.servers[_is_official][_target].client.listGroupUsers(
          this.nakama.servers[_is_official][_target].session, this.info['id'],
        ).then(v => {
          // 삭제된 그룹 여부 검토
          if (!v.group_users.length) {
            this.info['status'] = 'missing';
            this.nakama.channels_orig[_is_official][_target][this.info['channel_id']]['title']
              = this.nakama.channels_orig[_is_official][_target][this.info['channel_id']]['title'] + ' (삭제된 그룹)';
            this.nakama.channels_orig[_is_official][_target][this.info['channel_id']]['status'] = 'missing';
            this.nakama.save_channels_with_less_info();
            console.warn('사용자 로그인 여부를 연결/반영해야함');
            for (let i = 0, j = this.info['users'].length; i < j; i++)
              this.info['users']['status'] = 'missing';
          } else { // 활성 그룹인 경우
            this.info['users'] = v.group_users;
            /** 그룹 내 다른 사람들의 프로필 이미지 요청 */
            let object_req = [];
            // 사용자 리스트 갱신
            let am_i_lost = true;
            for (let i = 0, j = this.info['users'].length; i < j; i++) {
              if (this.info['users'][i].user.id != this.nakama.servers[_is_official][_target].session.user_id) {
                object_req.push({
                  collection: 'user_public',
                  key: 'profile_image',
                  user_id: this.info['users'][i].user.id,
                });
              } else {// 만약 내 정보라면
                this.info['users'][i].user.is_me = true;
                this.has_admin = this.info['creator_id'] == this.info['users'][i].user.id;
                this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
                  if (e && v) this.info['users'][i]['img'] = JSON.parse(v)['img'];
                });
                am_i_lost = false;
              }
              // 아래, 사용자 램프 조정
              switch (this.info['users'][i].state) {
                case 0:
                case 1:
                  this.info['users'][i]['status'] = 'certified';
                  break;
                case 2:
                  this.info['users'][i]['status'] = 'online';
                  break;
                case 3:
                  this.info['users'][i]['status'] = 'pending';
                  break;
                default:
                  console.warn('존재하지 않는 나카마 그룹원의 상태: ', this.info['users'][i].state);
                  break;
              }
            }
            if (am_i_lost) { // 내가 포함된 그룹이 아님
              this.info['status'] = 'missing';
              this.nakama.channels_orig[_is_official][_target][this.info['channel_id']]['title']
                = this.nakama.channels_orig[_is_official][_target][this.info['channel_id']]['title'] + ' (그룹원이 아님)';
              this.nakama.channels_orig[_is_official][_target][this.info['channel_id']]['status'] = 'missing';
              this.nakama.save_channels_with_less_info();
            } else {
              // 아래 다른 사람들의 이미지 받아오기
              this.nakama.servers[_is_official][_target].client.readStorageObjects(
                this.nakama.servers[_is_official][_target].session, {
                object_ids: object_req,
              }).then(v2 => {
                for (let i = 0, j = v2.objects.length; i < j; i++)
                  for (let k = 0, l = this.info['users'].length; k < l; k++)
                    if (v2.objects[i].user_id == this.info['users'][k].user.id) {
                      this.info['users'][k]['img'] = v2.objects[i].value['img'];
                      this.indexed.saveTextFileToUserPath(v2.objects[i].value['img'], `servers/${_is_official}/${_target}/users/${v2.objects[i].user_id}/profile.img`);
                      break;
                    }
              });
            }
          }
        });
      this.nakama.save_groups_with_less_info();
    }
  }

  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickInputFile() {
    if (this.has_admin)
      document.getElementById('file_sel').click();
  } inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.nakama.limit_image_size(ev, (v) => {
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
            msg: '그룹 이미지 업데이트 알림-테스트 로그',
          });
        });
      });
    };
    reader.readAsDataURL(ev.target.files[0]);
  }

  readasQRCodeFromId() {
    try {
      let except_some = { id: this.info.id, name: this.info.name };
      except_some['type'] = 'group';
      let qr: string = new QRCode({
        content: `[${JSON.stringify(except_some)}]`,
        padding: 4,
        width: 8,
        height: 8,
        color: "#bbb",
        background: "#111",
        ecl: "M",
      }).svg();
      this.QRCodeSRC = this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(qr)}`);
    } catch (e) {
      this.p5toast.show({
        text: `QRCode 생성 실패: ${e}`,
      });
    }
  }

  remove_group() {
    this.need_edit = false;
    if (this.info['status'] == 'online')
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].socket.writeChatMessage(
        this.info['channel_id'], {
        msg: `사용자가 그룹 나감: ${this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session.user_id}-테스트 로그`
      }).then(_m => {
        this.after_remove_group();
      });
    else this.after_remove_group();
  }

  after_remove_group() {
    this.leave_channel();
    this.nakama.remove_group_list(this.info, this.info['server']['isOfficial'], this.info['server']['target']);
    this.modalCtrl.dismiss();
  }

  need_edit = true;
  edit_group() {
    if (this.is_online && this.has_admin)
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
          msg: '그룹 정보 업데이트 알림-테스트 로그',
        });
      });
    this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']] = this.info;
    this.nakama.save_groups_with_less_info();
  }

  /** 사용자 프로필 열람 */
  open_user_profile(userInfo: any) {
    if (userInfo['user']['is_me']) {
      this.modalCtrl.create({
        component: ProfilePage,
      }).then(v => v.present());
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
      });
    }
  }

  /** 그룹 떠나기 */
  leave_group() {
    this.need_edit = false;
    this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].socket.writeChatMessage(
      this.info['channel_id'], {
      msg: `사용자가 그룹 나감: ${this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session.user_id}-테스트 로그`
    }).then(_m => {
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.leaveGroup(
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, this.info['id'],
      ).then(v => {
        if (v) {
          this.leave_channel();
          delete this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']];
          this.nakama.save_groups_with_less_info(() => this.modalCtrl.dismiss());
        }
      })
    });
  }

  /** 그룹 채널에서 나오기 */
  leave_channel() {
    if (this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['status'] != 'missing') {
      delete this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['img'];
      this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['title']
        = this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['title'] + ' (삭제된 그룹)';
      this.nakama.channels_orig[this.info['server']['isOfficial']][this.info['server']['target']][this.info['channel_id']]['status'] = 'missing';
    }
    this.nakama.save_channels_with_less_info();
  }

  ionViewWillLeave() {
    delete this.nakama.socket_reactive[-4];
    delete this.nakama.socket_reactive[-5];
    if (this.need_edit)
      this.edit_group();
  }
}

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
  info: any;
  /** 내가 이 그룹의 방장인지 여부 */
  has_admin = false;
  /** 이 그룹의 서버에 연결되어 있는지 여부 */
  is_online = false;

  ngOnInit() {
    this.info = this.navParams.get('info');
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
          this.indexed.loadTextFromUserPath(`servers/${_is_official}/${_target}/users/${this.info['users'][i].user.id}/profile.img`, (e, v) => {
            if (e && v) this.info['users'][i]['img'] = v;
          });
    if (this.info['users'])
      for (let i = 0, j = this.info['users'].length; i < j; i++)
        this.info['users'][i]['status'] = this.info['status'];
    if (this.is_online) { // 서버로부터 정보를 받아옴
      this.nakama.servers[_is_official][_target].client.listGroupUsers(
        this.nakama.servers[_is_official][_target].session, this.info['id'],
      ).then(v => {
        // 삭제된 그룹 여부 검토
        if (!v.group_users.length) {
          this.info['status'] = 'missing';
          for (let i = 0, j = this.info['users'].length; i < j; i++)
            this.info['users']['status'] = 'missing';
        } else { // 활성 그룹인 경우
          this.info['users'] = v.group_users;
          /** 그룹 내 다른 사람들의 프로필 이미지 요청 */
          let object_req = [];
          // 사용자 리스트 갱신
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
      });
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
        );
      });
    };
    reader.readAsDataURL(ev.target.files[0]);
  }

  readasQRCodeFromId() {
    try {
      let except_some = { id: this.info.id, title: this.info.title };
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
    let _is_official: string = this.info.server['isOfficial'];
    let _target: string = this.info.server['target'];
    this.nakama.remove_group_list(this.info, _is_official, _target);
    this.modalCtrl.dismiss();
  }

  need_edit = true;
  edit_group() {
    if (this.is_online && this.has_admin)
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.updateGroup(
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session,
        this.info['id'],
        {
          name: this.info['name'],
          lang_tag: this.info['lang_tag'],
          description: this.info['description'],
          open: this.info['open'],
        }
      );
    let less_info = { ...this.info };
    delete less_info['server'];
    delete less_info['img'];
    if (less_info['users'])
      for (let i = 0, j = less_info['users'].length; i < j; i++) {
        delete less_info['users'][i]['img'];
        delete less_info['users'][i]['status'];
      }
    this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']] = less_info;
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.nakama.groups), 'servers/groups.json');
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
        }
      }).then(v => v.present());
    }
  }

  /** 그룹 떠나기 */
  leave_group() {
    this.need_edit = false;
    this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.leaveGroup(
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, this.info['id'],
    ).then(v => {
      if (v) {
        delete this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']];
        this.indexed.saveTextFileToUserPath(JSON.stringify(this.nakama.groups), 'servers/groups.json', (_v) => {
          this.modalCtrl.dismiss();
        });
      }
    })
  }

  ionViewWillLeave() {
    delete this.nakama.socket_reactive[-5];
    if (this.need_edit)
      this.edit_group();
  }
}

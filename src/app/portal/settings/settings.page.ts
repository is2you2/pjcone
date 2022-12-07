import { Component, OnInit } from '@angular/core';
import { Group } from '@heroiclabs/nakama-js';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';
import { GroupDetailPage } from './group-detail/group-detail.page';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private nav: NavController,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    private indexed: IndexedDBService,
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
    this.nakama.socket_reactive['settings'] = this;
  }

  /** 표시되는 그룹 리스트 */
  groups: Group[] = [];
  self = {};
  /** 프로필 썸네일 */
  profile_filter: string;
  ionViewWillEnter() {
    if (this.nakama.users.self['is_online'])
      this.profile_filter = "filter: grayscale(0) contrast(1);";
    else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    this.load_groups();
  }
  /** 저장된 그룹 업데이트하여 반영 */
  load_groups() {
    let tmp_groups = this.nakama.rearrange_group_list();
    tmp_groups.forEach(group => {
      let _is_official = group['server']['isOfficial'];
      let _target = group['server']['target'];
      // 온라인이라면 서버정보로 덮어쓰기
      if (this.statusBar.groupServer[_is_official][_target] == 'online') {
        if (this.nakama.groups[_is_official][_target][group.id]['status'] != 'missing')
          this.nakama.servers[_is_official][_target].client.listGroupUsers(
            this.nakama.servers[_is_official][_target].session, group['id']
          ).then(v => { // 삭제된 그룹 여부 검토
            if (!v.group_users.length) { // 그룹 비활성중
              this.nakama.groups[_is_official][_target][group.id]['status'] = 'missing';
              this.nakama.channels_orig[_is_official][_target][group['channel_id']]['status'] = 'missing';
              this.nakama.save_channels_with_less_info();
            } else { // 그룹 활성중
              let am_i_lost = true;
              for (let i = 0, j = v.group_users.length; i < j; i++)
                if (v.group_users[i].user.id == this.nakama.servers[_is_official][_target].session.user_id) {
                  switch (v.group_users[i].state) {
                    case 0: // superadmin
                    case 1: // admin
                    case 2: // member
                      this.nakama.groups[_is_official][_target][group.id]['status'] = 'online';
                      break;
                    case 3: // request
                      this.nakama.groups[_is_official][_target][group.id]['status'] = 'pending';
                      break;
                    default:
                      console.warn('이해할 수 없는 코드 반환: ', v.group_users[i].state);
                      this.nakama.groups[_is_official][_target][group.id]['status'] = 'missing';
                      break;
                  }
                  am_i_lost = false;
                  v.group_users[i]['is_me'] = true;
                  break;
                }
              if (am_i_lost) { // 그룹은 있으나 구성원은 아님
                this.nakama.groups[_is_official][_target][group.id]['status'] = 'missing';
                this.nakama.channels_orig[_is_official][_target][group['channel_id']]['status'] = 'missing';
                this.nakama.save_channels_with_less_info();
              }
            }
            if (v.group_users.length)
              group['users'] = v.group_users;
            v.group_users.forEach(User => {
              if (User['is_me'])
                User['user'] = this.nakama.users.self;
              else this.nakama.save_other_user(User['user'], _is_official, _target);
            });
            this.nakama.save_groups_with_less_info();
          });
      }
    });
    this.groups = tmp_groups;
  }
  /** 채팅방 이중진입 방지용 */
  will_enter = false;
  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 최소한의 기능을 가진 채팅 시작하기 */
  start_minimalchat(_address?: string) {
    if (this.will_enter) return;
    this.will_enter = true;
    setTimeout(() => {
      this.will_enter = false;
    }, 500);
    this.modalCtrl.create({
      component: MinimalChatPage,
      componentProps: {
        address: _address,
        name: this.nakama.users.self['display_name'],
      },
    }).then(v => v.present());
  }

  /** 만들어진 그룹을 관리 */
  go_to_group_detail(i: number) {
    this.modalCtrl.create({
      component: GroupDetailPage,
      componentProps: {
        info: this.groups[i],
      },
    }).then(v => {
      v.onWillDismiss().then(() => {
        this.load_groups();
      });
      v.present();
    });
  }

  go_to_page(_page: string) {
    this.nav.navigateForward(`settings/${_page}`, {
      animation: iosTransitionAnimation,
    })
  }

  ionViewWillLeave() {
    delete this.nakama.socket_reactive['settings'];
  }
}

import { Component, OnInit } from '@angular/core';
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
  }

  /** 표시되는 그룹 리스트 */
  groups: any[] = [];
  /** 프로필 썸네일 */
  profile_img: string;
  profile_filter: string;
  ionViewWillEnter() {
    this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, v) => {
      let addition = {};
      if (e && v) addition = JSON.parse(v);
      this.profile_img = addition['img'];
      if (Boolean(localStorage.getItem('is_online')))
        this.profile_filter = "filter: grayscale(0) contrast(1);";
      else this.profile_filter = "filter: grayscale(.9) contrast(1.4);";
    });
    this.load_groups();
  }
  /** 저장된 그룹 업데이트하여 반영 */
  load_groups() {
    this.groups.length = 0;
    let local_tmp = [];
    let online_tmp = [];
    let isOfficial = Object.keys(this.nakama.groups);
    let is_last_official = false;
    let is_last_target = false;
    let is_last_group = false;
    for (let i = 0, j = isOfficial.length; i < j; i++) {
      let target = Object.keys(this.nakama.groups[isOfficial[i]]);
      for (let k = 0, l = target.length; k < l; k++) {
        let group = Object.keys(this.nakama.groups[isOfficial[i]][target[k]]);
        for (let m = 0, n = group.length; m < n; m++) {
          let group_and_server_info = {};
          group_and_server_info['server'] = this.nakama.servers[isOfficial[i]][target[k]].info;
          group_and_server_info['name'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['name'];
          group_and_server_info['creator_id'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['creator_id'];
          group_and_server_info['id'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['id'];
          group_and_server_info['description'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['description'];
          group_and_server_info['users'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['users'];
          group_and_server_info['status'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['status'];
          group_and_server_info['max_count'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['max_count'];
          group_and_server_info['lang_tag'] = this.nakama.groups[isOfficial[i]][target[k]][group[m]]['lang_tag'];
          group_and_server_info['status'] = 'offline';
          this.indexed.loadTextFromUserPath(`servers/${isOfficial[i]}/${target[k]}/groups/${group_and_server_info['id']}.img`, (e, v) => {
            if (e && v) group_and_server_info['img'] = v;
            local_tmp.push(group_and_server_info);
            if (is_last_official && is_last_target && m == n - 1)
              this.groups = local_tmp;
            // 온라인이라면 서버가 무조건 우선되고 이 정보로 업데이트 함
            if (this.statusBar.groupServer[isOfficial[i]][target[k]] == 'online') {
              this.nakama.servers[isOfficial[i]][target[k]].client.listGroupUsers(
                this.nakama.servers[isOfficial[i]][target[k]].session, group_and_server_info['id']
              ).then(v => { // 삭제된 그룹 여부 검토
                if (!v.group_users.length) { // 그룹 비활성중
                  group_and_server_info['status'] = 'missing';
                  this.nakama.groups[isOfficial[i]][target[k]][group[m]]['status'] = 'missing';
                  this.indexed.loadTextFromUserPath(`servers/${isOfficial[i]}/${target[k]}/groups/${group_and_server_info['id']}.img`, (e, v) => {
                    if (e && v) group_and_server_info['img'] = v;
                    online_tmp.push(group_and_server_info);
                  });
                } else { // 그룹 활성중
                  let at_least_kicked = true;
                  for (let o = 0, p = v.group_users.length; o < p; o++)
                    if (v.group_users[o].user.id == this.nakama.servers[isOfficial[i]][target[k]].session.user_id) {
                      switch (v.group_users[o].state) {
                        case 0: // superadmin
                        case 1: // admin
                        case 2: // member
                          group_and_server_info['status'] = 'online';
                          break;
                        case 3: // request
                          group_and_server_info['status'] = 'pending';
                          break;
                        default:
                          console.warn('이해할 수 없는 코드 반환: ', v.group_users[o].state);
                          group_and_server_info['status'] = 'missing';
                          break;
                      }
                      at_least_kicked = false;
                      break;
                    }
                  this.nakama.servers[isOfficial[i]][target[k]].client.readStorageObjects(
                    this.nakama.servers[isOfficial[i]][target[k]].session, {
                    object_ids: [{
                      collection: 'group_public',
                      key: `group_${group_and_server_info['id']}`,
                      user_id: group_and_server_info['creator_id']
                    }]
                  }).then(v => {
                    if (v.objects[0]) {
                      group_and_server_info['img'] = v.objects[0].value['img'];
                      this.indexed.saveTextFileToUserPath(group_and_server_info['img'], `servers/${isOfficial[i]}/${target[k]}/groups/${group_and_server_info['id']}.img`)
                    }
                    if (!at_least_kicked)
                      online_tmp.push(group_and_server_info);
                    is_last_group = m == n - 1;
                    if (is_last_official && is_last_target && is_last_group)
                      this.groups = online_tmp;
                  });
                }
              })
            }
          });
        }
        is_last_target = k == l - 1;
      }
      is_last_official = i == j - 1;
    }
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
        name: localStorage.getItem('name'),
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

  /** 개발자 블로그로 연결 (github 홈페이지) */
  go_to_dev_blog() {
    window.open('https://is2you2.github.io', '_system')
  }

  go_to_page(_page: string) {
    this.nav.navigateForward(`settings/${_page}`, {
      animation: iosTransitionAnimation,
    })
  }
}

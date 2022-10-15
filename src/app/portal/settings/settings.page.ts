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
    private nakama: NakamaService,
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
    let isOfficial = Object.keys(this.nakama.groups);
    isOfficial.forEach(_is_official => {
      let server = Object.keys(this.nakama.groups[_is_official]);
      server.forEach(_name => {
        let group = Object.keys(this.nakama.groups[_is_official][_name]);
        group.forEach(_group_name => {
          let group_and_server_info = {};
          group_and_server_info['server'] = this.nakama.servers[_is_official][_name].info;
          group_and_server_info['title'] = this.nakama.groups[_is_official][_name][_group_name]['title'];
          group_and_server_info['owner'] = this.nakama.groups[_is_official][_name][_group_name]['owner'];
          group_and_server_info['id'] = this.nakama.groups[_is_official][_name][_group_name]['id'];
          if (this.nakama.groups[_is_official][_name][_group_name]['img_id']) {
            group_and_server_info['img_id'] = this.nakama.groups[_is_official][_name][_group_name]['img_id'];
            this.nakama.servers[_is_official][_name].client.readStorageObjects(
              this.nakama.servers[_is_official][_name].session, {
              object_ids: [{
                collection: 'user_public',
                key: this.nakama.groups[_is_official][_name][_group_name]['img_id'],
                user_id: group_and_server_info['owner']
              }]
            }).then(v => {
              group_and_server_info['img'] = v.objects[0].value['img'];
              this.groups.push(group_and_server_info);
            });
          } else {
            this.groups.push(group_and_server_info);
          }
        });
      });
    });
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

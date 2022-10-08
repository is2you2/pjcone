import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';

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
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
  }

  temporary_online_status = false;
  /** 표시되는 그룹 리스트 */
  groups: any[] = [];

  ionViewWillEnter() {
    this.groups.length = 0;
    let isOfficial = Object.keys(this.nakama.groups);
    isOfficial.forEach(_is_official => {
      let server = Object.keys(this.nakama.groups[_is_official]);
      server.forEach(_name => {
        let group = Object.keys(this.nakama.groups[_is_official][_name]);
        group.forEach(_group_name => {
          this.groups.push({
            isOfficial: _is_official,
            server: _name,
            group: this.nakama.groups[_is_official][_name][_group_name]['title'],
            owner: this.nakama.groups[_is_official][_name][_group_name]['owner'],
          });
        });
      });
    });
    this.temporary_online_status = Boolean(localStorage.getItem('is_online'));
  }
  /** 채팅방 이중진입 방지용 */
  will_enter = false;
  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 사설 그룹채팅에서 사용할 이름 */
  member_name: string;
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
        name: this.member_name,
      },
    }).then(v => v.present());
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

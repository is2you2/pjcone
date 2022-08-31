import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { StatusManageService } from 'src/app/status-manage.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    private modal: ModalController,
    private nav: NavController,
    private statusBar: StatusManageService,
  ) { }
  /** 사설 서버 생성 가능 여부: 메뉴 disabled */
  cant_dedicated = false;
  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
  }

  /** 채팅방 이중진입 방지용 */
  will_enter = false;
  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 사설 그룹채팅에서 사용할 이름 */
  member_name: string;
  /** 최소한의 기능을 가진 채팅 시작하기 */
  start_minimalchat(_address?: string) {
    this.will_enter = true;
    setTimeout(() => {
      this.will_enter = false;
    }, 500);
    this.modal.create({
      component: MinimalChatPage,
      componentProps: {
        address: this.chat_address ? 'ws://' + this.chat_address : _address,
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

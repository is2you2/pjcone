import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { LocalGroupServerService } from 'src/app/local-group-server.service';
import { MinimalChatPage } from '../../minimal-chat/minimal-chat.page';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    private server: LocalGroupServerService,
    private modal: ModalController,
    private nav: NavController,
  ) { }

  ngOnInit() {
  }

  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 사설 그룹채팅에서 사용할 이름 */
  member_name: string;
  /** 최소한의 기능을 가진 채팅 시작하기 */
  start_minimalchat(_address?: string, _onQuit: Function = () => { }) {
    this.modal.create({
      component: MinimalChatPage,
      componentProps: {
        address: this.chat_address ? 'ws://' + this.chat_address : _address,
        name: this.member_name,
        onQuit: _onQuit,
      },
    }).then(v => v.present());
  }

  /** 서버 사용 가능 여부에 따라 버튼 조정 */
  isServerWorking = false;
  /** 최소한의 기능을 가진 채팅 서버 만들기 */
  start_minimalserver() {
    this.isServerWorking = true;
    this.server.funcs.onStart = () => {
      this.start_minimalchat('ws://localhost', () => {
        this.server.stop();
      });
    } // ^ 자체 참여
    this.server.funcs.onFailed = () => {
      setTimeout(() => {
        this.isServerWorking = false;
      }, 60000);
    }
    this.server.initialize();
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

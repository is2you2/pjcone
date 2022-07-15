import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LocalGroupServerService } from '../local-group-server.service';
import { MinimalChatPage } from '../minimal-chat/minimal-chat.page';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(
    private modal: ModalController,
    private server: LocalGroupServerService,
  ) { }

  ngOnInit() { }


  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 사설 그룹채팅에서 사용할 이름 */
  member_name: string;
  /** 최소한의 기능을 가진 채팅 시작하기 */
  start_minimalchat(_address?: string, _onQuit: Function = () => { }) {
    this.modal.create({
      component: MinimalChatPage,
      componentProps: {
        address: this.chat_address || _address,
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
      this.start_minimalchat('localhost', () => {
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
}

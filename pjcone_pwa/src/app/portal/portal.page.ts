import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { MinimalChatPage } from '../minimal-chat/minimal-chat.page';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(
    private modal: ModalController,
  ) { }

  ngOnInit() { }


  /** 사설 서버 주소, 없으면 공식서버 랜덤채팅 */
  chat_address: string;
  /** 최소한의 기능을 가진 채팅 시작하기 */
  start_minimalchat() {
    this.modal.create({
      component: MinimalChatPage,
      componentProps: { address: this.chat_address },
    }).then(v => v.present());
  }
}

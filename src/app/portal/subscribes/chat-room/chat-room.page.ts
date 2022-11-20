import { Component, OnInit } from '@angular/core';
import { Channel } from '@heroiclabs/nakama-js';
import { ModalController, NavParams } from '@ionic/angular';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
})
export class ChatRoomPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
  ) { }

  info: Channel;

  ngOnInit() {
    this.info = this.navParams.get('info');
    console.log('채팅 채널 정보: ', this.info);
  }

  /** 사용자 입력 */
  userInput = {
    text: '',
  }

  send() {
    if (!this.userInput.text) return;
    console.log('메시지 보내기: ', this.userInput.text);
    this.userInput.text = '';
  }
}

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { NakamaService } from 'src/app/nakama.service';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
})
export class ChatRoomPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    public nakama: NakamaService,
  ) { }

  info: any;

  ngOnInit() {
    this.info = this.navParams.get('info');
    let isOfficial = this.info['info']['isOfficial'];
    let target = this.info['info']['target'];
    console.log('채팅방 잠시 대기: ', this.info);
  }

  /** 사용자 입력 */
  userInput = {
    text: '',
  }

  send() {
    if (!this.userInput.text) return;
    this.nakama.servers[this.info['info']['isOfficial']][this.info['info']['target']].socket
      .writeChatMessage(this.info['id'], {
        msg: this.userInput.text
      }).then(_v => {
        this.userInput.text = '';
      });
  }
}
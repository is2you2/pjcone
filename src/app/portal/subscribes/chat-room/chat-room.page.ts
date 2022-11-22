import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
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
    private noti: LocalNotiService,
  ) { }

  info: any;

  ngOnInit() {
    this.info = this.navParams.get('info');
    console.log('채팅방 잠시 대기: ', this.info);
    this.noti.Current = this.info['id'];
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

  ionViewWillLeave() {
    this.noti.Current = undefined;
  }
}
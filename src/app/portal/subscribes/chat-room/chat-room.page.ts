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
    if (this.nakama.servers[isOfficial][target].socket) {
      let type = 0;
      let chat_target: string = undefined;
      switch (this.info['info']['group']) {
        case 'directmsg':
          type = 2;
          for (let i = 0, j = this.info['presences'].length; i < j; i++)
            if (this.info['presences'][i]['user_id'] != this.info['self']['user_id']) {
              chat_target = this.info['presences'][i]['user_id'];
              break;
            }
          break;
        default:
          console.log('그룹 default 준비중');
          break;
      }
      this.nakama.servers[isOfficial][target].socket.joinChat(
        chat_target, type, this.info['self']['persistence'], false)
        .then(c => {
          this.nakama.add_channels(c, isOfficial, target);
        });
    }
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
      }).then(v => {
        console.log('발송에 대해서: ', v);
        this.userInput.text = '';
      });
  }
}
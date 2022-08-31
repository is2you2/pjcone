import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
})
export class ChatRoomPage implements OnInit {

  constructor(
    private app: GlobalActService,
    public modalCtrl: ModalController,
  ) { }

  ngOnInit() { }

  /** 사용자 입력 */
  userInput = {
    text: '',
  }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-test-chat-act', 'chatroom');
  }

  send() {
    console.log('메시지 보내기: ', this.userInput.text);
    this.userInput.text = '';
  }
}

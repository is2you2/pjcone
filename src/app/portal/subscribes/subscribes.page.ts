import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { ProjinfoPage } from './projinfo/projinfo.page';
import { TaskInfoPage } from './task-info/task-info.page';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modal: ModalController,
  ) { }

  ngOnInit() {
  }

  /** 채팅방으로 이동하기 */
  go_to_chatroom() {
    this.modal.create({
      component: ChatRoomPage,
      componentProps: {},
    }).then(v => v.present());
  }

  go_to_projinfo() {
    this.modal.create({
      component: ProjinfoPage,
      componentProps: {},
    }).then(v => v.present());
  }

  go_to_taskinfo() {
    this.modal.create({
      component: TaskInfoPage,
      componentProps: {},
    }).then(v => v.present());
  }
}

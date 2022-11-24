import { Component, OnInit } from '@angular/core';
import { Channel } from '@heroiclabs/nakama-js';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';

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
    private statusBar: StatusManageService,
  ) { }

  info: Channel;
  isOfficial: string;
  target: string;

  messages = [];
  /** 사용자 정보 일람 */
  users = {};

  next_cursor: string = '';
  content_panel: HTMLElement;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.noti.Current = this.info['id'];
    this.isOfficial = this.info['info']['isOfficial'];
    this.target = this.info['info']['target'];
    this.load_all_users_info();
    this.content_panel = document.getElementById('content');
    console.warn('이 자리에서 로컬 채팅 기록 불러오기');
    // 실시간 채팅을 받는 경우 행동처리
    this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.focus_on_input();
      this.messages.push(c);
    }
    // 온라인이라면 마지막 대화 기록을 받아온다
    this.pull_msg_from_server();
  }

  /** 모든 사용자 정보를 받아오기 */
  load_all_users_info() {
    console.warn('모든 사용자 정보를 준비하기');
  }

  /** 사용자 입력 */
  userInput = {
    text: '',
  }

  /** 서버로부터 메시지 더 받아오기 */
  pull_msg_from_server() {
    if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online' && this.next_cursor !== undefined)
      this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
        this.nakama.servers[this.isOfficial][this.target].session,
        this.info['id'], 15, false, this.next_cursor).then(v => {
          console.warn('로컬 채팅 기록과 대조하여 내용이 다르다면 계속해서 불러오기처리 필요');
          v.messages.forEach(msg => {
            this.messages.unshift(msg);
          });
          this.next_cursor = v.next_cursor;
        });
  }

  /** 모바일 키보드 높이 맞추기용 */
  focus_on_input() {
    setTimeout(() => {
      this.content_panel.scrollIntoView({ block: 'start' });
    }, 0);
  }

  send() {
    if (!this.userInput.text) return;
    this.nakama.servers[this.isOfficial][this.target].socket
      .writeChatMessage(this.info['id'], {
        msg: this.userInput.text
      }).then(_v => {
        this.userInput.text = '';
      });
  }

  ionViewWillLeave() {
    delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
    this.noti.Current = undefined;
  }
}
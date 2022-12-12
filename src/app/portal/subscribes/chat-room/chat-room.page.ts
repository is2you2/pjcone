import { Component, OnInit } from '@angular/core';
import { Channel } from '@heroiclabs/nakama-js';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

interface ExtendButtonForm {
  title: string;
  /** 크기: 64 x 64 px */
  icon: string;
  /** 마우스 커서 스타일 */
  cursor?: string;
  act: Function;
}

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
    private p5toast: P5ToastService,
  ) { }

  info: Channel;
  isOfficial: string;
  target: string;

  messages = [];
  /** 사용자 정보 일람 */
  users = {};
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [{
    title: '채널 삭제',
    icon: '', // 아이콘 상대경로
    act: () => {
      if (this.info['status'] != 'missing') {
        if (this.info['redirect']['type'] != 3)
          this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
        else {
          this.p5toast.show({
            text: '이 채널은 그룹에 귀속되어 있습니다.',
          });
          return;
        }
      }
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
      this.nakama.rearrange_channels();
      this.modalCtrl.dismiss();
    }
  },
  {
    title: '파일 첨부',
    icon: '',
    cursor: 'copy',
    act: () => {
      console.log('파일 첨부');
    }
  },
  ];

  next_cursor = '';
  prev_cursor = '';
  content_panel: HTMLElement;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.noti.Current = this.info['id'];
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
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
  pull_msg_from_server(isHistory = true) {
    if (isHistory) {
      if ((this.info['status'] == 'online' || this.info['status'] == 'pending') && this.next_cursor !== undefined)
        this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.info['id'], 15, false, this.next_cursor).then(v => {
            console.warn('로컬 채팅id 기록과 대조하여 내용이 다르다면 계속해서 불러오기처리 필요');
            v.messages.forEach(msg => {
              msg = this.nakama.modulation_channel_message(msg, this.isOfficial, this.target);
              if (!this.info['last_comment'])
                this.info['last_comment'] = msg['content']['msg'];
              this.messages.unshift(msg);
            });
            this.next_cursor = v.next_cursor;
            this.prev_cursor = v.prev_cursor;
          });
    } else {
      console.log('현 상태보다 최근 기록 불러오기');
    }
  }

  isExpanded = false;

  open_ext_with_delay() {
    setTimeout(() => {
      this.isExpanded = !this.isExpanded;
    }, 60);
  }

  /** 모바일 키보드 높이 맞추기용 */
  focus_on_input() {
    setTimeout(() => {
      this.isExpanded = false;
      this.content_panel.scrollIntoView({ block: 'start' });
    }, 0);
  }

  send() {
    if (!this.userInput.text) return;
    this.nakama.servers[this.isOfficial][this.target].socket
      .writeChatMessage(this.info['id'], {
        msg: this.userInput.text,
      }).then(_v => {
        this.userInput.text = '';
      });
  }

  ionViewWillLeave() {
    if (this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
    this.noti.Current = undefined;
  }
}
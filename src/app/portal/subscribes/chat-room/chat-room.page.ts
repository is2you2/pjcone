import { Component, OnInit } from '@angular/core';
import { Channel, ChannelMessage } from '@heroiclabs/nakama-js';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import * as p5 from "p5";

interface FileInfo {
  id?: string;
  name?: string;
  ext?: string;
  /** 전체 파일 크기 */
  size?: number;
  result?: string;
}

interface ExtendButtonForm {
  title: string;
  /** 버튼 숨기기 */
  isHide?: boolean;
  /** 아이콘 상대경로-이름, 크기: 64 x 64 px */
  icon?: string;
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
    title: '삭제',
    act: () => {
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
      this.nakama.rearrange_channels();
      this.modalCtrl.dismiss();
    }
  },
  {
    title: '나가기',
    act: () => {
      if (this.info['redirect']['type'] != 3) {
        this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
        this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
        this.nakama.rearrange_channels();
        this.extended_buttons[0].isHide = false;
        this.extended_buttons[1].isHide = true;
      } else {
        this.p5toast.show({
          text: '이 채널은 그룹에 귀속되어 있습니다.',
        });
        return;
      }
    }
  },
  {
    title: '파일 첨부',
    icon: '',
    cursor: 'copy',
    act: () => {
      document.getElementById('file_sel').click();
    }
  },
  ];

  /** 파일 첨부하기 */
  inputFileSelected(ev: any) {
    this.userInput['file'] = {};
    this.userInput.file['name'] = ev.target.files[0].name;
    this.userInput.file['ext'] = ev.target.files[0].name.split('.')[1] || ev.target.files[0].type || '검토 불가';
    this.userInput.file['size'] = ev.target.files[0].size;
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.userInput.file['result'] = ev.target.result.replace(/"|\\|=/g, '');
    }
    reader.readAsDataURL(ev.target.files[0]);
  }

  /** 옛날로 가는 커서 */
  next_cursor = '';
  /** 최근으로 가는 커서 */
  prev_cursor = '';
  content_panel: HTMLElement;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.noti.Current = this.info['id'];
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
    this.content_panel = document.getElementById('content');
    console.warn('이 자리에서 로컬 채팅 기록 불러오기');
    // 실시간 채팅을 받는 경우 행동처리
    this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.check_sender_and_show_name(c);
      console.warn('마지막 발송자를 검토하여 이름 추가 표기 기능 필요');
      console.warn('파일 여부를 검토하여 last_comment에만 파일 포함 여부 표시');
      this.messages.push(c);
      setTimeout(() => {
        this.content_panel.scrollIntoView({ block: 'start' });
      }, 0);
    }
    this.extended_buttons[0].isHide = this.info['status'] != 'missing';
    this.extended_buttons[1].isHide = this.info['status'] == 'missing';
    // 온라인이라면 마지막 대화 기록을 받아온다
    this.pull_msg_from_server();
    this.follow_resize();
  }

  /** 발신인 표시를 위한 메시지 추가 가공 */
  check_sender_and_show_name(c: ChannelMessage) {
    c['color'] = (c.sender_id.replace(/[^8-9a-f]/g, '') + 'abcdef').substring(0, 6);
    if (c.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id)
      c['user_display_name'] = this.nakama.users.self['display_name'];
    else c['user_display_name'] = this.nakama.load_other_user(c.sender_id, this.isOfficial, this.target)['display_name'];
    c['user_display_name'] = c['user_display_name'] || '이름 없는 사용자';
  }

  p5canvas: p5;
  /** 창 조절에 따른 최대 화면 크기 조정 */
  follow_resize() {
    let sketch = (p: p5) => {
      let mainTable = document.getElementById('main_table');
      let mainDiv = document.getElementById('main_div');
      let inputTable = document.getElementById('input_table');
      let ext_menu = document.getElementById('ext_menu');
      p.setup = () => {
        setTimeout(() => {
          p.windowResized();
        }, 100);
        p.noLoop();
      }
      p.windowResized = () => {
        setTimeout(() => {
          mainDiv.setAttribute('style', `max-width: ${mainTable.parentElement.offsetWidth}px; max-height: ${mainTable.parentElement.clientHeight - inputTable.offsetHeight - ext_menu.offsetHeight}px`);
        }, 0);
      }
    }
    this.p5canvas = new p5(sketch);
  }

  /** 사용자 입력 */
  userInput = {
    file: undefined as FileInfo,
    text: '',
  }

  /** 서버로부터 메시지 더 받아오기
   * @param isHistory 옛날 정보 불러오기 유무, false면 최신정보 불러오기 진행
   */
  pull_msg_from_server(isHistory = true) {
    if (isHistory) {
      if ((this.info['status'] == 'online' || this.info['status'] == 'pending')) // 온라인 기반 리스트 받아오기
        this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.info['id'], 15, false, this.next_cursor).then(v => {
            console.warn('로컬 채팅id 기록과 대조하여 내용이 다르다면 계속해서 불러오기처리 필요');
            v.messages.forEach(msg => {
              msg = this.nakama.modulation_channel_message(msg, this.isOfficial, this.target);
              this.check_sender_and_show_name(msg);
              if (!this.info['last_comment'])
                this.info['last_comment'] = msg['content']['msg'];
              this.messages.unshift(msg);
            });
            this.next_cursor = v.next_cursor;
            this.prev_cursor = v.prev_cursor;
          });
      else { // 오프라인 기반 리스트 알려주기
        let tmp = [{
          content: {
            msg: '오프라인 기록 열람 기능 준비중',
          }
        }, {
          content: {
            msg: '온라인 상태여야 합니다.',
          }
        }];
        this.next_cursor = undefined;
        tmp.forEach(tmsg => this.messages.unshift(tmsg));
      }
    } else {
      console.log('현 상태보다 최근 기록 불러오기');
    }
  }

  isHidden = true;

  /** 핸드폰 가상키보드의 움직임을 고려하여 눈이 덜 불편하도록 지연 */
  open_ext_with_delay(force?: boolean) {
    this.isHidden = force || !this.isHidden;
    setTimeout(() => {
      this.p5canvas.windowResized();
      setTimeout(() => {
        this.content_panel.scrollIntoView({ block: 'start' });
      }, 0);
    }, 120);
  }

  send() {
    if (!this.userInput.text && !this.userInput['file']) return;
    let result = {};
    result['msg'] = this.userInput.text;
    let upload: string[] = [];
    if (this.userInput.file) { // 파일 첨부시
      result['filename'] = this.userInput.file.name;
      result['filesize'] = this.userInput.file.size;
      result['file_ext'] = this.userInput.file.ext;
      result['msg'] = result['msg'] || '(첨부파일 수신)';
      const SIZE_LIMIT = 240000;
      let seek = 0;
      while (seek < this.userInput.file.size) {
        let next = seek + SIZE_LIMIT;
        if (next > this.userInput.file.result.length)
          next = this.userInput.file.result.length;
        upload.push(this.userInput.file.result.substring(seek, next));
        seek = next;
      }
      result['partsize'] = upload.length;
    }
    this.nakama.servers[this.isOfficial][this.target].socket
      .writeChatMessage(this.info['id'], result).then(v => {
        /** 업로드가 진행중인 메시지 개체 */
        let worked = 0;
        for (let i = 0, j = upload.length; i < j; i++) // 첨부 파일이 포함된 경우
          this.nakama.servers[this.isOfficial][this.target].client.writeStorageObjects(
            this.nakama.servers[this.isOfficial][this.target].session, [{
              collection: 'file_public',
              key: `msg_${v.message_id}_${i}`,
              permission_read: 2,
              permission_write: 1,
              value: { data: upload[i] },
            }]).then(_f => {
              worked++;
              console.warn('업로드 경과 게시하기: ', worked, '/', j);
            }).catch(e => {
              console.error(`${i}번째 파일 올리기 오류`, e);
            });
        delete this.userInput.file;
        this.userInput.text = '';
      });
  }

  /** 메시지 정보 상세 */
  message_detail(msg: any) {
    console.warn('긴 클릭시 행동.. 메시지 상세 정보 표시: ', msg);
  }

  /** 메시지 내 파일 정보 */
  file_detail(msg: any) {
    console.warn('짧은 클릭으로 파일이 있는 메시지 정보 표시: ', msg);
  }

  ionViewWillLeave() {
    if (this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
    this.noti.Current = undefined;
    this.p5canvas.remove();
  }
}
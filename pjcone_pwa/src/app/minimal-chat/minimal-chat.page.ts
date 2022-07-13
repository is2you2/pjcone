import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Channel } from '@capacitor/local-notifications';
import { ModalController } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';

/** 메시지 받기 폼 */
interface ReceivedTextForm {
  target?: string;
  color: string;
  text: string;
}

/** MiniRanchat 에 있던 기능 이주, 대화창 구성 */
@Component({
  selector: 'app-minimal-chat',
  templateUrl: './minimal-chat.page.html',
  styleUrls: ['./minimal-chat.page.scss'],
})
export class MinimalChatPage implements OnInit {

  constructor(
    private client: MiniranchatClientService,
    private modal: ModalController,
    private device: Device,
    private noti: LocalNotiService,
    private title: Title,
  ) { }

  uuid = this.device.uuid;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'simplechat';
  iconColor = '#dddddd';
  /** 지금 연결된 사람 수 */
  ConnectedNow = 0;
  content_panel: HTMLElement;
  NotiChannelInfo: Channel = {
    id: this.Header,
    name: 'Project: 랜덤채팅',
    description: 'desc',
    lightColor: this.iconColor,
    lights: true,
    visibility: 0,
    importance: 3,
    vibration: false,
    // sound: '',
  };

  ngOnInit() {
    this.noti.Current = this.Header;
    this.noti.create_channel(this.NotiChannelInfo);

    this.content_panel = document.getElementById('content');
    this.title.setTitle('커뮤니티 랜덤채팅');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/${this.Header}.png`);

    this.client.initialize();
    this.client.funcs.onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        let isMe = this.uuid == data['uid'];
        let target = isMe ? '나' : '상대방';
        this.userInput.logs.push({ color: isMe ? 'bbf' : data['uid'] ? data['uid'].substring(0, 3) : '888', text: data['msg'], target: target });
      } catch (e) {
        switch (v) {
          case 'GOT_MATCHED':
            this.userInput.logs.length = 0;
            this.userInput.logs.push({ color: '8bb', text: '누군가를 만났습니다.' });
            this.status = 'linked';
            break;
          case 'PARTNER_OUT':
            this.userInput.logs.push({ color: 'b88', text: '상대방이 나갔습니다.' });
            this.status = 'unlinked';
            break;
          default:
            this.userInput.logs.push({ color: '888', text: '대화 상대를 기다립니다..' });
            let sep = v.split(':');
            this.ConnectedNow = parseInt(sep[1]);
            break;
        }
      }
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.client.funcs.onclose = (v: any) => {
      this.userInput.logs.push({ color: 'faa', text: '채팅 참가에 실패했습니다.' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.client.funcs.onopen = (v: any) => {
      this.client.funcs.onclose = (v: any) => {
        this.userInput.logs.push({ color: 'faa', text: '저런!! 팅겼어요.. ㅜㅜ' });
        this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /** 사용자 상태 */
  status: 'idle' | 'linked' | 'unlinked' = 'idle';
  /** 사용자 입력과 관련된 것들 */
  userInput = {
    /** 채팅, 로그 등 대화창에 표기되는 모든 것 */
    logs: [{ color: 'bbb', text: '랜덤채팅에 참가합니다.' } as ReceivedTextForm],
    /** 작성 텍스트 */
    text: '',
  }

  /** 랜덤채팅에 참여하기, 대화 끊고 다시 연결 */
  join_ranchat() {
    if (this.client.client.readyState == this.client.client.OPEN) {
      this.client.send('REQ_REGROUPING');
      this.userInput.logs.length = 0;
      this.userInput.logs.push({ color: 'bbb', text: '새로운 상대를 기다립니다..' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else { // 서버 연결중 아닐 때
      this.userInput.logs.push({ color: 'faa', text: '시작할 수 없어요..' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /** 메시지 보내기 */
  send_to() {
    let data = {
      uid: this.uuid,
      msg: this.userInput.text,
    }
    this.client.send(JSON.stringify(data));
    this.userInput.text = '';
  }

  /** 채팅 앱 종료하기 */
  quit_chat() {
    this.client.funcs.onclose = () => {
      this.userInput.logs.push({ color: 'ffa', text: '랜덤채팅에서 벗어납니다.' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.noti.remove_channel(this.NotiChannelInfo);
    console.warn('modal.dismiss() 설정 필요');
    this.client.disconnect();
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
  }
}

import { Component, OnInit } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { ModalController } from '@ionic/angular';
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
  ) { }

  uuid = this.device.uuid;

  ngOnInit() {
    this.client.initialize();
    this.client.funcs.onmessage = (v: any) => {
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
          case 'LONG_TIME_NO_SEE':
            this.userInput.logs.push({ color: '888', text: '대화 상대를 기다립니다..' });
            break;
          default:
            console.error('예상하지 못한 입력값: ', v);
            break;
        }
      }
    }
    this.client.funcs.onclose = (v: any) => {
      this.userInput.logs.push({ color: 'faa', text: '채팅 참가에 실패했습니다.' });
    }
    this.client.funcs.onopen = (v: any) => {
      this.client.funcs.onclose = (v: any) => {
        this.userInput.logs.push({ color: 'faa', text: '저런!! 팅겼어요.. ㅜㅜ' });
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
    this.client.send('REQ_REGROUPING');
    this.userInput.logs.length = 0;
    this.userInput.logs.push({ color: 'bbb', text: '새로운 상대를 기다립니다..' });
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
    }
    console.warn('modal.dismiss() 설정 필요');
    this.client.disconnect();
  }
}

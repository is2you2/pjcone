import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Channel } from '@capacitor/local-notifications';
import { ModalController, NavParams } from '@ionic/angular';
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
    private bgmode: BackgroundMode,
    private params: NavParams,
  ) { }

  uuid = this.device.uuid;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'simplechat';
  iconColor = '#dddddd';
  lnId = 11;
  summaryText = '미니랜챗';
  /** 지금 연결된 사람 수 */
  ConnectedNow = 0;
  req_refreshed = false;
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
    this.bgmode.on('deactivate').subscribe(() => {
      this.noti.CancelNoti({ notifications: [{ id: this.lnId }] });
    })
    this.noti.Current = this.Header;
    this.noti.create_channel(this.NotiChannelInfo);
    this.noti.register_action({
      types: [{
        id: 'reply',
        actions: [{
          id: 'send',
          title: '답장',
          input: true,
        }, {
          id: 'reconn',
          title: '새 대화'
        }]
      }, {
        id: 'reconn',
        actions: [{
          id: 'reconn',
          title: '새 대화',
        }],
      }, {
        id: 'exit',
        actions: [{
          id: 'exit',
          title: '종료하기',
        }]
      }]
    });
    this.noti.addNotiListener('Performed', (v: any) => {
      let type: string = v['actionId'];
      switch (type) {
        case 'send': // 입력값 보내기
          this.noti.CancelNoti({ notifications: [{ id: this.lnId }] });
          this.bgmode.moveToBackground();
          this.send_to(v['inputValue']);
          break;
        case 'reconn':
          this.bgmode.moveToBackground();
          this.join_ranchat();
          break;
        case 'exit':
          this.bgmode.moveToBackground();
          this.quit_chat();
        default:
          console.warn('준비하지 않은 행동: ', type);
          break;
      }
    });

    this.content_panel = document.getElementById('content');
    this.title.setTitle('Project: 랜덤채팅');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/${this.Header}.png`);

    this.client.initialize(this.params.get('address'));
    this.client.funcs.onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        let isMe = this.uuid == data['uid'];
        let target = isMe ? '나' : '상대방';
        this.userInput.logs.push({ color: isMe ? 'bbf' : data['uid'] ? data['uid'].substring(0, 3) : '888', text: data['msg'], target: target });
        if (!isMe) {
          this.noti.PushLocal({
            id_ln: this.lnId,
            title: target,
            body: data['msg'],
            largeBody_ln: data['msg'],
            iconColor_ln: this.iconColor,
            summaryText_ln: this.summaryText,
            actionTypeId_ln: 'reply',
            smallIcon_ln: this.Header,
            channelId_ln: this.Header,
            autoCancel_ln: true,
          }, this.Header);
          this.content_panel.style.height = '32px';
        }
      } catch (e) {
        switch (v) {
          case 'GOT_MATCHED':
            this.userInput.logs.length = 0;
            this.userInput.logs.push({ color: '8bb', text: '누군가를 만났습니다.' });
            this.status = 'linked';
            this.noti.PushLocal({
              id_ln: this.lnId,
              title: '누군가를 만났습니다.',
              actionTypeId_ln: 'reply',
              largeBody_ln: '',
              iconColor_ln: this.iconColor,
              summaryText_ln: this.summaryText,
              smallIcon_ln: this.Header,
              channelId_ln: this.Header,
              autoCancel_ln: true,
            }, this.Header);
            break;
          case 'PARTNER_OUT':
            this.userInput.logs.push({ color: 'b88', text: '상대방이 나갔습니다.' });
            this.status = 'unlinked';
            this.noti.PushLocal({
              id_ln: this.lnId,
              title: '상대방이 나갔습니다.',
              largeBody_ln: '',
              actionTypeId_ln: 'reconn',
              iconColor_ln: this.iconColor,
              summaryText_ln: this.summaryText,
              smallIcon_ln: this.Header,
              channelId_ln: this.Header,
              autoCancel_ln: true,
            }, this.Header);
            break;
          default:
            let sep = v.split(':');
            this.ConnectedNow = parseInt(sep[1]);
            if (sep[0] == 'LONG_TIME_NO_SEE')
              this.userInput.logs.push({ color: '888', text: '대화 상대를 기다립니다..' });
            break;
        }
      }
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.client.funcs.onclose = (v: any) => {
      this.userInput.logs.push({ color: 'faa', text: '채팅 참가에 실패했습니다.' });
      this.content_panel.style.height = '32px';
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.noti.PushLocal({
        id_ln: this.lnId,
        title: '채팅 참가에 실패했습니다.',
        largeBody_ln: '',
        actionTypeId_ln: 'exit',
        iconColor_ln: this.iconColor,
        summaryText_ln: this.summaryText,
        smallIcon_ln: this.Header,
        channelId_ln: this.Header,
        autoCancel_ln: true,
      }, this.Header);
    }
    this.client.funcs.onopen = (v: any) => {
      this.client.funcs.onclose = (v: any) => {
        this.userInput.logs.push({ color: 'faa', text: '저런!! 팅겼어요.. ㅜㅜ' });
        this.content_panel.style.height = '32px';
        this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.noti.PushLocal({
          id_ln: this.lnId,
          title: '저런!! 팅겼어요.. ㅜㅜ',
          largeBody_ln: '',
          actionTypeId_ln: 'exit',
          iconColor_ln: this.iconColor,
          summaryText_ln: this.summaryText,
          smallIcon_ln: this.Header,
          channelId_ln: this.Header,
          autoCancel_ln: true,
        }, this.Header);
      }
    }
  }

  /** 사용자 상태: 키보드 종류 노출 제어용 */
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
      this.content_panel.style.height = '32px';
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.req_refreshed = true;
      setTimeout(() => {
        this.req_refreshed = false;
      }, 5000);
    } else { // 서버 연결중 아닐 때
      this.userInput.logs.push({ color: 'faa', text: '시작할 수 없어요..' });
      this.content_panel.style.height = '32px';
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.noti.PushLocal({
        id_ln: this.lnId,
        title: '시작할 수 없어요..',
        largeBody_ln: '',
        actionTypeId_ln: 'exit',
        iconColor_ln: this.iconColor,
        summaryText_ln: this.summaryText,
        smallIcon_ln: this.Header,
        channelId_ln: this.Header,
        autoCancel_ln: true,
      }, this.Header);
    }
  }

  /** 모바일 키보드 높이 맞추기용 */
  focus_on_input() {
    this.content_panel.style.height = '0px';
    let loop = setInterval(() => {
      this.content_panel.scrollIntoView({ block: 'start' });
    }, 1 / 24);
    setTimeout(() => {
      clearInterval(loop);
    }, 500);
  }

  /** 메시지 보내기 */
  send_to(text?: string) {
    let data = {
      uid: this.uuid,
      msg: text || this.userInput.text,
    }
    if (!data.msg.trim()) return;
    this.client.send(JSON.stringify(data));
    this.userInput.text = '';
    this.focus_on_input();
  }

  /** 채팅 앱 종료하기 */
  quit_chat() {
    this.client.funcs.onclose = () => {
      this.userInput.logs.push({ color: 'ffa', text: '랜덤채팅에서 벗어납니다.' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.noti.CancelNoti({ notifications: [{ id: this.lnId }] });
    this.noti.remove_channel(this.NotiChannelInfo);
    this.noti.removeNotiListener();
    this.client.disconnect();
    this.modal.dismiss();
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.quit_chat();
  }
}

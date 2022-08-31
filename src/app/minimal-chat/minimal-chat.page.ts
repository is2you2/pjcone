import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { ILocalNotificationAction, ILocalNotificationActionType } from '@awesome-cordova-plugins/local-notifications/ngx';
import { ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';
import * as p5 from 'p5';

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
    public client: MiniranchatClientService,
    public modalCtrl: ModalController,
    private device: Device,
    private noti: LocalNotiService,
    private title: Title,
    private bgmode: BackgroundMode,
    private params: NavParams,
  ) { }

  uuid = this.device.uuid;
  header_title: string;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'simplechat';
  iconColor = 'd8d8d8';
  lnId = 11;
  summaryText = '미니랜챗';
  req_refreshed = false;
  content_panel: HTMLElement;

  reply_act: ILocalNotificationAction[];

  /** 이 창 열기(알림 상호작용) */
  open_this = () => {
    if (this.noti.Current != this.Header)
      this.modalCtrl.create({
        component: MinimalChatPage,
        componentProps: {
          name: this.params.get('name'),
        },
      }).then(v => v.present());
  }

  ngOnInit() {
    let get_address = this.params.get('address');
    let name = this.params.get('name');
    this.noti.Current = this.Header;
    this.content_panel = document.getElementById('content');
    this.title.setTitle(get_address ? 'Project: 그룹채팅' : 'Project: 랜덤채팅');
    this.header_title = get_address ? '그룹 채팅' : '미니랜챗';
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/${this.Header}.png`);

    if (!this.client.client || this.client.client.readyState != this.client.client.OPEN) {
      this.noti.SetListener('click', this.open_this);
      this.noti.SetListener('send', (v: any, eopts: any) => {
        this.noti.ClearNoti(v['id']);
        this.send(eopts['text']);
      });
      this.noti.SetListener('reconn', (v: any) => {
        this.noti.ClearNoti(v['id']);
        this.join_ranchat();
      });
      this.noti.SetListener('exit', (v: any) => {
        this.noti.ClearNoti(v['id']);
        this.quit_chat();
      });
      this.bgmode.on('deactivate').subscribe(() => {
        this.noti.ClearNoti(this.lnId);
      });
      this.reply_act = [{
        id: 'send',
        type: ILocalNotificationActionType.INPUT,
        title: '답장',
      }];
      if (get_address) {
        this.client.status = 'custom';
        this.summaryText = '그룹채팅';
      } else {
        this.reply_act.push({
          id: 'reconn',
          title: '새 대화',
          launch: false,
        });
      }
      this.client.userInput.logs.length = 0;
      this.client.userInput.logs.push({ color: 'bbb', text: this.client.status == 'custom' ? '그룹채팅에 참가합니다.' : '랜덤채팅에 참가합니다.' });
      this.client.initialize(get_address);
    }
    this.client.funcs.onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        let isMe = this.uuid == data['uid'];
        let target = isMe ? (name || '나') : (data['name'] || (this.client.status == 'custom' ? '참여자' : '상대방'));
        let color = data['uid'] ? data['uid'].substring(0, 3) : '888';
        if (data['msg'])
          this.client.userInput.logs.push({ color: color, text: data['msg'], target: target });
        else if (data['type']) {
          if (data['type'] == 'join')
            this.client.userInput.logs.push({ color: color, text: '그룹에 참여했습니다.', target: target });
          else
            this.client.userInput.logs.push({ color: color, text: '그룹을 떠났습니다.', target: target });
        }
        if (data['count']) this.client.ConnectedNow = data['count'];
        if (data['msg'])
          this.noti.PushLocal({
            id: this.lnId,
            title: target,
            body: data['msg'],
            iconColor_ln: this.iconColor,
            actions_ln: this.reply_act,
          }, this.Header, this.open_this);
        else if (data['type']) {
          let isJoin = data['type'] == 'join';
          this.noti.PushLocal({
            id: this.lnId,
            title: isJoin ? '사용자 참여' : '사용자 떠남',
            body: target + ` | ${isJoin ? '그룹에 참여했습니다.' : '그룹을 떠났습니다.'}`,
            iconColor_ln: this.iconColor,
            autoCancel_ln: true,
          }, this.Header, this.open_this);
        }
      } catch (e) {
        switch (v) {
          case 'GOT_MATCHED':
            this.client.userInput.logs.length = 0;
            this.client.userInput.logs.push({ color: '8bb', text: '누군가를 만났습니다.' });
            this.client.status = 'linked';
            this.noti.PushLocal({
              id: this.lnId,
              title: '누군가를 만났습니다.',
              actions_ln: [{
                id: 'send',
                type: ILocalNotificationActionType.INPUT,
                title: '인사'
              }],
              iconColor_ln: this.iconColor,
              autoCancel_ln: true,
            }, this.Header, this.open_this);
            break;
          case 'PARTNER_OUT':
            this.client.userInput.logs.push({ color: 'b88', text: '상대방이 나갔습니다.' });
            this.client.status = 'unlinked';
            this.noti.PushLocal({
              id: this.lnId,
              title: '상대방이 나갔습니다.',
              actions_ln: [{
                id: 'reconn',
                title: '새 대화'
              }, {
                id: 'exit',
                title: '끝내기',
                launch: false,
              }],
              iconColor_ln: this.iconColor,
              autoCancel_ln: true,
            }, this.Header, this.open_this);
            break;
          default:
            let sep = v.split(':');
            this.client.ConnectedNow = parseInt(sep[1]);
            break;
        }
      }
      this.focus_on_input();
    }
    this.client.funcs.onclose = (v: any) => {
      this.client.userInput.logs.push({ color: 'faa', text: '채팅 참가에 실패했습니다.' });
      this.focus_on_input();
      this.noti.PushLocal({
        id: this.lnId,
        title: '채팅 참가에 실패했습니다.',
        actions_ln: [{
          id: 'exit',
          title: '끝내기',
          launch: false,
        }],
        iconColor_ln: this.iconColor,
        autoCancel_ln: true,
      }, this.Header, this.open_this);
    }
    this.client.funcs.onopen = (v: any) => {
      if (get_address) {
        let count = {
          uid: this.uuid,
          name: name,
          type: 'join',
        }
        this.client.send(JSON.stringify(count));
      }
      this.client.funcs.onclose = (v: any) => {
        let text = '채팅에 참가할 수 없습니다.';
        this.client.userInput.logs.push({ color: 'faa', text: text });
        this.focus_on_input();
        this.noti.PushLocal({
          id: this.lnId,
          title: text,
          actions_ln: [{
            id: 'exit',
            title: '끝내기',
            launch: false,
          }],
          iconColor_ln: this.iconColor,
          autoCancel_ln: true,
        }, this.Header, this.open_this);
      }
    }
    this.follow_resize();
  }

  p5canvas: p5;
  /** 창 조절에 따른 최대 화면 크기 조정 */
  follow_resize() {
    let sketch = (p: p5) => {
      let mainTable = document.getElementById('main_table');
      let mainDiv = document.getElementById('main_div');
      let inputTable = document.getElementById('input_table');
      p.setup = () => {
        setTimeout(() => {
          p.windowResized();
        }, 100);
        p.noLoop();
      }
      p.windowResized = () => {
        mainDiv.setAttribute('style', `max-width: ${mainTable.offsetWidth}px; max-height: ${mainTable.offsetHeight - inputTable.offsetHeight}px`);
      }
    }
    this.p5canvas = new p5(sketch);
  }

  /** 랜덤채팅에 참여하기, 대화 끊고 다시 연결 */
  join_ranchat() {
    if (this.client.client.readyState == this.client.client.OPEN) {
      this.client.send('REQ_REGROUPING');
      this.client.status = 'unlinked';
      this.client.userInput.logs.length = 0;
      this.client.userInput.logs.push({ color: 'bbb', text: '새로운 상대를 기다립니다..' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.focus_on_input();
      this.req_refreshed = true;
      setTimeout(() => {
        this.req_refreshed = false;
      }, 1000);
    } else { // 서버 연결중 아닐 때
      let text = '시작할 수 없어요..';
      this.client.userInput.logs.push({ color: 'faa', text: text });
      this.focus_on_input();
      this.noti.PushLocal({
        id: this.lnId,
        title: text,
        actions_ln: [{
          id: 'exit',
          title: '끝내기',
          launch: false,
        }],
        iconColor_ln: this.iconColor,
        autoCancel_ln: true,
      }, this.Header, this.open_this);
    }
  }

  /** 모바일 키보드 높이 맞추기용 */
  focus_on_input() {
    setTimeout(() => {
      this.content_panel.scrollIntoView({ block: 'start' });
    }, 0);
  }

  /** 메시지 보내기 */
  send(text?: string) {
    let data = {
      uid: this.uuid,
      msg: text || this.client.userInput.text,
    }
    if (!data.msg.trim()) return;
    let name = this.params.get('name');
    if (name) data['name'] = name;
    this.client.send(JSON.stringify(data));
    this.client.userInput.text = '';
    this.focus_on_input();
  }

  /** 채팅 앱 종료하기 */
  quit_chat() {
    this.client.funcs.onclose = () => {
      this.client.userInput.logs.push({ color: 'ffa', text: this.client.status == 'custom' ? '그룹채팅에서 나옵니다.' : '랜덤채팅에서 벗어납니다.' });
      this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.noti.RemoveListener('click');
    this.noti.RemoveListener('send');
    this.noti.RemoveListener('reconn');
    this.noti.RemoveListener('exit');
    this.noti.ClearNoti(this.lnId);
    this.client.disconnect();
    this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.noti.Current = 'settings';
    this.p5canvas.remove();
  }
}

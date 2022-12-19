import { Injectable } from '@angular/core';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';

/** 앱 시작과 동시에 서버에 연결을 시도하여 실시간 상호작용하는 메인 클라이언트 */
@Injectable({
  providedIn: 'root'
})
export class WscService {

  constructor(
    private statusBar: StatusManageService,
    private p5toast: P5ToastService,
    private bgmode: BackgroundMode,
  ) { }
  /** 관리자 여부를 확인하여 관리자 메뉴 토글에 사용 */
  is_admin = false;
  client: WebSocket;
  /** 받았을 때 취할 행동
   * 1개 변수에서 메시지를 받아야 함
   * ```javascript
   * received(msg: string);
   * ```
   */
  received: { [id: string]: Function } = {};
  /** 서버로부터 연결이 끊어졌을 때 취하게 될 행동들 */
  disconnected: { [id: string]: Function } = {};

  socket_header = 'wss';
  address_override = '';

  /**
   * 서버와 반드시 연결시도하는 메인 소켓 클라이언트  
   * 다른 서버, 클라이언트를 생성하는 등의 다양한 역할을 수행할 수 있다.
   */
  initialize() {
    this.address_override = (localStorage.getItem('wsc_address_override') || '').replace(/[^0-9.]/g, '');
    this.socket_header = localStorage.getItem('wsc_socket_header') || 'wss';
    this.statusBar.settings['communityServer'] = 'pending';
    const PORT: number = 12000;
    console.log('여기로 연결해: ', `${this.socket_header}://${this.address_override || SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client = new WebSocket(`${this.socket_header}://${this.address_override || SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client.onopen = (_ev) => {
      this.statusBar.settings['communityServer'] = 'online';
      let online_info = {
        title: '온라인 모드',
        text: '커뮤니티 서버로부터 알림을 받을 수 있습니다.',
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      };
      this.bgmode.setDefaults(online_info);
      this.bgmode.configure(online_info);
    }
    this.client.onclose = (_ev) => {
      let keys = Object.keys(this.disconnected);
      keys.forEach(key => this.disconnected[key]());
      this.statusBar.settings['communityServer'] = 'missing';
      setTimeout(() => {
        this.statusBar.settings['communityServer'] = 'offline';
      }, 1500);
      this.p5toast.show({
        text: '커뮤니티 서버로부터 연결이 끊어졌습니다.',
      });
      let offline_info = {
        title: '오프라인 모드',
        text: '사설서버부터 알림을 받을 수 있습니다.',
        icon: 'icon_mono',
        color: 'ffd94e', // 모자 밑단 노란색
      };
      this.bgmode.setDefaults(offline_info);
      this.bgmode.configure(offline_info);
      this.is_admin = false;
    }
    this.client.onerror = (e) => {
      console.error('메인소켓 오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      ev.data.text().then(v => {
        let json = JSON.parse(v);
        this.received[json['act']](json);
      });
    }
  }

  send(msg: string) {
    if (this.client && this.client.readyState == this.client.OPEN)
      this.client.send(msg);
    else console.warn('메시지 발송 실패: ', msg);
  }
}

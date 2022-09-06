import { Injectable } from '@angular/core';
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
  ) { }

  client: WebSocket;
  /** 받았을 때 취할 행동
   * 1개 변수에서 메시지를 받아야 함
   * ```javascript
   * received(msg: string);
   * ```
   */
  received: Function = (v: string) => console.log('Default receive func: ', v);

  /**
   * 서버와 반드시 연결시도하는 메인 소켓 클라이언트  
   * 다른 서버, 클라이언트를 생성하는 등의 다양한 역할을 수행할 수 있다.
   * @param _Address 서버 주소, 포트 12000 고정
   */
  initialize() {
    this.statusBar.settings['communityServer'] = 'pending';
    const PORT: number = 12000;
    this.client = new WebSocket(`wss://${SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client.onopen = (ev) => {
      this.statusBar.settings['communityServer'] = 'online';
    }
    this.client.onclose = (ev) => {
      this.statusBar.settings['communityServer'] = 'missing';
      setTimeout(() => {
        this.statusBar.settings['communityServer'] = 'offline';
      }, 1500);
      this.p5toast.show({
        text: '커뮤니티 서버로부터 연결이 끊어졌습니다.',
      });
    }
    this.client.onerror = (e) => {
      console.error('메인소켓 오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      ev.data.text().then(v => {
        this.received(v);
      });
    }
  }

  send(msg: string) {
    if (this.client && this.client.readyState == this.client.OPEN)
      this.client.send(msg);
  }
}

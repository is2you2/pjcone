import { Injectable } from '@angular/core';
import { RemoteControllerService } from './remote-controller.service';

/** 앱 시작과 동시에 서버에 연결을 시도하여 실시간 상호작용하는 메인 클라이언트 */
@Injectable({
  providedIn: 'root'
})
export class WscService {

  constructor(
    public remote: RemoteControllerService,
  ) { }

  client: WebSocket;

  initialize(_Address: string) {
    const PORT: number = 12000;
    this.client = new WebSocket(`ws://${_Address}:${PORT}`);
    this.client.onopen = (ev) => {
      console.log('연결됨: ', ev);
    }
    this.client.onclose = (ev) => {
      console.log('연결 끊김: ', ev);
    }
    this.client.onerror = (e) => {
      console.error('오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      console.log('메시지 받음: ', ev);
    }
  }

  send(msg: string) {
    this.client.send(msg);
  }
}

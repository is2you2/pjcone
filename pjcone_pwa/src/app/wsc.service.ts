import { Injectable } from '@angular/core';
import { SOCKET_SERVER_ADDRESS } from './app.component';

/** 앱 시작과 동시에 서버에 연결을 시도하여 실시간 상호작용하는 메인 클라이언트 */
@Injectable({
  providedIn: 'root'
})
export class WscService {

  constructor(
  ) { }

  client: WebSocket;

  /**
   * 서버와 반드시 연결시도하는 메인 소켓 클라이언트  
   * 다른 서버, 클라이언트를 생성하는 등의 다양한 역할을 수행할 수 있다.
   * @param _Address 서버 주소, 포트 12000 고정
   */
  initialize() {
    const PORT: number = 12000;
    this.client = new WebSocket(`ws://${SOCKET_SERVER_ADDRESS}:${PORT}`);
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
      ev.data.text().then(v => {
        console.log('메시지 받음: ', v);
      });
    }
  }

  send(msg: string) {
    this.client.send(msg);
  }
}

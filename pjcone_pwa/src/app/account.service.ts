import { Injectable } from '@angular/core';
import { SOCKET_SERVER_ADDRESS } from './app.component';

/** 회원로그인시 사용하는 소켓 클라이언트 */
@Injectable({
  providedIn: 'root'
})
export class AccountService {

  constructor(
  ) { }

  client: WebSocket;

  /**
   * 회원으로 활동하기 위한 클라이언트
   * @param _Address 서버 주소, 포트 12001 고정
   */
  initialize() {
    const PORT: number = 12001;
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
      console.log('메시지 받음: ', ev);
    }
  }
}

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RemoteControllerService {

  constructor() { }

  client: WebSocket;
  /** 현재 조종중인 페이지 */
  target: any;

  /**
   * 휴대폰으로 간단하게 조종할 수 있는 웹 소켓 기반 리모콘을 운용합니다.
   * @param _Address ws주소, 주소부분만
   * @param _Port 포트
   */
  initialize(_Address: string, _Port: number = 12020) {
    this.client = new WebSocket('ws://' + _Address + ':' + _Port);
    this.client.onopen = (_ev) => {
      console.log('리모콘 연결됨: ', _ev);
    }
    this.client.onclose = (ev) => {
      console.log('연결 끊김: ', ev.code, '/', ev.reason);
    }
    this.client.onmessage = (ev) => {
      console.log('메시지 수신함: ', ev.data);
    }
    this.client.onerror = (e) => {
      // 시작 연결 실패시에도 여기로 접근함
      console.error('wsc 오류: ', e);
    }
  }
}

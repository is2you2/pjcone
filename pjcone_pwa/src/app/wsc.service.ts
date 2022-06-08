import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WscService {

  constructor() { }

  client: WebSocket;

  /**
   * 클라이언트를 생성합니다.
   * @param _Address ws주소, 주소부분만
   * @param _Port 포트
   * @param _initialSend 연결 수립시 바로 보내는 메시지가 있는 경우 기입
   * @param _closeCall 종료 코드 지정하기 (string-Function dict)
   */
  initialize(_Address: string, _Port: number = 12000, _initialSend: string = '', _closeCall = {}) {
    this.client = new WebSocket('ws://' + _Address + ':' + _Port);
    this.client.onopen = (_ev) => {
      console.log('연결 수립됨: ', _ev);
      if (_initialSend != '')
        this.client.send(_initialSend);
    }
    this.client.onclose = (ev) => {
      if (ev.wasClean) {
        console.log('정상적으로 연결 끊김: ', ev.code, '/', ev.reason);
        let keys = Object.keys(_closeCall);
        for (let i = 0, j = keys.length; i < j; i++)
          if (ev.code.toString() == keys[i]) {
            _closeCall[keys[i]]();
            break;
          }
      } else {
        console.warn('불안정하게 연결 끊김');
      }
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

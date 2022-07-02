import { Injectable } from '@angular/core';

/** 리모콘 조작 가능한 페이지임 */
export interface RemotePage {
  /** 웹소켓으로 받은 텍스트를 행동명령으로 바꾸기 위한 함수 링크 묶음
   * ```javascript
   * {
   *   'key': () => Function(), ..
   * }
   * ```
   */
  remote_act: any;
}

/** 화면 리모콘, 휴대폰에서 서버를 열고 데스크탑을 연결하여 원격 제어할 수 있다. */
@Injectable({
  providedIn: 'root'
})
export class RemoteControllerService {

  constructor() { }

  client: WebSocket;
  /** 현재 조종중인 페이지 */
  target: RemotePage;

  /**
   * 휴대폰으로 간단하게 조종할 수 있는 웹 소켓 기반 리모콘을 운용합니다.
   * @param _Address 핸드폰 서버의 주소부분만
   */
  initialize(_Address: string) {
    const _PORT: number = 12020;
    this.client = new WebSocket('ws://' + _Address + ':' + _PORT);
    this.client.onmessage = (ev) => {
      this.target.remote_act[ev.data]();
    }
    this.client.onerror = (e) => {
      // 시작 연결 실패시에도 여기로 접근함
      console.error('리모콘 오류: ', e);
    }
  }
}

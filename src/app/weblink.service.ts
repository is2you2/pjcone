import { Injectable } from '@angular/core';
import { SOCKET_SERVER_ADDRESS } from './app.component';

/** 웹과 앱을 연결짓기 위해 커뮤니티 서버에서 상호간 검토처리
 * 스캔 완료시 동작시키고 발송 후 즉시 종료된다
 */
@Injectable({
  providedIn: 'root'
})
export class WeblinkService {

  constructor() { }

  client: WebSocket;

  /**
   * 연결과 동시에 발송
   * @param json 발송하려는 메시지
   */
  initialize(json: any) {
    const PORT: number = 12020;
    this.client = new WebSocket(`wss://${SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client.onopen = (_ev) => {
      this.client.send(JSON.stringify(json));
    }
    setTimeout(() => {
      this.client.close();
    }, 5000);
  }
}

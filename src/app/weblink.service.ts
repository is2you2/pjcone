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
   * 서버와 반드시 연결시도하는 메인 소켓 클라이언트  
   * 다른 서버, 클라이언트를 생성하는 등의 다양한 역할을 수행할 수 있다.
   * @param target_pid 상대방 pid
   * @param local_address 나의 내부망 주소
   */
  initialize(target_pid: string, local_address: string[]) {
    const PORT: number = 12020;
    this.client = new WebSocket(`wss://${SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client.onopen = (_ev) => {
      let json = {
        from: 'mobile',
        pid: target_pid,
        addresses: local_address,
      };
      this.client.send(JSON.stringify(json));
    }
    setTimeout(() => {
      this.client.close();
    }, 1000);
  }
}

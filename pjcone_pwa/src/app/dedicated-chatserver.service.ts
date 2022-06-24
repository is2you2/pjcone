import { Injectable } from '@angular/core';
import { WebSocketServer } from "@awesome-cordova-plugins/web-socket-server/ngx";
import { isPlatform } from './app.component';

/** 사설 채팅 서버 */
@Injectable({
  providedIn: 'root'
})
export class DedicatedChatserverService {

  constructor() { }
  server: WebSocketServer;
  /** 연결된 사용자 리스트 */
  users = {};

  initialize() {
    if (isPlatform != 'Desktop' && !this.server) { // 서버가 없을 때만 구성 시도
      const PORT: number = 12011;
      this.server = new WebSocketServer();
      console.log('소켓 서버는 비어있어: ', this.server);

      // start websocket server
      this.server.start(PORT, {}).subscribe({
        next: server => console.log(`서버 Listening on ${server.addr}:${server.port}`),
        error: error => console.log(`ws생성 오류 발생: `, error)
      });

      console.log(this.server);

      // 새 사용자 받기
      this.server.watchOpen().subscribe(v => {
        console.log('watchOpen: ', v);
      });

      // 메시지 받기
      this.server.watchMessage().subscribe(v => {
        console.log(`watchMessage: ${v}`);
      });

      // 서버 멈출 때
      this.server.stop().then(server => {
        console.log(`Stop listening on ${server.addr}:${server.port}`);
      });
    } else {
      console.warn('wss가 이미 구성되어 있음: 검토필', this.server);
    }
  }

  /**
   * 클라이언트에게 메시지 발송
   * @param _id 발송받는 id 특정
   * @param _msg 메시지
   */
  send(_id: string, _msg: string) {
    this.server.send({ uuid: _id }, _msg);
  }
}

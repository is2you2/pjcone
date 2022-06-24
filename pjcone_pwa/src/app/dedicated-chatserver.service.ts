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

      this.server.start(PORT, {}).subscribe({
        next: server => console.log(`서버 Listening on ${server.addr}:${server.port}`),
        error: error => console.log(`ws생성 오류 발생: `, error)
      });

      console.log(this.server);

      this.server.watchOpen().subscribe(v => {
        console.log('watchOpen: ', v);
      });

      this.server.watchClose().subscribe(v => {
        console.log('watchClose: ', v);
      });

      this.server.watchFailure().subscribe(e => {
        console.error('watchFailure: ', e);
      });

      this.server.watchMessage().subscribe(v => {
        console.log(`watchMessage: ${v}`);
      });

      // local_addresses
      this.server.getInterfaces().then(v => {
        console.log('getInterfaces: ', v);
      });

      // 서버 멈출 때
    } else {
      console.warn('wss가 이미 구성되어 있음: 검토필', this.server);
    }

  }

  /** 사설 서버 종료 */
  stop() {
    this.server.stop().then(server => {
      console.log(`채팅서버 종료 ${server}`);
    });
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

import { Injectable } from '@angular/core';
import { WebSocketServer } from '@awesome-cordova-plugins/web-socket-server/ngx';
import { isPlatform } from './app.component';

@Injectable({
  providedIn: 'root'
})
export class DedicatedServerService {

  constructor(
    public server: WebSocketServer,
  ) { }
  /** 연결된 사용자 리스트 */
  users = {};

  /**
   * 사설 서버 개설, ionic에서는 기기당 1대로 제한된다
   * @param PORT 서비스별 포트번호, 리스트 참조
   * ```markdown
   * - 12000: 메인 서버
   * - 12010: 이메일 서버
   * - 12011: 채팅 서버
   * - 12020: 리모콘 서버
   * ```
   */
  initialize(PORT: number) {
    if (isPlatform != 'Desktop') {
      console.log('소켓 서버는 비어있어: ', this.server);

      this.server.start(PORT, {}).subscribe({
        next: (server: any) => console.log(`서버 Listening on ${server.addr}:${server.port}`),
        error: (error: any) => console.log(`ws생성 오류 발생: `, error)
      });

      console.log(this.server);

      this.server.watchOpen().subscribe((v: any) => {
        console.log('watchOpen: ', v);
      });

      this.server.watchClose().subscribe((v: any) => {
        console.log('watchClose: ', v);
      });

      this.server.watchFailure().subscribe((e: any) => {
        console.error('watchFailure: ', e);
      });

      this.server.watchMessage().subscribe((v: any) => {
        console.log(`watchMessage: ${v}`);
      });

      // local_addresses
      this.server.getInterfaces().then((v: any) => {
        console.log('getInterfaces: ', v);
      });

      // 서버 멈출 때
    } else {
      console.warn('플랫폼 불일치: ', this.server);
    }

  }

  /** 사설 서버 종료 */
  stop() {
    this.server.stop().then((server: any) => {
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

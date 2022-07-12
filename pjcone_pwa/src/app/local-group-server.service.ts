import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';

declare var cordova: any;

/** 기존 MiniRanchat에 내장된 릴레이 서버와 동일한 서버  
 * 동작 방식 역시 동일하게 구현되어있다
 */
@Injectable({
  providedIn: 'root'
})
export class LocalGroupServerService {

  server: any;
  /** 연결된 사용자 리스트 */
  users = {};

  /**
   * 사설 서버 개설, ionic에서는 기기당 1대로 제한된다
   * @param PORT 서비스별 포트번호, 리스트 참조
   * ```markdown
   * - 12011: 채팅 서버
   * ```
   */
  initialize() {
    const PORT = 12011;
    if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
      if (!this.server)
        this.server = cordova.plugins.wsserver;

      this.server.start(PORT, {
        // WebSocket Server handlers
        'onFailure': (addr, port, reason) => {
          console.error('Stopped listening on %s:%d. Reason: %s', addr, port, reason);
        },
        // WebSocket Connection handlers
        'onOpen': (conn) => {
          /* conn: {
           'uuid' : '8e176b14-a1af-70a7-3e3d-8b341977a16e',
           'remoteAddr' : '192.168.1.10',
           'httpFields' : {...},
           'resource' : '/?param1=value1&param2=value2'
           } */
          console.log('A user connected from %s', conn.remoteAddr);
        },
        'onMessage': (conn, msg) => {
          console.log(conn, msg); // msg can be a String (text message) or ArrayBuffer (binary message)
        },
        'onClose': (conn, code, reason, wasClean) => {
          console.log('A user disconnected from %s', conn.remoteAddr);
        },
        // Other options
        'origins': [], // validates the 'Origin' HTTP Header.
        'protocols': [], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
        'tcpNoDelay': true // disables Nagle's algorithm.
      }, (addr, port) => { // 시작할 때
        console.log('서버 Listening on %s:%d', addr, port);
      }, (reason) => { // 종료될 때
        console.error('Did not start. Reason: %s', reason);
      });

    } else {
      console.warn('플랫폼 불일치: 사설 서버 구축 취소');
    }
  }

  /** 로컬 주소 리스트 */
  getInterfaces() {
    this.server.getInterfaces((result: any) => {
      // 활용방법 필요
      console.log('local-addresses: ', result);
    });
  }

  /** 사용자 끊기 */
  disconnect_peer(id: string, code: number = 4000, reason: string = 'NULL') {
    this.server.close({ 'uuid': id }, code, reason);
  }

  /** 사설 서버 종료 */
  stop() {
    this.server.stop(function onStop(addr, port) {
      console.log('Stopped listening on %s:%d', addr, port);
    });
  }

  /**
   * 클라이언트에게 메시지 발송
   * @param _id 발송받는 id 특정
   * @param _msg 메시지
   */
  send(id: string, msg: string) {
    this.server.send({ 'uuid': id }, msg);
  }
}

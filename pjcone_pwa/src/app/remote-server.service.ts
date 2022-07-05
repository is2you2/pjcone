import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';

declare var cordova: any;

/** 리모콘 셀프 서버 운용시 생성  
 * 연결된 사용자는 전부 동일한 사람이라고 간주되므로, 전원 릴레이 처리를 한다.  
 * plain-text 기반 페이지 정보 공유
 */
@Injectable({
  providedIn: 'root'
})
export class RemoteServerService {

  constructor() { }
  server = cordova.plugins.wsserver;
  /** 연결된 사용자 리스트
   * ```javascript
   * {
   *   uuid: { addr }, ..
   * }
   * ```
   */
  users = {};

  /**
   * 리모콘용 서버 개설  
   * 사설 서버의 일종이나 주로 메인 서버와의 교류로 연결되므로  
   * 연결된 모든 사용자에게 자료가 릴레이된다.
   * @param PORT 서비스별 포트번호, 리스트 참조
   * ```markdown
   * - 12011: 채팅 서버
   * ```
   */
  initialize() {
    if (isPlatform != 'DesktopPWA') {
      this.server.start(12020, {
        'onFailure': (addr, port, reason) => console.error('Stopped listening on %s:%d. Reason: %s', addr, port, reason),
        'onOpen': (conn) => this.users[conn.uuid] = { 'addr': conn.remoteAddr },
        'onMessage': (_conn, msg) => this.send_to_all(msg),
        'onClose': (conn, _code, _reason, _wasClean) => delete this.users[conn.uuid],
        'origins': [], // validates the 'Origin' HTTP Header.
        'protocols': [], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
        'tcpNoDelay': true // disables Nagle's algorithm.
      }, function onStart(addr, port) {
        console.log('서버 Listening on %s:%d', addr, port);
      }, function onDidNotStart(reason) {
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

  /** 모든 연결된 피어들에게 발송 */
  send_to_all(msg: string) {
    for (let user in this.users) {
      this.send(user, msg);
    }
  }
}

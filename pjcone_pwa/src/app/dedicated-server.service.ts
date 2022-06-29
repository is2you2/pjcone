import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';

declare var cordova: any;

/** 사설 서버 운영 */
@Injectable({
  providedIn: 'root'
})
export class DedicatedServerService {

  constructor() { }
  server: any;
  /** 연결된 사용자 리스트  
   * ```js
   * { uuid: { addr } }
   * ```
   */
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

      this.server = cordova.plugins.wsserver;
      this.server.start(PORT, {
        // WebSocket Server handlers
        'onFailure': (addr, port, reason) => {
          console.log('서버 Stopped listening on %s:%d. Reason: %s', addr, port, reason);
        },
        // WebSocket Connection handlers
        'onOpen': (conn) => {
          /* conn: {
           'uuid' : '8e176b14-a1af-70a7-3e3d-8b341977a16e',
           'remoteAddr' : '192.168.1.10',
           'httpFields' : {...},
           'resource' : '/?param1=value1&param2=value2'
           } */
          console.log('서버에 연결됨: ', conn);
          this.users[conn.uuid] = { 'addr': conn.remoteAddr };
          console.log(this.users);
        },
        'onMessage': (conn, msg) => {
          console.log('서버 메시지 받음: ', conn, msg); // msg can be a String (text message) or ArrayBuffer (binary message)
          // 릴레이 역할 수행
          this.send_to_all(msg);
        },
        'onClose': (conn, code, reason, wasClean) => {
          console.log('서버에서 끊김:', conn, '/', code, '/', reason, '/', wasClean);
          delete this.users[conn.uuid];
          console.log(this.users);
        },
        // Other options
        'origins': [], // validates the 'Origin' HTTP Header.
        'protocols': [], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
        'tcpNoDelay': true // disables Nagle's algorithm.
      }, function onStart(addr, port) {
        console.log('서버 Listening on %s:%d', addr, port);
      }, function onDidNotStart(reason) {
        console.log('서버 Did not start. Reason: %s', reason);
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
  send_to(uuid: string, msg: string) {
    this.server.send({ 'uuid': uuid }, msg);
  }

  /**
   * 지정 사용자 외 모든 이에게 메시지 보내기
   * @param uuid 이 아이디 제외
   * @param msg 메시지
   */
  send_except(uuid: string, msg: string) {
    for (let user in this.users)
      if (user != uuid)
        this.send_to(user, msg);
  }

  send_to_all(msg: string) {
    for (let user in this.users)
      this.send_to(user, msg);
  }

}

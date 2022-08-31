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
  /** 연결된 사용자 리스트  
   * { uuid: { address, uid, name } }
   */
  private users = {};
  /** 상호작용 함수 */
  funcs = {
    /** 서버 시작할 때 */
    onStart: (v: any) => console.warn('onStart 함수 없음: ', v),
    /** 서버 생성 실패시, 서버 닫을 때 */
    onFailed: (v: any) => console.error('onFailed 함수 없음: ', v),
  }

  /**
   * 사설 서버 개설
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
          this.funcs.onFailed(`Stopped listening on ${addr}:${port}. Reason: ${reason}`);
        },
        // WebSocket Connection handlers
        'onOpen': (conn) => {
          this.users[conn.uuid] = {
            address: this.users[conn.remoteAddr],
          };
          Object.keys(this.users).forEach(user => {
            this.send_to(user, `Counter:${Object.keys(this.users).length}`);
          });
        },
        'onMessage': (conn, msg) => {
          try {
            let json = JSON.parse(msg);
            if (json['type'] == 'join') {
              this.users[conn.uuid]['uid'] = json['uid'];
              this.users[conn.uuid]['name'] = json['name'];
            }
          } catch (e) {
            console.error(`json 변환 오류_${msg}: ${e}`);
          }

          Object.keys(this.users).forEach(user => {
            this.send_to(user, msg);
          });
        },
        'onClose': (conn, code, reason, wasClean) => {
          let catch_uid = this.users[conn.uuid]['uid']
          let catch_name = this.users[conn.uuid]['name'];
          delete this.users[conn.uuid];
          let count = {
            uid: catch_uid,
            name: catch_name,
            type: 'leave',
            count: Object.keys(this.users).length,
          }
          let msg = JSON.stringify(count);
          Object.keys(this.users).forEach(user => {
            this.send_to(user, msg);
          });
        },
        // Other options
        'origins': [], // validates the 'Origin' HTTP Header.
        'protocols': [], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
        'tcpNoDelay': true // disables Nagle's algorithm.
      }, (addr, port) => { // 시작할 때
        this.server.getInterfaces((result: any) => {
          this.funcs.onStart(result);
        });
      }, (reason) => { // 종료될 때
        this.funcs.onFailed(`Did not start. Reason: ${reason}`);
      });
    } else {
      this.funcs.onFailed(`Did not start. Reason: 플랫폼 불일치: 사설 서버 구축 취소`);
    }
  }

  /** 사용자 끊기 */
  disconnect_peer(id: string, code: number = 4000, reason: string = 'EMPTY') {
    this.server.close({ 'uuid': id }, code, reason);
  }

  /** 사설 서버 종료 */
  stop() {
    this.server.stop((addr, port) => {
      this.funcs.onFailed(`Stopped listening on ${port}`);
    });
  }

  /**
   * 클라이언트에게 메시지 발송
   * @param _id 발송받는 id 특정
   * @param _msg 메시지
   */
  send_to(id: string, msg: string) {
    this.server.send({ 'uuid': id }, msg);
  }
}

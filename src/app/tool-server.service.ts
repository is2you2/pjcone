import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { StatusManageService } from './status-manage.service';

declare var cordova: any;

interface ListToolServer {
  /** cordova.wsserver */
  server?: any;
  /** 연결된 사용자 */
  users?: string[];
}

/** 도구모음 서버, 릴레이 서버 형식으로 동작 */
@Injectable({
  providedIn: 'root'
})
export class ToolServerService {

  constructor(
    private statusBar: StatusManageService,
  ) { }

  /** 모든 종류의 서버를 관리  
   * { [구분자id]: ListToolServer }
   */
  list: { [id: string]: ListToolServer } = {};

  /** 이 휴대폰의 주소 모음 */
  addresses: string[] = [];

  /**
   * 사설 서버 개설, throwable
   * @param _target 일괄처리용 구분자 (툴의 이름)
   * @param _PORT 사용을 위한 포트 입력
   * @param onStart 서버 시작시 행동
   * @param onConnect 서버에 사용자 연결시 행동
   * @param onMessage 메시지를 받았을 때 행동
   * @param onDisconnect 서버에 사용자 연결 끊김 행동
   */
  initialize(_target: string, _PORT: number, onStart: Function, onConnect: Function, onMessage: Function, onDisconnect: Function) {
    if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
      if (this.list[_target] == null) {
        this.statusBar.tools[_target] = 'pending';
        this.list[_target] = {};
        this.list[_target]['users'] = [];
      } else {
        console.warn('동일한 키의 서버가 이미 존재함: ', this.list);
        if (!this.statusBar.tools[_target] || this.statusBar.tools[_target] == 'offline')
          delete this.list[_target];
        return;
      }
      if (!this.list[_target]['server'])
        this.list[_target]['server'] = cordova.plugins.wsserver;
      this.check_addresses(_target);
      this.list[_target]['server'].start(_PORT, {
        'onFailure': (_addr, _port, _reason) => {
          this.onServerClose(_target);
          this.stop(_target);
        },
        'onOpen': (conn) => {
          this.list[_target]['users'].push(conn.uuid);
          onConnect(conn);
        },
        'onMessage': (conn, msg) => {
          try {
            let json = JSON.parse(msg);
            onMessage(conn, json);
          } catch (e) {
            console.error(`Tool-server_json 변환 오류_${msg}: ${e}`);
          }
        },
        'onClose': (conn, _code, _reason, _wasClean) => {
          for (let i = this.list[_target]['users'].length - 1; i >= 0; i--)
            if (this.list[_target]['users'][i] == conn.uuid) {
              this.list[_target]['users'].splice(i, 1);
              break;
            }
          onDisconnect(conn);
        },
        // Other options
        'origins': [], // validates the 'Origin' HTTP Header.
        'protocols': [], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
        'tcpNoDelay': true // disables Nagle's algorithm.
      }, (_addr, _port) => { // 시작할 때
        this.statusBar.tools[_target] = 'online';
        if (onStart) onStart();
      }, (_reason) => { // 종료될 때
        this.onServerClose(_target);
        this.stop(_target);
      });
    } else { // PWA 앱이라면
      this.stop(_target);
    }
  }

  /** 사설 서버 종료 */
  stop(_target: string) {
    if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
      if (this.list[_target])
        this.list[_target]['server'].stop((_addr, port) => {
          this.onServerClose(_target);
          delete this.list[_target];
        });
    }
  }

  /** 서버가 종료되었을 때 공통행동(알림바 업데이트) */
  private onServerClose(target: string) {
    delete this.list[target]['users'];
    this.statusBar.tools[target] = 'missing';
    setTimeout(() => {
      this.statusBar.tools[target] = 'offline';
    }, 1000);
  }

  /** 기기 주소 검토 */
  check_addresses(_target: string) {
    if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
      if (!this.list[_target]['server'])
        this.list[_target]['server'] = cordova.plugins.wsserver;
      this.list[_target]['server'].getInterfaces((result: any) => {
        this.addresses.length = 0;
        let keys = Object.keys(result);
        for (let i = 0, j = keys.length; i < j; i++)
          this.addresses = [...this.addresses, ...result[keys[i]]['ipv4Addresses']];
      });
    }
  }

  /** 단일 대상 발송 */
  send_to(_target: string, uuid: string, msg: string) {
    if (!this.list[_target]['users'].length) return;
    if (this.list[_target] && this.list[_target]['server'])
      this.list[_target]['server'].send({ 'uuid': uuid }, msg);
  }
}

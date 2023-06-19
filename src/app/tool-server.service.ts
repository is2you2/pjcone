// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { isPlatform } from './app.component';
import { StatusManageService } from './status-manage.service';

declare var cordova: any;

interface ListToolServer {
  /** cordova.wsserver */
  server?: any;
  /** 연결된 사용자 */
  users?: any;
  /** 사용 허용된 ip 주소 */
  target?: string;
}

/** 만능참여로 서버 참여시 스캔 정보 양식 */
export interface UnivToolForm {
  /** 대상의 이름, statusManager.tools 에 등록되어있어야 함 */
  name: string;
  /** 참여 가능자 ip주소 -> ListToolServer.target 에게 인계됨 */
  client: string;
}

/** 도구모음 서버, 1인 사용이 공통되므로 생성시 동작방식을 주입하여 사용 */
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

  /**
   * 사설 서버 개설, throwable
   * @param _target 일괄처리용 구분자
   * @param _PORT 사용을 위한 포트 입력
   * @param onMessage 메시지를 받았을 때 행동 onMessage(json)
   */
  initialize(_target: string, _PORT: number, onStart: Function, onMessage: Function) {
    try {
      if (!this.statusBar.tools[_target])
        throw `그런 툴은 없습니다: ${_target}`;
      this.statusBar.tools[_target] = 'pending';
      if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
        if (this.list[_target] == null) this.list[_target] = {};
        else {
          console.warn('동일한 서버 구성이 이미 존재함: ', this.list);
          return;
        }
        if (!this.list[_target]['server'])
          this.list[_target]['server'] = cordova.plugins.wsserver;

        this.list[_target]['server'].start(_PORT, {
          'onFailure': (_addr, _port, _reason) => {
            this.onServerClose(_target);
          },
          'onOpen': (conn) => {
            if (this.list[_target]['target'] == conn.remoteAddr)
              this.list[_target]['users'] = conn.uuid;
            else {
              console.log('허용되지 않은 사용자: ', this.list[_target]['target'], '/=', conn.remoteAddr);
              this.list[_target]['server'].close({ 'uuid': conn.uuid }, 4001, '허용되지 않은 사용자');
            }
            this.onClientConnected(_target);
          },
          'onMessage': (_conn, msg) => {
            try {
              let json = JSON.parse(msg);
              onMessage(json);
            } catch (e) {
              console.error(`Tool-server_json 변환 오류_${msg}: ${e}`);
            }
          },
          'onClose': (_conn, _code, _reason, _wasClean) => {
            this.stop(_target);
          },
          // Other options
          'origins': [], // validates the 'Origin' HTTP Header.
          'protocols': [], // validates the 'Sec-WebSocket-Protocol' HTTP Header.
          'tcpNoDelay': true // disables Nagle's algorithm.
        }, (_addr, _port) => { // 시작할 때
          this.onServerOpen(_target);
          if (onStart) onStart();
        }, (_reason) => { // 종료될 때
          this.onServerClose(_target);
        });
      } else { // PWA 앱이라면
        this.stop(_target);
      }
    } catch (error) {
      console.log('툴 서버 생성 실패: ', error);
    }
  }

  /** 사설 서버 종료 */
  stop(_target: string) {
    if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
      this.list[_target]['server'].stop((_addr, port) => {
        this.onServerClose(_target);
        delete this.list[_target];
      });
    }
  }

  /** 서버 시작시(알림바 업데이트) */
  onServerOpen(target: string) {
    console.log('test onServerOpen: ', target);
    this.statusBar.tools[target] = 'online';
  }

  /** 서버에 사람이 연결되었을 경우 공통행동(알림바 업데이트) */
  onClientConnected(target: string) {
    this.statusBar.tools[target] = 'certified';
  }

  /** 서버가 종료되었을 때 공통행동(알림바 업데이트) */
  onServerClose(target: string) {
    this.statusBar.tools[target] = 'missing';
    setTimeout(() => {
      this.statusBar.tools[target] = 'offline';
    }, 500);
  }

  /** 기기 주소 검토 */
  check_addresses(_target: string, onCheck: Function) {
    if (isPlatform != 'DesktopPWA' && isPlatform != 'MobilePWA') {
      if (!this.list[_target]['server'])
        this.list[_target]['server'] = cordova.plugins.wsserver;
      this.list[_target]['server'].getInterfaces((result: any) => {
        onCheck(result);
      });
    }
  }

  /**
   * 클라이언트에게 메시지 발송
   * @param _target 발송받는 그룹 특정
   * @param msg 메시지
   */
  send_to(_target: string, msg: string) {
    let id = Object.keys(this.list[_target]['users'])[0];
    this.list[_target]['server'].send({ 'uuid': id }, msg);
  }
}

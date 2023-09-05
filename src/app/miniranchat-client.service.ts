// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';

/** 기존 MiniRanchat과 서버를 공유하는 랜챗 클라이언트  
 * 해당 프로젝트의 동작 방식 역시 모방되어있다.
 */
@Injectable({
  providedIn: 'root'
})
export class MiniranchatClientService {

  constructor() { }

  client: { [id: string]: WebSocket } = {};

  // 'idle' | 'linked' | 'unlinked' | 'custom'
  status = {
    'dedicated_groupchat': 'idle',
    'community_ranchat': 'idle',
  }

  /** 사용자 입력과 관련된 것들 */
  userInput = {
    'dedicated_groupchat': {
      /** 채팅, 로그 등 대화창에 표기되는 모든 것 */
      logs: [],
      /** 작성 텍스트 */
      text: '',
      /** 마지막 메시지 썸네일 구성 */
      last_message: {},
    },
    'community_ranchat': {
      /** 채팅, 로그 등 대화창에 표기되는 모든 것 */
      logs: [],
      /** 작성 텍스트 */
      text: '',
      /** 마지막 메시지 썸네일 구성 */
      last_message: {},
    },
  }

  /** 지금 연결된 사람 수 */
  ConnectedNow = {
    'dedicated_groupchat': 0,
    'community_ranchat': 0,
  };

  /** 상호작용 함수들 */
  funcs = {
    'dedicated_groupchat': {
      onopen: (v: any) => console.warn('OnOpen 설정 안됨: ', v),
      onclose: (v: any) => console.warn('OnClose 설정 안됨: ', v),
      onmessage: (v: any) => console.warn('OnMessage 설정 안됨: ', v),
    },
    'community_ranchat': {
      onopen: (v: any) => console.warn('OnOpen 설정 안됨: ', v),
      onclose: (v: any) => console.warn('OnClose 설정 안됨: ', v),
      onmessage: (v: any) => console.warn('OnMessage 설정 안됨: ', v),
    },
  };

  /**
   * 클라이언트 연결 시도
   * @param _Address 기본값: 메인 소켓 서버, 사설 서버 주소로 변경 가능
   */
  initialize(_target?: string, _Address?: string) {
    const PORT: number = 12011;
    this.client[_target] = new WebSocket(`${_Address}:${PORT}`);
    this.client[_target].onopen = (ev) => {
      this.funcs[_target].onopen(ev);
    }
    this.client[_target].onclose = (ev) => {
      this.funcs[_target].onclose(ev);
    }
    this.client[_target].onerror = (e) => {
      console.error('오류 발생: ', e);
    }
    this.client[_target].onmessage = (ev) => {
      if (typeof ev.data == 'string')
        this.funcs[_target].onmessage(ev.data);
      else
        ev.data.text().then((v: any) => {
          this.funcs[_target].onmessage(v);
        });
    }
  }

  send(_target: string, msg: string) {
    if (this.client) this.client[_target].send(msg);
    else console.warn('client 연결되어있지 않음: 메시지 발송 취소: ', msg);
  }

  /** 클라이언트 끊기 */
  disconnect(_target: string, code = 1000, reason = 'user_close') {
    if (this.client) this.client[_target].close(code, reason);
  }
}

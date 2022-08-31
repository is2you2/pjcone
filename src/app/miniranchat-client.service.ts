import { Injectable } from '@angular/core';
import { SOCKET_SERVER_ADDRESS } from './app.component';

/** 기존 MiniRanchat과 서버를 공유하는 랜챗 클라이언트  
 * 해당 프로젝트의 동작 방식 역시 모방되어있다.
 */
@Injectable({
  providedIn: 'root'
})
export class MiniranchatClientService {

  client: WebSocket;

  /** 사용자 상태: 키보드 종류 노출 제어용 */
  status: 'idle' | 'linked' | 'unlinked' | 'custom' = 'idle';

  /** 사용자 입력과 관련된 것들 */
  userInput = {
    /** 채팅, 로그 등 대화창에 표기되는 모든 것 */
    logs: [],
    /** 작성 텍스트 */
    text: '',
  }

  /** 지금 연결된 사람 수 */
  ConnectedNow = 0;

  /** 상호작용 함수들 */
  funcs = {
    onopen: (v: any) => console.warn('OnOpen 설정 안됨: ', v),
    onclose: (v: any) => console.warn('OnClose 설정 안됨: ', v),
    onmessage: (v: any) => console.warn('OnMessage 설정 안됨: ', v),
  };

  /**
   * 클라이언트 연결 시도
   * @param _Address 기본값: 메인 소켓 서버, 사설 서버 주소로 변경 가능
   */
  initialize(_Address?: string) {
    const PORT: number = 12011;
    this.client = new WebSocket(`${_Address || `wss://${SOCKET_SERVER_ADDRESS}`}:${PORT}`);
    this.client.onopen = (ev) => {
      this.funcs.onopen(ev);
    }
    this.client.onclose = (ev) => {
      this.funcs.onclose(ev);
    }
    this.client.onerror = (e) => {
      console.error('오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      if (typeof ev.data == 'string')
        this.funcs.onmessage(ev.data);
      else
        ev.data.text().then((v: any) => {
          this.funcs.onmessage(v);
        });
    }
  }

  send(msg: string) {
    if (this.client) this.client.send(msg);
    else console.warn('client 연결되어있지 않음: 메시지 발송 취소: ', msg);
  }

  /** 클라이언트 끊기 */
  disconnect(code = 1000, reason = 'user_close') {
    if (this.client) this.client.close(code, reason);
  }
}

import { Injectable } from '@angular/core';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";

@Injectable({
  providedIn: 'root'
})
export class NakamaclientService {

  client: Client;
  /** 손님계정 (계정 전 행동요청용) */
  GuestSession: Session;
  /** 사용자 인증 세션 */
  AuthSession: Session;
  socket: Socket;

  constructor() { }

  /**
   * ### Nakama 클라이언트 연결
   * 서버연결 시도를 합니다. 연결실패시 false 반환
   */
  initialize(): Promise<boolean> { // 아래에서 서버 주소 검토하기
    this.client = new Client("defaultkey", "is2you2.iptime.org", '7350');
    return this.CheckIfServerAvailable();
  }
  /** 서버가 운영중인지 검토해봅시다 */
  async CheckIfServerAvailable(): Promise<boolean> {
    try {
      this.GuestSession = await this.client.authenticateDevice('GuestSession', false, 'pjconeGuest');
      return true;
    } catch (e) {
      switch (e.status) {
        case undefined: // 서버는 휴가중
          return false;
        default: // 휴가중이 아니라면 일하는 것으로 간주
          console.warn('서버 체크 결과: ', e.status);
          return true;
      }
    }
  }
}
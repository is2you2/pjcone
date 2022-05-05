import { Injectable } from '@angular/core';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";

@Injectable({
  providedIn: 'root'
})
export class NakamaclientService {

  client: Client;
  session: Session;
  /** 서버가 온라인 상태입니까? */
  isConnected: boolean = false;
  socket: Socket;

  constructor() { }

  /**
   * ### 클라이언트 연결
   * 서버연결 시도를 합니다. 연결실패시 false 반환
   */
  initialize(): Promise<boolean> {
    this.client = new Client("defaultkey", "is2you2.iptime.org", '7350');
    return this.check_if_server_available();
  }
  /** 서버가 운영중인지 검토해봅시다 */
  async check_if_server_available(): Promise<boolean> {
    try {
      await this.client.authenticateEmail('CheckerSession', '');
    } catch (e) {
      switch (e.status) {
        case undefined: // 서버는 휴가중
          this.isConnected = false;
          break;
        default: // 휴가중이 아니라면 일하는 것으로 간주
          console.warn('서버 체크 결과: ', e.status);
          this.isConnected = true;
          break;
      }
      return this.isConnected;
    }
  }
  /**
   * ### 이메일 주소로 로그인
   * 이메일 주소와 비밀번호로 로그인 시도합니다. 로그인 여부를 반환합니다.  
   * 로그인에 실패하는 경우:  
   * - 등록되지 않은 회원
   * - 비밀번호가 틀림
   * - 생성 요청시 이미 있는 계정이지만 정보가 틀리게 입력됨
   * @param email 사용자가 입력한 이메일 주소
   * @param password 사용자가 입력한 비밀번호
   * @param _create 생성 여부
   * @param _username 사용자 이름(회원 가입시)
   * @param _vars 기타 자료들 추가 {}
   * @returns 정상 로그인 여부
   */
  async session_login(email: string, password: string, _create: boolean = false, _username?: string, _vars?: any): Promise<number> {
    try {
      this.session = await this.client.authenticateEmail(email, password, _create, _username, _vars);
      return 0;
    } catch (e) {
      return e.status;
    }
  }
}

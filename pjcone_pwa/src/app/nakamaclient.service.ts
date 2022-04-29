import { Injectable } from '@angular/core';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";

@Injectable({
  providedIn: 'root'
})
export class NakamaclientService {

  client: Client;
  session: Session;
  isConnected: boolean = false;
  socket: Socket;

  constructor() { }

  /**
   * ### 클라이언트 연결
   * 서버연결 시도를 합니다. 연결실패시 false 반환
   */
  client_init(): Promise<boolean> {
    this.client = new Client("defaultkey", "192.168.0.20", '7350');
    return this.check_if_server_available();
  }
  /** 서버가 운영중인지 검토해봅시다 */
  async check_if_server_available(): Promise<boolean> {
    let checker_session;
    try {
      checker_session = await this.client.authenticateDevice('CheckerSession', true, 'CheckerSession');
    } catch (e) { // 어째뜬 제대로 동작하지 않았다
      return false;
    }
    return this.client.getAccount(checker_session).then(v => {
      return true; // timeout 없이 동작해주었다
    }).catch(e => {
      return false; // 이 쉬운걸 동작시키지 못한거면 이건 이거대로 문제가 있다
    });
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
  async session_login(email: string, password: string, _create: boolean = false, _username?: string, _vars?: any): Promise<boolean> {
    try {
      this.session = await this.client.authenticateEmail(email, password, _create, _username, _vars);
      return true;
    } catch (e) {
      return false;
    }
  }
}

import { Injectable } from '@angular/core';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";

@Injectable({
  providedIn: 'root'
})
export class NakamaclientService {

  client: Client;
  session: Session;
  socket: Socket;

  constructor() { }

  /**
   * ### 클라이언트 연결
   * 서버연결 시도를 합니다. 연결실패시 false 반환
   */
  client_init(): void {
    this.client = new Client("defaultkey", "172.30.1.29", '7350');
    console.log('클라이언트 연결: ', this.client);
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
      console.log('로그인 성공! ', this.session);
      return true;
    } catch (e) {
      console.error('로그인 시도 실패: ', e);
      return false;
    }
  }
}

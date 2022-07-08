import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { SOCKET_SERVER_ADDRESS } from './app.component';

/** 사용자 정보 */
interface UserInfo {
  /** 사용자 정보 외 관리되는 별도 번호 */
  uuid?: string;
  nickname?: string;
  /** 프로필 이미지 */
  images?: string[];
  /** 프로필 배경 이미지 */
  backgrounds?: string[];
  /** 프로필 글귀 */
  comment?: string;
}

/** 회원과 관련된 일에 사용하는 소켓 클라이언트 */
@Injectable({
  providedIn: 'root'
})
export class AccountService {

  constructor(
    private device: Device,
  ) { }

  client: WebSocket;

  /**
   * 회원으로 활동하기 위한 클라이언트
   * @param _Address 서버 주소, 포트 12001 고정
   */
  initialize(inited?: Function) {
    const PORT: number = 12001;
    this.client = new WebSocket(`ws://${SOCKET_SERVER_ADDRESS}:${PORT}`);
    this.client.onopen = (ev) => {
      console.log('연결됨: ', ev);
      inited();
    }
    this.client.onclose = (ev) => {
      console.log('연결 끊김: ', ev);
    }
    this.client.onerror = (e) => {
      console.error('오류 발생: ', e);
    }
    this.client.onmessage = (ev) => {
      ev.data.text().then(v => {
        console.log('메시지 받음: ', v);
      });
    }
  }

  /**
   * 회원가입 요청보내기
   * @param email 사용자 이메일 주소
   */
  register(email: string) {
    let reg = {
      act: 'register',
      email: email,
      uuid: this.device.uuid,
    }
    this.client.send(JSON.stringify(reg));
  }

  /** 사용자 정보 교체하기 */
  change_userInfo(_data: UserInfo) {
    let data = {
      'act': 'profile',
      ..._data
    }
    this.client.send(JSON.stringify(data));
  }
}

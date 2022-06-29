import { Injectable } from '@angular/core';
import { NavController } from '@ionic/angular';
import { isPlatform } from './app.component';

/** 리모콘 조작 가능한 페이지임 */
export interface RemotePage {
  /** 웹소켓으로 받은 텍스트를 행동명령으로 바꾸기 위한 함수 링크 묶음 */
  remote_act: any;
}

/** 화면 리모콘, 휴대폰에서 서버를 열고 데스크탑을 연결하여 원격 제어할 수 있다. */
@Injectable({
  providedIn: 'root'
})
export class RemoteControllerService {

  constructor(
    private nav: NavController,
  ) { }

  client: WebSocket;
  /** 현재 조종중인 페이지 */
  target: RemotePage;

  /**
   * 휴대폰으로 간단하게 조종할 수 있는 웹 소켓 기반 리모콘을 운용합니다.
   * @param _Address 핸드폰 서버의 주소부분만
   */
  initialize(_Address: string) {
    const _PORT: number = 12020;
    this.client = new WebSocket('ws://' + _Address + ':' + _PORT);
    this.client.onopen = (_ev) => {
      console.log('리모콘 연결됨: ', _ev);
      if (isPlatform != 'Desktop') { // 모바일인 경우 모바일용으로
        this.nav.navigateRoot('remote/test', {
          animated: true,
          animationDirection: 'forward',
        })
      }
    }
    this.client.onclose = (ev) => {
      console.log('연결 끊김: ', ev.code, '/', ev.reason);
    }
    this.client.onmessage = (ev) => {
      console.log('메시지 수신함: ', ev.data);
      this.target.remote_act[ev.data]();
    }
    this.client.onerror = (e) => {
      // 시작 연결 실패시에도 여기로 접근함
      console.error('wsc 오류: ', e);
    }
  }
}

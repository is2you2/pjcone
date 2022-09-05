import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';


@Injectable({
  providedIn: 'root'
})
export class NakamaService {

  constructor(
    private device: Device,
  ) { }

  /** 구성: this > Official > TargetKey > Client */
  client: { [id: string]: { [id: string]: Client } } = {
    'official': {},
    'unofficial': {},
  };
  /** 구성: this > Official > TargetKey > ActKey > Session */
  session: { [id: string]: { [id: string]: { [id: string]: Session } } } = {
    'official': {},
    'unofficial': {},
  };
  /** 구성: this > Official > TargetKey > ActKey > Session */
  socket: { [id: string]: { [id: string]: { [id: string]: Socket } } } = {
    'official': {},
    'unofficial': {},
  };

  /** 공식 테스트 서버를 대상으로 Nakama 클라이언트 구성을 진행합니다.
   * @param _is_official 공식 서버 여부
   * @param _target 대상 key
   */
  initialize(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _key = 'defaultkey') {
    this.client[_is_official][_target] = new Client(_key, SOCKET_SERVER_ADDRESS);
    if (localStorage.getItem('is_online')) {
      this.init_session();
    }
  }

  /** 세션처리
   * @param _target 대상 key
   * @param _act 세션 이름
   */
  async init_session(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _act = 'default') {
    let uuid = this.device.uuid;
    try {
      this.session[_is_official][_target][_act] = await this.client[_is_official][_target].authenticateEmail(localStorage.getItem('email'), uuid, false);
      console.log('세션 성공 로그: ', this.session[_is_official][_target][_act]);
    } catch (e) {
      console.error('init_session_un: ', e);
    }
  }

  /** 서버에 연결 */
  connect_to(_is_official: 'official' | 'unofficial', _target = 'default', _act = 'default') {
    this.socket[_is_official][_target][_act].connect(
      this.session[_is_official][_target][_act], true
    );
  }

  /** 연결 끊기 */
  disconnect(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _act = 'default') {
    this.socket[_is_official][_target][_act].disconnect(true);
  }
}

import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { P5ToastService } from './p5-toast.service';


@Injectable({
  providedIn: 'root'
})
export class NakamaService {

  constructor(
    private device: Device,
    private p5toast: P5ToastService,
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
   * @param _key 서버 key
   */
  initialize(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _key = 'defaultkey') {
    this.client[_is_official][_target] = new Client(_key, SOCKET_SERVER_ADDRESS);
    if (localStorage.getItem('is_online')) {
      this.init_session();
    }
  }

  /** 세션처리
   * @param _CallBack 오류시 행동방침
   * @param _target 대상 key
   * @param _act 세션 이름
   */
  async init_session(_CallBack = () => { }, _is_official: 'official' | 'unofficial' = 'official', _target = 'default', _act = 'default') {
    let uuid = this.device.uuid;
    try {
      if (!this.session[_is_official][_target]) this.session[_is_official][_target] = {};
      this.session[_is_official][_target][_act] = await this.client[_is_official][_target].authenticateEmail(localStorage.getItem('email'), uuid, false);
      this.p5toast.show({
        text: '로그인되었습니다.',
        force: true,
      });
    } catch (e) {
      switch (e.status) {
        case 400: // 비번이 없거나 하는 등, 요청이 잘못됨
          this.p5toast.show({
            text: '잘못된 요청입니다',
            force: true,
          });
          _CallBack();
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: '기기 재검증 이메일 발송 필요! (아직 개발되지 않음)',
            force: true,
          });
          _CallBack();
          break;
        case 404: // 아이디 없음
          this.session[_is_official][_target][_act] = await this.client[_is_official][_target].authenticateEmail(localStorage.getItem('email'), uuid, true);
          this.p5toast.show({
            text: '회원가입이 완료되었습니다.',
            force: true,
          });
          break;
        default:
          this.p5toast.show({
            text: `준비되지 않은 오류 유형: ${e}`,
            force: true,
          });
          _CallBack();
          break;
      }
    }
  }

  /** 서버에 연결 */
  connect_to(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _act = 'default') {
    this.socket[_is_official][_target][_act].connect(
      this.session[_is_official][_target][_act], true
    );
  }

  /** 연결 끊기 */
  disconnect(_is_official: 'official' | 'unofficial' = 'official', _target = 'default', _act = 'default') {
    this.socket[_is_official][_target][_act].disconnect(true);
  }
}

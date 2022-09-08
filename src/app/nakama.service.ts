import { Injectable } from '@angular/core';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { Client, Session, Socket } from "@heroiclabs/nakama-js";
import { SOCKET_SERVER_ADDRESS } from './app.component';
import { P5ToastService } from './p5-toast.service';
import { StatusManageService } from './status-manage.service';


@Injectable({
  providedIn: 'root'
})
export class NakamaService {

  constructor(
    private device: Device,
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
  ) { }

  /** 구성: this > Official > TargetKey > Client */
  client: { [id: string]: { [id: string]: Client } } = {
    'official': {},
    'unofficial': {},
  };
  /** 구성: this > Official > TargetKey > Session */
  session: { [id: string]: { [id: string]: Session } } = {
    'official': {
      default: undefined,
    },
    'unofficial': {},
  };
  /** 구성: this > Official > TargetKey > Socket */
  socket: { [id: string]: { [id: string]: Socket } } = {
    'official': {
      default: undefined,
    },
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
      this.init_all_sessions();
    }
  }

  /** 모든 pending 세션 켜기 */
  init_all_sessions(_CallBack = (v: boolean) => console.log(v)) {
    let Targets = Object.keys(this.session['official']);
    Targets.forEach(_target => {
      if (this.statusBar.groupServer['official'][_target] == 'pending')
        this.init_session(_CallBack, 'official', _target);
    });

    let unTargets = Object.keys(this.session['unofficial']);
    unTargets.forEach(_target => {
      if (this.statusBar.groupServer['unofficial'][_target] == 'pending')
        this.init_session(_CallBack, 'unofficial', _target);
    });
  }

  /** 세션처리
   * @param _CallBack 오류시 행동방침
   * @param _target 대상 key
   */
  async init_session(_CallBack = (v: boolean) => console.log(v), _is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    let uuid = this.device.uuid;
    try {
      this.session[_is_official][_target] = await this.client[_is_official][_target].authenticateEmail(localStorage.getItem('email'), uuid, false);
      _CallBack(true);
      this.set_statusBar('online', _is_official, _target);
    } catch (e) {
      switch (e.status) {
        case 400: // 비번이 없거나 하는 등, 요청이 잘못됨
          this.p5toast.show({
            text: '웹 브라우저에서는 지원하지 않습니다.',
            force: true,
          });
          _CallBack(false);
          this.set_statusBar('missing', _is_official, _target);
          break;
        case 401: // 비밀번호 잘못됨
          this.p5toast.show({
            text: '기기 재검증 이메일 발송 필요! (아직 개발되지 않음)',
            force: true,
          });
          _CallBack(false);
          this.set_statusBar('missing', _is_official, _target);
          break;
        case 404: // 아이디 없음
          this.session[_is_official][_target] = await this.client[_is_official][_target].authenticateEmail(localStorage.getItem('email'), uuid, true);
          this.p5toast.show({
            text: '회원가입이 완료되었습니다.',
            force: true,
          });
          this.set_statusBar('online', _is_official, _target);
          break;
        default:
          this.p5toast.show({
            text: `준비되지 않은 오류 유형: ${e}`,
            force: true,
          });
          _CallBack(false);
          this.set_statusBar('missing', _is_official, _target);
          break;
      }
    }
  }

  set_statusBar(_status: 'offline' | 'missing' | 'pending' | 'online' | 'certified', _is_official: string, _target: string) {
    this.statusBar.groupServer[_is_official][_target] = _status;
    this.statusBar.settings['groupServer'] = _status;
  }

  /** 서버에 연결 */
  connect_to(_is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    this.socket[_is_official][_target].connect(
      this.session[_is_official][_target], true
    );
  }

  /** 연결 끊기 */
  disconnect(_is_official: 'official' | 'unofficial' = 'official', _target = 'default') {
    this.socket[_is_official][_target].disconnect(true);
  }
}

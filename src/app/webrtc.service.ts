import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as p5 from 'p5';
function import_p5sound() {
  if (window.location.protocol != 'http:' || window.location.host.indexOf('localhost') == 0) {
    import('p5/lib/addons/p5.sound').then(p5sound => {
    });
  }
}
import_p5sound();
import { WebrtcManageIoDevPage } from './webrtc-manage-io-dev/webrtc-manage-io-dev.page';
import { P5ToastService } from './p5-toast.service';
import { LanguageSettingService } from './language-setting.service';
import { MatchOpCode, NakamaService } from './nakama.service';
import { Match } from '@heroiclabs/nakama-js';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IndexedDBService } from './indexed-db.service';
import { VoiceRecorder } from "@langx/capacitor-voice-recorder";
import { isDarkMode } from './global-act.service';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private lang: LanguageSettingService,
    private nakama: NakamaService,
    private mClipboard: Clipboard,
  ) {
    this.nakama.WebRTCService = this;
  }

  private p5canvas: p5;

  private localMedia: any;
  private localStream: any;
  private PeerConnection: any;

  private remoteMedia: any;

  /** 통화 시작 시간 */
  startTime: number;

  private TypeIn: 'video' | 'audio' | 'data';
  /** WebRTC 자체 사용 여부  
   * p5 컨트롤러 개체를 다루기 위해 필요함
   */
  private OnUse = false;
  /** 통화요청 가능 여부, 통화요청을 할 수 있고, 통화 끊기는 할 수 없음 */
  isCallable = false;
  /** 통화중 여부, 통화중일 땐 통화요청 할 수 없고, 통화 끊기를 할 수 있음 */
  private isConnected = false;
  /** 응답에 반응하여 진입 후 통화 연결되기 전 */
  private JoinInited = false;

  // Nakama 서버에서 통화가 사용된 채널에 로그를 남기며, 통화 요청 신호로 간주됨
  // 채널 채팅 내 통화 기록을 누르면 그 당시 생성된 매치id에 연결을 시도하고 없으면 통화가 종료된 것으로 간주
  // 채팅 로그에는 match_id 만 공유한다
  private isOfficial: string;
  private target: string;
  channel_id: string;
  private user_id: string;
  /** 현재 연결된 매치 */
  CurrentMatch: Match;
  private LocalOffer: any;
  LocalAnswer: any;
  private ReceivedOfferPart = '';
  private ReceivedAnswerPart = '';
  private IceCandidates = [];
  /** 전화끊기시 추가 행동 등록 */
  HangUpCallBack: Function;

  /** 초기화 회신 반응 행동 */
  InitReplyCallback: Function;

  /** 기존 내용 삭제 및 WebRTC 기반 구축  
   * 마이크 권한을 확보하고 연결하기
   * @param type 영상통화 / 음성통화
   * @param media_const 미디어 입출 정보 지정, 빈 값을 넣어 기본 값으로 행동하기
   * @param nakama 통화가 진행중인 채널 정보
   * @param LeaveMatch nakama에서 연결된 매치가 있다면 연결끊기 처리
   */
  async initialize(type: 'video' | 'audio' | 'data',
    media_const?: MediaStreamConstraints, nakama?: any, LeaveMatch?: boolean) {
    if (type != 'data' && window.location.protocol == 'http:' && window.location.host.indexOf('localhost') != 0) {
      // 보안 연결 필수, 웹 페이지로 현재 정보와 함께 던져주기
      let servers = this.nakama.get_all_online_server();
      let out_link = 'https://is2you2.github.io/godotchat_pwa/';
      out_link += `?tmp_user=${this.nakama.users.self['email']},${this.nakama.users.self['password']},${this.nakama.users.self['display_name']}`;
      for (let i = 0, j = servers.length; i < j; i++)
        out_link += `&server=${servers[i].info.name || ''},${servers[i].info.address || ''},${servers[i].info.useSSL || ''},${servers[i].info.port || ''},${servers[i].info.key || ''}`;
      out_link += `&open_prv_channel=${nakama.user_id},${nakama.isOfficial || 'official'},${nakama.target || 'DevTestServer'}`;
      try {
        let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json');
        let ServerInfos = JSON.parse(list);
        for (let i = 0, j = ServerInfos.length; i < j; i++)
          out_link += `&rtcserver=[${ServerInfos[i].urls}],${ServerInfos[i].username},${ServerInfos[i].credential}`;
      } catch (e) { }
      try {
        await this.mClipboard.copy(out_link);
      } catch (error) { }
      window.open(out_link, '_blank');
      throw this.lang.text['WebRTCDevManager']['SecurityError'];
    }
    if (type != 'data') {
      let answer = await VoiceRecorder.requestAudioRecordingPermission();
      if (!answer.value) throw this.lang.text['WebRTCDevManager']['SecurityError'];
    }
    if (this.OnUse) {
      this.p5toast.show({
        text: this.lang.text['WebRTCDevManager']['AlreadyCalling'],
      });
      throw this.lang.text['WebRTCDevManager']['AlreadyCalling'];
    }
    await this.close_webrtc(LeaveMatch);
    this.TypeIn = type;
    // 통화중인 상대방이 오프라인으로 전환되면 통화 끝내기
    this.nakama.socket_reactive['WEBRTC_CHECK_ONLINE'] = (_user: any) => {
      if (this.user_id == _user.user_id)
        if (!this.nakama.load_other_user(this.user_id, this.isOfficial, this.target)['online'])
          this.close_webrtc();
    }
    this.nakama.socket_reactive['WEBRTC_INIT_REQ_SIGNAL'] = async (_target?: any) => {
      let data_str = JSON.stringify(this.LocalOffer);
      let part = data_str.match(/(.{1,64})/g);
      if (!_target) {
        for (let i = 0, j = part.length; i < j; i++)
          await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
            this.CurrentMatch.match_id, MatchOpCode.WEBRTC_REPLY_INIT_SIGNAL, encodeURIComponent(part[i]));
        await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
          this.CurrentMatch.match_id, MatchOpCode.WEBRTC_REPLY_INIT_SIGNAL, encodeURIComponent('EOL'));
      } else {
        for (let i = 0, j = part.length; i < j; i++) {
          _target['client'].send(JSON.stringify({
            type: 'socket_react',
            channel: _target['channel'],
            act: 'WEBRTC_REPLY_INIT_SIGNAL',
            data_str: part[i],
          }));
          await new Promise((done) => setTimeout(done, 40));
        }
        _target['client'].send(JSON.stringify({
          type: 'socket_react',
          channel: _target['channel'],
          act: 'WEBRTC_REPLY_INIT_SIGNAL',
          data_str: 'EOL',
        }));
      }
    }
    this.nakama.socket_reactive['WEBRTC_REPLY_INIT_SIGNAL'] = (data_str: string) => {
      if (data_str == 'EOL') { // 수신 완료
        this.createRemoteOfferFromAnswer(JSON.parse(this.ReceivedOfferPart));
        this.ReceivedOfferPart = '';
        if (this.InitReplyCallback) this.InitReplyCallback();
      } else this.ReceivedOfferPart += data_str;
    }
    this.nakama.socket_reactive['WEBRTC_RECEIVE_ANSWER'] = (data_str: string, _target?: any) => {
      if (data_str == 'EOL') { // 수신 완료
        this.ReceiveRemoteAnswer(JSON.parse(this.ReceivedAnswerPart), _target);
        this.ReceivedAnswerPart = '';
      } else this.ReceivedAnswerPart += data_str;
    }
    this.nakama.socket_reactive['WEBRTC_ICE_CANDIDATES'] = (data_str: string, _target?: any) => {
      this.ReceiveIceCandidate(JSON.parse(data_str), _target);
    }
    this.nakama.socket_reactive['WEBRTC_NEGOCIATENEEDED'] = (data_str: string) => {
      if (data_str == 'EOL') { // 수신 완료
        this.createRemoteOfferFromAnswer(JSON.parse(this.ReceivedOfferPart));
        this.ReceivedOfferPart = '';
        this.CreateAnswer();
      } else this.ReceivedOfferPart += data_str;
    }
    this.nakama.socket_reactive['WEBRTC_RECEIVED_CALL_SELF'] = () => {
      this.close_webrtc(false);
    }
    if (nakama) {
      this.isOfficial = nakama.isOfficial;
      this.target = nakama.target;
      this.user_id = nakama.user_id;
      this.channel_id = nakama.channel_id;
    }
    if (type != 'data') { // 화상/음성 통화일 때에만 개체 생성
      this.createP5_panel();
      try { // 로컬 정보 생성 및 받기
        this.localMedia = document.createElement(type);
        this.localMedia.id = 'webrtc_video';
        this.localMedia.style.width = '100%';
        this.localMedia.style.height = 'fit-content';
        this.localMedia.autoplay = true;
        if (type == 'video')
          this.localMedia.playsInline = true;
        this.localMedia.muted = true;
        document.body.appendChild(this.localMedia);

        // 원격 비디오 테스트 생성
        this.remoteMedia = document.createElement(type);
        this.remoteMedia.id = 'webrtc_video_remote';
        this.remoteMedia.style.width = '100%';
        this.remoteMedia.style.height = 'fit-content';
        this.remoteMedia.autoplay = true;
        if (type == 'video')
          this.remoteMedia.playsInline = true;
        document.body.appendChild(this.remoteMedia);

        let dev_list = await this.getDeviceList();
        let audioId: string;
        let videoId: string;
        let saved_vid_index = Number(localStorage.getItem('VideoInputDev') ?? NaN);
        let saved_aud_index = Number(localStorage.getItem('AudioInputDev') ?? NaN);
        for (let i = 0, j = dev_list.length, vid_index = 0, aud_index = 0; i < j; i++)
          if (!audioId || !videoId) {
            if (!audioId && dev_list[i].kind == 'audioinput') {
              if (Number.isNaN(saved_aud_index)) {
                audioId = dev_list[i].deviceId;
                localStorage.setItem('AudioInputDev', `${aud_index}`);
              } else if (aud_index == saved_aud_index)
                audioId = dev_list[i].deviceId;
              aud_index++;
            }
            if (!videoId && dev_list[i].kind == 'videoinput') {
              if (Number.isNaN(saved_vid_index)) {
                videoId = dev_list[i].deviceId;
                localStorage.setItem('AudioInputDev', `${vid_index}`);
              } else if (vid_index == saved_vid_index)
                videoId = dev_list[i].deviceId;
              vid_index++;
            }
          } else break;
        // 로컬 미디어 정보 관리
        if (!media_const) {
          media_const = {};
          if (type == 'video') {
            media_const['video'] = true;
            if (videoId) media_const['video'] = { deviceId: videoId };
          } else media_const['video'] = false;
          media_const['audio'] = true;
          if (audioId) media_const['audio'] = { deviceId: audioId };
        }
        this.localStream = await navigator.mediaDevices.getUserMedia(media_const);
        this.localMedia.srcObject = this.localStream;
        this.isCallable = true;
      } catch (e) {
        console.log('navigator.getUserMedia error: ', e);
        await this.close_webrtc();
        this.p5toast.show({
          text: `${this.lang.text['WebRTCDevManager']['InitErr']}: ${e}`,
        });
      }
    } else this.isCallable = true;
    await this.createCall();
    if (this.p5canvas)
      this.p5canvas['call_button'].elt.disabled = false;
  }

  createP5_panel() {
    this.OnUse = true;
    if (this.p5canvas) {
      clearTimeout(this.p5canvas['waiting_act']);
      this.p5canvas.remove();
    }
    this.p5canvas = new p5((p: p5) => {
      /** 사용하는 div개체 */
      let div: p5.Element;
      /** 내용물 개체 */
      let content: p5.Element;
      /** 현재 상태 알려주기 텍스트 / 이름으로 변경됨 */
      let status: p5.Element;
      /** 내부 border 처리용 */
      let border: p5.Element;
      // 통신 관련 버튼
      /** 버튼 줄 관리 */
      let buttons: p5.Element;
      let call_button: p5.Element;
      let mute_button: p5.Element;
      let unmute_button: p5.Element;
      /** 입력 기기 선택용 */
      let dev_button: p5.Element;
      let hangup_button: p5.Element;
      /** 새 메시지 알림을 위한 외곽선 조정용 */
      let borderLerp = 1;
      const BORDER_RADIUS = 32;
      p.setup = () => {
        let osc: p5.Oscillator;
        let waiting = () => {
          if (this.JoinInited) {
            osc.stop(.1);
            clearTimeout(p['waiting_act']);
          } else {
            if (osc) osc.stop(.1);
            osc = new p5.Oscillator(380, 'sine');
            osc.start();
            osc.amp(1, .15);
            osc.amp(0, .75);
            p['waiting_act'] = setTimeout(() => {
              waiting();
            }, 1200);
          }
        }
        p['waiting_act'] = setTimeout(() => {
          waiting();
        }, 0);
        // 다른 기기에서 통화가 연결된 경우 나머지 기기에서 중복 연결 안내음 표시 제거
        p['hangup'] = (duplicated = false) => {
          if (!this.isConnected && !duplicated) return;
          osc.stop(.1);
          clearTimeout(p['waiting_act']);
          osc = new p5.Oscillator(380, 'sine');
          osc.start();
          osc.freq(250, .35);
          osc.amp(1, .15);
          osc.amp(0, .25);
          osc.amp(1, .35);
          osc.amp(0, .45);
        }

        p.noCanvas();
        div = p.createDiv();
        div.id('outterDiv');
        div.style("position: absolute; left: 50%; top: 0px; z-index: 1");
        div.style("transform: translateX(-50%)");
        div.style("width: fit-content; height: fit-content");
        div.style("padding: 8px 16px;");
        div.style("display: flex; justify-content: center;");

        border = p.createDiv();
        border.parent(div);
        border.style("display: flex; justify-content: center;");
        border.style("width: fit-content; height: fit-content");
        border.style(`border-radius: ${BORDER_RADIUS}px`);
        border.style(`background: #${isDarkMode ? '30564e88' : 'b9543788'}`);
        border.style("padding: 6px 12px");

        content = p.createDiv();
        content.parent(border);
        content.id('webrtc_content');
        content.style("display: flex; justify-content: center;");
        content.style('flex-direction', 'column');
        content.style("width: fit-content; height: fit-content");
        content.style("word-break: break-all");
        content.style(`background: #${isDarkMode ? '30564e88' : 'b9543788'}`);
        content.style(`border-radius: ${BORDER_RADIUS}px`);
        content.style("padding: 6px 12px");
        content.style(`color: ${isDarkMode ? 'white' : 'black'}`);
        update_border();

        if (this.isOfficial && this.target) {
          if (this.user_id) // 1:1 대화인 경우
            status = p.createDiv(this.nakama.users[this.isOfficial][this.target][this.user_id]['display_name']);
          status.parent(content);
          status.style('text-align', 'center');
          status.style('align-self', 'center');
          status.style('width', '100%');
          status.style('height', 'fit-content');
          status.style('pointer-events', 'none');
        }

        buttons = p.createDiv();
        buttons.parent(content);
        buttons.id('webrtc_content');
        buttons.style("display: flex; justify-content: center;");
        buttons.style("align-self", "center");
        buttons.style("width: fit-content; height: fit-content");

        call_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="call-outline"></ion-icon>');
        call_button.parent(buttons);
        call_button.style('padding', '0px');
        call_button.style('margin', '4px');
        call_button.style('border-radius', `${BORDER_RADIUS / 2}px`);
        call_button.style('width', '40px');
        call_button.style('height', '40px');
        call_button.mouseClicked(() => {
          this.CreateAnswer();
        });
        call_button.elt.disabled = true;
        p['call_button'] = call_button;

        mute_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="mic-outline"></ion-icon>');
        mute_button.parent(buttons);
        mute_button.style('padding', '0px');
        mute_button.style('margin', '4px');
        mute_button.style('border-radius', `${BORDER_RADIUS / 2}px`);
        mute_button.style('width', '40px');
        mute_button.style('height', '40px');
        mute_button.mouseClicked(() => {
          const audioTracks = this.localStream.getAudioTracks();
          for (let i = 0, j = audioTracks.length; i < j; i++)
            audioTracks[i].enabled = false;
          unmute_button.show();
          mute_button.hide();
        });

        unmute_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="mic-off-outline"></ion-icon>');
        unmute_button.parent(buttons);
        unmute_button.style('background-color', 'grey')
        unmute_button.style('padding', '0px');
        unmute_button.style('margin', '4px');
        unmute_button.style('border-radius', `${BORDER_RADIUS / 2}px`);
        unmute_button.style('width', '40px');
        unmute_button.style('height', '40px');
        unmute_button.mouseClicked(() => {
          const audioTracks = this.localStream.getAudioTracks();
          for (let i = 0, j = audioTracks.length; i < j; i++)
            audioTracks[i].enabled = true;
          mute_button.show();
          unmute_button.hide();
        });
        unmute_button.hide();

        dev_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="settings-outline"></ion-icon>');
        dev_button.parent(buttons);
        dev_button.style('padding', '0px');
        dev_button.style('margin', '4px');
        dev_button.style('border-radius', `${BORDER_RADIUS / 2}px`);
        dev_button.style('width', '40px');
        dev_button.style('height', '40px');
        dev_button.mouseClicked(async () => {
          dev_button.elt.disabled = true;
          let list = await this.getDeviceList();
          this.modalCtrl.create({
            component: WebrtcManageIoDevPage,
            componentProps: {
              list: list,
            },
          }).then(v => {
            v.onDidDismiss().then(async v => {
              dev_button.elt.disabled = false;
              try {
                let info: MediaStreamConstraints = {};
                if (v.data.videoinput) {
                  info['video'] = {
                    deviceId: v.data.videoinput.deviceId,
                  }
                }
                if (v.data.audioinput) {
                  info['audio'] = {
                    deviceId: v.data.audioinput.deviceId,
                  }
                }
                this.PeerConnection.removeStream(this.localStream);
                this.localStream = await navigator.mediaDevices.getUserMedia(info);
                this.localMedia.srcObject = this.localStream;
                this.localStream.getTracks().forEach((track: any) => this.PeerConnection.addTrack(track, this.localStream));
              } catch (e) { }
            });
            v.present()
          });
        });

        hangup_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="close-circle-outline"></ion-icon>');
        hangup_button.parent(buttons);
        hangup_button.style('background-color', 'red');
        hangup_button.style('padding', '0px');
        hangup_button.style('margin', '4px');
        hangup_button.style('border-radius', `${BORDER_RADIUS / 2}px`);
        hangup_button.style('width', '40px');
        hangup_button.style('height', '40px');
        hangup_button.mouseClicked(async () => {
          await this.close_webrtc();
        });
      }

      let NotUsed = false;
      p.draw = () => {
        if (borderLerp > 0)
          borderLerp -= .03;
        update_border();
        if (!this.OnUse) { // 사용하지 않게 되면 퇴장 애니메이션
          if (this.p5canvas && !NotUsed) {
            this.p5canvas['hangup']();
            div.hide();
            setTimeout(() => {
              if (!this.OnUse) this.p5canvas.remove();
            }, 1000);
            NotUsed = true;
          }
        }
      }

      /** Toast 외곽 조정 */
      let update_border = () => {
        let calced = p.lerpColor(p.color(`#${isDarkMode ? '30564e88' : 'b9543788'}`), p.color('#ffd94ebb'), borderLerp)['levels'];
        let border_calced = 4 * borderLerp;
        border.style(`padding: ${border_calced}px ${border_calced}px`);
        content.style(`padding: ${p.lerp(6, 2, borderLerp)}px ${p.lerp(12, 8, borderLerp)}px`);
        border.style(`background: rgba(${calced[0]}, ${calced[1]}, ${calced[2]}, ${calced[3] / 255})`);
      }
    });
  }

  /** 입력 장치 정보 불러오기 */
  async getDeviceList(): Promise<MediaDeviceInfo[]> {
    let list = await navigator.mediaDevices.enumerateDevices();
    return list;
  }

  /** 상대방에게 연결 요청 */
  async createCall() {
    this.isCallable = false;
    this.isConnected = true; // 연결된건 아니지만 통화종료를 수행할 수 있도록
    this.startTime = window.performance.now();

    let servers: RTCConfiguration;
    try {
      let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json');
      servers = {};
      servers.iceServers = JSON.parse(list);
    } catch (e) { }
    // Create peer connections and add behavior.
    if (this.TypeIn != 'data') {
      if (!servers || !servers.iceServers || !servers.iceServers.length) {
        this.p5toast.show({
          text: this.lang.text['WebRTCDevManager']['NoRegServer'],
        });
        servers = undefined;
      }
    }
    this.PeerConnection = new RTCPeerConnection(servers);

    this.PeerConnection.addEventListener('icecandidate', (ev: any) => this.handleConnection(ev));
    this.PeerConnection.addEventListener(
      'connectionstatechange', async (ev: any) => {
        switch (ev.target.connectionState) {
          case 'failed': // 실패
          case 'disconnected': // 연결 끊어짐
            await this.close_webrtc();
            break;
          case 'connected':
            if (this.p5canvas) clearTimeout(this.p5canvas['waiting_act']);
            break;
          default:
            console.log('연결 상태 변경됨: ', ev.target.connectionState);
            break;
        }
      });
    // Add local stream to connection and create offer to connect.
    if (this.TypeIn != 'data') {
      this.localStream.getTracks().forEach((track: any) => this.PeerConnection.addTrack(track, this.localStream));
      this.PeerConnection.addEventListener('addstream', (ev: any) => {
        this.remoteMedia.srcObject = ev.stream;
      });
    } else this.createDataChannel();
    this.PeerConnection.addEventListener('datachannel', (event: any) => {
      this.dataChannel = event.channel;
      this.createDataChannelListener();
    });
    this.PeerConnection.addEventListener('negotiationneeded', async (_ev: any) => {
      // 스트림 설정 변경시 재협상 필요, sdp 재교환해야함
      // 교환한 사람쪽에서 이 트리거가 발동됨
      if (this.JoinInited) { // 응답 받아 진입한 경우에도 동작하므로 구분에 유의한다
        await this.PeerConnection.createOffer({
          offerToReceiveVideo: 1,
        }).then((ev: any) => this.createdOffer(ev))
          .catch((e: any) => this.setSessionDescriptionError(e));

        let data_str = JSON.stringify(this.LocalOffer);
        let part = data_str.match(/(.{1,64})/g);
        if (this.isOfficial && this.target) {
          for (let i = 0, j = part.length; i < j; i++)
            await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
              this.CurrentMatch.match_id, MatchOpCode.WEBRTC_NEGOCIATENEEDED, encodeURIComponent(part[i]));
          await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
            this.CurrentMatch.match_id, MatchOpCode.WEBRTC_NEGOCIATENEEDED, encodeURIComponent('EOL'));
        } else {
          console.log('서버정보 없음: 누구 통해서 보냄?');
        }
      }
    })
  }

  dataChannel: any;
  dataChannelOpenAct: Function;
  dataChannelOnMsgAct: Function;
  dataChannelOnCloseAct: Function;
  createDataChannel(option?: RTCDataChannelInit) {
    this.dataChannel = this.PeerConnection.createDataChannel(option);
    this.createDataChannelListener();
  }

  createDataChannelListener() {
    this.dataChannel.addEventListener('open', (_ev: any) => {
      if (this.dataChannelOpenAct) this.dataChannelOpenAct();
    });
    this.dataChannel.addEventListener('close', (_ev: any) => {
      if (this.dataChannelOnCloseAct) this.dataChannelOnCloseAct();
      this.dataChannelOpenAct = undefined;
      this.dataChannelOnMsgAct = undefined;
      this.dataChannelOnCloseAct = undefined;
    });
    this.dataChannel.addEventListener('message', (event: any) => {
      if (this.dataChannelOnMsgAct) this.dataChannelOnMsgAct(event.data);
    });
  }

  send(msg: string) {
    try {
      this.dataChannel.send(msg);
    } catch (e) {
      console.log('WebRTC 메시지 발송 실패: ', e);
    }
  }

  /** 전화 요청 생성 */
  CreateOffer() {
    if (this.p5canvas)
      this.p5canvas['call_button'].hide();

    this.PeerConnection.createOffer({
      offerToReceiveVideo: 1,
    }).then((ev: any) => this.createdOffer(ev))
      .catch((e: any) => this.setSessionDescriptionError(e));
  }

  private handleConnection(event: any) {
    let iceCandidate = event.candidate;

    if (iceCandidate)
      this.IceCandidates.push(new RTCIceCandidate(iceCandidate));
  }

  /** iceCandidate를 수신받으면 잠시 후에 답변발송을 함 */
  ReplyIceCandidate: any;
  /** ice candidate 공유 받음 */
  ReceiveIceCandidate(newIceCandidate: any, _target?: any) {
    if (this.ReplyIceCandidate) clearTimeout(this.ReplyIceCandidate);
    this.ReplyIceCandidate = setTimeout(async () => {
      if (!_target) {
        for (let i = 0, j = this.IceCandidates.length; i < j; i++)
          await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
            this.CurrentMatch.match_id, MatchOpCode.WEBRTC_ICE_CANDIDATES, encodeURIComponent(JSON.stringify(this.IceCandidates[i])));
      } else {
        for (let i = 0, j = this.IceCandidates.length; i < j; i++) {
          _target['client'].send(JSON.stringify({
            type: 'socket_react',
            act: 'WEBRTC_ICE_CANDIDATES',
            channel: _target['channel'],
            data_str: JSON.stringify(this.IceCandidates[i]),
          }));
          await new Promise((done) => setTimeout(done, 40));
        }
      }
      this.IceCandidates.length = 0;
    }, 800);
    this.PeerConnection.addIceCandidate(newIceCandidate)
      .then(() => {
        console.log('Success to add new ice candidate');
      }).catch((e: any) => {
        console.error('failed to add ice candidate: ', e);
      });
  }

  // Logs offer creation and sets peer connection session descriptions.
  private createdOffer(description: any) {
    this.LocalOffer = description;

    this.PeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  /** 상대방이 생성한 offer를 받음 */
  createRemoteOfferFromAnswer(description: any) {
    this.PeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  /** 응답해주기 */
  CreateAnswer(_target?: any) {
    this.PeerConnection.createAnswer()
      .then((desc: any) => this.createdAnswer(desc, _target))
      .catch((e: any) => this.setSessionDescriptionError(e));
  }

  // Logs success when localDescription is set.
  private setLocalDescriptionSuccess(peerConnection: any) {
    this.setDescriptionSuccess(peerConnection, 'setLocalDescription');
  }

  // Logs success when remoteDescription is set.
  private setRemoteDescriptionSuccess(peerConnection: any) {
    this.setDescriptionSuccess(peerConnection, 'setRemoteDescription');
  }

  // Logs answer to offer creation and sets peer connection session descriptions.
  private async createdAnswer(description: any, _target?: any) {
    if (this.p5canvas)
      this.p5canvas['call_button'].hide();
    this.LocalAnswer = description;

    this.PeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));

    let data_str = JSON.stringify(description);
    let part = data_str.match(/(.{1,64})/g);
    if (!_target) {
      for (let i = 0, j = part.length; i < j; i++)
        await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
          this.CurrentMatch.match_id, MatchOpCode.WEBRTC_RECEIVE_ANSWER, encodeURIComponent(part[i]));
      await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
        this.CurrentMatch.match_id, MatchOpCode.WEBRTC_RECEIVE_ANSWER, encodeURIComponent('EOL'));
      await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
        this.nakama.self_match[this.isOfficial][this.target].match_id, MatchOpCode.WEBRTC_RECEIVED_CALL_SELF, encodeURIComponent(''));
    } else {
      for (let i = 0, j = part.length; i < j; i++) {
        _target.client.send(JSON.stringify({
          type: 'socket_react',
          act: 'WEBRTC_RECEIVE_ANSWER',
          channel: _target.channel,
          data_str: part[i],
        }));
        await new Promise((done) => setTimeout(done, 40));
      }
      _target.client.send(JSON.stringify({
        type: 'socket_react',
        act: 'WEBRTC_RECEIVE_ANSWER',
        channel: _target.channel,
        data_str: 'EOL',
      }));
    }
    // 스스로에게 통화 수신됨을 알림 (self_match)
    this.JoinInited = true;
  }

  /** 상대방으로부터 답변을 받음 */
  async ReceiveRemoteAnswer(description: any, _target?: any) {
    this.PeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
    // 방 생성자가 ice candidate 를 공유함
    if (!_target) {
      for (let i = 0, j = this.IceCandidates.length; i < j; i++)
        await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
          this.CurrentMatch.match_id, MatchOpCode.WEBRTC_ICE_CANDIDATES, encodeURIComponent(JSON.stringify(this.IceCandidates[i])));
    } else {
      for (let i = 0, j = this.IceCandidates.length; i < j; i++) {
        _target['client'].send(JSON.stringify({
          type: 'socket_react',
          channel: _target['channel'],
          act: 'WEBRTC_ICE_CANDIDATES',
          data_str: JSON.stringify(this.IceCandidates[i]),
        }));
        await new Promise((done) => setTimeout(done, 40));
      }
    }
    this.IceCandidates.length = 0;
  }

  private setSessionDescriptionError(error: any) {
    console.error(`Failed to create session description: ${error}.`);
  }

  // Logs success when setting session description.
  private setDescriptionSuccess(peerConnection: any, functionName: any) {
    console.log(`Local ${functionName} complete.`);
  }

  /** 통화 종료하기 */
  private async HangUpCall(leaveMatch: boolean) {
    if (this.p5canvas)
      this.p5canvas['hangup']();
    this.isCallable = true;
    this.isConnected = false;
    if (this.PeerConnection)
      this.PeerConnection.close();
    this.PeerConnection = undefined;
    try {
      if (leaveMatch && this.CurrentMatch.match_id != this.nakama.self_match[this.isOfficial][this.target].match_id) {
        await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
          this.CurrentMatch.match_id, MatchOpCode.WEBRTC_HANGUP, '');
        await this.nakama.servers[this.isOfficial][this.target].socket.leaveMatch(this.CurrentMatch.match_id);
      }
    } catch (e) { }
  }

  /** webrtc 관련 개체 전부 삭제 */
  async close_webrtc(LeaveMatch = true, checkIfData = false) {
    if (checkIfData && this.TypeIn != 'data') return;
    this.InitReplyCallback = undefined;
    await this.HangUpCall(LeaveMatch);
    if (this.localMedia) this.localMedia.remove();
    if (this.remoteMedia) this.remoteMedia.remove();
    this.OnUse = false;
    this.isCallable = false;
    this.isConnected = false;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: any) => track.stop());
      this.localStream.getAudioTracks().forEach((track: any) => track.stop());
    }
    if (this.HangUpCallBack) {
      try {
        await this.HangUpCallBack();
      } catch (e) {
        console.log('전화 끊기 추가동작 오류: ', e);
      }
      this.HangUpCallBack = undefined;
    }
    this.localMedia = undefined;
    this.localStream = undefined;
    this.remoteMedia = undefined;
    this.isOfficial = undefined;
    this.target = undefined;
    this.user_id = undefined;
    this.channel_id = undefined;
    this.LocalOffer = undefined;
    this.LocalAnswer = undefined;
    this.dataChannel = {};
    this.ReceivedOfferPart = '';
    this.ReceivedAnswerPart = '';
    this.JoinInited = false;
    delete this.nakama.socket_reactive['WEBRTC_INIT_REQ_SIGNAL'];
    delete this.nakama.socket_reactive['WEBRTC_REPLY_INIT_SIGNAL'];
    delete this.nakama.socket_reactive['WEBRTC_RECEIVE_ANSWER'];
    delete this.nakama.socket_reactive['WEBRTC_ICE_CANDIDATES'];
    delete this.nakama.socket_reactive['WEBRTC_NEGOCIATENEEDED'];
    delete this.nakama.socket_reactive['WEBRTC_RECEIVED_CALL_SELF'];
    delete this.nakama.socket_reactive['WEBRTC_CHECK_ONLINE'];
    this.IceCandidates.length = 0;
  }
}

import { Injectable } from '@angular/core';
import * as p5 from 'p5';
function import_p5sound() {
  if (window.location.protocol != 'http:' || window.location.host.indexOf('localhost') == 0) {
    import('p5/lib/addons/p5.sound');
  }
}
import_p5sound();
import { P5ToastService } from './p5-toast.service';
import { LanguageSettingService } from './language-setting.service';
import { NakamaService } from './nakama.service';
import { IndexedDBService } from './indexed-db.service';
import { VoiceRecorder } from "@langx/capacitor-voice-recorder";
import { GlobalActService, isDarkMode } from './global-act.service';

/** 각 피어의 구성요소 양식 */
interface PeerForm {
  TypeIn?: 'video' | 'audio' | 'data';
  PeerConnection?: RTCPeerConnection;
  /** 통화중 여부, 통화중일 땐 통화요청 할 수 없고, 통화 끊기를 할 수 있음 */
  isConnected?: boolean;
  /** 응답에 반응하여 진입 후 통화 연결되기 전 */
  JoinInited?: boolean;
  LocalOffer?: any;
  /** LocalOffer 결과물 분할처리된 것을 관리 */
  LocalOfferPartArray?: string[];
  LocalAnswer?: any;
  ReceivedOfferPart?: string;
  ReceivedAnswerPart?: string;
  IceCandidates?: any[];
  /** 전화끊기시 추가 행동 등록 */
  HangUpCallBack?: Function;
  dataChannel?: RTCDataChannel;
  dataChannelOpenAct?: Function;
  dataChannelOnMsgAct?: Function;
  dataChannelOnCloseAct?: Function;
}

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  constructor(
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private lang: LanguageSettingService,
    private nakama: NakamaService,
    private global: GlobalActService,
  ) {
    this.nakama.WebRTCService = this;
    this.global.WebRTCService = this;
  }

  private p5canvas: p5;
  private p5waitingAct: any;
  private p5callButton: p5.Element;
  private p5hangup: Function;

  private localMedia: any;
  private localStream: MediaStream;
  private remoteMedia: any;

  /** 피어간 P2P 다중 연결을 허용하기 위해 각 피어들을 id 별로 묶어서 관리 */
  Peers: { [id: string]: PeerForm } = {};
  /** WebRTC 자체 사용 여부  
   * p5 컨트롤러 개체를 다루기 위해 필요함  
   * 이 변수는 미디어 채널을 사용하는지 여부와 동일함
   */
  private OnUse = false;
  /** 상태를 표시하는 문구 (간이 통화에서 표시됨, 기억되어야 하므로 여기에 배치됨) */
  StatusText = '';

  /** 기존 내용 삭제 및 WebRTC 기반 구축  
   * 마이크 권한을 확보하고 연결하기
   * @param type 영상통화 / 음성통화 / 데이터 채널 연결
   * @param actId 데이터 채널을 사용하는 경우 id 처리 (미디어 채널은 1개만 사용하므로 허용하지 않음)
   */
  async initialize(type: 'video' | 'audio' | 'data', actId: string) {
    // 이미 사용중이라면 오류 띄우고 끝내기
    if (this.OnUse && type != 'data') {
      this.p5toast.show({
        text: this.lang.text['WebRTCDevManager']['AlreadyCalling'],
      });
      throw this.lang.text['WebRTCDevManager']['AlreadyCalling'];
    }
    // 기존 연결 끊기 행동 전 선행 검토
    if (type != 'data') {
      // 미디어 채널인 경우 보안 연결 필수, 안되면 안내 띄우고 무시
      if (window.location.protocol == 'http:' && window.location.host.indexOf('localhost') != 0)
        throw this.lang.text['WebRTCDevManager']['SecurityError'];
      let answer = await VoiceRecorder.requestAudioRecordingPermission();
      if (!answer.value) throw this.lang.text['WebRTCDevManager']['SecurityError'];
    }
    await this.close_webrtc(actId);
    if (!this.Peers[actId]) this.Peers[actId] = {};
    this.Peers[actId].TypeIn = type;
    this.Peers[actId].IceCandidates = [];
    this.Peers[actId].ReceivedOfferPart = '';
    this.Peers[actId].ReceivedAnswerPart = '';
    if (type != 'data') { // 화상/음성 통화일 때에만 개체 생성
      this.createP5_panel(actId);
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
        let media_const = {};
        if (type == 'video') {
          media_const['video'] = true;
          if (videoId) media_const['video'] = { deviceId: videoId };
        } else media_const['video'] = false;
        media_const['audio'] = true;
        if (audioId) media_const['audio'] = { deviceId: audioId };
        this.localStream = await navigator.mediaDevices.getUserMedia(media_const);
        this.localMedia.srcObject = this.localStream;
      } catch (e) {
        console.log('navigator.getUserMedia error: ', e);
        await this.close_webrtc(actId);
        this.p5toast.show({
          text: `${this.lang.text['WebRTCDevManager']['InitErr']}: ${e}`,
        });
      }
    }
    await this.createCall(actId);
    if (this.p5callButton)
      this.p5callButton.elt.disabled = false;
  }

  /** 최초 연결쌍이 구성되었을 때 사용자 정보 요청하기 */
  WEBRTC_INIT_REQ_SIGNAL(_target: any, actId: string) {
    let data_str = JSON.stringify(this.Peers[actId].LocalOffer);
    this.Peers[actId].LocalOfferPartArray = data_str.match(/(.{1,64})/g);
    this.WEBRTC_REPLY_INIT_SIGNAL_PART(_target, actId);
  }

  WEBRTC_REPLY_INIT_SIGNAL_PART(_target: any, actId: string) {
    if (_target['client'] && _target['client'].readyState == _target['client'].OPEN) {
      let data = this.Peers[actId].LocalOfferPartArray.shift();
      if (data) {
        _target['client'].send(JSON.stringify({
          type: 'socket_react',
          channel: _target['channel'],
          act: 'WEBRTC_REPLY_INIT_SIGNAL',
          data_str: data,
        }));
      } else {
        _target['client'].send(JSON.stringify({
          type: 'socket_react',
          channel: _target['channel'],
          act: 'WEBRTC_REPLY_INIT_SIGNAL',
          data_str: 'EOL',
        }));
      }
    }
  }

  WEBRTC_REPLY_INIT_SIGNAL(data_str: string, _target: any, actId: string) {
    if (data_str == 'EOL') { // 수신 완료
      this.createRemoteOfferFromAnswer(JSON.parse(this.Peers[actId].ReceivedOfferPart), actId);
      this.Peers[actId].ReceivedOfferPart = '';
    } else {
      this.Peers[actId].ReceivedOfferPart += data_str;
      if (_target['client'] && _target['client'].readyState == _target['client'].OPEN) {
        _target['client'].send(JSON.stringify({
          type: 'socket_react',
          channel: _target['channel'],
          act: 'WEBRTC_REPLY_INIT_SIGNAL_PART',
        }));
      }
    }
  }

  WEBRTC_RECEIVE_ANSWER(data_str: string, _target: any, actId: string) {
    if (data_str == 'EOL') { // 수신 완료
      this.ReceiveRemoteAnswer(JSON.parse(this.Peers[actId].ReceivedAnswerPart), _target, actId);
      this.Peers[actId].ReceivedAnswerPart = '';
    } else this.Peers[actId].ReceivedAnswerPart += data_str;
  }

  WEBRTC_ICE_CANDIDATES(data_str: string, _target: any, actId: string) {
    this.ReceiveIceCandidate(JSON.parse(data_str), _target, actId);
  }

  WEBRTC_NEGOCIATENEEDED(data_str: string, actId: string) {
    if (data_str == 'EOL') { // 수신 완료
      this.createRemoteOfferFromAnswer(JSON.parse(this.Peers[actId].ReceivedOfferPart), actId);
      this.Peers[actId].ReceivedOfferPart = '';
      this.CreateAnswer(undefined, actId);
    } else this.Peers[actId].ReceivedOfferPart += data_str;
  }

  createP5_panel(actId: string) {
    this.OnUse = true;
    if (this.p5canvas) {
      clearTimeout(this.p5waitingAct);
      this.p5waitingAct = null;
      if (this.p5callButton) this.p5callButton.remove();
      this.p5callButton = null;
      this.p5hangup = null;
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
          if (this.Peers[actId].JoinInited) {
            osc.stop(.1);
            clearTimeout(this.p5waitingAct);
          } else {
            if (osc) osc.stop(.1);
            osc = new p5.Oscillator(380, 'sine');
            osc.start();
            osc.amp(1, .15);
            osc.amp(0, .75);
            this.p5waitingAct = setTimeout(() => {
              waiting();
            }, 1200);
          }
        }
        this.p5waitingAct = setTimeout(() => {
          waiting();
        }, 0);
        // 다른 기기에서 통화가 연결된 경우 나머지 기기에서 중복 연결 안내음 표시 제거
        this.p5hangup = () => {
          if (!this.Peers[actId]?.isConnected) return;
          osc.stop(.1);
          clearTimeout(this.p5waitingAct);
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
        border.style('background: var(--toast-background-color)');
        border.style("padding: 6px 12px");

        content = p.createDiv();
        content.parent(border);
        content.id('webrtc_content');
        content.style("display: flex; justify-content: center;");
        content.style('flex-direction', 'column');
        content.style("width: fit-content; height: fit-content");
        content.style("word-break: break-all");
        content.style('background: var(--toast-background-color)');
        content.style(`border-radius: ${BORDER_RADIUS}px`);
        content.style("padding: 6px 12px");
        content.style(`color: ${isDarkMode ? 'white' : 'black'}`);
        update_border();

        buttons = p.createDiv();
        buttons.parent(content);
        buttons.id('webrtc_content');
        buttons.style("display: flex; justify-content: center;");
        buttons.style("align-self", "center");
        buttons.style("width: fit-content; height: fit-content");

        this.p5callButton = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="call-outline"></ion-icon>');
        this.p5callButton.parent(buttons);
        this.p5callButton.style('padding', '0px');
        this.p5callButton.style('margin', '4px');
        this.p5callButton.style('border-radius', `${BORDER_RADIUS / 2}px`);
        this.p5callButton.style('width', '40px');
        this.p5callButton.style('height', '40px');
        this.p5callButton.mouseClicked(() => {
          this.CreateAnswer(undefined, actId);
        });
        this.p5callButton.elt.disabled = true;
        this.p5callButton = this.p5callButton;

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
          this.global.PageDismissAct['webrtc-manage'] = async (v: any) => {
            dev_button.elt.disabled = false;
            try {
              let info: MediaStreamConstraints = {};
              if (this.Peers[actId].TypeIn == 'video' && v.data.videoinput)
                info['video'] = {
                  deviceId: { exact: v.data.videoinput.deviceId },
                }
              if (v.data.audioinput)
                info['audio'] = {
                  deviceId: { exact: v.data.audioinput.deviceId },
                }
              this.localStream.getTracks().forEach(track => track.stop());
              this.localStream = await navigator.mediaDevices.getUserMedia(info);
              this.localMedia.srcObject = this.localStream;
              this.Peers[actId].PeerConnection.getSenders().forEach(sender => {
                if (sender.track) sender.replaceTrack(this.localStream.getTracks()[0])
              });
              this.CreateOffer(actId);
            } catch (e) {
              console.log('미디어 스트림 변경 오류: ', e);
            }
            this.global.RestoreShortCutAct('webrtc-manage');
            delete this.global.PageDismissAct['webrtc-manage'];
          }
          this.global.StoreShortCutAct('webrtc-manage');
          this.global.ActLikeModal('webrtc-manage-io-dev', {
            list: JSON.parse(JSON.stringify(list)),
            typein: this.Peers[actId].TypeIn,
            dismiss: 'webrtc-manage',
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
          await this.close_webrtc(actId);
        });
      }

      let NotUsed = false;
      p.draw = () => {
        if (borderLerp > 0)
          borderLerp -= .03;
        update_border();
        if (!this.OnUse) { // 사용하지 않게 되면 퇴장 애니메이션
          if (this.p5hangup && !NotUsed) {
            this.p5hangup();
            div.hide();
            setTimeout(() => {
              if (!this.OnUse) {
                clearTimeout(this.p5waitingAct);
                this.p5waitingAct = null;
                this.p5callButton.remove();
                this.p5callButton = null;
                this.p5hangup = null;
                this.p5canvas.remove();
              }
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
  async createCall(actId: string) {
    this.Peers[actId].isConnected = true; // 연결된건 아니지만 통화종료를 수행할 수 있도록

    let servers: RTCConfiguration;
    try {
      let list = await this.indexed.loadTextFromUserPath('servers/webrtc_server.json');
      servers = {};
      servers.iceServers = JSON.parse(list);
    } catch (e) { }
    if (!servers || !servers.iceServers || !servers.iceServers.length) {
      this.p5toast.show({
        text: this.lang.text['WebRTCDevManager']['NoRegServer'],
      });
      servers = null;
    }
    this.Peers[actId].PeerConnection = new RTCPeerConnection(servers);

    this.Peers[actId].PeerConnection.onicecandidate = (ev) => this.handleConnection(ev, actId);

    this.Peers[actId].PeerConnection.oniceconnectionstatechange = (ev) => {
      console.log('ICE Connection state: ', this.Peers[actId].PeerConnection.iceConnectionState);
    };

    this.Peers[actId].PeerConnection.onconnectionstatechange = async (ev: any) => {
      switch (ev.target.connectionState) {
        case 'failed': // 실패
        case 'disconnected': // 연결 끊어짐
          await this.close_webrtc(actId);
          break;
        case 'connected':
          if (this.p5waitingAct)
            clearTimeout(this.p5waitingAct);
          break;
        default:
          console.log('연결 상태 변경됨: ', ev.target.connectionState);
          break;
      }
    };
    // Add local stream to connection and create offer to connect.
    if (this.Peers[actId].TypeIn != 'data') {
      this.localStream.getTracks().forEach((track: any) => this.Peers[actId].PeerConnection.addTrack(track, this.localStream));
      this.Peers[actId].PeerConnection.ontrack = (ev: any) => {
        this.remoteMedia.srcObject = ev.streams[0];
      };
    } else this.createDataChannel(undefined, actId);
    this.Peers[actId].PeerConnection.ondatachannel = (event: any) => {
      this.Peers[actId].dataChannel = event.channel;
    };
    this.Peers[actId].PeerConnection.onnegotiationneeded = async (_ev: any) => {
      // 스트림 설정 변경시 재협상 필요, sdp 재교환해야함
      // 교환한 사람쪽에서 이 트리거가 발동됨
      if (this.Peers[actId].JoinInited) { // 응답 받아 진입한 경우에도 동작하므로 구분에 유의한다
        await this.Peers[actId].PeerConnection.createOffer({
          offerToReceiveVideo: true,
        }).then((ev: any) => this.createdOffer(ev, actId))
          .catch((e: any) => this.setSessionDescriptionError(e));
      }
    }
  }

  createDataChannel(option?: string, actId?: string) {
    this.Peers[actId].dataChannel = this.Peers[actId].PeerConnection.createDataChannel(option);
    this.createDataChannelListener(actId);
  }

  createDataChannelListener(actId: string) {
    this.Peers[actId].dataChannel.onopen = (_ev: any) => {
      if (this.Peers[actId].dataChannelOpenAct) this.Peers[actId].dataChannelOpenAct();
    };
    this.Peers[actId].dataChannel.onclose = (_ev: any) => {
      if (this.Peers[actId].dataChannelOnCloseAct) this.Peers[actId].dataChannelOnCloseAct();
      this.Peers[actId].dataChannelOpenAct = null;
      this.Peers[actId].dataChannelOnMsgAct = null;
      this.Peers[actId].dataChannelOnCloseAct = null;
    };
    this.Peers[actId].dataChannel.onmessage = (event: any) => {
      if (this.Peers[actId].dataChannelOnMsgAct) this.Peers[actId].dataChannelOnMsgAct(event.data);
    };
  }

  /** 전화 요청 생성 */
  CreateOffer(actId: string) {
    if (this.p5callButton) this.p5callButton.hide();

    this.Peers[actId].PeerConnection.createOffer({
      offerToReceiveVideo: true,
    }).then(ev => this.createdOffer(ev, actId))
      .catch(e => this.setSessionDescriptionError(e));
  }

  private handleConnection(event: any, actId: string) {
    let iceCandidate = event.candidate;

    if (iceCandidate)
      this.Peers[actId].IceCandidates.push(new RTCIceCandidate(iceCandidate));
  }

  /** iceCandidate를 수신받으면 잠시 후에 답변발송을 함 */
  ReplyIceCandidate: any;
  /** ice candidate 공유 받음 */
  ReceiveIceCandidate(newIceCandidate: any, _target: any, actId: string) {
    if (this.ReplyIceCandidate) clearTimeout(this.ReplyIceCandidate);
    this.ReplyIceCandidate = setTimeout(async () => {
      for (let i = 0, j = this.Peers[actId].IceCandidates.length; i < j; i++) {
        if (_target['client'] && _target['client'].readyState == _target['client'].OPEN)
          _target['client'].send(JSON.stringify({
            type: 'socket_react',
            act: 'WEBRTC_ICE_CANDIDATES',
            channel: _target['channel'],
            data_str: JSON.stringify(this.Peers[actId].IceCandidates[i]),
          }));
        await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
      }
      this.Peers[actId].IceCandidates.length = 0;
    }, 800);
    this.Peers[actId].PeerConnection.addIceCandidate(newIceCandidate)
      .then(() => {
        console.log('Success to add new ice candidate');
      }).catch((e: any) => {
        console.error('failed to add ice candidate: ', e);
      });
  }

  // Logs offer creation and sets peer connection session descriptions.
  private createdOffer(description: any, actId: string) {
    this.Peers[actId].LocalOffer = description;

    this.Peers[actId].PeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.Peers[actId].PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  /** 상대방이 생성한 offer를 받음 */
  createRemoteOfferFromAnswer(description: any, actId: string) {
    this.Peers[actId].PeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.Peers[actId].PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  /** 응답해주기 */
  CreateAnswer(_target: any, actId: string) {
    this.Peers[actId].PeerConnection.createAnswer()
      .then((desc: any) => this.createdAnswer(desc, _target, actId))
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
  private async createdAnswer(description: any, _target: any, actId: string) {
    if (this.p5callButton) this.p5callButton.hide();
    this.Peers[actId].LocalAnswer = description;

    this.Peers[actId].PeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.Peers[actId].PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));

    let data_str = JSON.stringify(description);
    let part = data_str.match(/(.{1,64})/g);
    for (let i = 0, j = part.length; i < j; i++)
      if (_target.client && _target.client.readyState == _target.client.OPEN) {
        _target.client.send(JSON.stringify({
          type: 'socket_react',
          act: 'WEBRTC_RECEIVE_ANSWER',
          channel: _target.channel,
          data_str: part[i],
        }));
        await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
      }
    if (_target.client && _target.client.readyState == _target.client.OPEN)
      _target.client.send(JSON.stringify({
        type: 'socket_react',
        act: 'WEBRTC_RECEIVE_ANSWER',
        channel: _target.channel,
        data_str: 'EOL',
      }));
    this.Peers[actId].JoinInited = true;
  }

  /** 상대방으로부터 답변을 받음 */
  async ReceiveRemoteAnswer(description: any, _target: any, actId: string) {
    this.Peers[actId].PeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.Peers[actId].PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
    // 방 생성자가 ice candidate 를 공유함
    for (let i = 0, j = this.Peers[actId].IceCandidates.length; i < j; i++)
      if (_target['client'] && _target['client'].readyState == _target['client'].OPEN) {
        _target['client'].send(JSON.stringify({
          type: 'socket_react',
          channel: _target['channel'],
          act: 'WEBRTC_ICE_CANDIDATES',
          data_str: JSON.stringify(this.Peers[actId].IceCandidates[i]),
        }));
        await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
      }
    this.Peers[actId].IceCandidates.length = 0;
  }

  private setSessionDescriptionError(error: any) {
    console.error(`Failed to create session description: ${error}.`);
  }

  // Logs success when setting session description.
  private setDescriptionSuccess(peerConnection: any, functionName: any) {
    console.log(`Local ${functionName} complete.`);
  }

  /** 통화 종료하기 */
  private HangUpCall(actId: string) {
    this.Peers[actId].isConnected = false;
    if (this.Peers[actId].PeerConnection) {
      this.Peers[actId].PeerConnection.close();
      this.Peers[actId].PeerConnection.onicecandidate = null;
      this.Peers[actId].PeerConnection.oniceconnectionstatechange = null;
      this.Peers[actId].PeerConnection.onconnectionstatechange = null;
      this.Peers[actId].PeerConnection.ontrack = null;
      this.Peers[actId].PeerConnection.ondatachannel = null;
      this.Peers[actId].PeerConnection.onnegotiationneeded = null;
    }
    this.Peers[actId].PeerConnection = null;
  }

  /** webrtc 관련 개체 전부 삭제
   * @param actId 만약 데이터라면 id를 반드시 같이 넘겨주셔야 합니다
   */
  async close_webrtc(actId: string) {
    // 없는 통화라면 무시함
    if (!this.Peers[actId]) return;
    this.HangUpCall(actId);
    await this.Peers[actId].HangUpCallBack?.();
    if (this.Peers[actId].TypeIn != 'data') {
      this.OnUse = false;
      if (this.p5hangup) this.p5hangup();
      if (this.localMedia) this.localMedia.remove();
      if (this.remoteMedia) this.remoteMedia.remove();
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((track: any) => track.stop());
        this.localStream.getAudioTracks().forEach((track: any) => track.stop());
      }
      this.localMedia = null;
      this.localStream = null;
      this.remoteMedia = null;
    }
    if (this.Peers[actId].dataChannel) {
      this.Peers[actId].dataChannel.onopen = null;
      this.Peers[actId].dataChannel.onclose = null;
      this.Peers[actId].dataChannel.onmessage = null;
    }
    delete this.Peers[actId];
  }
}

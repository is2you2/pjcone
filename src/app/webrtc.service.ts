import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as p5 from 'p5';
import { WebrtcManageIoDevPage } from './webrtc-manage-io-dev/webrtc-manage-io-dev.page';
import { P5ToastService } from './p5-toast.service';
import { LanguageSettingService } from './language-setting.service';
import { MatchOpCode, NakamaService } from './nakama.service';
import { Match } from '@heroiclabs/nakama-js';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
    private nakama: NakamaService,
  ) { }

  p5canvas: p5;

  localMedia: any;
  localStream: any;
  PeerConnection: any;

  remoteMedia: any;

  /** 통화 시작 시간 */
  startTime: number;

  TypeIn: any;
  /** WebRTC 자체 사용 여부  
   * p5 컨트롤러 개체를 다루기 위해 필요함
   */
  OnUse = false;
  /** 통화요청 가능 여부, 통화요청을 할 수 있고, 통화 끊기는 할 수 없음 */
  isCallable = false;
  /** 통화중 여부, 통화중일 땐 통화요청 할 수 없고, 통화 끊기를 할 수 있음 */
  isConnected = false;
  /** WebRTC 서버 정보 */
  servers: RTCConfiguration; // Allows for RTC server configuration.

  // Nakama 서버에서 통화가 사용된 채널에 로그를 남기며, 통화 요청 신호로 간주됨
  // 채널 채팅 내 통화 기록을 누르면 그 당시 생성된 매치id에 연결을 시도하고 없으면 통화가 종료된 것으로 간주
  // 채팅 로그에는 match_id 만 공유한다
  isOfficial: string;
  target: string;
  channel_id: string;
  user_id: string;
  /** 현재 연결된 매치 */
  CurrentMatch: Match;
  LocalOffer: any;
  ReceivedOfferPart = '';
  ReceivedAnswerPart = '';

  /** 기존 내용 삭제 및 WebRTC 기반 구축  
   * 마이크 권한을 확보하고 연결하기
   * @param type 영상통화 / 음성통화
   * @param media_const 미디어 입출 정보 지정, 빈 값을 넣어 기본 값으로 행동하기
   * @param info ice 서버 등의 정보 입력
   * @param nakama 통화가 진행중인 채널 정보
   */
  async initialize(type: 'video' | 'audio',
    media_const?: MediaStreamConstraints, info?: RTCConfiguration, nakama?: any, LeaveMatch?: boolean) {
    if (this.OnUse) {
      this.p5toast.show({
        text: this.lang.text['WebRTCDevManager']['AlreadyCalling'],
      });
      throw this.lang.text['WebRTCDevManager']['AlreadyCalling'];
    }
    await this.close_webrtc(LeaveMatch);
    this.TypeIn = type;
    this.nakama.socket_reactive['WEBRTC_INIT_REQ_SIGNAL'] = async () => {
      let data_str = JSON.stringify(this.LocalOffer);
      let part = data_str.match(/(.{1,250})/g);
      for (let i = 0, j = part.length; i < j; i++)
        await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
          this.CurrentMatch.match_id, MatchOpCode.WEBRTC_REPLY_INIT_SIGNAL, encodeURIComponent(part[i]));
      await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
        this.CurrentMatch.match_id, MatchOpCode.WEBRTC_REPLY_INIT_SIGNAL, encodeURIComponent('EOL'));
    }
    this.nakama.socket_reactive['WEBRTC_REPLY_INIT_SIGNAL'] = (data_str: string) => {
      if (data_str == 'EOL') { // 수신 완료
        this.createRemoteOfferFromAnswer(JSON.parse(this.ReceivedOfferPart));
        this.ReceivedOfferPart = '';
      } else this.ReceivedOfferPart += data_str;
    }
    this.nakama.socket_reactive['WEBRTC_RECEIVE_ANSWER'] = (data_str: string) => {
      if (data_str == 'EOL') { // 수신 완료
        this.ReceiveRemoteAnswer(JSON.parse(this.ReceivedAnswerPart));
        this.ReceivedAnswerPart = '';
      } else this.ReceivedAnswerPart += data_str;
    }
    this.servers = info;
    if (nakama) {
      this.isOfficial = nakama.isOfficial;
      this.target = nakama.target;
      this.user_id = nakama.user_id;
      this.channel_id = nakama.channel_id;
    }
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
        this.localMedia.playsInline = true;
      document.body.appendChild(this.remoteMedia);

      // 로컬 미디어 정보 관리
      if (!media_const) media_const = {
        video: type == 'video',
        audio: true,
      }
      let mediaStream = await navigator.mediaDevices.getUserMedia(media_const);
      this.localStream = mediaStream;
      this.localMedia.srcObject = mediaStream;
      this.isCallable = true;
    } catch (e) {
      console.log('navigator.getUserMedia error: ', e);
      this.close_webrtc();
      this.p5toast.show({
        text: `${this.lang.text['WebRTCDevManager']['InitErr']}: ${e}`,
      });
    }
    this.createCall();
  }

  createP5_panel() {
    this.OnUse = true;
    if (this.p5canvas)
      this.p5canvas.remove();
    this.p5canvas = new p5((p: p5) => {
      /** 사용하는 div개체 */
      let div: p5.Element;
      /** 내용물 개체 */
      let content: p5.Element;
      /** 현재 상태 알려주기 텍스트 */
      let status: p5.Element;
      /** 내부 border 처리용 */
      let border: p5.Element;
      // 통신 관련 버튼
      let call_button: p5.Element;
      let mute_button: p5.Element;
      let unmute_button: p5.Element;
      /** 입력 기기 선택용 */
      let dev_button: p5.Element;
      let hangup_button: p5.Element;
      /** 새 메시지 알림을 위한 외곽선 조정용 */
      let borderLerp = 1;
      p.setup = () => {
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
        border.style("border-radius: 64px");
        border.style("background: #44a6fa88");
        border.style("padding: 12px");

        content = p.createDiv();
        content.parent(border);
        content.id('webrtc_content');
        content.style("display: flex; justify-content: center;");
        content.style("width: fit-content; height: fit-content");
        content.style("word-break: break-all");
        content.style("background: #44a6fa88");
        content.style("border-radius: 64px");
        content.style("padding: 12px");
        content.style("color: white");
        update_border();

        if (this.isOfficial && this.target) {
          if (this.user_id) // 1:1 대화인 경우
            status = p.createDiv(this.nakama.users[this.isOfficial][this.target][this.user_id]['display_name']);
          status.parent(content);
          status.style('position', 'absolute');
          status.style('top', '7px');
          status.style('left', '50%');
          status.style('width', 'fit-content');
          status.style('height', 'fit-content');
          status.style('transform', 'translateX(-50%)');
        }

        call_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="call-outline"></ion-icon>');
        call_button.parent(content);
        call_button.style('padding', '0px');
        call_button.style('margin', '4px');
        call_button.style('border-radius', '32px');
        call_button.style('width', '40px');
        call_button.style('height', '40px');
        call_button.mouseClicked(() => {
          this.CreateAnswer();
        });
        p['call_button'] = call_button;

        mute_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="mic-outline"></ion-icon>');
        mute_button.parent(content);
        mute_button.style('padding', '0px');
        mute_button.style('margin', '4px');
        mute_button.style('border-radius', '32px');
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
        unmute_button.parent(content);
        unmute_button.style('background-color', 'grey')
        unmute_button.style('padding', '0px');
        unmute_button.style('margin', '4px');
        unmute_button.style('border-radius', '32px');
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
        dev_button.parent(content);
        dev_button.style('padding', '0px');
        dev_button.style('margin', '4px');
        dev_button.style('border-radius', '32px');
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
            v.onDidDismiss().then(v => {
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
                this.OnUse = false;
                this.initialize(this.TypeIn, info, this.servers);
              } catch (e) { }
            });
            v.present()
          });
        });

        hangup_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="close-circle-outline"></ion-icon>');
        hangup_button.parent(content);
        hangup_button.style('background-color', 'red');
        hangup_button.style('padding', '0px');
        hangup_button.style('margin', '4px');
        hangup_button.style('border-radius', '32px');
        hangup_button.style('width', '40px');
        hangup_button.style('height', '40px');
        hangup_button.mouseClicked(() => {
          this.close_webrtc();
        });
      }

      p.draw = () => {
        if (borderLerp > 0)
          borderLerp -= .03;
        update_border();
        if (!this.OnUse) { // 사용하지 않게 되면 퇴장 애니메이션
          if (this.p5canvas)
            this.p5canvas.remove();
        }
      }

      /** Toast 외곽 조정 */
      let update_border = () => {
        let calced = p.lerpColor(p.color('#44a6fabb'), p.color('#ffd94ebb'), borderLerp)['levels'];
        border.style(`padding: ${4 * borderLerp}px`);
        content.style(`padding: ${p.lerp(12, 8, borderLerp)}px`);
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
  createCall() {
    this.isCallable = false;
    this.isConnected = true; // 연결된건 아니지만 통화종료를 수행할 수 있도록
    this.startTime = window.performance.now();
    // Get local media stream tracks.
    const videoTracks = this.localStream.getVideoTracks();
    const audioTracks = this.localStream.getAudioTracks();
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}.`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}.`);
    }

    // Create peer connections and add behavior.
    this.PeerConnection = new RTCPeerConnection(this.servers);
    console.log('Created local peer connection object localPeerConnection.');

    this.PeerConnection.addEventListener('icecandidate', (ev: any) => this.handleConnection(ev));
    this.PeerConnection.addEventListener(
      'connectionstatechange', (ev: any) => this.handleConnectionChange(ev));

    // Add local stream to connection and create offer to connect.
    this.PeerConnection.addStream(this.localStream);
    console.log('Added local stream to localPeerConnection.');
  }

  /** 전화 요청 생성 */
  CreateOfffer() {
    if (this.p5canvas)
      this.p5canvas['call_button'].hide();

    console.log('localPeerConnection createOffer start.');
    this.PeerConnection.createOffer({
      offerToReceiveVideo: 1,
    }).then((ev: any) => this.createdOffer(ev))
      .catch((e: any) => this.setSessionDescriptionError(e));
  }

  private handleConnection(event: any) {
    const peerConnection = event.target;
    const iceCandidate = event.candidate;

    if (iceCandidate) {
      const newIceCandidate = new RTCIceCandidate(iceCandidate);

      console.log(`ICE candidate:\n` +
        `${event.candidate.candidate}.`);
    }
  }

  // Logs changes to the connection state.
  private handleConnectionChange(event: any) {
    console.log('ICE state change event: ', event);
  }

  // Logs offer creation and sets peer connection session descriptions.
  private createdOffer(description: any) {
    console.log(`Offer from localPeerConnection:\n${description.sdp}`);
    this.LocalOffer = description;

    console.log('createdOffer: PeerConnection.setLocalDescription');
    this.PeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  /** 상대방이 생성한 offer를 받음 */
  createRemoteOfferFromAnswer(description: any) {
    console.log('createRemoteOfferFromAnswer: PeerConnection.setRemoteDescription');
    this.PeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  /** 응답해주기 */
  CreateAnswer() {
    this.PeerConnection.createAnswer()
      .then((desc: any) => this.createdAnswer(desc))
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
  private async createdAnswer(description: any) {
    console.log('createdAnswer: PeerConnection.setLocalDescription');
    if (this.p5canvas)
      this.p5canvas['call_button'].hide();

    this.PeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));

    let data_str = JSON.stringify(description);
    let part = data_str.match(/(.{1,250})/g);
    for (let i = 0, j = part.length; i < j; i++)
      await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
        this.CurrentMatch.match_id, MatchOpCode.WEBRTC_RECEIVE_ANSWER, encodeURIComponent(part[i]));
    await this.nakama.servers[this.isOfficial][this.target].socket.sendMatchState(
      this.CurrentMatch.match_id, MatchOpCode.WEBRTC_RECEIVE_ANSWER, encodeURIComponent('EOL'));
  }

  /** 상대방으로부터 답변을 받음 */
  ReceiveRemoteAnswer(description: any) {
    console.log('ReceiveRemoteAnswer: PeerConnection.setRemoteDescription');
    this.PeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.PeerConnection);
      }).catch((e: any) => this.setSessionDescriptionError(e));
  }

  private setSessionDescriptionError(error: any) {
    console.error(`Failed to create session description: ${error}.`);
  }

  // Logs success when setting session description.
  private setDescriptionSuccess(peerConnection: any, functionName: any) {
    console.log(`Local ${functionName} complete.`);
  }

  /** 통화 종료하기 */
  async HangUpCall(leaveMatch: boolean) {
    this.isCallable = true;
    this.isConnected = false;
    if (this.PeerConnection)
      this.PeerConnection.close();
    this.PeerConnection = undefined;
    try {
      if (leaveMatch)
        await this.nakama.servers[this.isOfficial][this.target].socket.leaveMatch(this.CurrentMatch.match_id);
    } catch (e) { }
  }

  /** webrtc 관련 개체 전부 삭제 */
  async close_webrtc(LeaveMatch = true) {
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
    this.localMedia = undefined;
    this.localStream = undefined;
    this.remoteMedia = undefined;
    this.ReceivedOfferPart = '';
    this.ReceivedAnswerPart = '';
    this.TypeIn = undefined;
    delete this.nakama.socket_reactive['WEBRTC_INIT_REQ_SIGNAL'];
    delete this.nakama.socket_reactive['WEBRTC_REPLY_INIT_SIGNAL'];
    delete this.nakama.socket_reactive['WEBRTC_RECEIVE_ANSWER'];
    this.servers = undefined;
  }
}

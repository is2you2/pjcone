import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as p5 from 'p5';
import { WebrtcManageIoDevPage } from './webrtc-manage-io-dev/webrtc-manage-io-dev.page';
import { P5ToastService } from './p5-toast.service';
import { LanguageSettingService } from './language-setting.service';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
  ) { }

  p5canvas: p5;

  localMedia: any;
  localStream: any;
  localPeerConnection: any;

  remoteMedia: any;
  remoteStream: any;
  remotePeerConnection: any;

  /** 통화 시작 시간 */
  startTime: number;

  /** WebRTC 자체 사용 여부  
   * p5 컨트롤러 개체를 다루기 위해 필요함
   */
  OnUse = false;
  /** 통화요청 가능 여부, 통화요청을 할 수 있고, 통화 끊기는 할 수 없음 */
  isCallable = false;
  /** 통화중 여부, 통화중일 땐 통화요청 할 수 없고, 통화 끊기를 할 수 있음 */
  isConnected = false;
  /** 서버 정보 */
  servers: RTCConfiguration; // Allows for RTC server configuration.

  /** 기존 내용 삭제 및 WebRTC 기반 구축  
   * 마이크 권한을 확보하고 연결하기
   */
  async initialize(type: 'video' | 'audio', info?: RTCConfiguration) {
    this.close_webrtc();
    this.servers = info;
    this.createP5_panel();
    try { // 로컬 정보 생성 및 받기
      this.localMedia = document.createElement(type);
      this.localMedia.id = 'webrtc_video';
      this.localMedia.style.width = '100%';
      this.localMedia.style.height = 'fit-content';
      this.localMedia.autoplay = true;
      if (type != 'audio')
        this.localMedia.playsInline = true;
      document.body.appendChild(this.localMedia);

      // 원격 비디오 테스트 생성
      this.remoteMedia = document.createElement(type);
      this.remoteMedia.id = 'webrtc_video_remote';
      this.remoteMedia.style.width = '100%';
      this.remoteMedia.style.height = 'fit-content';
      this.remoteMedia.autoplay = true;
      if (type != 'audio')
        this.localMedia.playsInline = true;
      document.body.appendChild(this.remoteMedia);

      // 로컬 미디어 정보 관리
      let mediaStream = await navigator.mediaDevices.getUserMedia({
        video: type == 'video',
        audio: true,
      });
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

        call_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="call-outline"></ion-icon>');
        call_button.parent(content);
        call_button.style('padding', '0px');
        call_button.style('margin', '4px');
        call_button.style('border-radius', '32px');
        call_button.style('width', '40px');
        call_button.style('height', '40px');
        call_button.mouseClicked(() => {
          this.createCall();
          call_button.hide();
        });

        mute_button = p.createButton('<ion-icon style="width: 32px; height: 32px;" name="mic-outline"></ion-icon>');
        mute_button.parent(content);
        mute_button.style('padding', '0px');
        mute_button.style('margin', '4px');
        mute_button.style('border-radius', '32px');
        mute_button.style('width', '40px');
        mute_button.style('height', '40px');
        mute_button.mouseClicked(() => {
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
          let list = await this.getDeviceList();
          this.modalCtrl.create({
            component: WebrtcManageIoDevPage,
            componentProps: {
              list: list,
            },
          }).then(v => {
            v.onDidDismiss().then(v => {
              try {
                console.log(v.data);
              } catch (e) {
                console.log('장치 관리 오류: ', e);
              }
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
    this.localPeerConnection = new RTCPeerConnection(this.servers);
    console.log('Created local peer connection object localPeerConnection.');

    this.localPeerConnection.addEventListener('icecandidate', (ev: any) => this.handleConnection(ev));
    this.localPeerConnection.addEventListener(
      'iceconnectionstatechange', (ev: any) => this.handleConnectionChange(ev));

    this.remotePeerConnection = new RTCPeerConnection(this.servers);
    console.log('Created remote peer connection object remotePeerConnection.');

    this.remotePeerConnection.addEventListener('icecandidate', (ev: any) => this.handleConnection(ev));
    this.remotePeerConnection.addEventListener(
      'iceconnectionstatechange', (ev: any) => this.handleConnectionChange(ev));
    this.remotePeerConnection.addEventListener('addstream', (ev: any) => this.gotRemoteMediaStream(ev));

    // Add local stream to connection and create offer to connect.
    this.localPeerConnection.addStream(this.localStream);
    console.log('Added local stream to localPeerConnection.');

    console.log('localPeerConnection createOffer start.');
    this.localPeerConnection.createOffer({
      offerToReceiveVideo: 1,
    }).then((ev: any) => this.createdOffer(ev)).catch(this.setSessionDescriptionError);
  }

  private handleConnection(event: any) {
    const peerConnection = event.target;
    const iceCandidate = event.candidate;

    if (iceCandidate) {
      const newIceCandidate = new RTCIceCandidate(iceCandidate);
      const otherPeer = this.getOtherPeer(peerConnection);

      otherPeer.addIceCandidate(newIceCandidate)
        .then(() => {
          this.handleConnectionSuccess(peerConnection);
        }).catch((error: any) => {
          this.handleConnectionFailure(peerConnection, error);
        });

      console.log(`${this.getPeerName(peerConnection)} ICE candidate:\n` +
        `${event.candidate.candidate}.`);
    }
  }

  // Gets the "other" peer connection.
  private getOtherPeer(peerConnection: any) {
    return (peerConnection === this.localPeerConnection) ?
      this.remotePeerConnection : this.localPeerConnection;
  }

  // Logs that the connection succeeded.
  private handleConnectionSuccess(peerConnection: any) {
    console.log(`${this.getPeerName(peerConnection)} addIceCandidate success.`);
  };

  // Logs changes to the connection state.
  private handleConnectionChange(event: any) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`${this.getPeerName(peerConnection)} ICE state: ` +
      `${peerConnection.iceConnectionState}.`);
  }

  // Logs that the connection failed.
  private handleConnectionFailure(peerConnection: any, error: any) {
    console.error(`${this.getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
      `${error.toString()}.`);
  }

  // Gets the name of a certain peer connection.
  private getPeerName(peerConnection: any) {
    return (peerConnection === this.localPeerConnection) ?
      'localPeerConnection' : 'remotePeerConnection';
  }

  // Handles remote MediaStream success by adding it as the remoteVideo src.
  private gotRemoteMediaStream(event: any) {
    const mediaStream = event.stream;
    this.remoteMedia.srcObject = mediaStream;
    this.remoteStream = mediaStream;
    console.log('Remote peer connection received remote stream.');
  }

  // Logs offer creation and sets peer connection session descriptions.
  private createdOffer(description: any) {
    console.log(`Offer from localPeerConnection:\n${description.sdp}`);

    console.log('localPeerConnection setLocalDescription start.');
    this.localPeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.localPeerConnection);
      }).catch(this.setSessionDescriptionError);

    console.log('remotePeerConnection setRemoteDescription start.');
    this.remotePeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.remotePeerConnection);
      }).catch(this.setSessionDescriptionError);

    console.log('remotePeerConnection createAnswer start.');
    this.remotePeerConnection.createAnswer()
      .then((desc) => this.createdAnswer(desc))
      .catch(this.setSessionDescriptionError);
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
  private createdAnswer(description: any) {
    console.log(`Answer from remotePeerConnection:\n${description.sdp}.`);

    console.log('remotePeerConnection setLocalDescription start.');
    this.remotePeerConnection.setLocalDescription(description)
      .then(() => {
        this.setLocalDescriptionSuccess(this.remotePeerConnection);
      }).catch(this.setSessionDescriptionError);

    console.log('localPeerConnection setRemoteDescription start.');
    this.localPeerConnection.setRemoteDescription(description)
      .then(() => {
        this.setRemoteDescriptionSuccess(this.localPeerConnection);
      }).catch(this.setSessionDescriptionError);
  }

  private setSessionDescriptionError(error: any) {
    console.error(`Failed to create session description: ${error}.`);
  }

  // Logs success when setting session description.
  private setDescriptionSuccess(peerConnection: any, functionName: any) {
    const peerName = this.getPeerName(peerConnection);
    console.log(`${peerName} ${functionName} complete.`);
  }

  /** 통화 종료하기 */
  HangUpCall() {
    this.isCallable = true;
    this.isConnected = false;
    if (this.localPeerConnection)
      this.localPeerConnection.close();
    if (this.remotePeerConnection)
      this.remotePeerConnection.close();
    this.localPeerConnection = null;
    this.remotePeerConnection = null;
    console.log('Ending call.');
  }

  /** webrtc 관련 개체 전부 삭제 */
  close_webrtc() {
    this.HangUpCall();
    if (this.localMedia) this.localMedia.remove();
    if (this.remoteMedia) this.remoteMedia.remove();
    this.OnUse = false;
    this.isCallable = false;
    this.isConnected = false;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track: any) => track.stop());
      this.localStream.getAudioTracks().forEach((track: any) => track.stop());
    }
    if (this.remoteStream) {
      this.remoteStream.getVideoTracks().forEach((track: any) => track.stop());
      this.remoteStream.getAudioTracks().forEach((track: any) => track.stop());
    }
    this.servers = undefined;
  }
}

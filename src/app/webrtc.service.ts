import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WebrtcService {

  constructor() { }

  localMedia: any;
  localStream: any;
  localPeerConnection: any;

  remoteMedia: any;
  remoteStream: any;
  remotePeerConnection: any;

  /** 통화 시작 시간 */
  startTime: number;

  /** 통화요청 가능 여부, 통화요청을 할 수 있고, 통화 끊기는 할 수 없음 */
  isCallable = false;
  /** 통화중 여부, 통화중일 땐 통화요청 할 수 없고, 통화 끊기를 할 수 있음 */
  isConnected = false;
  /** 서버 정보 */
  servers: RTCConfiguration; // Allows for RTC server configuration.

  /** 기존 내용 삭제 및 WebRTC 기반 구축  
   * 마이크 권한을 확보하고 연결하기
   */
  initialize(type: 'video' | 'audio', info?: RTCConfiguration) {
    this.close_webrtc();
    this.servers = info;
    try { // 로컬 정보 생성 및 받기
      this.localMedia = document.createElement(type);
      this.localMedia.id = 'webrtc_video';
      this.localMedia.style.width = '100%';
      this.localMedia.style.height = 'fit-content';
      this.localMedia.autoplay = true;
      if (type != 'audio')
        this.localMedia.playsInline = true;
      document.getElementById('webrtc_local').appendChild(this.localMedia);

      // 원격 비디오 테스트 생성
      this.remoteMedia = document.createElement(type);
      this.remoteMedia.id = 'webrtc_video_remote';
      this.remoteMedia.style.width = '100%';
      this.remoteMedia.style.height = 'fit-content';
      this.remoteMedia.autoplay = true;
      if (type != 'audio')
        this.localMedia.playsInline = true;
      document.getElementById('webrtc_remote').appendChild(this.remoteMedia);

      navigator.mediaDevices.getUserMedia({
        video: type == 'video',
        audio: true,
      }).then((mediaStream) => {
        this.localStream = mediaStream;
        this.localMedia.srcObject = mediaStream;
        this.isCallable = true;
      })
    } catch (e) {
      console.log('navigator.getUserMedia error: ', e);
    }
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

  handleConnection(event: any) {
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
  getOtherPeer(peerConnection: any) {
    return (peerConnection === this.localPeerConnection) ?
      this.remotePeerConnection : this.localPeerConnection;
  }

  // Logs that the connection succeeded.
  handleConnectionSuccess(peerConnection: any) {
    console.log(`${this.getPeerName(peerConnection)} addIceCandidate success.`);
  };

  // Logs changes to the connection state.
  handleConnectionChange(event: any) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`${this.getPeerName(peerConnection)} ICE state: ` +
      `${peerConnection.iceConnectionState}.`);
  }

  // Logs that the connection failed.
  handleConnectionFailure(peerConnection: any, error: any) {
    console.error(`${this.getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
      `${error.toString()}.`);
  }

  // Gets the name of a certain peer connection.
  getPeerName(peerConnection: any) {
    return (peerConnection === this.localPeerConnection) ?
      'localPeerConnection' : 'remotePeerConnection';
  }

  // Handles remote MediaStream success by adding it as the remoteVideo src.
  gotRemoteMediaStream(event: any) {
    const mediaStream = event.stream;
    this.remoteMedia.srcObject = mediaStream;
    this.remoteStream = mediaStream;
    console.log('Remote peer connection received remote stream.');
  }

  // Logs offer creation and sets peer connection session descriptions.
  createdOffer(description: any) {
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
  setLocalDescriptionSuccess(peerConnection: any) {
    this.setDescriptionSuccess(peerConnection, 'setLocalDescription');
  }

  // Logs success when remoteDescription is set.
  setRemoteDescriptionSuccess(peerConnection: any) {
    this.setDescriptionSuccess(peerConnection, 'setRemoteDescription');
  }

  // Logs answer to offer creation and sets peer connection session descriptions.
  createdAnswer(description: any) {
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

  setSessionDescriptionError(error: any) {
    console.error(`Failed to create session description: ${error}.`);
  }

  // Logs success when setting session description.
  setDescriptionSuccess(peerConnection: any, functionName: any) {
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

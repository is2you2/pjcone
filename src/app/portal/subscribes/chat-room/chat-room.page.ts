import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChannelMessage } from '@heroiclabs/nakama-js';
import { AlertController, IonicSafeString, LoadingController, ModalController, NavController } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
import { NakamaService } from 'src/app/nakama.service';
import * as p5 from "p5";
import { OthersProfilePage } from 'src/app/others-profile/others-profile.page';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { isNativefier, isPlatform } from 'src/app/app.component';
import { IonicViewerPage } from './ionic-viewer/ionic-viewer.page';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { DomSanitizer } from '@angular/platform-browser';
import { VoidDrawPage } from './void-draw/void-draw.page';
import { ContentCreatorInfo, FILE_BINARY_LIMIT, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { GroupDetailPage } from '../../settings/group-detail/group-detail.page';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ActivatedRoute, Router } from '@angular/router';
import { GroupServerPage } from '../../settings/group-server/group-server.page';
import { WebrtcService } from 'src/app/webrtc.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import clipboard from "clipboardy";
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { VoiceRecorder } from "@langx/capacitor-voice-recorder";

export interface ExtendButtonForm {
  /** 버튼 숨기기 */
  isHide?: boolean;
  /** 아이콘 상대경로-이름, 크기: 64 x 64 px */
  icon?: string;
  /** 아이콘 대신 사용하는 이미지 경로, 크기: 64 x 64 px */
  icon_img?: string;
  /** 마우스 커서 스타일 */
  cursor?: string;
  /** 메뉴 이름 (문자열) */
  name: string;
  act: Function;
}

/** 메시지 인용시 양식 */
interface QouteMessage {
  /** 해당 메시지가 이미지를 포함한 경우 이미지 보이게 처리 */
  url?: string;
  /** 해당 메시지에 이미지가 파일 이름으로 포함됨 */
  path?: string;
  /** 텍스트 메시지 앞부분을 발췌하여 보여주기 */
  text?: string;
  /** 해당 메시지 아이디 */
  id?: string;
  /** 메시지를 발송한 사람의 정보 */
  user_id?: string;
  /** 당시 사용하던 사용자 이름 */
  display_name?: string;
  /** 해당 메시지가 생성된 시간 기록 */
  timestamp: string;
}

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
})
export class ChatRoomPage implements OnInit, OnDestroy {

  constructor(
    public modalCtrl: ModalController,
    private navCtrl: NavController,
    private route: ActivatedRoute,
    private router: Router,
    public nakama: NakamaService,
    private noti: LocalNotiService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
    private global: GlobalActService,
    private loadingCtrl: LoadingController,
    private webrtc: WebrtcService,
    private p5toast: P5ToastService,
    private mClipboard: Clipboard,
    private alertCtrl: AlertController,
  ) { }

  /** 채널 정보 */
  info: any = {};
  isOfficial: string;
  target: string;
  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;

  /** 마지막에 읽은 메시지를 찾았는지 */
  foundLastRead = false;
  messages = [];
  /** 발송 시도하였으나 다시 답장받지 못한 메시지 */
  sending_msg = [];
  /** 내가 발송한 메시지가 수신되면 썸네일 구성하기 */
  temporary_open_thumbnail = {};
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [
    { // 0
      icon: 'settings-outline',
      name: this.lang.text['ChatRoom']['ExtSettings'],
      act: () => {
        if (this.info['redirect']['type'] != 3) {
          this.extended_buttons[0].isHide = true;
        } else {
          if (!this.lock_modal_open) {
            try {
              this.lock_modal_open = true;
              this.modalCtrl.create({
                component: GroupDetailPage,
                componentProps: {
                  info: this.nakama.groups[this.isOfficial][this.target][this.info['group_id']],
                  server: { isOfficial: this.isOfficial, target: this.target },
                },
              }).then(v => {
                v.onWillDismiss().then(data => {
                  if (data.data) { // 그룹 탈퇴/삭제시
                    this.extended_buttons.forEach(button => {
                      button.isHide = true;
                    });
                    this.extended_buttons[0].isHide = false;
                    this.extended_buttons[12].isHide = false;
                  }
                });
                v.onDidDismiss().then(() => {
                  this.ionViewDidEnter();
                });
                this.removeShortCutKey();
                v.present();
                this.lock_modal_open = false;
              });
            } catch (e) {
              this.lock_modal_open = false;
              this.p5toast.show({
                text: this.lang.text['ChatRoom']['AlreadyRemoved'],
              });
            }
          }
        }
      }
    }, { // 1
      icon: 'hammer-outline',
      name: this.lang.text['ChatRoom']['ExtSoloImage'],
      isHide: true,
      act: () => {
        if (this.info['info']['img']) {
          delete this.info['info']['img'];
          this.indexed.removeFileFromUserPath(`servers/${this.info['server']['isOfficial']}/${this.info['server']['target']}/groups/${this.info['id']}.img`);
          this.p5toast.show({
            text: this.lang.text['ChatRoom']['LocalImageRemoved'],
          });
        } else document.getElementById('local_channel').click();
      }
    }, { // 2
      icon: 'image-outline',
      name: this.lang.text['ChatRoom']['BackgroundImage'],
      act: () => {
        if (this.HasBackgroundImage)
          this.RemoveChannelBackgroundImage();
        else document.getElementById('backgroundImage_sel').click();
      }
    }, { // 3
      icon: 'document-attach-outline',
      name: this.lang.text['ChatRoom']['attachments'],
      act: async () => {
        if (!this.userInputTextArea)
          this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        try {
          await this.new_attach({ detail: { value: 'link' } });
          return; // 파일 넣기 성공시 링크 발송 기능 여전히 사용
        } catch (e) {
          if (e != 'done')
            this.new_attach({ detail: { value: 'load' } });
        }
      }
    }, { // 4
      icon_img: 'voidDraw.png',
      name: this.lang.text['ChatRoom']['voidDraw'],
      act: async () => {
        if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        let props = {};
        let content_related_creator: ContentCreatorInfo[];
        if (this.userInput.file) { // 선택한 파일을 편집하는 경우
          switch (this.userInput.file.typeheader) {
            case 'image':
              try {
                if (this.userInput.file.url)
                  this.userInput.file.blob = await fetch(this.userInput.file.url, { signal: this.cont.signal }).then(r => r.blob());
                let tmp_work_path = `tmp_files/chatroom/attached.${this.userInput.file.file_ext}`;
                await this.indexed.saveBlobToUserPath(this.userInput.file.blob, tmp_work_path);
                let thumbnail_image = document.getElementById('ChatroomSelectedImage');
                props['path'] = tmp_work_path;
                props['width'] = thumbnail_image['naturalWidth'];
                props['height'] = thumbnail_image['naturalHeight'];
                content_related_creator = this.userInput.file.content_related_creator;
              } catch (e) {
                this.p5toast.show({
                  text: `${this.lang.text['ContentViewer']['CannotEditFile']}: ${e}`,
                });
                return;
              }
              break;
            case 'text':
              props['text'] = this.userInput.file.thumbnail;
              break;
          }
        }
        this.modalCtrl.create({
          component: VoidDrawPage,
          componentProps: props,
          cssClass: 'fullscreen',
        }).then(v => {
          v.onWillDismiss().then(async v => {
            if (v.data) await this.voidDraw_fileAct_callback(v, content_related_creator);
          });
          v.onDidDismiss().then(() => {
            this.ionViewDidEnter();
          });
          this.removeShortCutKey();
          v.present();
        });
      }
    }, { // 5
      icon: 'reader-outline',
      name: this.lang.text['ChatRoom']['newText'],
      act: async () => {
        if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        let props = {
          info: {
            content: {
              is_new: undefined,
              type: 'text/plain',
              viewer: 'text',
              filename: undefined,
              path: undefined,
            },
          },
          no_edit: undefined,
        };
        if (this.userInput.file) { // 선택한 파일을 편집하는 경우
          switch (this.userInput.file.viewer) {
            case 'code':
            case 'text':
              let path = 'tmp_files/chatroom/edit_text.txt';
              await this.indexed.saveBlobToUserPath(this.userInput.file.blob, path);
              props.info.content.path = path;
              props.info.content.type = this.userInput.file.type;
              props.info.content.viewer = this.userInput.file.viewer;
              props.info.content.filename = this.userInput.file.filename || this.userInput.file.name;
              break;
          }
        } else { // 새 텍스트 파일
          let newDate = new Date();
          let year = newDate.getUTCFullYear();
          let month = ("0" + (newDate.getMonth() + 1)).slice(-2);
          let date = ("0" + newDate.getDate()).slice(-2);
          let hour = ("0" + newDate.getHours()).slice(-2);
          let minute = ("0" + newDate.getMinutes()).slice(-2);
          let second = ("0" + newDate.getSeconds()).slice(-2);
          props.info.content.is_new = 'text';
          props.info.content.filename = `texteditor_${year}-${month}-${date}_${hour}-${minute}-${second}.txt`;
          props.no_edit = true;
        }
        this.modalCtrl.create({
          component: IonicViewerPage,
          componentProps: props,
        }).then(v => {
          v.onWillDismiss().then(v => {
            if (v.data) {
              let this_file: FileInfo = {};
              this_file.content_creator = {
                timestamp: new Date().getTime(),
                display_name: this.nakama.users.self['display_name'],
                various: 'textedit',
              };
              this_file.content_related_creator = [];
              this_file.content_related_creator.push(this_file.content_creator);
              this_file.blob = v.data.blob;
              this_file.path = v.data.path;
              this_file.size = v.data.blob['size'];
              this_file.filename = v.data.blob.name || props.info.content.filename;
              this_file.file_ext = this_file.filename.split('.').pop();
              this_file.type = 'text/plain';
              this_file.viewer = 'text';
              this.userInput.file = this_file;
            }
          });
          v.onDidDismiss().then(() => {
            this.ionViewDidEnter();
          });
          this.removeShortCutKey();
          v.present();
        });
      }
    },
    { // 6
      icon: 'camera-outline',
      name: this.lang.text['ChatRoom']['Camera'],
      act: async () => {
        try {
          const image = await Camera.getPhoto({
            quality: 90,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera,
          });
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
          this.userInput.file = {};
          let time = new Date();
          this.userInput.file.filename = `Camera_${time.toLocaleString().replace(/:/g, '_')}.${image.format}`;
          this.userInput.file.file_ext = image.format;
          this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl('data:image/jpeg;base64,' + image.base64String);
          this.userInput.file.type = `image/${image.format}`;
          this.userInput.file.typeheader = 'image';
          this.userInput.file.content_related_creator = [{
            user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'camera',
          }];
          this.userInput.file.content_creator = {
            user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'camera',
          };
          await this.indexed.saveBase64ToUserPath('data:image/jpeg;base64,' + image.base64String,
            `tmp_files/chatroom/${this.userInput.file.filename}`, (raw) => {
              this.userInput.file.blob = new Blob([raw], { type: this.userInput.file['type'] })
            });
          loading.dismiss();
        } catch (e) { }
      }
    }, { // 7
      icon: 'mic-circle-outline',
      name: this.lang.text['ChatRoom']['Voice'],
      act: async () => {
        this.useVoiceRecording = !this.useVoiceRecording;
        if (this.useVoiceRecording) { // 녹음 시작
          let req = await VoiceRecorder.hasAudioRecordingPermission();
          if (req.value) { // 권한 있음
            this.extended_buttons[7].icon = 'stop-circle-outline';
            await VoiceRecorder.startRecording();
            this.p5toast.show({
              text: this.lang.text['ChatRoom']['StartVRecord'],
            });
          } else await VoiceRecorder.requestAudioRecordingPermission();
        } else { // 녹음 종료
          let data = await VoiceRecorder.stopRecording();
          let blob = this.global.Base64ToBlob(`${data.value.mimeType},${data.value.recordDataBase64}`);
          blob['name'] = `${this.lang.text['ChatRoom']['VoiceRecord']}.${data.value.mimeType.split('/').pop().split(';')[0]}`;
          blob['type_override'] = data.value.mimeType;
          this.selected_blobFile_callback_act(blob);
          this.extended_buttons[7].icon = 'mic-circle-outline';
        }
      }
    }, { // 8
      icon: 'cloud-done-outline',
      name: this.lang.text['ChatRoom']['Detour'],
      act: () => {
        this.toggle_custom_attach();
      }
    }, { // 9
      icon: 'call-outline',
      name: this.lang.text['ChatRoom']['VoiceChat'],
      act: async () => {
        try {
          await this.webrtc.initialize('audio', undefined, {
            isOfficial: this.isOfficial,
            target: this.target,
            channel_id: this.info['id'],
            user_id: this.info['info']['id'] || this.info['info']['user_id'],
          });
          this.webrtc.CurrentMatch = await this.nakama.servers[this.isOfficial][this.target].socket.createMatch();
          await this.nakama.servers[this.isOfficial][this.target].socket
            .writeChatMessage(this.info['id'], { match: this.webrtc.CurrentMatch.match_id });
          this.scroll_down_logs();
          this.webrtc.CreateOffer();
        } catch (e) {
          this.p5toast.show({
            text: `${this.lang.text['ChatRoom']['JoinMatchFailed']}: ${e}`,
          });
        }
      }
    }, { // 10
      icon: 'volume-mute-outline',
      name: this.lang.text['ChatRoom']['ReadText'],
      act: async () => {
        this.toggle_speakermode();
      }
    }, { // 11
      icon: 'log-out-outline',
      name: this.lang.text['ChatRoom']['LogOut'],
      act: async () => {
        if (this.info['redirect']['type'] != 3) {
          try {
            await this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
            this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
            this.extended_buttons.forEach(button => {
              button.isHide = true;
            });
            this.extended_buttons[12].isHide = false;
          } catch (e) {
            console.error('채널에서 나오기 실패: ', e);
          }
        } else {
          this.extended_buttons[11].isHide = true;
        }
        this.ionViewDidEnter();
      }
    }, { // 12
      isHide: true,
      name: this.lang.text['ChatRoom']['RemoveHistory'],
      icon: 'close-circle-outline',
      act: () => {
        this.alertCtrl.create({
          header: this.lang.text['ChatRoom']['RemoveChannel'],
          message: this.lang.text['ChatRoom']['CannotUndone'],
          buttons: [{
            text: this.lang.text['ChatRoom']['Delete'],
            handler: async () => {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
              loading.present();
              delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
              try { // 그룹 이미지 삭제
                switch (this.info['redirect']['type']) {
                  case 3: // 그룹방
                    await this.nakama.remove_group_list(
                      this.nakama.groups[this.isOfficial][this.target][this.info['group_id']] || this.info['info'], this.isOfficial, this.target);
                    break;
                  case 0: // 로컬 채널
                    await this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/groups/${this.info.id}.img`);
                    break;
                }
              } catch (e) {
                console.log('그룹 이미지 삭제 오류: ', e);
              }
              try { // 그룹 정보 삭제
                delete this.nakama.groups[this.isOfficial][this.target][this.info['group_id']];
              } catch (e) {
                console.log('DeleteGroupFailed: ', e);
              }
              this.nakama.save_groups_with_less_info();
              // 해당 채널과 관련된 파일 일괄 삭제 (cdn / ffs)
              try { // FFS 요청 우선
                let fallback = localStorage.getItem('fallback_fs');
                if (!fallback) throw '사용자 지정 서버 없음';
                let split_fullAddress = fallback.split('://');
                let address = split_fullAddress.pop().split(':');
                let protocol = split_fullAddress.pop();
                if (protocol) {
                  protocol += ':';
                } else {
                  let checkProtocol = address[0].replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, '');
                  protocol = checkProtocol ? 'https:' : 'http:';
                }
                let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
                // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
                let target_key = `${this.info.id}_${this.nakama.users.self['display_name']}`;
                try { // 원격 채널일 경우를 대비해 타겟 키를 바꿔치기 시도
                  target_key = `${this.info['info'].id}_${this.nakama.servers[this.isOfficial][this.target].session.user_id}`
                } catch (e) { }
                this.global.remove_files_from_storage_with_key(target_address, target_key);
              } catch (e) { }
              try { // cdn 삭제 요청, 로컬 채널은 주소 만들다가 알아서 튕김
                let protocol = this.info['info'].server.useSSL ? 'https:' : 'http:';
                let address = this.info['info'].server.address;
                let target_address = `${[protocol]}//${address}:9002/`;
                this.global.remove_files_from_storage_with_key(target_address, `${this.info['info'].id}_${this.nakama.servers[this.isOfficial][this.target].session.user_id}`);
              } catch (e) { }
              // 해당 채널과 관련된 파일 일괄 삭제 (로컬)
              let list = await this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}`);
              for (let i = 0, j = list.length; i < j; i++) {
                loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`
                await this.indexed.removeFileFromUserPath(list[i]);
              }
              loading.dismiss();
              this.navCtrl.pop();
            },
            cssClass: 'redfont',
          }]
        }).then(v => {
          this.global.p5key['KeyShortCut']['Escape'] = () => {
            v.dismiss();
          }
          v.onDidDismiss().then(() => {
            this.global.p5key['KeyShortCut']['Escape'] = () => {
              this.navCtrl.pop();
            }
          });
          v.present();
        });
      }
    },];

  useVoiceRecording = false;

  ionViewDidEnter() {
    VoiceRecorder.getCurrentStatus().then(v => {
      if (v.status == 'RECORDING') {
        // 게시물 생성기에서 음성녹음중인 상태로 들어오면 음성녹음을 할 수 없음
        this.extended_buttons[7].isHide = true;
      }
    });
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
    this.global.p5key['KeyShortCut']['BottomTab'] = (key: string) => {
      if (document.activeElement != document.getElementById(this.ChannelUserInputId))
        switch (key) {
          case 'E':
            this.open_ext_with_delay();
            break;
        }
    }
    let ExtTarget = [];
    for (let i = 0, j = this.extended_buttons.length; i < j; i++) {
      if (!this.extended_buttons[i].isHide)
        ExtTarget.push(this.extended_buttons[i]);
    }
    this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
      if (!this.isHidden && document.activeElement != document.getElementById(this.ChannelUserInputId) && ExtTarget.length > index)
        ExtTarget[index]['act']();
    }
    this.global.p5key['KeyShortCut']['EnterAct'] = () => {
      if (document.activeElement != document.getElementById(this.ChannelUserInputId))
        setTimeout(() => {
          if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
          this.make_ext_hidden();
          this.userInputTextArea.focus();
        }, 0);
    }
    this.noti.Current = this.info['cnoti_id'];
    this.useFirstCustomCDN = this.info['CDN'] || Number(localStorage.getItem('useFFSCDN')) || 0;
    this.toggle_custom_attach(this.useFirstCustomCDN);
  }

  /** 첨부 파일 타입 정하기 */
  async new_attach(ev: any, override: FileInfo = undefined) {
    if (override === undefined)
      override = {};
    switch (ev.detail.value) {
      case 'load':
        if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        document.getElementById(this.file_sel_id).click();
        break;
      case 'link':
        try {
          let pasted_url = override.url;
          if (!this.userInput.file && pasted_url === undefined)
            try {
              pasted_url = await this.mClipboard.paste();
            } catch (e) {
              try {
                pasted_url = await clipboard.read();
              } catch (e) {
                throw e;
              }
            }
          try { // DataURL 주소인지 검토
            let blob = this.global.Base64ToBlob(pasted_url);
            let getType = pasted_url.split(';')[0].split(':')[1];
            let file = new File([blob],
              `${this.lang.text['ChatRoom']['FileLink']}.${getType.split('/').pop()}`, {
              type: getType,
            });
            await this.selected_blobFile_callback_act(file);
            throw 'done';
          } catch (e) {
            switch (e) {
              case 'done':
                throw e;
            }
          }
          try { // 정상적인 주소인지 검토
            if (pasted_url.indexOf('http:') != 0 && pasted_url.indexOf('https:') != 0) throw '올바른 웹 주소가 아님';
            if (this.userInput.file && override.filename === undefined) throw '이미 파일이 첨부됨, 토글만 시도';
            let res = await fetch(pasted_url, { signal: this.cont.signal });
            if (!res.ok) throw 'URL 구조가 정상이 아님';
          } catch (e) {
            throw e;
          }
          let this_file: FileInfo = {};
          this_file.url = pasted_url;
          this_file['content_related_creator'] = [];
          if (override && override.content_related_creator) this_file['content_related_creator'] = [...override.content_related_creator]
          this_file['content_related_creator'].push({
            user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: override.url ? 'shared' : 'link',
          });
          this_file['content_creator'] = {
            user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: override.url ? 'shared' : 'link',
          };
          let sep = this_file.url.split('.');
          this_file.file_ext = override.file_ext || sep.pop().split('?').shift();
          this_file.filename = override.filename || decodeURIComponent(`${sep.pop().split('/').pop() || this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`);
          this.global.set_viewer_category_from_ext(this_file);
          this_file.type = override.type || '';
          this_file.typeheader = override.typeheader || this_file.viewer;
          this.global.modulate_thumbnail(this_file, this_file.url, this.cont);
          if (this.NeedScrollDown())
            setTimeout(() => {
              this.scroll_down_logs();
            }, 100);
          this.userInput.file = this_file;
          this.inputPlaceholder = `(${this.lang.text['ChatRoom']['FileLink']}: ${this.userInput.file.filename})`;
        } catch (e) {
          if (e == 'done')
            throw e;
          else throw `인식 불가능한 URL 정보: ${e}`;
        }
        break;
    }
  }

  /** 사용자 지정 우선 서버 사용 여부  
   * 0: 기본값  
   * 1: FFS 우선  
   * 2: SQL 강제
   */
  useFirstCustomCDN = 0;
  async toggle_custom_attach(force?: number) {
    let ModulerSize = this.info['redirect']['type'] == 0 ? 2 : 3;
    this.useFirstCustomCDN = (force ?? (this.useFirstCustomCDN + 1)) % ModulerSize;
    if (isPlatform == 'Android') {
      this.useFirstCustomCDN = 2;
      this.extended_buttons[8].isHide = true;
    }
    switch (this.useFirstCustomCDN) {
      case 0: // 기본값, cdn 서버 우선, 실패시 SQL
        this.extended_buttons[8].icon = 'cloud-offline-outline';
        this.extended_buttons[8].name = this.lang.text['ChatRoom']['Detour'];
        break;
      case 1: // FFS 서버 우선, 실패시 cdn, SQL 순
        this.extended_buttons[8].icon = 'cloud-done-outline';
        this.extended_buttons[8].name = this.lang.text['ChatRoom']['useFSS'];
        break;
      case 2: // SQL 강제
        this.extended_buttons[8].icon = 'server-outline';
        this.extended_buttons[8].name = this.lang.text['ChatRoom']['forceSQL'];
        break;
    }
    this.info['CDN'] = this.useFirstCustomCDN;
    this.nakama.save_channels_with_less_info();
  }

  async toggle_speakermode(force?: boolean) {
    this.useSpeaker = force ?? !this.useSpeaker;
    this.extended_buttons[10].icon = this.useSpeaker
      ? 'volume-high-outline' : 'volume-mute-outline';
    if (this.useSpeaker)
      localStorage.setItem('useChannelSpeaker', `${this.useSpeaker}`);
    else localStorage.removeItem('useChannelSpeaker');
    if (!this.useSpeaker) try {
      await TextToSpeech.stop();
    } catch (e) { }
  }

  /** 배경화면 선택됨 여부 */
  HasBackgroundImage = false;
  /** 페이지 진입시 배경화면 불러오기 */
  async LoadChannelBackgroundImage() {
    try {
      let blob = await this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/backgroundImage.png`, '');
      this.ChangeBackgroundImage({ target: { files: [blob] } });
      this.HasBackgroundImage = true;
    } catch (e) { }
  }

  /** 채널 배경화면 지우기 */
  async RemoveChannelBackgroundImage() {
    try {
      await this.indexed.removeFileFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/backgroundImage.png`);
      let main_table = document.getElementById('main_table');
      main_table.style.backgroundImage = 'url("")';
    } catch (e) { }
    this.HasBackgroundImage = false;
  }

  /** 채널 배경화면 변경 */
  ChangeBackgroundImage(ev: any) {
    let main_table = document.getElementById('main_table');
    let imageFile = ev.target.files[0];
    let FileURL = URL.createObjectURL(imageFile);
    main_table.style.backgroundImage = `url('${FileURL}')`;
    this.indexed.saveBlobToUserPath(imageFile, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/backgroundImage.png`);
    this.HasBackgroundImage = true;
    setTimeout(() => {
      URL.revokeObjectURL(FileURL);
    }, 100);
  }

  /** 파일 첨부하기 */
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      let is_multiple_files = ev.target.files.length != 1;
      if (is_multiple_files) {
        let alert = await this.alertCtrl.create({
          header: this.lang.text['ChatRoom']['MultipleSend'],
          message: `${this.lang.text['ChatRoom']['CountFile']}: ${ev.target.files.length}`,
          buttons: [{
            text: this.lang.text['ChatRoom']['Send'],
            handler: async () => {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['ChatRoom']['MultipleSend'] });
              loading.present();
              for (let i = 0, j = ev.target.files.length; i < j; i++) {
                loading.message = `${j - i}: ${ev.target.files[i].name}`;
                await this.selected_blobFile_callback_act(ev.target.files[i]);
                await this.send();
              }
              this.noti.ClearNoti(7);
              loading.dismiss();
              setTimeout(() => {
                this.scroll_down_logs();
                let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
                input.value = '';
              }, 300);
            }
          }]
        });
        this.global.p5key['KeyShortCut']['Escape'] = () => {
          alert.dismiss();
        }
        alert.onDidDismiss().then(() => {
          this.global.p5key['KeyShortCut']['Escape'] = () => {
            this.navCtrl.pop();
          }
        });
        alert.present();
      } else {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        await this.selected_blobFile_callback_act(ev.target.files[0]);
        loading.dismiss();
        let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
        input.value = '';
      }
    } else {
      delete this.userInput.file;
      this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
      let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
      input.value = '';
    }
  }

  /** 로컬채널 대표이미지 변경 */
  async LocalChannelImageChanged(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => {
      this.info['info']['img'] = v['canvas'].toDataURL();
      this.indexed.saveTextFileToUserPath(this.info['info']['img'],
        `servers/${this.info['server']['isOfficial']}/${this.info['server']['target']}/groups/${this.info['id']}.img`);
      this.p5toast.show({
        text: this.lang.text['ChatRoom']['LocalImageChanged'],
      });
    });
  }

  /** 옛날로 가는 커서 */
  next_cursor = '';
  /** 최근으로 가는 커서 */
  prev_cursor = '';
  file_sel_id = 'file_sel_id';
  ChatLogs: HTMLElement;
  ChatContDiv: HTMLElement;

  ShowGoToBottom = false;
  isMobile = false;

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.navCtrl.back();
    };
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.useSpeaker = Boolean(localStorage.getItem('useChannelSpeaker'));
    this.toggle_speakermode(this.useSpeaker);
    this.ChatLogs = document.getElementById('chatroom_div');
    this.ChatLogs.onscroll = (_ev: any) => {
      if (this.ChatLogs.scrollHeight - (this.ChatLogs.scrollTop + this.ChatLogs.clientHeight) < 1500) {
        // 스크롤을 제일 하단으로 내리면 사라짐
        if (!this.ShowGoToBottom)
          if (!this.ShowRecentMsg)
            this.init_last_message_viewer();
        if (this.ShowRecentMsg && !this.BlockAutoScrollDown)
          this.pull_msg_history(false);
      }
      this.ShowGoToBottom = (this.ChatLogs.scrollHeight - 220 > this.ChatLogs.scrollTop + this.ChatLogs.clientHeight) || this.ShowRecentMsg;
    }
    this.nakama.ChatroomLinkAct = async (c: any, _fileinfo: FileInfo) => {
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
      this.info = c;
      await this.init_chatroom();
      this.userInput.file = _fileinfo;
      if (this.userInput.file) this.create_thumbnail_imported(_fileinfo);
    }
    this.route.queryParams.subscribe(async _p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      if (navParams) this.info = navParams.info;
      await new Promise(res => setTimeout(res, 100)); // init 지연
      await this.init_chatroom();
      this.userInput.file = navParams.file;
      if (this.userInput.file) this.create_thumbnail_imported(navParams.file);
    });
    setTimeout(() => {
      this.CreateDrop();
    }, 100);
    this.isMobile = isPlatform == 'Android' || isPlatform == 'iOS';
    this.nakama.StatusBarChangedCallback = async () => {
      await this.SetExtensionButtons();
    }
  }

  ionViewWillEnter() {
    this.ChatContDiv = document.getElementById('chatroom_content_div');
    document.getElementById(this.ChannelUserInputId).onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        if (clipboardItem.type.startsWith('image/'))
          stack.push({ file: clipboardItem });
      if (!stack.length) return;
      if (stack.length == 1)
        this.selected_blobFile_callback_act(stack[0].file);
      else this.alertCtrl.create({
        header: this.lang.text['ChatRoom']['MultipleSend'],
        message: `${this.lang.text['ChatRoom']['CountFile']}: ${stack.length}`,
        buttons: [{
          text: this.lang.text['ChatRoom']['Send'],
          handler: () => {
            this.DropSendAct(stack);
          }
        }]
      }).then(v => {
        this.global.p5key['KeyShortCut']['Escape'] = () => {
          v.dismiss();
        }
        v.onDidDismiss().then(() => {
          this.global.p5key['KeyShortCut']['Escape'] = () => {
            this.navCtrl.pop();
          }
        });
        v.present();
      });
      return false;
    }
  }

  async GetSpeechToText() {
    await VoiceRecorder.requestAudioRecordingPermission();
    let result = await SpeechRecognition.start({
      language: this.lang.lang,
      maxResults: 1,
      prompt: this.lang.text['ChatRoom']['TalkMessage'],
      partialResults: true,
      popup: true,
    });
    this.userInput.text = result['matches'][0];
  }

  p5canvas: p5;
  CreateDrop() {
    let parent = document.getElementById('p5Drop_chatroom');
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
        canvas.parent(parent);
        p.pixelDensity(.1);
        canvas.drop((file: any) => {
          let _Millis = p.millis();
          if (LastDropAt < _Millis - 400) { // 새로운 파일로 인식
            isMultipleSend = false;
            Drops.length = 0;
            Drops.push(file);
          } else { // 여러 파일 입력으로 인식
            isMultipleSend = true;
            Drops.push(file);
          }
          LastDropAt = _Millis;
          clearTimeout(StartAct);
          StartAct = setTimeout(async () => {
            if (!isMultipleSend) {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
              loading.present();
              this.selected_blobFile_callback_act(file.file);
              loading.dismiss();
            } else { // 여러 파일 발송 여부 검토 후, 아니라고 하면 첫 파일만
              this.alertCtrl.create({
                header: this.lang.text['ChatRoom']['MultipleSend'],
                message: `${this.lang.text['ChatRoom']['CountFile']}: ${Drops.length}`,
                buttons: [{
                  text: this.lang.text['ChatRoom']['Send'],
                  handler: () => {
                    this.DropSendAct(Drops);
                  }
                }]
              }).then(v => {
                this.global.p5key['KeyShortCut']['Escape'] = () => {
                  v.dismiss();
                }
                v.onDidDismiss().then(() => {
                  this.global.p5key['KeyShortCut']['Escape'] = () => {
                    this.navCtrl.pop();
                  }
                });
                v.present();
              });
            }
          }, 400);
        });
        p['ChatMsgDragAct'] = ChatMsgDragAct;
      }
      let StartAct: any;
      let isMultipleSend = false;
      let LastDropAt = 0;
      let Drops = [];
      p.mouseMoved = (ev: any) => {
        if (ev['dataTransfer']) {
          parent.style.pointerEvents = 'all';
          parent.style.backgroundColor = '#0008';
        } else {
          parent.style.pointerEvents = 'none';
          parent.style.backgroundColor = 'transparent';
        }
      }
      /** 이 길이보다 길다면 메시지 인용으로 인식합니다 */
      const MESSAGE_QOUTE_SIZE = 80;
      let CurrentChatMovedSize = 0;
      p.touchMoved = (ev: any) => {
        try {
          ChatMsgDragAct(ev.touches[0].clientX);
        } catch (e) { }
      }
      let ChatMsgDragAct = (clientX: number) => {
        if (this.MsgClickedStartPos && this.TargetMessageObject) {
          CurrentChatMovedSize = this.MsgClickedStartPos - clientX;
          if (this.IsQouteMyMessage) {
            if (CurrentChatMovedSize > 0)
              this.TargetMessageObject.style.paddingRight = `${CurrentChatMovedSize / 2}px`;
            else this.TargetMessageObject.style.marginRight = `${CurrentChatMovedSize / 2}px`;
          } else this.TargetMessageObject.style.marginLeft = `${-CurrentChatMovedSize / 2}px`;
          if (MESSAGE_QOUTE_SIZE < CurrentChatMovedSize) {
            this.TargetMessageObject.style.backgroundColor = 'rgba(var(--ion-color-primary-rgb), .5)';
          } else if (-MESSAGE_QOUTE_SIZE > CurrentChatMovedSize) {
            this.TargetMessageObject.style.backgroundColor = 'rgba(var(--ion-color-tertiary-rgb), .5)';
          } else this.TargetMessageObject.style.backgroundColor = null;
        }
      }
      // https://javascript.info/task/truncate
      let truncate = (str: string, maxlength: number) => {
        return (str.length > maxlength) ? str.slice(0, maxlength - 1) + '…' : str;
      }
      p.mouseReleased = () => {
        ReleaseChatMsgAct();
      }
      p.touchEnded = () => {
        ReleaseChatMsgAct();
      }
      let ReleaseChatMsgAct = async () => {
        if (this.MsgClickedStartPos && this.TargetMessageObject) {
          if (MESSAGE_QOUTE_SIZE < CurrentChatMovedSize) {
            try {
              let catch_index: number;
              for (let k = 0, l = this.ViewableMessage.length; k < l; k++)
                if (this.TargetMessageObject.id == this.ViewableMessage[k].message_id) {
                  catch_index = k;
                  break;
                }
              if (catch_index === undefined) throw '메시지를 찾을 수 없음';
              let target_msg = this.ViewableMessage[catch_index];
              let text = this.deserialize_text(target_msg);
              this.userInput.qoute = {
                timestamp: target_msg.create_time,
              };
              if (text) this.userInput.qoute.text = truncate(text, 80);
              if (target_msg.content.viewer == 'image') {
                if (target_msg.content.url)
                  this.userInput.qoute.url = target_msg.content.url;
                else if (target_msg.content.path) {
                  this.userInput.qoute.path = target_msg.content.path.split('/').pop();
                  if (!this.userInput.qoute.url) {
                    let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/${this.userInput.qoute.path}`;
                    this.indexed.checkIfFileExist(path, b => {
                      if (b) this.indexed.loadBlobFromUserPath(path, '', blob => {
                        let FileURL = URL.createObjectURL(blob);
                        this.userInput.qoute['url'] = FileURL;
                        setTimeout(() => {
                          URL.revokeObjectURL(FileURL);
                        }, 100);
                      });
                    });
                  }
                }
              }
              this.userInput.qoute.id = target_msg.message_id;
              this.userInput.qoute.display_name = target_msg.user_display_name;
              this.userInput.qoute.user_id = target_msg['sender_id'];
              setTimeout(() => {
                this.make_ext_hidden();
                this.userInputTextArea.focus();
              }, 0);
            } catch (e) {
              console.log('메시지 상세보기 실패: ', e);
            }
          } else if (-MESSAGE_QOUTE_SIZE > CurrentChatMovedSize) {
            try {
              let catch_index: number;
              for (let k = 0, l = this.ViewableMessage.length; k < l; k++)
                if (this.TargetMessageObject.id == this.ViewableMessage[k].message_id) {
                  catch_index = k;
                  break;
                }
              if (catch_index === undefined) throw '메시지를 찾을 수 없음';
              let target_msg = this.ViewableMessage[catch_index];
              await this.CopyMessageText(target_msg);
            } catch (e) {
              console.log('메시지 복사 실패: ', e);
            }
          }
          this.TargetMessageObject.style.backgroundColor = null;
          this.TargetMessageObject.style.paddingRight = null;
          this.TargetMessageObject.style.marginRight = null;
          this.TargetMessageObject.style.marginLeft = null;
          CurrentChatMovedSize = 0;
        }
        this.MsgClickedStartPos = undefined;
        this.TargetMessageObject = undefined;
        this.IsQouteMyMessage = undefined;
      }
    });
  }

  BlockAutoScrollDown = false;
  /** 해당 메시지 찾기 */
  async FindQoute(id: string, timestamp: string) {
    let targetChat: HTMLElement;
    for (let i = this.ViewableMessage.length - 1; i >= 0; i--)
      if (id == this.ViewableMessage[i].message_id) {
        targetChat = document.getElementById(id);
        break;
      }
    this.BlockAutoScrollDown = true;
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    if (!targetChat) { // 메시지가 안보이면 이전 메시지에서 찾기
      let whileBreaker = false;
      // <ion-item [disabled]="(next_cursor === undefined && !ViewMsgIndex) || !pullable" button
      while (!targetChat && this.next_cursor !== undefined && this.ViewMsgIndex && this.pullable && !whileBreaker) {
        await this.pull_msg_history();
        await new Promise((done) => setTimeout(done, 200));
        for (let i = this.ViewableMessage.length - 1; i >= 0; i--) {
          if (new Date(this.ViewableMessage[i].create_time).getTime() < new Date(timestamp).getTime()) {
            whileBreaker = true;
            break; // 해당 시간대에 기록이 없으면 중단
          }
          if (id == this.ViewableMessage[i].message_id) {
            targetChat = document.getElementById(id);
            break;
          }
        }
      }
    }
    if (targetChat) {
      targetChat.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        targetChat.style.backgroundColor = 'rgba(var(--ion-color-primary-rgb), .5)';
      }, 100);
      setTimeout(() => {
        targetChat.style.backgroundColor = null;
      }, 3500);
    } else this.p5toast.show({
      text: this.lang.text['ChatRoom']['LostOriginMsg'],
    });
    this.BlockAutoScrollDown = false;
    loading.dismiss();
  }

  /** 인용 정보를 삭제함 */
  RemoveQoute() {
    delete this.userInput.qoute;
  }

  /** 한번에 여러파일 보내기 */
  async DropSendAct(Drops: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    for (let i = 0, j = Drops.length; i < j; i++) {
      await this.selected_blobFile_callback_act(Drops[i].file);
      await this.send();
    }
    loading.dismiss();
    setTimeout(() => {
      this.scroll_down_logs();
    }, 300);
  }

  /** 파일 선택시 행동
   * @param path 다른 채널에서 공유시 원본이 저장된 경로
   */
  async selected_blobFile_callback_act(blob: any, contentRelated: ContentCreatorInfo[] = [], various = 'loaded', path?: string) {
    this.userInput['file'] = {};
    this.userInput.file['filename'] = blob.name;
    this.userInput.file['file_ext'] = blob.name.split('.').pop() || blob.type || this.lang.text['ChatRoom']['unknown_ext'];
    this.userInput.file['size'] = blob.size;
    this.userInput.file['type'] = blob.type || blob.type_override;
    if (path) this.userInput.file.path = path;
    this.userInput.file['content_related_creator'] = [
      ...contentRelated, {
        user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
        timestamp: new Date().getTime(),
        display_name: this.nakama.users.self['display_name'],
        various: various as any,
      }];
    this.userInput.file['content_creator'] = {
      user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().getTime(),
      display_name: this.nakama.users.self['display_name'],
      various: various as any,
    };
    this.userInput.file.blob = blob;
    this.create_selected_thumbnail();
    this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
  }

  /** 다른 채널에 공유하기로 진입한 경우 재구성하기 */
  async create_thumbnail_imported(FileInfo: FileInfo) {
    if (FileInfo.url) {
      await this.new_attach({ detail: { value: 'link' } }, FileInfo);
    } else {
      let blob = await this.indexed.loadBlobFromUserPath(FileInfo.path, FileInfo.type);
      blob['name'] = FileInfo.filename || FileInfo.name;
      this.selected_blobFile_callback_act(blob, FileInfo.content_related_creator, 'shared', FileInfo.path);
    }
  }

  /** 선택한 파일의 썸네일 만들기 */
  async create_selected_thumbnail() {
    this.global.set_viewer_category_from_ext(this.userInput.file);
    if (this.userInput.file.url) {
      try {
        let res = await fetch(this.userInput.file.url, { signal: this.cont.signal });
        if (res.ok) this.userInput.file.thumbnail = this.userInput.file.url;
      } catch (e) { }
      this.userInput.file.typeheader = this.userInput.file.viewer;
      return;
    } else try {
      this.userInput.file.thumbnail = await this.indexed.loadBlobFromUserPath(this.userInput.file.path, this.userInput.file.type);
    } catch (e) { }
    let FileURL = URL.createObjectURL(this.userInput.file.blob);
    this.userInput.file['typeheader'] = this.userInput.file.blob.type.split('/')[0] || this.userInput.file.viewer;
    setTimeout(() => {
      URL.revokeObjectURL(FileURL);
    }, 0);
    this.userInput.file['thumbnail'] = undefined;
    switch (this.userInput.file['viewer']) {
      case 'image': // 이미지인 경우 사용자에게 보여주기
        this.userInput.file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(FileURL);
        break;
      case 'code':
      case 'text':
        new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.loadStrings(FileURL, v => {
              this.userInput.file['thumbnail'] = v;
              p.remove();
            }, e => {
              console.error('문자열 불러오기 실패: ', e);
              p.remove();
            });
          }
        });
        break;
    }
  }

  last_message_viewer = {
    user_id: undefined,
    message: undefined,
    color: undefined,
    is_me: undefined,
  };

  async init_chatroom() {
    if (this.cont) this.cont.abort();
    this.cont = new AbortController();
    this.userInput.text = '';
    delete this.userInput.file;
    delete this.userInput.qoute;
    this.ResizeTextArea();
    this.nakama.OnTransferMessage = {};
    this.ViewableMessage.length = 0;
    this.ViewMsgIndex = 0;
    this.ShowGoToBottom = false;
    this.ShowRecentMsg = false;
    this.isHistoryLoaded = false;
    this.LocalHistoryList.length = 0;
    this.messages.length = 0;
    this.prev_cursor = '';
    this.next_cursor = '';
    this.pullable = true;
    this.init_last_message_viewer();
    this.file_sel_id = `chatroom_${this.info.id}_${new Date().getTime()}`;
    this.ChannelUserInputId = `chatroom_input_${this.info.id}_${new Date().getTime()}`;
    this.noti.Current = this.info['cnoti_id'];
    if (this.info['cnoti_id'])
      this.noti.ClearNoti(this.info['cnoti_id']);
    // PWA: 윈도우 창을 다시 보게 될 때 알림 삭제
    window.onfocus = () => {
      if (this.info['cnoti_id'])
        this.noti.ClearNoti(this.info['cnoti_id']);
    }
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
    this.info = this.nakama.channels_orig[this.isOfficial][this.target][this.info.id];
    this.LoadChannelBackgroundImage();
    this.nakama.opened_page_info['channel'] = {
      isOfficial: this.isOfficial,
      target: this.target,
      id: this.info.id,
    }
    this.foundLastRead = this.info['last_read_id'] == this.info['last_comment_id'];
    await this.SetExtensionButtons();
    // 실시간 채팅을 받는 경우 행동처리
    if (this.nakama.channels_orig[this.isOfficial][this.target] &&
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']] &&
      this.info['status'] != 'missing')
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
        if (c.code == 1) { // 편집된 메시지 업데이트
          for (let i = 0, j = this.messages.length; i < j; i++)
            if (this.messages[i].message_id == c['message_id']) {
              this.messages[i].content = c.content;
              break;
            }
          return;
        }
        let is_local = c['sender_id'] == 'local';
        if (c.content['filename']) this.ModulateFileEmbedMessage(c);
        this.info['last_read_id'] = c.message_id;
        if (!is_local) this.check_if_send_msg(c);
        if (!(c.code == 1 || c.code == 2)) this.messages.push(c);
        if (c.code == 2) { // 메시지 삭제하기 동작
          for (let i = this.messages.length - 1; i >= 0; i--)
            if (this.messages[i].message_id == c.message_id) {
              this.messages.splice(i, 1);
              break;
            }
        }
        // 인용 메시지가 경로로 구성된 이미지 파일을 따르는 경우
        if (c.content.qoute && c.content.qoute.path) this.OpenQouteThumbnail(c);
        if (this.ViewMsgIndex + this.ViewCount == this.messages.length - 1)
          this.ViewMsgIndex++;
        this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
        this.modulate_chatmsg(0, this.ViewableMessage.length);
        this.modulate_chatmsg(this.ViewableMessage.length - 1, this.ViewableMessage.length);
        this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
        if (this.useSpeaker) this.SpeechReceivedMessage(c);
        setTimeout(() => {
          this.info['is_new'] = false;
          this.nakama.has_new_channel_msg = false;
          if (this.NeedScrollDown() && !this.ShowRecentMsg) {
            this.init_last_message_viewer();
            this.ChatLogs.scrollTo({ top: this.ChatLogs.scrollHeight, behavior: 'smooth' });
          } else if (c.code != 2) {
            if (this.info['local'])
              this.last_message_viewer['is_me'] = true;
            else this.last_message_viewer['is_me'] = c.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id;
            this.last_message_viewer['user_id'] = c.sender_id;
            let message_copied = JSON.parse(JSON.stringify(c.content['msg']))
            if (c.content['filename']) // 파일이 첨부된 경우
              if (message_copied.length) { // 최신 메시지 보기에 (첨부파일) 메시지를 임의로 추가
                message_copied[0][0]['text'] = `(${this.lang.text['ChatRoom']['attachments']}) ${message_copied[0][0]['text']}`;
              } else message_copied = [[{ text: `(${this.lang.text['ChatRoom']['attachments']})` }]];
            this.last_message_viewer['message'] = message_copied;
            this.last_message_viewer['color'] = c.color;
          }
        }, 100);
        // 수신된 메시지를 실시간 고도 패키지에 연결해주기
        if (this.global.godot_window && this.global.godot_window['received_msg']) {
          let regen_msg = {
            sender_id: c.sender_id,
            user_display_name: c.user_display_name,
            content: c.content,
          }
          this.global.godot_window['received_msg'](regen_msg);
        }
      }
    // 마지막 대화 기록을 받아온다
    await this.pull_msg_history();
    setTimeout(() => {
      let scrollHeight = this.ChatLogs.scrollHeight;
      this.ChatLogs.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }, 500);
  }

  /** 메시지에 인용이 포함되어있다면 인용 썸네일 생성 시도 */
  OpenQouteThumbnail(c: any) {
    let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/${c.content.qoute.path}`;
    this.indexed.checkIfFileExist(path, b => {
      if (b) this.indexed.loadBlobFromUserPath(path, '', blob => {
        let FileURL = URL.createObjectURL(blob);
        c.content.qoute['url'] = FileURL;
        setTimeout(() => {
          URL.revokeObjectURL(FileURL);
        }, 100);
      });
    });
  }

  /** 확장버튼 설정 초기화 */
  async SetExtensionButtons() {
    this.extended_buttons.forEach(button => {
      button.isHide = false;
    });
    switch (this.info['redirect']['type']) {
      case 2: // 1:1 대화라면
        if (this.info['status'] != 'missing') {
          if (!this.info['redirect']) // 채널 최초 생성 오류 방지용
            this.info['status'] = this.info['info']['online'] ? 'online' : 'pending';
          else if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online')
            this.info['status'] = this.nakama.load_other_user(this.info['redirect']['id'], this.isOfficial, this.target)['online'] ? 'online' : 'pending';
          this.extended_buttons[0].isHide = true;
          this.extended_buttons[1].isHide = true;
          this.extended_buttons[9].isHide = false;
          this.extended_buttons[12].isHide = true;
        }
        break;
      case 3: // 그룹 대화라면
        if (this.info['status'] != 'missing')
          await this.nakama.load_groups(this.isOfficial, this.target, this.info['group_id']);
        this.extended_buttons[1].isHide = true;
        this.extended_buttons[11].isHide = true;
        delete this.extended_buttons[0].isHide;
        this.extended_buttons[9].isHide = true;
        this.extended_buttons[12].isHide = true;
        break;
      case 0: // 로컬 채널형 기록
        this.extended_buttons[0].isHide = true;
        this.extended_buttons[9].isHide = true;
        this.extended_buttons[11].isHide = true;
        break;
    }
    // 오프라인 상태라면 메뉴를 간소화한다
    if (this.info['status'] === undefined || this.info['status'] == 'missing') {
      this.extended_buttons.forEach(button => {
        button.isHide = true;
      });
      this.extended_buttons[12].isHide = false;
      if (this.info['redirect']['type'] == 3)
        this.extended_buttons[0].isHide = false;
    } else this.extended_buttons[10].isHide = isNativefier || this.info['status'] == 'missing';
    this.extended_buttons[2].isHide = false;
  }

  /** 선택한 메시지 복사 */
  async CopyMessageText(msg: any) {
    let text: any = this.deserialize_text(msg);
    let isImageTarget = false;
    if (!text) { // 텍스트가 없다면 첨부파일을 대상으로 하기
      // 링크가 있다면 링크를 복사
      if (msg.content.url) {
        text = msg.content.url;
        isImageTarget = Boolean(text);
      } else { // 링크가 아니라면 파일 복사
        try {
          let path = msg.content.path;
          let blob = await this.indexed.loadBlobFromUserPath(path, msg.content.type);
          text = blob;
          isImageTarget = true;
        } catch (e) { }
      }
    }
    try { // 개체 복사하기 시도
      if (!isImageTarget) throw '텍스트 복사로 즉시 이동';
      let data = {};
      data[msg.content.type] = text;
      await navigator.clipboard.write([
        new ClipboardItem(data)
      ]);
      if (isPlatform == 'DesktopPWA')
        this.p5toast.show({
          text: `${this.lang.text['GlobalAct']['PCCopyImage']}: ${msg.content.filename}`,
        });
    } catch (e) { // 개체가 아니라면 텍스트 복사하기 시도
      try {
        await this.mClipboard.copy(text);
      } catch (e) {
        try {
          await clipboard.write(text);
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${text}`,
            });
        } catch (e) {
          console.log('클립보드 복사 실패: ', e);
        }
      }
    }
  }

  init_last_message_viewer() {
    delete this.last_message_viewer['user_id'];
    delete this.last_message_viewer['message'];
    delete this.last_message_viewer['color'];
    delete this.last_message_viewer['is_me'];
  }

  /** 충분히 스크롤 되어있어서 최하단으로 내려도 됨 */
  NeedScrollDown(): boolean {
    return this.ChatLogs.scrollHeight < this.ChatLogs.scrollTop + this.ChatLogs.clientHeight + 200;
  }

  /** 가장 최근 메시지 보기 */
  scroll_down_logs() {
    if (!this.ShowRecentMsg)
      this.init_last_message_viewer();
    this.ChatLogs.scrollTo({ top: this.ChatLogs.scrollHeight, behavior: 'smooth' });
  }

  /** 내가 보낸 메시지인지 검토하는 과정  
   * 내 메시지 한정 썸네일을 생성하거나 열람 함수를 생성
   */
  check_if_send_msg(msg: any) {
    for (let i = 0, j = this.sending_msg.length; i < j; i++)
      if (msg.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id
        && msg.content['local_comp'] == this.sending_msg[i].content['local_comp']) {
        if (msg.content['filename']) this.auto_open_thumbnail(msg);
        this.sending_msg.splice(i, 1);
        break;
      }
  }

  /** 내가 보낸 메시지 한정, 자동으로 썸네일을 생성 (또는 생성 함수를 만들기) */
  auto_open_thumbnail(msg: any) {
    try {
      this.temporary_open_thumbnail[msg.message_id]();
    } catch (e) {
      this.temporary_open_thumbnail[msg.message_id] = () => {
        if (msg.content.url) {
          this.global.modulate_thumbnail(msg.content, '', this.cont);
        } else {
          this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`,
            msg.content['type'],
            v => {
              msg.content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
              let url = URL.createObjectURL(v);
              this.global.modulate_thumbnail(msg.content, url, this.cont);
              if (this.NeedScrollDown())
                setTimeout(() => {
                  this.scroll_down_logs();
                }, 100);
              // 서버에 파일을 업로드
              this.nakama.WriteStorage_From_channel(msg, msg.content['path'], this.isOfficial, this.target);
            });
          delete this.temporary_open_thumbnail[msg.message_id];
        }
      }
    }
  }

  /** 첨부파일 삭제 */
  removeAttach() {
    delete this.userInput.file;
    this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
  }

  /** 사용자 입력 */
  userInput = {
    file: undefined as FileInfo,
    text: '',
    qoute: undefined as QouteMessage,
  }
  inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];

  pullable = true;
  ViewableMessage = [];
  ViewMsgIndex = 0;
  /** 새로고침되는 메시지 수 */
  RefreshCount = 15;
  /** 한번에 보여지는 최대 메시지 수 */
  ViewCount = 45;
  /** 더 최근 메시지 가져오기 버튼 보이기 여부 (아래로 스크롤 검토) */
  ShowRecentMsg = false;
  /** 서버로부터 메시지 더 받아오기
   * @param isHistory 옛날 정보 불러오기 유무, false면 최신정보 불러오기 진행
   */
  async pull_msg_history(isHistory = true) {
    if (!this.pullable && isHistory) return;
    this.pullable = false;
    if (isHistory) {
      try {
        if (this.info['local']) throw 'Local channel';
        if (this.info['status'] === undefined || this.info['status'] == 'missing') throw 'Channel missing';
        if (this.ViewMsgIndex != 0) { // 위에 더 볼 수 있는 메시지가 있음 (이미 받은 것으로)
          let ShowMeAgainCount = Math.min(this.ViewMsgIndex, this.RefreshCount)
          this.ViewMsgIndex -= ShowMeAgainCount;
          this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
          for (let i = 0; i < ShowMeAgainCount; i++) {
            let FileURL: any;
            try {
              this.ViewableMessage[i].content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${this.ViewableMessage[i].message_id}.${this.ViewableMessage[i].content['file_ext']}`;
              let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
              FileURL = URL.createObjectURL(blob);
            } catch (e) { }
            this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL, this.cont);
            this.modulate_chatmsg(i, ShowMeAgainCount + 1);
            if (this.ViewableMessage[i].content.qoute && this.ViewableMessage[i].content.qoute.path) this.OpenQouteThumbnail(this.ViewableMessage[i]);
          }
          this.modulate_chatmsg(0, this.ViewableMessage.length);
          this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
          this.pullable = true;
          return;
        }
        let v = await this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.info['id'], this.RefreshCount, false, this.next_cursor);
        this.info['is_new'] = false;
        v.messages.forEach(msg => {
          msg = this.nakama.modulation_channel_message(msg, this.isOfficial, this.target);
          this.nakama.check_sender_and_show_name(msg, this.isOfficial, this.target);
          if (!this.info['last_comment']) {
            let hasFile = msg.content['filename'] ? `(${this.lang.text['ChatRoom']['attachments']}) ` : '';
            if (msg['code'] != 2) this.info['last_comment'] = hasFile + (msg['content']['msg'] || msg['content']['noti'] || '');
          }
          // 마지막으로 읽은 메시지인지 검토
          if (!this.foundLastRead && this.info['last_read_id']) {
            if (this.info['last_read_id'] == msg.message_id) {
              msg['isLastRead'] = true;
              this.foundLastRead = true;
              this.info['last_read_id'] = this.info['last_comment_id'];
              this.nakama.save_channels_with_less_info();
            }
          } else this.foundLastRead = true;
          this.nakama.translate_updates(msg);
          if (msg.content['filename']) this.ModulateFileEmbedMessage(msg);
          this.nakama.CatchQouteMsgUserName(msg, this.isOfficial, this.target);
          this.nakama.ModulateTimeDate(msg);
          this.nakama.content_to_hyperlink(msg);
          if (msg.code != 2) this.messages.unshift(msg);
        });
        this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
        for (let i = 0, j = this.ViewableMessage.length; i < j; i++) {
          let FileURL: any;
          try {
            if (!this.ViewableMessage[i].content['file_ext']) throw '파일이 없는 메시지';
            if (this.ViewableMessage[i].content['url']) throw '링크된 파일';
            this.ViewableMessage[i].content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${this.ViewableMessage[i].message_id}.${this.ViewableMessage[i].content['file_ext']}`;
            this.indexed.checkIfFileExist(this.ViewableMessage[i].content['path'], b => {
              if (b) this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext, (blob) => {
                FileURL = URL.createObjectURL(blob);
                this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL, this.cont);
              });
            })
          } catch (e) {
            this.global.modulate_thumbnail(this.ViewableMessage[i].content, '');
          }
          this.modulate_chatmsg(i, j + 1);
          if (this.ViewableMessage[i].content.qoute && this.ViewableMessage[i].content.qoute.path) this.OpenQouteThumbnail(this.ViewableMessage[i]);
        }
        this.modulate_chatmsg(0, this.ViewableMessage.length);
        this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
        this.next_cursor = v.next_cursor;
        this.prev_cursor = v.prev_cursor;
        this.pullable = true;
        this.nakama.saveListedMessage(this.messages, this.info, this.isOfficial, this.target);
      } catch (e) {
        await this.LoadLocalChatHistory();
      }
      setTimeout(() => { // 스크롤이 생기지 않았다면 메시지 더 가져오기
        if (this.next_cursor !== undefined)
          if (this.ChatContDiv && this.ChatContDiv.clientHeight < this.ChatLogs.clientHeight)
            this.pull_msg_history();
      }, 0);
    } else { // 최근 메시지를 보려고 함
      let subtract = this.messages.length - this.ViewMsgIndex - this.ViewCount;
      this.ShowRecentMsg = !(subtract == 0);
      this.ViewMsgIndex += Math.min(this.RefreshCount, subtract);
      this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
      for (let i = this.ViewableMessage.length - 1; i >= 0; i--) {
        let FileURL: any;
        try {
          this.ViewableMessage[i].content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${this.ViewableMessage[i].message_id}.${this.ViewableMessage[i].content['file_ext']}`;
          let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
          FileURL = URL.createObjectURL(blob);
        } catch (e) { }
        this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL, this.cont);
        this.modulate_chatmsg(i, this.ViewableMessage.length);
        if (this.ViewableMessage[i].content.qoute && this.ViewableMessage[i].content.qoute.path) this.OpenQouteThumbnail(this.ViewableMessage[i]);
      }
      this.pullable = true;
    }
  }

  useSpeaker = false;
  /** 마지막에 받은 메시지 읽기 */
  SpeechReceivedMessage(msg: any) {
    try {
      if (msg.code != 0) throw '일반 수신 메시지가 아님';
      let getMessage = JSON.parse(JSON.stringify(msg.content.msg));
      let read_this = '';
      for (let i = 0, j = getMessage.length; i < j; i++)
        for (let k = 0, l = getMessage[i].length; k < l; k++)
          read_this += getMessage[i][k]['text'] + ' ';
      if (read_this && read_this.trim()) this.SpeechThese.push(read_this);
      if (!this.isSpeeching) this.SpeechingTexts();
    } catch (e) { }
  }

  isSpeeching = false;
  SpeechThese: string[] = [];
  async SpeechingTexts() {
    let read_this = this.SpeechThese.shift();
    this.isSpeeching = true;
    if (read_this && read_this.trim())
      await TextToSpeech.speak({
        text: read_this,
        lang: this.lang.lang,
      });
    if (this.SpeechThese.length)
      this.SpeechingTexts();
    else this.isSpeeching = false;
  }

  /** 로컬 기록으로 불러와지는 경우 */
  isHistoryLoaded = false;
  LocalHistoryList = [];
  /** 내부 저장소 채팅 기록 열람 */
  async LoadLocalChatHistory() {
    if (this.ViewMsgIndex > 0) { // 위에 더 볼 수 있는 메시지가 있음 (열람된 파일에서)
      let ShowMeAgainCount = Math.min(this.ViewableMessage.length, Math.min(this.ViewMsgIndex, this.RefreshCount));
      this.ViewMsgIndex -= ShowMeAgainCount;
      this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
      for (let i = ShowMeAgainCount - 1; i >= 0; i--) {
        let FileURL: any;
        try {
          this.ViewableMessage[i].content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${this.ViewableMessage[i].message_id}.${this.ViewableMessage[i].content['file_ext']}`;
          let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
          FileURL = URL.createObjectURL(blob);
        } catch (e) { }
        this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL, this.cont);
        this.modulate_chatmsg(i, ShowMeAgainCount + 1);
        if (this.ViewableMessage[i].content.qoute && this.ViewableMessage[i].content.qoute.path) this.OpenQouteThumbnail(this.ViewableMessage[i]);
      }
      this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
      this.pullable = this.ViewMsgIndex != 0 || Boolean(this.LocalHistoryList.length);
      if (this.pullable && this.ViewableMessage.length && this.ViewableMessage.length < this.RefreshCount)
        await this.LoadLocalChatHistory();
      return;
    }
    if (!this.isHistoryLoaded) { // 기록 리스트 잡아두기
      let list = await this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/chats/`);
      this.LocalHistoryList = list;
      // 채팅파일이 아닌 경로(폴더)를 제외
      for (let i = list.length - 1; i >= 0; i--) {
        let sep = list[i].split('/');
        if (sep[sep.length - 4] != 'chats')
          list.splice(i, 1);
      }
      this.isHistoryLoaded = true;
      if (this.LocalHistoryList.length)
        this.LoadLocalChatHistory();
      else return;
    } else { // 다음 파일에서 읽기
      try {
        let target_path = this.LocalHistoryList.pop();
        if (!target_path) throw '기록 없음';
        let v = await this.indexed.loadTextFromUserPath(target_path);
        if (v) {
          let json: any[] = JSON.parse(v.trim());
          let ExactAddedChatCount = 0;
          for (let i = json.length - 1; i >= 0; i--) {
            this.nakama.translate_updates(json[i]);
            json[i] = this.nakama.modulation_channel_message(json[i], this.isOfficial, this.target);
            this.nakama.CatchQouteMsgUserName(json[i], this.isOfficial, this.target);
            this.nakama.ModulateTimeDate(json[i]);
            json[i].content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${json[i].message_id}.${json[i].content['file_ext']}`;
            if (json[i]['code'] != 2) {
              ExactAddedChatCount++;
              this.messages.unshift(json[i]);
            }
          }
          this.ViewMsgIndex = Math.max(0, ExactAddedChatCount - this.RefreshCount);
          this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
          let ShowMeAgainCount = Math.min(Math.min(ExactAddedChatCount, this.RefreshCount), this.ViewableMessage.length);
          for (let i = ShowMeAgainCount - 1; i >= 0; i--) {
            let FileURL: any;
            try {
              let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
              FileURL = URL.createObjectURL(blob);
            } catch (e) { }
            this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL, this.cont);
            this.modulate_chatmsg(i, ShowMeAgainCount);
            if (this.ViewableMessage[i].content.qoute && this.ViewableMessage[i].content.qoute.path) this.OpenQouteThumbnail(this.ViewableMessage[i]);
          }
          this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
        } else await this.LoadLocalChatHistory();
      } catch (e) { }
      this.pullable = this.ViewMsgIndex != 0 || Boolean(this.LocalHistoryList.length);
      if (this.pullable && this.ViewableMessage.length < this.RefreshCount)
        this.LoadLocalChatHistory();
    }
  }

  /** 마우스 클릭 시작점 */
  MsgClickedStartPos: number;
  TargetMessageObject: HTMLElement;
  IsQouteMyMessage: boolean;

  /** 메시지를 누를 때 */
  ChatBalloonMouseDown(ev: any, msg: any) {
    if (ev.which == 2) { // 가운데 버튼이면 즉시 인용처리
      this.IsQouteMyMessage = msg.is_me;
      this.MsgClickedStartPos = ev.clientX;
      this.TargetMessageObject = document.getElementById(msg.message_id);
      this.MsgClickedStartPos = ev.clientX + 90;
      this.p5canvas['ChatMsgDragAct'](ev.clientX);
    }
  }

  /** 메시지를 터치할 때 */
  ChatBalloonOnTouchStart(ev: any, msg: any) {
    try {
      this.IsQouteMyMessage = msg.is_me;
      this.MsgClickedStartPos = ev.touches[0].clientX;
      this.TargetMessageObject = document.getElementById(msg.message_id);
    } catch (e) { }
  }

  /** 말풍선 우클릭 행동 */
  ChatBalloonContextMenu(msg: any) {
    try {
      let catch_index: number;
      for (let i = 0, j = this.ViewableMessage.length; i < j; i++)
        if (msg.message_id == this.ViewableMessage[i].message_id) {
          catch_index = i;
          break;
        }
      if (catch_index === undefined) throw '메시지를 찾을 수 없음';
      if (isPlatform == 'DesktopPWA')
        this.CopyMessageText(this.ViewableMessage[catch_index]);
      this.message_detail(msg, catch_index);
    } catch (e) {
      console.log('메시지 상세보기 실패: ', e);
    }
    return false;
  }

  /** 추가 매뉴 숨김여부 */
  isHidden = true;

  /** 핸드폰 가상키보드의 움직임을 고려하여 눈이 덜 불편하도록 지연 */
  open_ext_with_delay() {
    this.ScrollNearLogs();
    this.isHidden = !this.isHidden;
  }

  /** 확장 메뉴 숨기기 */
  make_ext_hidden() {
    this.ScrollNearLogs();
    if (isPlatform != 'DesktopPWA')
      this.isHidden = true;
  }

  /** 최근 메시지에 가까이 있다면 스크롤 내리기 */
  ScrollNearLogs() {
    if (this.NeedScrollDown()) {
      this.ChatLogs.scrollTo({ top: this.ChatLogs.scrollHeight, behavior: 'smooth' });
      setTimeout(() => {
        this.ChatLogs.scrollTo({ top: this.ChatLogs.scrollHeight, behavior: 'smooth' });
      }, 150);
    }
  }

  /** 플랫폼별 높이 관리를 위한 함수 분리, 사용자 입력칸 높이 조정 함수 */
  ResizeTextArea() {
    if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
    this.userInputTextArea.style.height = '36px';
  }

  userInputTextArea: HTMLElement;
  ChannelUserInputId = 'ChannelUserInputId';
  check_key(ev: any) {
    if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
    if (isPlatform == 'DesktopPWA') {
      if (ev.key == 'Enter' && !ev.shiftKey && ev.type == 'keydown') {
        this.send(true);
      } else {
        setTimeout(() => {
          this.ResizeTextArea();
          this.userInputTextArea.style.height = this.userInputTextArea.scrollHeight + 'px';
        }, 0);
      }
    } else {
      setTimeout(() => {
        this.ResizeTextArea();
        this.userInputTextArea.style.height = this.userInputTextArea.scrollHeight + 'px';
      }, 0);
    }
  }

  block_send = false;
  async send(with_key = false) {
    if (with_key && (isPlatform == 'Android' || isPlatform == 'iOS')) return;
    if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
    if (!this.userInput.text.trim() && !this.userInput['file']) {
      setTimeout(() => {
        this.userInput.text = '';
        this.ResizeTextArea();
      }, 0);
      return;
    }
    if (this.block_send) return;
    this.block_send = true;
    // 입력칸 높이를 일시적으로 고정시킴
    this.userInputTextArea.style.maxHeight = `${this.userInputTextArea.offsetHeight}px`;
    setTimeout(() => { // iOS 보정용
      this.make_ext_hidden();
      this.userInputTextArea.focus();
    }, 0);
    this.isHidden = true;
    let result: FileInfo = {};
    result['msg'] = this.userInput.text;
    let FileAttach = false;
    let isURL = false;
    let isLongText = '';
    if (this.userInput.qoute) { // 메시지 인용시
      delete this.userInput.qoute.url;
      result['qoute'] = this.userInput.qoute;
    }
    if (this.userInput.file) { // 파일 첨부시
      result['filename'] = this.userInput.file.filename;
      result['file_ext'] = this.userInput.file.file_ext;
      result['type'] = this.userInput.file.type;
      try {
        result['filesize'] = this.userInput.file.size || this.userInput.file.blob.size;
        result['partsize'] = Math.ceil(result['filesize'] / FILE_BINARY_LIMIT);
      } catch (e) {
        result['url'] = this.userInput.file.url;
        isURL = true;
      }
      if (result['msg'].length > 600) { // 메시지가 충분히 깁니다
        isLongText = result['msg'];
        delete result['msg'];
      } else result['msg'] = result['msg'];
      result['content_creator'] = this.userInput.file.content_creator;
      result['content_related_creator'] = this.userInput.file.content_related_creator;
      if (!isURL && !this.info['local'] && this.useFirstCustomCDN != 2) try { // 서버에 연결된 경우 cdn 서버 업데이트 시도
        let address = this.nakama.servers[this.isOfficial][this.target].info.address;
        let protocol = this.nakama.servers[this.isOfficial][this.target].info.useSSL ? 'https:' : 'http:';
        let targetname = `${this.info['group_id'] ||
          (this.info['user_id_one'] == this.nakama.servers[this.isOfficial][this.target].session.user_id ? this.info['user_id_two'] : this.info['user_id_one'])
          }_${this.nakama.servers[this.isOfficial][this.target].session.user_id}`;
        let savedAddress = await this.global.upload_file_to_storage(this.userInput.file,
          targetname, protocol, address, this.useFirstCustomCDN == 1);
        isURL = Boolean(savedAddress);
        if (!isURL) throw '링크 만들기 실패';
        delete result['partsize']; // 메시지 삭제 등의 업무 효율을 위해 정보 삭제
        result['url'] = savedAddress;
      } catch (e) {
        console.log('cdn 업로드 처리 실패: ', e);
      }
      FileAttach = true;
      for (let i = 0, j = result['content_related_creator'].length; i < j; i++) {
        delete result['content_related_creator'][i]['is_me'];
        delete result['content_related_creator'][i]['timeDisplay'];
        delete result['content_related_creator'][i]['various_display'];
      }
    } else { // 파일은 없지만 메시지가 충분히 깁니다
      if (result['msg'].length > 600) {
        this.LongTextMessageAsFile(result);
        return;
      }
    }
    result['local_comp'] = Math.random();
    let tmp = { content: JSON.parse(JSON.stringify(result)) };
    this.nakama.content_to_hyperlink(tmp);
    if (this.info['local']) { // 로컬 채널 전용 행동 (셀프 보내기)
      /** 업로드가 진행중인 메시지 개체 */
      let local_msg_id = new Date().getTime().toString();
      if (FileAttach && !isURL) { // 첨부 파일이 포함된 경우, 링크는 아닌 경우
        try {
          let CatchedAddress: string;
          if (this.useFirstCustomCDN == 1)
            CatchedAddress = await this.global.try_upload_to_user_custom_fs(this.userInput.file, `${this.info.id}_${this.nakama.users.self['display_name']}`);
          if (CatchedAddress) {
            delete tmp.content['path'];
            delete tmp.content['partsize'];
            tmp.content['url'] = CatchedAddress;
          } else throw '업로드 실패';
        } catch (e) { // 사설 서버 업로드 실패시 직접 저장
          let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${local_msg_id}.${this.userInput.file.file_ext}`;
          await this.indexed.saveBlobToUserPath(this.userInput.file.blob, path);
        }
      }
      delete this.userInput.file;
      delete this.userInput.qoute;
      if (isLongText) {
        tmp['msg'] = isLongText;
        this.LongTextMessageAsFile(tmp);
      }
      let getNow = new Date().toISOString();
      let msg = {
        channel_id: this.info.id,
        code: 0,
        color: '888888',
        ...tmp,
        create_time: getNow,
        update_time: getNow,
        sender_id: 'local',
        message_id: local_msg_id,
        user_display_name: this.nakama.users.self['display_name'],
        is_me: true,
      };
      this.SendLocalMessage(msg);
      this.userInputTextArea.style.maxHeight = null;
      this.block_send = false;
      return;
    } // 아래, 온라인 행동
    this.sending_msg.push(tmp);
    if (this.NeedScrollDown())
      setTimeout(() => {
        this.scroll_down_logs();
      }, 100);
    try {
      setTimeout(() => {
        this.userInput.text = '';
        this.ResizeTextArea();
      }, 0);
      let v = await this.nakama.servers[this.isOfficial][this.target].socket
        .writeChatMessage(this.info['id'], result);
      /** 업로드가 진행중인 메시지 개체 */
      if (FileAttach) { // 첨부 파일이 포함된 경우, 링크는 아닌 경우
        if (isURL) {
          this.auto_open_thumbnail({
            content: result,
            message_id: v.message_id,
          });
        } else {
          // 로컬에 파일을 저장
          let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${v.message_id}.${this.userInput.file.file_ext}`;
          this.indexed.saveBlobToUserPath(this.userInput.file.blob, path, () => {
            this.auto_open_thumbnail({
              content: result,
              message_id: v.message_id,
            });
          });
        }
      }
      delete this.userInput.file;
      delete this.userInput.qoute;
      this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
      if (isLongText) {
        result['msg'] = isLongText;
        this.LongTextMessageAsFile(result);
      }
    } catch (e) {
      switch (e.code) {
        case 3: // 채널 연결 실패 (삭제된 경우)
          this.p5toast.show({
            text: this.lang.text['ChatRoom']['FailedToJoinChannel'],
          });
          break;
        default: // 검토 필요 오류
          console.log('오류 검토 필요: ', e);
          this.p5toast.show({
            text: `${this.lang.text['ChatRoom']['FailedToSend']}: ${typeof e == 'string' ? e : e.message}`,
          });
          break;
      }
      setTimeout(() => {
        this.userInput.text = '';
        this.ResizeTextArea();
      }, 0);
      setTimeout(() => {
        for (let i = this.sending_msg.length - 1; i >= 0; i--) {
          if (this.sending_msg[i]['content']['local_comp'] == result['local_comp'])
            this.sending_msg.splice(i, 1);
        }
      }, 1500);
    }
    this.userInputTextArea.style.maxHeight = null;
    this.block_send = false;
  }

  /** 하이퍼링크 열기 행동 후 포커스 빼기 */
  async open_url_link(url: string) {
    // 근데 주소가 메인 주소라면 QR행동으로 처리하기
    if (url.indexOf('https://is2you2.github.io/devtalk_pwa/?') == 0) {
      let init = this.global.CatchGETs(url) || {};
      this.global.initialize();
      try {
        await this.nakama.AddressToQRCodeAct(init);
      } catch (e) {
        this.p5toast.show({
          text: `${this.lang.text['ChatRoom']['QRLinkFailed']}: ${e}`,
        });
      }
    } else window.open(url, '_system');
    this.make_ext_hidden();
    this.userInputTextArea.focus();
    this.SetOtherAct();
  }

  /** 원격 발송 없이 로컬에 저장하기 */
  SendLocalMessage(msg: any) {
    let MsgText = this.deserialize_text(msg);
    this.nakama.CatchQouteMsgUserName(msg, this.isOfficial, this.target);
    this.nakama.ModulateTimeDate(msg);
    this.nakama.channels_orig[this.isOfficial][this.target][msg.channel_id]['last_comment_time'] = msg.update_time;
    this.nakama.channels_orig[this.isOfficial][this.target][this.info.id]['last_comment_id'] = msg.message_id;
    this.nakama.rearrange_channels();
    this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'](msg);
    this.nakama.saveListedMessage([msg], this.info, this.isOfficial, this.target);
    let hasFile = msg.content['filename'] ? `(${this.lang.text['ChatRoom']['attachments']}) ` : '';
    if (msg.code != 2) this.nakama.channels_orig[this.isOfficial][this.target][this.info.id]['last_comment'] = hasFile +
      (MsgText || msg.content['noti'] || (msg.content['match'] ? this.lang.text['ChatRoom']['JoinWebRTCMatch'] : undefined) || '');
    setTimeout(() => {
      this.userInput.text = '';
      if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
      this.ResizeTextArea();
      this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
      if (this.NeedScrollDown())
        this.scroll_down_logs();
    }, 0);
  }

  /** 바로 전달하기 어려운 긴 글은 파일화 시켜서 보내기 */
  async LongTextMessageAsFile(result: any) {
    let blob = new Blob([result['msg']]);
    await this.indexed.saveBlobToUserPath(blob, `tmp_files/chatroom/${this.lang.text['ChatRoom']['LongText']}_${result['msg'].substring(0, 10)}.txt`);
    let this_file: FileInfo = {};
    this_file.blob = blob;
    this_file['content_related_creator'] = [{
      user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().getTime(),
      display_name: this.nakama.users.self['display_name'],
      various: 'long_text',
    }];
    this_file['content_creator'] = {
      user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().getTime(),
      display_name: this.nakama.users.self['display_name'],
      various: 'long_text',
    };
    let file_name_header_part = result['msg'].substring(0, 24);
    this_file.path = `tmp_files/chatroom/${this.lang.text['ChatRoom']['LongText']}_${file_name_header_part}~.txt`;
    this_file.file_ext = 'txt';
    this_file.filename = `[${this.lang.text['ChatRoom']['LongText']}] ${file_name_header_part}~.txt`;
    this.global.set_viewer_category_from_ext(this_file);
    this_file.type = 'text/plain';
    this_file.typeheader = 'text';
    delete result['msg'];
    delete this.userInput.file;
    delete this.userInput.qoute;
    this.userInput.text = '';
    this.ResizeTextArea();
    this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
    this.userInput.file = this_file;
    this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
    this.create_selected_thumbnail();
    this.p5toast.show({
      text: this.lang.text['ChatRoom']['CreateAsTextFile'],
    });
    this.block_send = false;
  }

  isOtherAct = false;
  /** 다른 행동을 하는 경우 메시지 상세 행동을 하지 않음 */
  SetOtherAct() {
    this.isOtherAct = true;
    setTimeout(() => {
      this.isOtherAct = false;
    }, 0);
  }

  /** 메시지 정보 상세 */
  async message_detail(msg: any, index: number) {
    if (this.isOtherAct) return; // 다른 행동과 중첩 방지
    if (this.info['status'] == 'offline' || this.info['status'] == 'missing') return;
    if (msg.content['user_update']) return; // 시스템 메시지 관리 불가
    if (msg.content['gupdate']) return; // 시스템 메시지 관리 불가 (그룹)
    if (!msg['is_me']) return;
    let orig_msg = this.deserialize_text(msg);
    let MsgText = orig_msg;
    let FileURL = msg.content['url'];
    if (msg.content['viewer']) {
      try { // 파일 불러오기 실패시 그저 망치기
        if (msg.content['viewer'] != 'image') throw '이미지 파일이 아님';
        let blob = await this.indexed.loadBlobFromUserPath(msg.content['path'], msg.content['type']);
        FileURL = URL.createObjectURL(blob);
      } catch (e) {
        try { // 대안 썸네일 불러오기 (영상 등 이미지가 아닌 파일의 썸네일)
          let blob = await this.indexed.loadBlobFromUserPath(`${msg.content['path']}_thumbnail.png`, msg.content['type']);
          FileURL = URL.createObjectURL(blob);
        } catch (e) { }
      }
      MsgText = `(${this.lang.text['ChatRoom']['attachments']}) ${MsgText}`
    }
    let text_form = FileURL ? `<div style="text-align: center;">${MsgText}</div>` : `<div>${MsgText}</div>`;
    let image_form = `<div style="width: 100%;"><img src="${FileURL}" alt="${msg.content['filename']}" style="border-radius: 8px; max-height: 230px; position: relative; left: 50%; transform: translateX(-50%); ${this.info['HideAutoThumbnail'] ? 'filter: blur(6px);' : ''}"></div>`;
    let result_form = FileURL ? image_form + text_form : text_form;
    this.alertCtrl.create({
      header: this.lang.text['ChatRoom']['ManageChat'],
      message: new IonicSafeString(result_form),
      buttons: [{
        text: this.lang.text['ChatRoom']['EditChat'],
        handler: () => {
          this.alertCtrl.create({
            header: this.lang.text['ChatRoom']['EditChat'],
            inputs: [{
              type: 'textarea',
              value: orig_msg,
              placeholder: MsgText,
            }],
            buttons: [{
              text: this.lang.text['ChatRoom']['EditChat'],
              handler: async (ev) => {
                let edited = ev[0] || (msg.content['path'] ? '' : MsgText);
                let edit_well = false;
                let working_msg = JSON.parse(JSON.stringify(msg));
                working_msg.content['msg'] = edited;
                working_msg.content['edited'] = true;
                if (msg.content['thumbnail'])
                  working_msg.content['thumbnail'] = msg.content['thumbnail'];
                working_msg['update_time'] = new Date().toISOString();
                if (!this.info['local']) { // 서버와 연결된 경우
                  try {
                    await this.nakama.servers[this.isOfficial][this.target].socket.updateChatMessage(this.info['id'], msg.message_id, working_msg.content);
                    edit_well = true;
                  } catch (e) {
                    console.log('메시지 편집 요청 오류: ', e);
                  }
                } else edit_well = true;
                if (!edit_well) return;
                working_msg['code'] = 1;
                if (this.info['local']) {
                  this.nakama.content_to_hyperlink(working_msg);
                  working_msg['update_time'] = Date.now();
                  this.SendLocalMessage(working_msg);
                }
              }
            }],
          }).then(v => {
            v.onWillDismiss().then(() => {
              this.ionViewDidEnter();
            });
            this.removeShortCutKey();
            this.global.p5key['KeyShortCut']['Escape'] = () => {
              v.dismiss();
            }
            v.present();
          });
        }
      }, {
        text: this.lang.text['UserFsDir']['Delete'],
        cssClass: 'redfont',
        handler: async () => {
          if (!this.info['local']) { // 서버와 연결된 채널인 경우
            try {
              await this.nakama.servers[this.isOfficial][this.target].socket.removeChatMessage(this.info['id'], msg.message_id);
              if (FileURL) { // 첨부파일이 포함되어 있는 경우
                if (msg.content.url) { // 링크된 파일인 경우
                  this.global.remove_file_from_storage(msg.content.url);
                } else { // 파트 업로드 파일인 경우
                  let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['DeleteFile'] });
                  loading.present();
                  for (let i = 0; i < msg.content['partsize']; i++) {
                    try { // 파일이 없어도 순회 작업 진행
                      await this.nakama.servers[this.isOfficial][this.target].client.deleteStorageObjects(
                        this.nakama.servers[this.isOfficial][this.target].session, {
                        object_ids: [{
                          collection: `file_${msg.channel_id.replace(/[.]/g, '_')}`,
                          key: `msg_${msg.message_id}_${i}`,
                        }],
                      });
                    } catch (e) { }
                    loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${msg.content['filename']}_${msg.content['partsize'] - i}`;
                  } // 서버에서 삭제되지 않았을 경우 파일을 남겨두기
                  let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
                  await this.indexed.removeFileFromUserPath(path);
                  await this.indexed.removeFileFromUserPath(`${path}_thumbnail.png`);
                  loading.dismiss();
                }
              }
            } catch (e) {
              console.error('채널 메시지 삭제 오류: ', e);
            }
          } else { // 로컬 채널인경우 첨부파일을 즉시 삭제
            if (FileURL) {
              if (msg.content.url) { // 링크된 파일인 경우
                this.global.remove_file_from_storage(msg.content.url);
              } else { // 파트 업로드 파일인 경우
                let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
                try {
                  await this.indexed.removeFileFromUserPath(path);
                } catch (e) { }
                try {
                  await this.indexed.removeFileFromUserPath(`${path}_thumbnail.png`);
                } catch (e) { }
              }
            }
          }
          this.ViewableMessage.splice(index, 1);
          for (let i = 0, j = this.messages.length; i < j; i++)
            if (this.messages[i]['message_id'] == msg['message_id']) {
              this.messages.splice(i, 1);
              break;
            }
          msg['update_time'] = Date.now();
          msg['code'] = 2;
          this.SendLocalMessage(msg);
          for (let i = this.ViewableMessage.length - 1; i >= 0; i--)
            this.modulate_chatmsg(i, this.ViewableMessage.length);
          this.p5toast.show({
            text: this.lang.text['ChatRoom']['MsgRemoved'],
          });
        }
      }]
    }).then(v => {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.global.p5key['KeyShortCut']['Escape'] = () => {
          this.navCtrl.pop();
        }
        URL.revokeObjectURL(FileURL);
        this.isOtherAct = false;
      });
      v.present();
    });
  }

  /** 메시지 평문화 */
  deserialize_text(msg: any) {
    let MsgText = '';
    if (!msg.content['msg']) return MsgText;
    for (let i = 0, j = msg.content['msg'].length; i < j; i++) {
      for (let k = 0, l = msg.content['msg'][i].length; k < l; k++)
        MsgText += msg.content['msg'][i][k].text;
      if (i + 1 < j) MsgText += '\n';
    }
    return MsgText;
  }

  /** 메시지 내 파일 정보, 파일 다운받기 */
  async file_detail(msg: any) {
    this.isOtherAct = true;
    if (msg.content['url']) {
      this.open_viewer(msg, msg.content['url']);
      setTimeout(() => {
        this.isOtherAct = false;
      }, 0);
      return;
    }
    let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
    try { // 전송 진행중인지 검토
      let has_history = await this.indexed.checkIfFileExist(`${path}.history`);
      // 파일 송수신중인건 아님
      if (!has_history) throw '썸네일 열기';
      msg.content['text'] = [this.lang.text['TodoDetail']['WIP']];
      // 아래는 부분적으로 진행된 파일이 검토될 때
      let v = await this.indexed.loadTextFromUserPath(`${path}.history`);
      let json = JSON.parse(v);
      delete msg.content['text'];
      // 이전에 중단된 전송을 이어서하기
      switch (json['type']) {
        case 'upload':
          msg.content['text'] = [this.lang.text['ChatRoom']['uploading']];
          this.nakama.WriteStorage_From_channel(msg, path, this.isOfficial, this.target, json['index']);
          // 전송 작업 중일 때는 열람으로 넘겨주기
          if (msg.content['transfer_index'] && this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]['OnTransfer'])
            throw '전송작업 중, 썸네일 열기';
          break;
        case 'download':
          msg.content['text'] = [this.lang.text['TodoDetail']['WIP']];
          await this.nakama.ReadStorage_From_channel(msg, path, this.isOfficial, this.target, json['index']);
          if (this.NeedScrollDown())
            setTimeout(() => {
              this.scroll_down_logs();
            }, 100);
          break;
      }
    } catch (e) { // 전송중이던 기록이 없음
      let isFileExist = await this.indexed.checkIfFileExist(path);
      if (isFileExist) { // 파일이 존재함
        if (!msg.content['text'])
          msg.content['text'] = [this.lang.text['ChatRoom']['downloaded']];
        this.indexed.loadBlobFromUserPath(path,
          msg.content['type'],
          v => {
            msg.content['path'] = path;
            let url = URL.createObjectURL(v);
            this.global.modulate_thumbnail(msg.content, url, this.cont);
            if (this.NeedScrollDown())
              setTimeout(() => {
                this.scroll_down_logs();
              }, 100);
          });
        this.open_viewer(msg, path);
      } else { // 다운받아야 함
        if (!this.isHistoryLoaded) { // 서버와 연결되어 있음
          msg.content['text'] = [this.lang.text['TodoDetail']['WIP']];
          await this.nakama.ReadStorage_From_channel(msg, path, this.isOfficial, this.target);
          if (this.NeedScrollDown())
            setTimeout(() => {
              this.scroll_down_logs();
            }, 400);
        } else this.p5toast.show({
          text: this.lang.text['ChatRoom']['cannot_open_file'],
        });
      }
    }
    this.isOtherAct = false;
  }

  JoinWebRTCMatch(msg: any) {
    this.SetOtherAct();
    this.nakama.JoinWebRTCMatch(msg, this.isOfficial, this.target, this.info);
  }

  /** 메시지 추가시마다 메시지 상태를 업데이트 (기존 html 연산)  
   * 메시지 자료형들(사용자 이름 보이기, 시간 보이기 등)을 메시지에 연산하는 것으로, 원래는 html에서 *ngIf 등으로 동작했었다  
   * 연산 줄이기 용도
   * @param i 현재 메시지 번호
   * @param j 메시지 전체 길이
   */
  async modulate_chatmsg(i: number, j: number) {
    if (j == 0) return; // 길이가 없을 때 오류 방지용
    // 1회성 보여주기 양식 생성 (채팅방 전용 정보)
    if (!this.ViewableMessage[i]['showInfo'])
      this.ViewableMessage[i]['showInfo'] = {};
    // 날짜 표시
    this.ViewableMessage[i]['showInfo']['date'] = Boolean(this.ViewableMessage[i]['msgDate']);
    // 발신인과 시간 표시
    this.ViewableMessage[i]['showInfo']['sender'] = !this.ViewableMessage[i].content.noti;
    // 이전 메시지와 정보를 비교하여 이전 메시지와 지금 메시지의 상태를 결정 (실시간 메시지 받기류)
    if (i - 1 >= 0) {
      this.ViewableMessage[i]['showInfo']['date'] = Boolean(this.ViewableMessage[i]['msgDate']) && (this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i - 1]['msgDate']);
      this.ViewableMessage[i]['showInfo']['sender'] = !this.ViewableMessage[i].content.noti && (this.ViewableMessage[i - 1]['isLastRead'] || this.ViewableMessage[i].sender_id != this.ViewableMessage[i - 1].sender_id || this.ViewableMessage[i - 1].content.noti || this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i - 1]['msgDate'] || this.ViewableMessage[i]['msgTime'] != this.ViewableMessage[i - 1]['msgTime']);
    }
    // url 링크 개체 즉시 불러오기
    if (this.ViewableMessage[i]['content']['url']) {
      try { // 대안 썸네일이 있다면 보여주고 끝내기
        let blob = await this.indexed.loadBlobFromUserPath(`${this.ViewableMessage[i]['content']['path']}_thumbnail.png`, 'image/png');
        let FileURL = URL.createObjectURL(blob);
        this.ViewableMessage[i]['content']['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(FileURL);
        setTimeout(() => {
          URL.revokeObjectURL(FileURL);
        }, 100);
        return;
      } catch (e) { // 대안 썸네일이 없는 경우 썸네일 생성 시도
        if (this.ViewableMessage[i]['content'].viewer == 'image' && this.ViewableMessage[i]['content']['url'])
          this.ViewableMessage[i]['content']['thumbnail'] = this.ViewableMessage[i]['content']['url'];
      }
    }
    // 다음 메시지와 정보를 비교하여 다음 메시지의 상태를 결정 (기록 불러오기류)
    try {
      if (i + 1 < j) {
        this.ViewableMessage[i + 1]['showInfo']['date'] = Boolean(this.ViewableMessage[i]['msgDate']) && (this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i + 1]['msgDate']);
        this.ViewableMessage[i + 1]['showInfo']['sender'] = !this.ViewableMessage[i + 1].content.noti && (this.ViewableMessage[i]['isLastRead'] || this.ViewableMessage[i].sender_id != this.ViewableMessage[i + 1].sender_id || this.ViewableMessage[i].content.noti || this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i + 1]['msgDate'] || this.ViewableMessage[i]['msgTime'] != this.ViewableMessage[i + 1]['msgTime']);
      }
    } catch (e) { }
  }

  /** 파일이 포함된 메시지 구조화, 자동 썸네일 작업 */
  ModulateFileEmbedMessage(msg: any) {
    if (msg.content.url) // URL 이 있다면 냅다 적용시켜보기
      this.global.modulate_thumbnail(msg.content, '', this.cont);
    let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
    msg.content['path'] = path;
    try {
      msg.content['transfer_index'] = this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id][msg.message_id];
    } catch (e) { }
    if (!msg.content['transfer_index'])
      this.indexed.checkIfFileExist(`${path}.history`, b => {
        if (b) this.indexed.loadTextFromUserPath(`${path}.history`, (e, v) => {
          if (e && v) {
            let json = JSON.parse(v);
            delete msg.content['text'];
            if (!this.nakama.OnTransfer[this.isOfficial]) this.nakama.OnTransfer[this.isOfficial] = {};
            if (!this.nakama.OnTransfer[this.isOfficial][this.target]) this.nakama.OnTransfer[this.isOfficial][this.target] = {};
            if (!this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id]) this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id] = {};
            if (!this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id][msg.message_id])
              this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id][msg.message_id] = { index: msg.content['partsize'] - json['index'] };
            msg.content['transfer_index'] = this.nakama.OnTransfer[this.isOfficial][this.target][msg.channel_id][msg.message_id];
          }
        });
      });
    this.global.set_viewer_category(msg.content);
    this.indexed.checkIfFileExist(path, async (b) => {
      if (b) {
        msg.content['text'] = [this.lang.text['ChatRoom']['downloaded']];
        this.indexed.loadBlobFromUserPath(path,
          msg.content['type'],
          v => {
            msg.content['path'] = path;
            let url = URL.createObjectURL(v);
            this.global.modulate_thumbnail(msg.content, url, this.cont);
            if (this.NeedScrollDown())
              setTimeout(() => {
                this.scroll_down_logs();
              }, 100);
          });
      } else { // 대안 썸네일 생성
        try {
          let blob = await this.indexed.loadBlobFromUserPath(`${msg.content['path']}_thumbnail.png`, 'image/png');
          let FileURL = URL.createObjectURL(blob);
          this.global.modulate_thumbnail(msg.content, FileURL, this.cont);
        } catch (e) { }
      }
    });
  }

  /** 썸네일 이미지 표시 토글 */
  async toggle_thumbnail() {
    this.info['HideAutoThumbnail'] = !this.info['HideAutoThumbnail'];
    this.nakama.save_channels_with_less_info();
  }

  lock_modal_open = false;
  open_viewer(msg: any, _path: string) {
    let attaches = [];
    for (let i = 0, j = this.messages.length; i < j; i++)
      if (this.messages[i].content.filename)
        attaches.push(this.messages[i]);
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      this.removeShortCutKey();
      this.modalCtrl.create({
        component: IonicViewerPage,
        componentProps: {
          info: msg,
          path: _path,
          alt_path: _path,
          isOfficial: this.isOfficial,
          target: this.target,
          relevance: attaches,
          local: this.info['local'],
        },
        cssClass: 'fullscreen',
      }).then(v => {
        v.onDidDismiss().then((v) => {
          this.lock_modal_open = false;
          this.ionViewDidEnter();
          if (v.data) { // 파일 편집하기를 누른 경우
            switch (v.data.type) {
              case 'image':
                let related_creators: ContentCreatorInfo[] = [];
                if (v.data.msg.content['content_related_creator'])
                  related_creators = [...v.data.msg.content['content_related_creator']];
                if (v.data.msg.content['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
                  let is_already_exist = false;
                  for (let i = 0, j = related_creators.length; i < j; i++)
                    if (related_creators[i].user_id == v.data.msg.content['content_creator']['user_id']) {
                      is_already_exist = true;
                      break;
                    }
                  if (!is_already_exist) related_creators.push(v.data.msg.content['content_creator']);
                }
                this.modalCtrl.create({
                  component: VoidDrawPage,
                  componentProps: {
                    path: v.data.path || _path,
                    width: v.data.width,
                    height: v.data.height,
                    isDarkMode: v.data.isDarkMode,
                    scrollHeight: v.data.scrollHeight,
                  },
                  cssClass: 'fullscreen',
                }).then(v => {
                  v.onDidDismiss().then(() => {
                    this.ionViewDidEnter();
                  });
                  v.onWillDismiss().then(async v => {
                    if (v.data) await this.voidDraw_fileAct_callback(v, related_creators);
                  });
                  this.removeShortCutKey();
                  v.present();
                });
                return;
              case 'text':
                this.selected_blobFile_callback_act(v.data.blob, v.data.contentRelated, 'textedit');
                break;
            }
          }
          this.noti.Current = this.info['cnoti_id'];
          if (this.info['cnoti_id'])
            this.noti.ClearNoti(this.info['cnoti_id']);
        });
        this.removeShortCutKey();
        this.noti.Current = 'IonicViewerPage';
        v.present();
      });
    }
  }

  async voidDraw_fileAct_callback(v: any, related_creators?: any) {
    try {
      this.userInput.file = {};
      this.userInput.file.filename = v.data['name'];
      this.userInput.file.file_ext = 'png';
      this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
      this.userInput.file.type = 'image/png';
      this.userInput.file.typeheader = 'image';
      if (related_creators) {
        this.userInput.file.content_related_creator = related_creators;
        this.userInput.file.content_creator = {
          user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        };
      } else {
        this.userInput.file.content_related_creator = [{
          user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        }];
        this.userInput.file.content_creator = {
          user_id: this.info['local'] ? 'local' : this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        };
      }
      await this.indexed.saveBase64ToUserPath(v.data['img'], `tmp_files/chatroom/${this.userInput.file.filename}`, (raw) => {
        this.userInput.file.blob = new Blob([raw], { type: this.userInput.file['type'] });
      });
      this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
    } catch (e) {
      console.error('godot-이미지 편집 사용 불가: ', e);
    }
    v.data['loadingCtrl'].dismiss();
  }

  /** 사용자 정보보기 */
  user_detail(msg: ChannelMessage) {
    if (!this.lock_modal_open) {
      this.isOtherAct = true;
      this.lock_modal_open = true;
      if (msg['is_me']) // 내 정보
        this.modalCtrl.create({
          component: GroupServerPage,
          componentProps: {
            isOfficial: this.info['server']['isOfficial'],
            target: this.info['server']['target'],
          }
        }).then(v => {
          v.onDidDismiss().then((_v) => {
            this.isOtherAct = false;
            this.ionViewDidEnter();
            this.noti.Current = this.info['cnoti_id'];
            if (this.info['cnoti_id'])
              this.noti.ClearNoti(this.info['cnoti_id']);
          });
          this.removeShortCutKey();
          this.noti.Current = 'GroupServerPage';
          v.present();
          this.lock_modal_open = false;
        });
      else { // 다른 사용자 정보
        this.modalCtrl.create({
          component: OthersProfilePage,
          componentProps: {
            info: { user: this.nakama.load_other_user(msg.sender_id, this.isOfficial, this.target) },
            group: this.info,
            has_admin: false,
          },
        }).then(v => {
          v.onDidDismiss().then((_v) => {
            this.ionViewDidEnter();
            this.isOtherAct = false;
            this.noti.Current = this.info['cnoti_id'];
            if (this.info['cnoti_id'])
              this.noti.ClearNoti(this.info['cnoti_id']);
          });
          this.noti.Current = 'OthersProfilePage';
          this.removeShortCutKey();
          v.present();
          this.lock_modal_open = false;
        });
      }
    }
  }

  ionViewWillLeave() {
    this.nakama.rearrange_channels();
    if (this.nakama.channels_orig[this.isOfficial][this.target] &&
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
    this.noti.Current = undefined;
    this.removeShortCutKey();
    window.onfocus = undefined;
  }

  removeShortCutKey() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['EnterAct'];
  }

  async ngOnDestroy(): Promise<void> {
    this.cont.abort();
    delete this.nakama.opened_page_info['channel'];
    this.nakama.ChatroomLinkAct = undefined;
    if (this.p5canvas)
      this.p5canvas.remove()
    this.nakama.OnTransferMessage = {};
    try {
      if (this.useVoiceRecording) await VoiceRecorder.stopRecording();
    } catch (e) { }
    delete this.nakama.StatusBarChangedCallback;
  }
}
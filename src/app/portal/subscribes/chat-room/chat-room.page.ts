// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChannelMessage } from '@heroiclabs/nakama-js';
import { AlertController, IonSelect, LoadingController, ModalController, NavController } from '@ionic/angular';
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
import { QrSharePage } from '../../settings/qr-share/qr-share.page';
import { QuickShareReviewPage } from './quick-share-review/quick-share-review.page';
import { WebrtcService } from 'src/app/webrtc.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import clipboard from "clipboardy";
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { UserFsDirPage } from 'src/app/user-fs-dir/user-fs-dir.page';

interface ExtendButtonForm {
  /** 버튼 숨기기 */
  isHide?: boolean;
  /** 아이콘 상대경로-이름, 크기: 64 x 64 px */
  icon?: string;
  /** 아이콘 대신 사용하는 이미지 경로, 크기: 64 x 64 px */
  icon_img?: string;
  /** 마우스 커서 스타일 */
  cursor?: string;
  act: Function;
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
      act: () => {
        if (this.info['redirect']['type'] != 3) {
          this.extended_buttons[0].isHide = true;
        } else {
          if (!this.lock_modal_open) {
            this.lock_modal_open = true;
            this.modalCtrl.create({
              component: GroupDetailPage,
              componentProps: {
                info: this.nakama.groups[this.isOfficial][this.target][this.info['group_id']],
                server: { isOfficial: this.isOfficial, target: this.target },
              },
            }).then(v => {
              v.onWillDismiss().then(data => {
                if (data.data) { // 탈퇴시
                  this.extended_buttons.forEach(button => {
                    button.isHide = true;
                  });
                  this.extended_buttons[8].isHide = false;
                  this.extended_buttons[0].isHide = false;
                }
              });
              v.onDidDismiss().then(() => {
                this.ionViewDidEnter();
              });
              this.removeShortCutKey();
              v.present();
              this.lock_modal_open = false;
            });
          }
        }
      }
    },
    { // 1
      icon: 'document-attach-outline',
      act: async () => {
        if (!this.userInputTextArea)
          this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        await this.NewAttach.open();
        this.removeShortCutKey();
        this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
          let TempFunc = ['image', 'link', 'inapp', 'load'];
          if (!this.isHidden && document.activeElement != document.getElementById(this.ChannelUserInputId) && TempFunc.length > index)
            this.new_attach({ detail: { value: TempFunc[index] } });
        }
      }
    },
    { // 2
      icon: 'camera-outline',
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
            user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'camera',
          }];
          this.userInput.file.content_creator = {
            user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
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
    }, { // 3
      icon: 'server-outline',
      act: () => {
        this.modalCtrl.create({
          component: QrSharePage,
        }).then(v => {
          v.onDidDismiss().then(v => {
            if (v.data) {
              this.userInput.quickShare = v.data;
              this.inputPlaceholder = this.lang.text['ChatRoom']['QuickShare_placeholder'];
            } else {
              this.cancel_qrshare();
            }
            this.ionViewDidEnter();
          });
          this.removeShortCutKey();
          v.present();
        });
      }
    }, { // 4
      icon: 'call-outline',
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
          this.webrtc.CreateOfffer();
        } catch (e) {
          console.log('webrtc 시작단계 오류: ', e);
        }
      }
    }, { // 5
      icon: 'volume-mute-outline',
      act: async () => {
        this.toggle_speakermode();
      }
    }, { // 6
      icon: 'log-out-outline',
      act: async () => {
        if (this.info['redirect']['type'] != 3) {
          try {
            await this.nakama.remove_group_list(
              this.nakama.groups[this.isOfficial][this.target][this.info['group_id']] || this.info['info'], this.isOfficial, this.target, false);
            await this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
            this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
            this.extended_buttons.forEach(button => {
              button.isHide = true;
            });
            this.extended_buttons[8].isHide = false;
          } catch (e) {
            console.error('채널에서 나오기 실패: ', e);
          }
        } else {
          this.extended_buttons[6].isHide = true;
        }
        this.ionViewDidEnter();
      }
    }, { // 7 
      isHide: false,
      icon: 'images-outline',
      act: () => {
        this.modalCtrl.create({
          component: UserFsDirPage,
          componentProps: {
            path: `/${this.info['id']}/files/`,
          },
        }).then(v => {
          v.onWillDismiss().then(async v => {
            if (v.data) this.selected_blobFile_callback_act(v.data);
          });
          v.onDidDismiss().then(() => {
            this.is_modal = false;
            this.ionViewDidEnter();
          });
          this.is_modal = true;
          v.present();
        });
      }
    }, { // 8
      isHide: true,
      icon: 'close-circle-outline',
      act: async () => {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
        if (this.info['redirect']['type'] == 3) // 그룹방
          await this.nakama.remove_group_list(
            this.nakama.groups[this.isOfficial][this.target][this.info['group_id']] || this.info['info'], this.isOfficial, this.target);
        try {
          delete this.nakama.groups[this.isOfficial][this.target][this.info['group_id']];
        } catch (e) {
          console.log('DeleteGroupFailed: ', e);
        }
        this.nakama.remove_channel_files(this.isOfficial, this.target, this.info.id);
        this.nakama.save_groups_with_less_info();
        let list = await this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}`);
        for (let i = 0, j = list.length; i < j; i++) {
          loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`
          await this.indexed.removeFileFromUserPath(list[i]);
        }
        loading.dismiss();
        this.navCtrl.pop();
      }
    },];

  /** 다른 modal 페이지로 넘어갔는지 여부 */
  is_modal = false;
  /** 페이지 넘어간지 여부를 검토 후 단축키 추가하기 */
  add_shortcut() {
    if (!this.is_modal)
      this.ionViewDidEnter();
  }

  ionViewDidEnter() {
    this.nakama.resumeBanner();
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
          this.userInputTextArea.focus();
        }, 0);
    }
  }

  @ViewChild('NewChatRoomAttach') NewAttach: IonSelect;
  /** 첨부 파일 타입 정하기 */
  async new_attach(ev: any) {
    switch (ev.detail.value) {
      case 'load':
        if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        document.getElementById(this.file_sel_id).click();
        break;
      case 'image':
        if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        let props = {}
        let content_related_creator: ContentCreatorInfo[];
        if (this.userInput.file && this.userInput.file.typeheader == 'image') { // 선택한 파일을 편집하는 경우
          try {
            if (this.userInput.file.url)
              this.userInput.file.blob = await fetch(this.userInput.file.url).then(r => r.blob());
            let tmp_work_path = `tmp_files/chatroom/attached.${this.userInput.file.file_ext}`;
            await this.indexed.saveBlobToUserPath(this.userInput.file.blob, tmp_work_path, undefined, this.indexed.godotDB)
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
        }
        this.modalCtrl.create({
          component: VoidDrawPage,
          componentProps: props,
        }).then(v => {
          v.onWillDismiss().then(async v => {
            if (v.data) await this.voidDraw_fileAct_callback(v, content_related_creator);
          });
          v.onDidDismiss().then(() => {
            this.is_modal = false;
            this.ionViewDidEnter();
          });
          this.is_modal = true;
          v.present();
        });
        break;
      case 'link':
        try {
          let pasted_url: string;
          try {
            pasted_url = await this.mClipboard.paste()
          } catch (e) {
            try {
              pasted_url = await clipboard.read()
            } catch (e) {
              throw e;
            }
          }
          let this_file: FileInfo = {};
          this_file.url = pasted_url;
          this_file['content_related_creator'] = [{
            user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'link',
          }];
          this_file['content_creator'] = {
            user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
            timestamp: new Date().getTime(),
            display_name: this.nakama.users.self['display_name'],
            various: 'link',
          };
          this_file.file_ext = this_file.url.split('.').pop().split('?').shift();
          this_file.filename = `${this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`;
          this.global.set_viewer_category_from_ext(this_file);
          this_file.type = '';
          this_file.typeheader = this_file.viewer;
          this.global.modulate_thumbnail(this_file, this_file.url);
          if (this.NeedScrollDown())
            setTimeout(() => {
              this.scroll_down_logs();
            }, 100);
          this.userInput.file = this_file;
          this.inputPlaceholder = `(${this.lang.text['ChatRoom']['FileLink']}: ${this.userInput.file.filename})`;
        } catch (e) {
          this.p5toast.show({
            text: `${this.lang.text['ChatRoom']['FailedToPasteData']}: ${e}`,
          });
        }
        break;
      case 'inapp': // 인앱 탐색기에서 가져오기
        this.modalCtrl.create({
          component: UserFsDirPage,
        }).then(v => {
          v.onWillDismiss().then(async v => {
            if (v.data) this.selected_blobFile_callback_act(v.data);
          });
          v.onDidDismiss().then(() => {
            this.is_modal = false;
            this.ionViewDidEnter();
          });
          this.is_modal = true;
          v.present();
        });
    }
    this.NewAttach.value = '';
  }

  async toggle_speakermode(force?: boolean) {
    this.useSpeaker = force ?? !this.useSpeaker;
    this.extended_buttons[5].icon = this.useSpeaker
      ? 'volume-high-outline' : 'volume-mute-outline';
    if (!this.useSpeaker) try {
      await TextToSpeech.stop();
    } catch (e) { }
  }

  /** 빠른 공유 정보 삭제 */
  cancel_qrshare() {
    delete this.userInput.quickShare;
    this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
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
              this.noti.noti.schedule({
                id: 7,
                title: this.lang.text['ChatRoom']['MultipleSend'],
                progressBar: { indeterminate: true },
                sound: null,
                smallIcon: 'res://diychat',
                color: 'b0b0b0',
              });
              for (let i = 0, j = ev.target.files.length; i < j; i++) {
                loading.message = `${this.lang.text['ChatRoom']['MultipleSend']}: ${j - i}`;
                this.noti.noti.schedule({
                  id: 7,
                  title: this.lang.text['ChatRoom']['MultipleSend'],
                  progressBar: { value: i, maxValue: j },
                  sound: null,
                  smallIcon: 'res://diychat',
                  color: 'b0b0b0',
                });
                await this.selected_blobFile_callback_act(ev.target.files[i]);
                await this.send();
              }
              this.noti.ClearNoti(7);
              loading.dismiss();
              setTimeout(() => {
                this.scroll_down_logs();
              }, 300);
            }
          }]
        });
        alert.present();
      } else {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        await this.selected_blobFile_callback_act(ev.target.files[0]);
        loading.dismiss();
      }
    } else {
      delete this.userInput.file;
      this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
    }
  }

  /** 옛날로 가는 커서 */
  next_cursor = '';
  /** 최근으로 가는 커서 */
  prev_cursor = '';
  file_sel_id = 'file_sel_id';
  ChatLogs: HTMLElement;

  ShowGoToBottom = false;
  isMobile = false;

  ngOnInit() {
    this.ChatLogs = document.getElementById('chatroom_div');
    this.ChatLogs.onscroll = (_ev: any) => {
      if (Math.abs(this.ChatLogs.scrollHeight - (this.ChatLogs.scrollTop + this.ChatLogs.clientHeight)) < 1) {
        // 스크롤을 제일 하단으로 내리면 사라짐
        if (!this.ShowGoToBottom)
          if (!this.ShowRecentMsg)
            this.init_last_message_viewer();
        if (this.ShowRecentMsg)
          this.pull_msg_history(false);
      }
      this.ShowGoToBottom = this.ChatLogs.scrollHeight - 220 > this.ChatLogs.scrollTop + this.ChatLogs.clientHeight;
    }
    this.nakama.ChatroomLinkAct = async (c: any, _fileinfo: FileInfo) => {
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
      this.info = c;
      await this.init_chatroom();
      this.userInput.file = _fileinfo;
      if (this.userInput.file) this.create_selected_thumbnail();
    }
    this.route.queryParams.subscribe(async _p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      if (navParams) this.info = navParams.info;
      await this.init_chatroom();
      this.userInput.file = navParams.file;
      if (this.userInput.file) this.create_selected_thumbnail();
    });
    if (isPlatform == 'DesktopPWA')
      setTimeout(() => {
        this.CreateDrop();
      }, 0);
    this.isMobile = isPlatform == 'Android' || isPlatform == 'iOS';
  }

  async GetSpeechToText() {
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
        p.pixelDensity(1);
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
              }).then(v => v.present());
            }
          }, 400);
        });
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
    });
  }

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

  async selected_blobFile_callback_act(blob: any, contentRelated: ContentCreatorInfo[] = [], various = 'loaded') {
    this.userInput['file'] = {};
    this.userInput.file['filename'] = blob.name;
    this.userInput.file['file_ext'] = blob.name.split('.').pop() || blob.type || this.lang.text['ChatRoom']['unknown_ext'];
    this.userInput.file['size'] = blob.size;
    this.userInput.file['type'] = blob.type;
    this.userInput.file['content_related_creator'] = [
      ...contentRelated, {
        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
        timestamp: new Date().getTime(),
        display_name: this.nakama.users.self['display_name'],
        various: various as any,
      }];
    this.userInput.file['content_creator'] = {
      user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().getTime(),
      display_name: this.nakama.users.self['display_name'],
      various: various as any,
    };
    this.userInput.file.blob = blob;
    this.create_selected_thumbnail();
    this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
  }

  /** 선택한 파일의 썸네일 만들기 */
  async create_selected_thumbnail() {
    try {
      if (this.userInput.file.blob.user_fs) { // 인앱 탐색기에서 넘어오는 경우
        this.global.set_viewer_category_from_ext(this.userInput.file);
        if (this.userInput.file.url) {
          this.userInput.file.thumbnail = this.userInput.file.url;
          this.userInput.file.typeheader = this.userInput.file.viewer;
          return;
        } else this.userInput.file.thumbnail = await this.indexed.loadBlobFromUserPath(this.userInput.file.path, this.userInput.file.type);
      }
    } catch (e) { }
    let FileURL = URL.createObjectURL(this.userInput.file.blob);
    this.userInput.file['typeheader'] = this.userInput.file.blob.type.split('/')[0] || this.userInput.file.viewer;
    setTimeout(() => {
      URL.revokeObjectURL(FileURL);
    }, 0);
    this.userInput.file['thumbnail'] = undefined;
    switch (this.userInput.file['typeheader']) {
      case 'image': // 이미지인 경우 사용자에게 보여주기
        this.userInput.file['thumbnail'] = this.sanitizer.bypassSecurityTrustUrl(FileURL);
        break;
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
    this.toggle_speakermode(false);
    this.init_last_message_viewer();
    this.file_sel_id = `chatroom_${this.info.id}_${new Date().getTime()}`;
    this.ChannelUserInputId = `chatroom_input_${this.info.id}_${new Date().getTime()}`;
    this.noti.Current = this.info['cnoti_id'];
    if (this.info['cnoti_id'])
      this.noti.ClearNoti(this.info['cnoti_id']);
    this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
    this.info = this.nakama.channels_orig[this.isOfficial][this.target][this.info.id];
    this.nakama.opened_page_info['channel'] = {
      isOfficial: this.isOfficial,
      target: this.target,
      id: this.info.id,
    }
    this.foundLastRead = this.info['last_read_id'] == this.info['last_comment_id'];
    switch (this.info['redirect']['type']) {
      case 2: // 1:1 대화라면
        if (this.info['status'] != 'missing') {
          if (!this.info['redirect']) // 채널 최초 생성 오류 방지용
            this.info['status'] = this.info['info']['online'] ? 'online' : 'pending';
          else if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online')
            this.info['status'] = this.nakama.load_other_user(this.info['redirect']['id'], this.isOfficial, this.target)['online'] ? 'online' : 'pending';
          delete this.extended_buttons[6].isHide;
          this.extended_buttons[0].isHide = true;
          this.extended_buttons[4].isHide = window.location.protocol == 'http:' && window.location.host.indexOf('localhost') != 0 || false;
        }
        break;
      case 3: // 그룹 대화라면
        if (this.info['status'] != 'missing')
          await this.nakama.load_groups(this.isOfficial, this.target, this.info['group_id']);
        this.extended_buttons[6].isHide = true;
        delete this.extended_buttons[0].isHide;
        this.extended_buttons[4].isHide = true;
        break;
      default:
        break;
    }
    // 실시간 채팅을 받는 경우 행동처리
    if (this.nakama.channels_orig[this.isOfficial][this.target] &&
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
        this.nakama.check_sender_and_show_name(c, this.isOfficial, this.target);
        if (c.content['filename']) this.ModulateFileEmbedMessage(c);
        this.info['last_read_id'] = this.info['last_comment_id'];
        this.nakama.save_channels_with_less_info();
        this.check_if_send_msg(c);
        this.messages.push(c);
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
          } else {
            this.last_message_viewer['is_me'] = c.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id;
            this.last_message_viewer['user_id'] = c.sender_id;
            this.last_message_viewer['message'] = c.content['msg'];
            this.last_message_viewer['color'] = c.color;
          }
        }, 0);
      }
    if (this.info['status'] === undefined || this.info['status'] == 'missing') {
      this.extended_buttons.forEach(button => {
        button.isHide = true;
      });
      this.extended_buttons[7].isHide = false;
      this.extended_buttons[8].isHide = false;
      if (this.info['redirect']['type'] == 3)
        this.extended_buttons[0].isHide = false;
    }
    this.extended_buttons[5].isHide = isNativefier || this.info['status'] == 'missing';
    // 마지막 대화 기록을 받아온다
    this.pull_msg_history();
    setTimeout(() => {
      let scrollHeight = this.ChatLogs.scrollHeight;
      this.ChatLogs.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }, 500);
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
        this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`,
          msg.content['type'],
          v => {
            msg.content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
            let url = URL.createObjectURL(v);
            this.global.modulate_thumbnail(msg.content, url);
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

  /** 첨부파일 삭제 */
  removeAttach() {
    delete this.userInput.file;
    this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
  }

  /** 사용자 입력 */
  userInput = {
    file: undefined as FileInfo,
    quickShare: undefined as Array<any>,
    text: '',
  }
  inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];

  pullable = true;
  ViewableMessage = [];
  ViewMsgIndex = 0;
  /** 새로고침되는 메시지 수 */
  RefreshCount = 15;
  /** 한번에 보여지는 최대 메시지 수 */
  ViewCount = 45;
  /** 더 최근 메시지 가져오기 버튼 보이기 여부 */
  ShowRecentMsg = false;
  /** 서버로부터 메시지 더 받아오기
   * @param isHistory 옛날 정보 불러오기 유무, false면 최신정보 불러오기 진행
   */
  async pull_msg_history(isHistory = true) {
    if (!this.pullable && isHistory) return;
    this.pullable = false;
    if (isHistory) {
      try {
        if (this.info['status'] === undefined || this.info['status'] == 'missing') throw 'Channel missing';
        if (this.ViewMsgIndex != 0) { // 위에 더 볼 수 있는 메시지가 있음 (이미 받은 것으로)
          let ShowMeAgainCount = Math.min(this.ViewMsgIndex, this.RefreshCount)
          this.ViewMsgIndex -= ShowMeAgainCount;
          this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
          for (let i = 0; i < ShowMeAgainCount; i++)
            try {
              let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
              let FileURL = URL.createObjectURL(blob);
              this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL);
            } catch (e) { }
          this.modulate_chatmsg(0, this.ViewableMessage.length);
          this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
          this.pullable = true;
          return;
        }
        await this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.info['id'], this.RefreshCount, false, this.next_cursor).then(v => {
            this.info['is_new'] = false;
            v.messages.forEach(msg => {
              msg = this.nakama.modulation_channel_message(msg, this.isOfficial, this.target);
              this.nakama.check_sender_and_show_name(msg, this.isOfficial, this.target);
              if (!this.info['last_comment']) {
                let hasFile = msg.content['filename'] ? `(${this.lang.text['ChatRoom']['attachments']}) ` : '';
                this.info['last_comment'] = hasFile + (msg['content']['msg'] || msg['content']['noti'] || '');
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
              this.nakama.ModulateTimeDate(msg);
              this.nakama.content_to_hyperlink(msg);
              this.messages.unshift(msg);
              this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
              this.modulate_chatmsg(0, this.ViewableMessage.length);
            });
            this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
            this.next_cursor = v.next_cursor;
            this.prev_cursor = v.prev_cursor;
            this.pullable = true;
            this.nakama.saveListedMessage(this.messages, this.info, this.isOfficial, this.target);
          });
      } catch (e) {
        if (this.info['redirect']['type'] == 3) // 그룹대화라면 공개여부 검토
          if (this.nakama.groups[this.isOfficial][this.target]
            && this.nakama.groups[this.isOfficial][this.target][this.info['group_id']]
            && !this.nakama.groups[this.isOfficial][this.target][this.info['group_id']]['open']) {
            let tmp = [{
              content: {
                msg: [{ text: this.lang.text['ChatRoom']['closed_group_must_online'] }],
              }
            }, {
              content: {
                msg: [{ text: this.lang.text['ChatRoom']['closed_group_not_allow'] }],
              }
            }];
            this.next_cursor = undefined;
            this.isHistoryLoaded = true;
            tmp.forEach(tmsg => this.messages.push(tmsg));
            return;
          }
        this.LoadLocalChatHistory();
      }
    } else {
      let subtract = this.messages.length - this.ViewMsgIndex - this.ViewCount;
      this.ShowRecentMsg = !(subtract == 0);
      this.ViewMsgIndex += Math.min(this.RefreshCount, subtract);
      this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
      for (let i = this.ViewableMessage.length - 1; i >= 0; i--) {
        try {
          let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
          let FileURL = URL.createObjectURL(blob);
          this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL);
        } catch (e) { }
        this.modulate_chatmsg(i, this.ViewableMessage.length);
      }
      this.pullable = true;
    }
  }

  useSpeaker = false;
  /** 마지막에 받은 메시지 읽기 */
  SpeechReceivedMessage(msg: any) {
    let getMessage = JSON.parse(JSON.stringify(msg.content.msg));
    let read_this = '';
    for (let i = 0, j = getMessage.length; i < j; i++)
      for (let k = 0, l = getMessage[i].length; k < l; k++)
        read_this += getMessage[i][k]['text'] + ' ';
    this.SpeechThese.push(read_this);
    if (!this.isSpeeching) this.SpeechingTexts();
  }

  isSpeeching = false;
  SpeechThese: string[] = [];
  async SpeechingTexts() {
    let read_this = this.SpeechThese.shift();
    this.isSpeeching = true;
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
    if (this.ViewMsgIndex > 0) { // 위에 더 볼 수 있는 메시지가 있음 (이미 받은 것으로)
      let ShowMeAgainCount = Math.min(this.ViewableMessage.length, Math.min(this.ViewMsgIndex, this.RefreshCount));
      this.ViewMsgIndex -= ShowMeAgainCount;
      this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
      for (let i = ShowMeAgainCount - 1; i >= 0; i--) {
        try {
          let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
          let FileURL = URL.createObjectURL(blob);
          this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL);
        } catch (e) { }
        this.modulate_chatmsg(i, ShowMeAgainCount);
      }
      this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
      this.pullable = this.ViewMsgIndex != 0 || Boolean(this.LocalHistoryList.length);
      return;
    }
    if (!this.isHistoryLoaded) // 기록 리스트 잡아두기
      this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/chats/`, (list) => {
        this.LocalHistoryList = list;
        this.isHistoryLoaded = true;
        if (!this.LocalHistoryList.length) return;
        this.indexed.loadTextFromUserPath(this.LocalHistoryList.pop(), async (e, v) => {
          if (e && v) {
            let json: any[] = JSON.parse(v.trim());
            for (let i = json.length - 1; i >= 0; i--) {
              this.nakama.translate_updates(json[i]);
              json[i] = this.nakama.modulation_channel_message(json[i], this.isOfficial, this.target);
              this.nakama.ModulateTimeDate(json[i]);
              this.messages.unshift(json[i]);
            }
            this.ViewMsgIndex = Math.max(0, this.messages.length - this.RefreshCount);
            this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.RefreshCount);
            this.modulate_chatmsg(0, json.length);
            for (let i = this.ViewableMessage.length - 1; i >= 0; i--) {
              try {
                let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
                let FileURL = URL.createObjectURL(blob);
                this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL);
              } catch (e) { }
              this.modulate_chatmsg(i, this.ViewableMessage.length);
            }
          }
          this.next_cursor = null;
          this.pullable = true;
        });
      });
    else { // 다음 파일에서 읽기
      this.indexed.loadTextFromUserPath(this.LocalHistoryList.pop(), async (e, v) => {
        if (e && v) {
          let json: any[] = JSON.parse(v.trim());
          for (let i = json.length - 1; i >= 0; i--) {
            this.nakama.translate_updates(json[i]);
            json[i] = this.nakama.modulation_channel_message(json[i], this.isOfficial, this.target);
            this.nakama.ModulateTimeDate(json[i]);
            this.messages.unshift(json[i]);
          }
          this.ViewMsgIndex = Math.max(0, json.length - this.RefreshCount);
          this.ViewableMessage = this.messages.slice(this.ViewMsgIndex, this.ViewMsgIndex + this.ViewCount);
          let ShowMeAgainCount = Math.min(Math.min(json.length, this.RefreshCount), this.ViewableMessage.length);
          for (let i = ShowMeAgainCount - 1; i >= 0; i--) {
            try {
              let blob = await this.indexed.loadBlobFromUserPath(this.ViewableMessage[i].content['path'], this.ViewableMessage[i].content.file_ext);
              let FileURL = URL.createObjectURL(blob);
              this.global.modulate_thumbnail(this.ViewableMessage[i].content, FileURL);
            } catch (e) { }
            this.modulate_chatmsg(i, ShowMeAgainCount);
          }
          this.ShowRecentMsg = this.messages.length > this.ViewMsgIndex + this.ViewCount;
        } else if (e) this.LoadLocalChatHistory();
        this.pullable = Boolean(this.LocalHistoryList.length);
      });
    }
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

  userInputTextArea: HTMLElement;
  ChannelUserInputId = 'ChannelUserInputId';
  check_key(ev: any) {
    if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
    if (isPlatform == 'DesktopPWA') {
      if (ev.key == 'Enter' && !ev.shiftKey && ev.type == 'keydown') {
        this.send(true);
      } else {
        setTimeout(() => {
          this.userInputTextArea.style.height = '36px';
          this.userInputTextArea.style.height = this.userInputTextArea.scrollHeight + 'px';
        }, 0);
      }
    } else {
      setTimeout(() => {
        this.userInputTextArea.style.height = '36px';
        this.userInputTextArea.style.height = this.userInputTextArea.scrollHeight + 'px';
      }, 0);
    }
  }

  async send(with_key = false) {
    if (with_key && (isPlatform == 'Android' || isPlatform == 'iOS')) return;
    if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
    if (!this.userInput.text.trim() && !this.userInput['file'] && !this.userInput['quickShare']) {
      setTimeout(() => {
        this.userInput.text = '';
        this.userInputTextArea.style.height = '36px';
      }, 0);
      return;
    }
    this.userInputTextArea.focus();
    this.isHidden = true;
    let result: FileInfo = {};
    result['msg'] = this.userInput.text;
    let FileAttach = false;
    let isURL = false;
    let isLongText = '';
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
      if (result['msg'].length > 800) { // 메시지가 충분히 깁니다
        isLongText = result['msg'];
        delete result['msg'];
      } else result['msg'] = result['msg'];
      result['content_creator'] = this.userInput.file.content_creator;
      result['content_related_creator'] = this.userInput.file.content_related_creator;
      FileAttach = true;
      for (let i = 0, j = result['content_related_creator'].length; i < j; i++) {
        delete result['content_related_creator'][i]['is_me'];
        delete result['content_related_creator'][i]['timeDisplay'];
        delete result['content_related_creator'][i]['various_display'];
      }
    } else { // 파일은 없지만 메시지가 충분히 깁니다
      if (result['msg'].length > 800) {
        this.LongTextMessageAsFile(result);
        return;
      }
    }
    if (this.userInput.quickShare)
      result['quickShare'] = this.userInput.quickShare;
    result['local_comp'] = Math.random();
    let tmp = { content: JSON.parse(JSON.stringify(result)) };
    this.nakama.content_to_hyperlink(tmp);
    this.sending_msg.push(tmp);
    try {
      await this.nakama.servers[this.isOfficial][this.target].socket
        .writeChatMessage(this.info['id'], result).then(v => {
          /** 업로드가 진행중인 메시지 개체 */
          if (FileAttach && !isURL) { // 첨부 파일이 포함된 경우, 링크는 아닌 경우
            // 로컬에 파일을 저장
            let path = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${v.message_id}.${this.userInput.file.file_ext}`;
            this.indexed.saveBlobToUserPath(this.userInput.file.blob, path, () => {
              this.auto_open_thumbnail({
                content: result,
                message_id: v.message_id,
              });
            });
          }
          delete this.userInput.quickShare;
          delete this.userInput.file;
          this.userInput.text = '';
          this.userInputTextArea.style.height = '36px';
          this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
          if (isLongText) {
            result['msg'] = isLongText;
            this.LongTextMessageAsFile(result);
          }
        });
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
            text: `${this.lang.text['ChatRoom']['FailedToSend']}: ${e.message}`,
          });
          break;
      }
      setTimeout(() => {
        this.userInput.text = '';
        this.userInputTextArea.style.height = '36px';
      }, 0);
      setTimeout(() => {
        for (let i = this.sending_msg.length - 1; i >= 0; i--) {
          if (this.sending_msg[i]['content']['local_comp'] == result['local_comp'])
            this.sending_msg.splice(i, 1);
        }
      }, 1500);
    }
  }

  /** 바로 전달하기 어려운 긴 글은 파일화 시켜서 보내기 */
  async LongTextMessageAsFile(result: any) {
    let blob = new Blob([result['msg']]);
    await this.indexed.saveBlobToUserPath(blob, `tmp_files/chatroom/${this.lang.text['ChatRoom']['LongText']}_${result['msg'].substring(0, 10)}.txt`);
    let this_file: FileInfo = {};
    this_file.blob = blob;
    this_file['content_related_creator'] = [{
      user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
      timestamp: new Date().getTime(),
      display_name: this.nakama.users.self['display_name'],
      various: 'long_text',
    }];
    this_file['content_creator'] = {
      user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
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
    delete this.userInput.quickShare;
    delete this.userInput.file;
    this.userInput.text = '';
    this.userInputTextArea.style.height = '36px';
    this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
    this.userInput.file = this_file;
    this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
    this.create_selected_thumbnail();
    this.p5toast.show({
      text: this.lang.text['ChatRoom']['CreateAsTextFile'],
    });
  }

  /** 메시지 정보 상세 */
  message_detail(msg: any) {
  }

  /** 메시지 내 파일 정보, 파일 다운받기 */
  async file_detail(msg: any) {
    if (msg.content['url']) {
      msg.content['thumbnail'] = msg.content['url'];
      this.open_viewer(msg, msg.content['url']);
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
            this.global.modulate_thumbnail(msg.content, url);
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
        }
      }
    }
  }

  /** QR행동처럼 처리하기 */
  async quickShare_act(_msg: any) {
    this.modalCtrl.create({
      component: QuickShareReviewPage,
      componentProps: {
        data: _msg.content['quickShare']
      },
    }).then(v => v.present());
  }

  JoinWebRTCMatch(msg: any) {
    this.nakama.JoinWebRTCMatch(msg, this.isOfficial, this.target, this.info);
  }

  /** 메시지 추가시마다 메시지 상태를 업데이트 (기존 html 연산)  
   * 메시지 자료형들(사용자 이름 보이기, 시간 보이기 등)을 메시지에 연산하는 것으로, 원래는 html에서 *ngIf 등으로 동작했었다  
   * 연산 줄이기 용도
   * @param i 현재 메시지 번호
   * @param j 메시지 전체 길이
   * @param msg 메시지 개체
   */
  modulate_chatmsg(i: number, j: number) {
    // 1회성 보여주기 양식 생성 (채팅방 전용 정보)
    if (!this.ViewableMessage[i]['showInfo'])
      this.ViewableMessage[i]['showInfo'] = {};
    // 날짜 표시
    this.ViewableMessage[i]['showInfo']['date'] = Boolean(this.ViewableMessage[i]['msgDate']);
    // 발신인과 시간 표시
    this.ViewableMessage[i]['showInfo']['sender'] = !this.ViewableMessage[i].content.noti && this.ViewableMessage[i].user_display_name;
    // 이전 메시지와 정보를 비교하여 이전 메시지와 지금 메시지의 상태를 결정 (실시간 메시지 받기류)
    if (i - 1 >= 0) {
      this.ViewableMessage[i]['showInfo']['date'] = Boolean(this.ViewableMessage[i]['msgDate']) && (this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i - 1]['msgDate']);
      this.ViewableMessage[i]['showInfo']['sender'] = !this.ViewableMessage[i].content.noti && this.ViewableMessage[i].user_display_name && (this.ViewableMessage[i - 1]['isLastRead'] || this.ViewableMessage[i].sender_id != this.ViewableMessage[i - 1].sender_id || this.ViewableMessage[i - 1].content.noti || this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i - 1]['msgDate'] || this.ViewableMessage[i]['msgTime'] != this.ViewableMessage[i - 1]['msgTime']);
    }
    // url 링크 개체 즉시 불러오기
    if (this.ViewableMessage[i]['content']['url']) {
      if (this.ViewableMessage[i]['content'].viewer == 'image')
        this.ViewableMessage[i]['content']['thumbnail'] = this.ViewableMessage[i]['content']['url'];
      else delete this.ViewableMessage[i]['content']['thumbnail'];
    }
    // 다음 메시지와 정보를 비교하여 다음 메시지의 상태를 결정 (기록 불러오기류)
    try {
      if (i + 1 < j) {
        this.ViewableMessage[i + 1]['showInfo']['date'] = Boolean(this.ViewableMessage[i]['msgDate']) && (this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i + 1]['msgDate']);
        this.ViewableMessage[i + 1]['showInfo']['sender'] = !this.ViewableMessage[i + 1].content.noti && this.ViewableMessage[i + 1].user_display_name && (this.ViewableMessage[i]['isLastRead'] || this.ViewableMessage[i].sender_id != this.ViewableMessage[i + 1].sender_id || this.ViewableMessage[i].content.noti || this.ViewableMessage[i]['msgDate'] != this.ViewableMessage[i + 1]['msgDate'] || this.ViewableMessage[i]['msgTime'] != this.ViewableMessage[i + 1]['msgTime']);
      }
    } catch (e) { }
  }

  /** 파일이 포함된 메시지 구조화, 자동 썸네일 작업 */
  ModulateFileEmbedMessage(msg: any) {
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
    this.indexed.checkIfFileExist(path, (b) => {
      if (b) {
        msg.content['text'] = [this.lang.text['ChatRoom']['downloaded']];
        this.indexed.loadBlobFromUserPath(path,
          msg.content['type'],
          v => {
            msg.content['path'] = path;
            let url = URL.createObjectURL(v);
            this.global.modulate_thumbnail(msg.content, url);
            if (this.NeedScrollDown())
              setTimeout(() => {
                this.scroll_down_logs();
              }, 100);
          });
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
          targetDB: this.indexed.ionicDB,
          relevance: attaches,
        },
        cssClass: 'fullscreen',
      }).then(v => {
        v.onDidDismiss().then((v) => {
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
                  },
                }).then(v => {
                  v.onWillDismiss().then(async v => {
                    if (v.data) await this.voidDraw_fileAct_callback(v, related_creators);
                  });
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
          this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
        });
        this.noti.Current = 'IonicViewerPage';
        v.present();
        this.nakama.removeBanner();
        this.lock_modal_open = false;
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
          user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        };
      } else {
        this.userInput.file.content_related_creator = [{
          user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        }];
        this.userInput.file.content_creator = {
          user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().getTime(),
          display_name: this.nakama.users.self['display_name'],
          various: 'voidDraw',
        };
      }
      await this.indexed.saveBase64ToUserPath(v.data['img'], `tmp_files/chatroom/${this.userInput.file.filename}`, (raw) => {
        this.userInput.file.blob = new Blob([raw], { type: this.userInput.file['type'] })
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
      this.lock_modal_open = true;
      if (msg['is_me']) // 내 정보
        this.modalCtrl.create({
          component: GroupServerPage,
        }).then(v => {
          v.onDidDismiss().then((_v) => {
            this.noti.Current = this.info['cnoti_id'];
            if (this.info['cnoti_id'])
              this.noti.ClearNoti(this.info['cnoti_id']);
            this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
          });
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
            this.noti.Current = this.info['cnoti_id'];
            if (this.info['cnoti_id'])
              this.noti.ClearNoti(this.info['cnoti_id']);
            this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
          });
          this.noti.Current = 'OthersProfilePage';
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
  }

  removeShortCutKey() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['EnterAct'];
  }

  ngOnDestroy(): void {
    delete this.nakama.opened_page_info['channel'];
    this.nakama.ChatroomLinkAct = undefined;
    if (this.p5canvas)
      this.p5canvas.remove()
    this.nakama.OnTransferMessage = {};
  }
}
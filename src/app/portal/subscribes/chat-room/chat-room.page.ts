// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChannelMessage } from '@heroiclabs/nakama-js';
import { LoadingController, ModalController, NavController, NavParams } from '@ionic/angular';
import { LocalNotiService } from 'src/app/local-noti.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import * as p5 from "p5";
import { ProfilePage } from '../../settings/profile/profile.page';
import { OthersProfilePage } from 'src/app/others-profile/others-profile.page';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { isPlatform } from 'src/app/app.component';
import { IonicViewerPage } from './ionic-viewer/ionic-viewer.page';
import { GodotViewerPage } from './godot-viewer/godot-viewer.page';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { DomSanitizer } from '@angular/platform-browser';
import { VoidDrawPage } from './void-draw/void-draw.page';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { UserFsDirPage } from 'src/app/user-fs-dir/user-fs-dir.page';
import { GroupDetailPage } from '../../settings/group-detail/group-detail.page';
import { Camera } from '@awesome-cordova-plugins/camera/ngx';
import { ActivatedRoute, Router } from '@angular/router';

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

const SIZE_LIMIT = 240000;

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
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
    private global: GlobalActService,
    private loadingCtrl: LoadingController,
    private camera: Camera,
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
  extended_buttons: ExtendButtonForm[] = [{
    isHide: true,
    icon: 'close-circle-outline',
    act: async () => {
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
      if (this.nakama.channel_transfer[this.isOfficial][this.target] && this.nakama.channel_transfer[this.isOfficial][this.target][this.info.id])
        delete this.nakama.channel_transfer[this.isOfficial][this.target][this.info.id];
      if (this.info['redirect']['type'] == 3)
        await this.nakama.remove_group_list(this.nakama.groups[this.isOfficial][this.target][this.info['group_id']], this.isOfficial, this.target);
      await this.nakama.remove_channel_files(this.isOfficial, this.target, this.info.id);
      await this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}`, (list) => {
        list.forEach(path => this.indexed.removeFileFromUserPath(path));
        loading.dismiss();
      });
      this.navCtrl.back();
    }
  },
  {
    icon: 'log-out-outline',
    act: async () => {
      if (this.info['redirect']['type'] != 3) {
        try {
          await this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
          this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
          this.extended_buttons.forEach(button => {
            button.isHide = true;
          });
          this.extended_buttons[0].isHide = false;
        } catch (e) {
          console.error('채널에서 나오기 실패: ', e);
        }
      } else {
        this.extended_buttons[1].isHide = true;
      }
    }
  },
  {
    icon: 'settings-outline',
    act: () => {
      if (this.info['redirect']['type'] != 3) {
        this.extended_buttons[2].isHide = true;
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
                this.extended_buttons[0].isHide = false;
              }
            });
            v.present();
            this.lock_modal_open = false;
          });
        }
      }
    }
  },
  {
    icon: 'camera-outline',
    act: () => {
      this.camera.getPicture({
        destinationType: 0,
        correctOrientation: true,
      }).then(v => {
        if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
        this.userInput.file = {};
        let time = new Date();
        this.userInput.file.filename = `Camera_${time.toLocaleString().replace(/:/g, '_')}.jpeg`;
        this.userInput.file.file_ext = 'jpeg';
        this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl('data:image/jpeg;base64,' + v);
        this.userInput.file.type = 'image/jpeg';
        this.userInput.file.typeheader = 'image';
        this.userInput.file.content_related_creator = [{
          user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().toLocaleString(),
          display_name: this.nakama.users.self['display_name'],
        }];
        this.userInput.file.content_creator = {
          user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
          timestamp: new Date().toLocaleString(),
          display_name: this.nakama.users.self['display_name'],
        };
        this.userInput.file.base64 = 'data:image/jpeg;base64,' + v;
      });
    }
  },
  {
    icon: 'document-attach-outline',
    act: () => {
      if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
      document.getElementById(this.file_sel_id).click();
    }
  },
  {
    icon: 'folder-open-outline',
    act: () => {
      if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
      this.modalCtrl.create({
        component: UserFsDirPage,
        componentProps: {
          path: `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files`,
          return: true,
        }
      }).then(v => {
        v.onDidDismiss().then(async data => {
          if (data.data) {
            let file = data.data['info'];
            let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
            loading.present();
            try {
              let blob = await this.indexed.loadBlobFromUserPath(file.path, '');
              let TmpUrl = URL.createObjectURL(blob);
              setTimeout(() => {
                URL.revokeObjectURL(TmpUrl);
              }, 0);
              this.userInput.file = {};
              this.userInput.file.filename = file.name;
              this.userInput.file.file_ext = file.file_ext;
              this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(TmpUrl);
              this.userInput.file.type = '';
              this.userInput.file.typeheader = file.viewer;
              this.userInput.file.content_related_creator = [{
                display_name: this.lang.text['GlobalAct']['UnCheckableCreator'],
                timestamp: new Date().toLocaleString(),
              }];
              this.userInput.file.content_creator = {
                user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                timestamp: new Date().toLocaleString(),
                display_name: this.nakama.users.self['display_name'],
              };
              this.userInput.file.base64 = await this.global.GetBase64ThroughFileReader(blob);
            } catch (e) {
              console.log('파일 불러오기에 실패함: ', e);
            }
            loading.dismiss();
          }
        })
        v.present();
      });
    }
  },
  {
    icon_img: 'voidDraw.png',
    act: () => {
      if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
      this.modalCtrl.create({
        component: VoidDrawPage,
      }).then(v => {
        v.onWillDismiss().then(v => {
          if (v.data) {
            this.userInput.file = {};
            this.userInput.file.filename = v.data['name'];
            this.userInput.file.file_ext = 'png';
            this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
            this.userInput.file.type = 'image/png';
            this.userInput.file.typeheader = 'image';
            this.userInput.file.content_related_creator = [{
              user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
              timestamp: new Date().toLocaleString(),
              display_name: this.nakama.users.self['display_name'],
            }];
            this.userInput.file.content_creator = {
              user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
              timestamp: new Date().toLocaleString(),
              display_name: this.nakama.users.self['display_name'],
            };
            this.userInput.file.base64 = v.data['img'];
            this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
            v.data['loadingCtrl'].dismiss();
          }
        });
        v.present();
      });
    },
  }];

  /** 파일 첨부하기 */
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      this.userInput['file'] = {};
      this.userInput.file['filename'] = ev.target.files[0].name;
      this.userInput.file['file_ext'] = ev.target.files[0].name.split('.')[1] || ev.target.files[0].type || this.lang.text['ChatRoom']['unknown_ext'];
      this.userInput.file['size'] = ev.target.files[0].size;
      this.userInput.file['type'] = ev.target.files[0].type;
      this.userInput.file['typeheader'] = ev.target.files[0].type.split('/')[0];
      this.userInput.file['content_related_creator'] = [{
        timestamp: new Date().toLocaleString(),
        display_name: this.lang.text['GlobalAct']['UnCheckableCreator'],
      }];
      this.userInput.file['content_creator'] = {
        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
        timestamp: new Date().toLocaleString(),
        display_name: this.nakama.users.self['display_name'],
      };
      let updater = setInterval(() => { }, 110);
      setTimeout(() => {
        clearInterval(updater);
      }, 1500);
      let FileURL = URL.createObjectURL(ev.target.files[0]);
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
      this.userInput.file['base64'] = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
      this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
    } else {
      delete this.userInput.file;
      this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
    }
  }

  /** 옛날로 가는 커서 */
  next_cursor = '';
  /** 최근으로 가는 커서 */
  prev_cursor = '';
  content_panel: HTMLElement;
  send_thumbnail: HTMLElement;
  file_sel_id = 'file_sel_id';

  ngOnInit() {
    this.nakama.removeBanner();
    this.nakama.ChatroomLinkAct = (c: any) => {
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'];
      this.messages.length = 0;
      this.info = c;
      this.init_chatroom();
    }
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      if (navParams) this.info = navParams.info;
      this.init_chatroom();
    });
  }

  async init_chatroom() {
    this.file_sel_id = `chatroom_${this.info.id}_${new Date().getTime()}`;
    this.ChannelUserInputId = `chatroom_input_${this.info.id}_${new Date().getTime()}`;
    this.noti.Current = this.info['cnoti_id'];
    if (this.info['cnoti_id'])
      this.noti.ClearNoti(this.info['cnoti_id']);
    this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
    this.foundLastRead = this.info['last_read_id'] == this.info['last_comment_id'];
    this.extended_buttons[3].isHide = isPlatform != 'Android' && isPlatform != 'iOS';
    switch (this.info['redirect']['type']) {
      case 2: // 1:1 대화라면
        if (this.info['status'] != 'missing') {
          if (!this.info['redirect']) // 채널 최초 생성 오류 방지용
            this.info['status'] = this.info['info']['online'] ? 'online' : 'pending';
          else if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online')
            this.info['status'] = this.nakama.load_other_user(this.info['redirect']['id'], this.isOfficial, this.target)['online'] ? 'online' : 'pending';
          this.extended_buttons[2].isHide = true;
        }
        break;
      case 3: // 그룹 대화라면
        await this.nakama.load_groups(this.isOfficial, this.target, this.info['group_id']);
        this.extended_buttons[1].isHide = true;
        delete this.extended_buttons[2].isHide;
        break;
      default:
        break;
    }
    this.content_panel = document.getElementById('content');
    this.send_thumbnail = document.getElementById('send_thumbnail');
    // 실시간 채팅을 받는 경우 행동처리
    if (this.nakama.channels_orig[this.isOfficial][this.target] &&
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
        this.nakama.check_sender_and_show_name(c, this.isOfficial, this.target);
        if (c.content['filename']) this.ModulateFileEmbedMessage(c);
        this.info['last_read_id'] = this.info['last_comment_id'];
        this.check_if_send_msg(c);
        this.messages.push(c);
        this.modulate_chatmsg(this.messages.length - 1, this.messages.length);
        setTimeout(() => {
          this.info['is_new'] = false;
          this.nakama.has_new_channel_msg = false;
          this.content_panel.scrollIntoView({ block: 'start' });
        }, 0);
      }
    if (this.info['status'] == 'missing') {
      this.extended_buttons.forEach(button => {
        button.isHide = true;
      });
      this.extended_buttons[0].isHide = false;
      if (this.info['redirect']['type'] == 3)
        this.extended_buttons[2].isHide = false;
    }
    // 마지막 대화 기록을 받아온다
    this.pull_msg_history();
    setTimeout(() => {
      this.content_panel.scrollIntoView({ block: 'start' });
    }, 500);
  }

  /** 내가 보낸 메시지인지 검토하는 과정  
   * 내 메시지 한정 썸네일을 생성하거나 열람 함수를 생성
   */
  check_if_send_msg(msg: any) {
    for (let i = 0, j = this.sending_msg.length; i < j; i++) {
      if (msg.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id
        && msg.content['local_comp'] == this.sending_msg[i].content['local_comp']) {
        if (msg.content['filename']) this.auto_open_thumbnail(msg);
        this.sending_msg.splice(i, 1);
        break;
      }
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
            let url = URL.createObjectURL(v);
            msg.content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
            this.global.modulate_thumbnail(msg.content, url);
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
    text: '',
  }
  inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];

  pullable = true;
  /** 서버로부터 메시지 더 받아오기
   * @param isHistory 옛날 정보 불러오기 유무, false면 최신정보 불러오기 진행
   */
  async pull_msg_history(isHistory = true) {
    if (!this.pullable) return;
    this.pullable = false;
    if (isHistory) {
      try {
        await this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
          this.nakama.servers[this.isOfficial][this.target].session,
          this.info['id'], 15, false, this.next_cursor).then(v => {
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
                }
              } else this.foundLastRead = true;
              this.nakama.translate_updates(msg);
              if (msg.content['filename']) this.ModulateFileEmbedMessage(msg);
              this.nakama.ModulateTimeDate(msg);
              this.nakama.content_to_hyperlink(msg);
              this.messages.unshift(msg);
              this.modulate_chatmsg(0, this.messages.length);
            });
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
      console.log('지금 보고있는 기록보다 최근 기록 불러오기');
    }
  }

  isHistoryLoaded = false;
  LocalHistoryList = [];
  /** 내부 저장소 채팅 기록 열람 */
  LoadLocalChatHistory() {
    if (!this.isHistoryLoaded)
      this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/chats/`, (list) => {
        this.LocalHistoryList = list;
        this.isHistoryLoaded = true;
        if (!this.LocalHistoryList.length) return;
        this.indexed.loadTextFromUserPath(this.LocalHistoryList.pop(), (e, v) => {
          if (e && v) {
            let json: any[] = JSON.parse(v.trim());
            for (let i = json.length - 1; i >= 0; i--) {
              this.ModulateFileEmbedMessage(json[i]);
              this.nakama.translate_updates(json[i]);
              json[i] = this.nakama.modulation_channel_message(json[i], this.isOfficial, this.target);
              this.nakama.ModulateTimeDate(json[i]);
              this.messages.unshift(json[i]);
              this.modulate_chatmsg(0, this.messages.length);
            }
          }
          this.next_cursor = null;
          this.pullable = Boolean(this.LocalHistoryList.length);
        });
      });
    else {
      this.indexed.loadTextFromUserPath(this.LocalHistoryList.pop(), (e, v) => {
        if (e && v) {
          let json: any[] = JSON.parse(v.trim());
          for (let i = json.length - 1; i >= 0; i--) {
            this.ModulateFileEmbedMessage(json[i]);
            this.nakama.translate_updates(json[i]);
            json[i] = this.nakama.modulation_channel_message(json[i], this.isOfficial, this.target);
            this.nakama.ModulateTimeDate(json[i]);
            this.messages.unshift(json[i]);
            this.modulate_chatmsg(0, this.messages.length);
          }
        }
        this.pullable = Boolean(this.LocalHistoryList.length);
      });
    }
  }

  /** 추가 매뉴 숨김여부 */
  isHidden = true;

  /** 핸드폰 가상키보드의 움직임을 고려하여 눈이 덜 불편하도록 지연 */
  open_ext_with_delay() {
    this.isHidden = !this.isHidden;
  }

  /** 확장 메뉴 숨기기 */
  make_ext_hidden() {
    if (isPlatform == 'DesktopPWA') return;
    this.isHidden = true;
  }

  userInputTextArea: HTMLElement;
  ChannelUserInputId = 'ChannelUserInputId';
  check_key(ev: any) {
    if (!this.userInputTextArea) this.userInputTextArea = document.getElementById(this.ChannelUserInputId);
    if (isPlatform == 'DesktopPWA') {
      if (ev.key == 'Enter' && !ev.shiftKey && ev.type == 'keydown') {
        this.send(true);
      } else {
        this.userInputTextArea.style.height = '36px';
        this.userInputTextArea.style.height = this.userInputTextArea.scrollHeight + 'px';
      }
    } else {
      this.userInputTextArea.style.height = '36px';
      this.userInputTextArea.style.height = this.userInputTextArea.scrollHeight + 'px';
    }
  }

  send(with_key = false) {
    if (with_key && (isPlatform == 'Android' || isPlatform == 'iOS')) return;
    if (!this.userInput.text.trim() && !this.userInput['file']) {
      setTimeout(() => {
        this.userInput.text = '';
      }, 0);
      this.userInputTextArea.style.height = '36px';
      return;
    }
    this.userInputTextArea.style.height = '36px';
    let result: FileInfo = {};
    result['msg'] = this.userInput.text;
    let upload: any[] = [];
    if (this.userInput.file) { // 파일 첨부시
      result['filename'] = this.userInput.file.filename;
      result['filesize'] = this.userInput.file.size;
      result['file_ext'] = this.userInput.file.file_ext;
      result['type'] = this.userInput.file.type;
      result['msg'] = result['msg'];
      result['content_creator'] = this.userInput.file.content_creator;
      result['content_related_creator'] = this.userInput.file.content_related_creator;
      upload = this.userInput.file.base64.match(/(.{1,220000})/g);
      result['partsize'] = upload.length;
    }
    result['local_comp'] = Math.random();
    let tmp = { content: JSON.parse(JSON.stringify(result)) };
    this.nakama.content_to_hyperlink(tmp);
    this.sending_msg.push(tmp);
    try {
      this.nakama.servers[this.isOfficial][this.target].socket
        .writeChatMessage(this.info['id'], result).then(v => {
          /** 업로드가 진행중인 메시지 개체 */
          if (upload.length) { // 첨부 파일이 포함된 경우
            // 로컬에 파일을 저장
            this.indexed.saveBase64ToUserPath(this.userInput.file.base64, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${v.message_id}.${this.userInput.file.file_ext}`, () => {
              this.auto_open_thumbnail({
                content: result,
                message_id: v.message_id,
              });
              // 서버에 파일을 업로드
              this.nakama.WriteStorage_From_channel(v, upload, this.isOfficial, this.target);
            });
          }
          delete this.userInput.file;
          this.userInput.text = '';
          this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
        });
    } catch (e) {
      setTimeout(() => {
        this.userInput.text = '';
      }, 0);
      this.userInputTextArea.style.height = '36px';
      setTimeout(() => {
        for (let i = this.sending_msg.length - 1; i >= 0; i--) {
          if (this.sending_msg[i]['content']['local_comp'] == result['local_comp'])
            this.sending_msg.splice(i, 1);
        }
      }, 1500);
    }
  }

  /** 메시지 정보 상세 */
  message_detail(_msg: any) {
    console.log('');
  }

  /** 메시지 내 파일 정보, 파일 다운받기 */
  file_detail(msg: any) {
    this.indexed.checkIfFileExist(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`, (v) => {
      if (v) { // 파일이 존재하는 경우
        // 전송중 상태로 뜬다면 재발송 검토
        if (this.nakama.channel_transfer[this.isOfficial][this.target]
          && this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id]
          && this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]) {
          // 이전에 전송하다가 짤린 파일이었다면 다시 전송 시작
          if (this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]['OnProgress']) {
            this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`, msg.content['type'], async blob => {
              let base64 = await this.global.GetBase64ThroughFileReader(blob);
              let upload = base64.match(/(.{1,220000})/g);
              this.nakama.WriteStorage_From_channel(msg, upload, this.isOfficial, this.target, this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]['progress'][0]);
              delete this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]['OnProgress'];
            });
            return; // 재전송하는 경우에는 파일 열람을 하지 않는다
          }
        }
        if (!msg.content['text'])
          msg.content['text'] = [this.lang.text['ChatRoom']['downloaded']];
        this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`,
          msg.content['type'],
          v => {
            let url = URL.createObjectURL(v);
            msg.content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
            this.global.modulate_thumbnail(msg.content, url);
          });
        this.open_viewer(msg, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`);
      } else { // 가지고 있는 파일이 아닐 경우
        try { // 전송받는중이라면 무시
          if (this.nakama.channel_transfer[this.isOfficial][this.target]
            && this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id]
            && this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]) {
            if (this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id]['OnProgress']) {
              delete this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id];
              throw "Need to download file again";
            } else return;
          }
          else throw "Need to download file";
        } catch (e) { // 전송중이 아니라면 다운받기
          console.log(e);
          if (!this.isHistoryLoaded)
            this.nakama.ReadStorage_From_channel(msg, this.isOfficial, this.target, (resultModified) => {
              let url = URL.createObjectURL(resultModified);
              msg.content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
              this.global.modulate_thumbnail(msg.content, url);
            });
        }
      }
    });
  }

  /** 메시지 추가시마다 메시지 상태를 업데이트 (기존 html 연산) */
  modulate_chatmsg(i: number, j: number) {
    // 1회성 보여주기 양식 생성 (채팅방 전용 정보)
    if (!this.messages[i]['showInfo'])
      this.messages[i]['showInfo'] = {};
    // 날짜 표시
    this.messages[i]['showInfo']['date'] = Boolean(this.messages[i]['msgDate']);
    // 발신인과 시간 표시
    this.messages[i]['showInfo']['sender'] = !this.messages[i].content.noti && this.messages[i].user_display_name;
    // 이전 메시지와 정보를 비교하여 이전 메시지와 지금 메시지의 상태를 결정 (실시간 메시지 받기류)
    if (i - 1 >= 0) {
      this.messages[i]['showInfo']['date'] = Boolean(this.messages[i]['msgDate']) && (this.messages[i]['msgDate'] != this.messages[i - 1]['msgDate']);;
      this.messages[i]['showInfo']['sender'] = !this.messages[i].content.noti && this.messages[i].user_display_name && (this.messages[i - 1]['isLastRead'] || this.messages[i].sender_id != this.messages[i - 1].sender_id || this.messages[i - 1].content.noti || this.messages[i]['msgDate'] != this.messages[i - 1]['msgDate']);
    }
    // 다음 메시지와 정보를 비교하여 다음 메시지의 상태를 결정 (기록 불러오기류)
    if (i + 1 < j) {
      this.messages[i + 1]['showInfo']['date'] = Boolean(this.messages[i]['msgDate']) && (this.messages[i]['msgDate'] != this.messages[i + 1]['msgDate']);
      this.messages[i + 1]['showInfo']['sender'] = !this.messages[i + 1].content.noti && this.messages[i + 1].user_display_name && (this.messages[i]['isLastRead'] || this.messages[i].sender_id != this.messages[i + 1].sender_id || this.messages[i].content.noti || this.messages[i]['msgDate'] != this.messages[i + 1]['msgDate']);
    }
  }

  /** 파일이 포함된 메시지 구조화, 자동 썸네일 작업 */
  ModulateFileEmbedMessage(msg: any) {
    this.global.set_viewer_category(msg.content);
    this.indexed.checkIfFileExist(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`, (b) => {
      if (b) {
        msg.content['text'] = [this.lang.text['ChatRoom']['downloaded']];
        this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`,
          msg.content['type'],
          v => {
            let url = URL.createObjectURL(v);
            msg.content['path'] = `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
            this.global.modulate_thumbnail(msg.content, url);
          });
      }
    });
  }

  /** 콘텐츠 상세보기 뷰어 띄우기 */
  open_viewer(msg: any, path: string) {
    switch (msg.content['viewer']) {
      case 'godot':
        this.open_godot_viewer(msg, path);
        break;
      default:
        this.open_ionic_viewer(msg, path);
        break;
    }
  }

  lock_modal_open = false;
  open_ionic_viewer(msg: any, _path: string) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      this.modalCtrl.create({
        component: IonicViewerPage,
        componentProps: {
          info: msg.content,
          path: _path,
        },
      }).then(v => {
        v.onDidDismiss().then((v) => {
          if (v.data) { // 파일 편집하기를 누른 경우
            let related_creators: ContentCreatorInfo[] = [];
            if (msg.content['content_related_creator'])
              related_creators.push(...msg.content['content_related_creator']);
            if (msg.content['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
              let is_already_exist = false;
              for (let i = 0, j = related_creators.length; i < j; i++)
                if (related_creators[i].user_id == msg.content['content_creator']['user_id']) {
                  is_already_exist = true;
                  break;
                }
              if (!is_already_exist) related_creators.push(msg.content['content_creator']);
            }
            this.modalCtrl.create({
              component: VoidDrawPage,
              componentProps: {
                path: _path,
                width: v.data.width,
                height: v.data.height,
              },
            }).then(v => {
              v.onWillDismiss().then(v => {
                if (v.data) {
                  try {
                    this.userInput.file = {};
                    this.userInput.file.filename = v.data['name'];
                    this.userInput.file.file_ext = 'png';
                    this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
                    this.userInput.file.type = 'image/png';
                    this.userInput.file.typeheader = 'image';
                    if (v.data['is_modify']) {
                      this.userInput.file.content_related_creator = related_creators;
                      this.userInput.file.content_creator = {
                        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                        timestamp: new Date().toLocaleString(),
                        display_name: this.nakama.users.self['display_name'],
                      };
                    } else {
                      this.userInput.file.content_related_creator = [{
                        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                        timestamp: new Date().toLocaleString(),
                        display_name: this.nakama.users.self['display_name'],
                      }];
                      this.userInput.file.content_creator = {
                        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                        timestamp: new Date().toLocaleString(),
                        display_name: this.nakama.users.self['display_name'],
                      };
                    }
                    this.userInput.file.base64 = v.data['img'];
                    this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
                  } catch (e) {
                    console.error('이미지 편집 사용 불가: ', e);
                  }
                  v.data['loadingCtrl'].dismiss();
                }
              });
              v.present();
            });
            return;
          }
          this.noti.Current = this.info['cnoti_id'];
          if (this.info['cnoti_id'])
            this.noti.ClearNoti(this.info['cnoti_id']);
          this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
        });
        this.noti.Current = 'IonicViewerPage';
        v.present();
        this.lock_modal_open = false;
      });
    }
  }

  open_godot_viewer(msg: any, _path: string) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      this.modalCtrl.create({
        component: GodotViewerPage,
        componentProps: {
          info: msg.content,
          path: _path,
        },
      }).then(v => {
        v.onDidDismiss().then(async (v) => {
          if (v.data) { // 파일 편집하기를 누른 경우
            let related_creators: ContentCreatorInfo[] = [];
            if (msg.content['content_related_creator'])
              related_creators.push(...msg.content['content_related_creator']);
            if (msg.content['content_creator']) { // 마지막 제작자가 이미 작업 참여자로 표시되어 있다면 추가하지 않음
              let is_already_exist = false;
              for (let i = 0, j = related_creators.length; i < j; i++)
                if (related_creators[i].user_id == msg.content['content_creator']['user_id']) {
                  is_already_exist = true;
                  break;
                }
              if (!is_already_exist) related_creators.push(msg.content['content_creator']);
            }
            await this.indexed.saveBase64ToUserPath(v.data.base64, 'tmp_files/modify_image.png');
            this.modalCtrl.create({
              component: VoidDrawPage,
              componentProps: {
                path: 'tmp_files/modify_image.png',
                width: v.data.width,
                height: v.data.height,
              },
            }).then(v => {
              v.onWillDismiss().then(v => {
                if (v.data) {
                  try {
                    this.userInput.file = {};
                    this.userInput.file.filename = v.data['name'];
                    this.userInput.file.file_ext = 'png';
                    this.userInput.file.thumbnail = this.sanitizer.bypassSecurityTrustUrl(v.data['img']);
                    this.userInput.file.type = 'image/png';
                    this.userInput.file.typeheader = 'image';
                    if (v.data['is_modify']) {
                      this.userInput.file.content_related_creator = related_creators;
                      this.userInput.file.content_creator = {
                        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                        timestamp: new Date().toLocaleString(),
                        display_name: this.nakama.users.self['display_name'],
                      };
                    } else {
                      this.userInput.file.content_related_creator = [{
                        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                        timestamp: new Date().toLocaleString(),
                        display_name: this.nakama.users.self['display_name'],
                      }];
                      this.userInput.file.content_creator = {
                        user_id: this.nakama.servers[this.isOfficial][this.target].session.user_id,
                        timestamp: new Date().toLocaleString(),
                        display_name: this.nakama.users.self['display_name'],
                      };
                    }
                    this.userInput.file.base64 = v.data['img'];
                    this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.filename})`;
                  } catch (e) {
                    console.error('godot-이미지 편집 사용 불가: ', e);
                  }
                  v.data['loadingCtrl'].dismiss();
                }
              });
              v.present();
            });
          }
          this.noti.Current = this.info['cnoti_id'];
          if (this.info['cnoti_id'])
            this.noti.ClearNoti(this.info['cnoti_id']);
          this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
        });
        this.noti.Current = 'GodotViewerPage';
        v.present();
        this.lock_modal_open = false;
      });
    }
  }

  /** 사용자 정보보기 */
  user_detail(msg: ChannelMessage) {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      if (msg['is_me']) // 내 정보
        this.modalCtrl.create({
          component: ProfilePage,
        }).then(v => {
          v.onDidDismiss().then((_v) => {
            this.noti.Current = this.info['cnoti_id'];
            if (this.info['cnoti_id'])
              this.noti.ClearNoti(this.info['cnoti_id']);
            this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
          });
          this.noti.Current = 'ProfilePage';
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
  }

  ngOnDestroy(): void {
    this.nakama.ChatroomLinkAct = undefined;
  }
}
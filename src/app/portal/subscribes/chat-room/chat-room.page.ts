// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { Channel, ChannelMessage } from '@heroiclabs/nakama-js';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
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

interface FileInfo {
  id?: string;
  name?: string;
  type?: string;
  ext?: string;
  /** 전체 파일 크기 */
  size?: number;
  result?: string;
}

interface ExtendButtonForm {
  title: string;
  /** 버튼 숨기기 */
  isHide?: boolean;
  /** 아이콘 상대경로-이름, 크기: 64 x 64 px */
  icon?: string;
  /** 마우스 커서 스타일 */
  cursor?: string;
  act: Function;
}

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
})
export class ChatRoomPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    public nakama: NakamaService,
    private noti: LocalNotiService,
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private alertCtrl: AlertController,
    public lang: LanguageSettingService,
    private sanitizer: DomSanitizer,
  ) { }

  /** 채널 정보 */
  info: Channel;
  isOfficial: string;
  target: string;

  /** 마지막에 읽은 메시지를 찾았는지 */
  foundLastRead = false;
  messages = [];
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [{
    title: this.lang.text['ChatRoom']['remove_chatroom'],
    isHide: true,
    icon: 'close-circle',
    act: () => {
      delete this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']];
      if (this.nakama.channel_transfer[this.isOfficial][this.target] && this.nakama.channel_transfer[this.isOfficial][this.target][this.info.id])
        delete this.nakama.channel_transfer[this.isOfficial][this.target][this.info.id];
      this.indexed.GetFileListFromDB(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}`, (list) => {
        list.forEach(path => this.indexed.removeFileFromUserPath(path));
      });
      this.modalCtrl.dismiss();
    }
  },
  {
    title: this.lang.text['ChatRoom']['leave_chatroom'],
    icon: 'log-out',
    act: async () => {
      if (this.info['redirect']['type'] != 3) {
        await this.nakama.servers[this.isOfficial][this.target].socket.leaveChat(this.info['id']);
        this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['status'] = 'missing';
        this.extended_buttons.forEach(button => {
          button.isHide = true;
        });
        this.extended_buttons[0].isHide = false;
      } else {
        this.p5toast.show({
          text: this.lang.text['ChatRoom']['belonging_to_group'],
        });
        return;
      }
    }
  },
  {
    title: this.lang.text['ChatRoom']['attach_file'],
    icon: 'attach',
    act: () => {
      document.getElementById('file_sel').click();
    }
  },
  ];

  /** 파일 첨부하기 */
  inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      this.userInput['file'] = {};
      this.userInput.file['name'] = ev.target.files[0].name;
      this.userInput.file['ext'] = ev.target.files[0].name.split('.')[1] || ev.target.files[0].type || this.lang.text['ChatRoom']['unknown_ext'];
      this.userInput.file['size'] = ev.target.files[0].size;
      this.userInput.file['type'] = ev.target.files[0].type;
      let updater = setInterval(() => { }, 110);
      setTimeout(() => {
        clearInterval(updater);
      }, 1500);
      let reader: any = new FileReader();
      reader = reader._realReader ?? reader;
      reader.onload = (ev: any) => {
        this.userInput.file['result'] = ev.target.result.replace(/"|\\|=/g, '');
        this.inputPlaceholder = `(${this.lang.text['ChatRoom']['attachments']}: ${this.userInput.file.name})`;
      }
      reader.readAsDataURL(ev.target.files[0]);
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

  ngOnInit() {
    this.nakama.removeBanner();
    this.info = this.navParams.get('info');
    this.noti.Current = this.info['cnoti_id'];
    if (this.info['cnoti_id'])
      this.noti.ClearNoti(this.info['cnoti_id']);
    this.noti.RemoveListener(`openchat${this.info['cnoti_id']}`);
    this.isOfficial = this.info['server']['isOfficial'];
    this.target = this.info['server']['target'];
    this.foundLastRead = this.info['last_read_id'] == this.info['last_comment_id'];
    switch (this.info['redirect']['type']) {
      case 2: // 1:1 대화라면
        if (this.info['status'] != 'missing') {
          if (!this.info['redirect']) // 채널 최초 생성 오류 방지용
            this.info['status'] = this.info['info']['online'] ? 'online' : 'pending';
          else if (this.statusBar.groupServer[this.isOfficial][this.target] == 'online')
            this.info['status'] = this.nakama.load_other_user(this.info['redirect']['id'], this.isOfficial, this.target)['online'] ? 'online' : 'pending';
        }
        break;
      case 3: // 그룹 대화라면
        break;
      default:
        break;
    }
    this.content_panel = document.getElementById('content');
    // 실시간 채팅을 받는 경우 행동처리
    if (this.nakama.channels_orig[this.isOfficial][this.target] &&
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']])
      this.nakama.channels_orig[this.isOfficial][this.target][this.info['id']]['update'] = (c: any) => {
        this.content_panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.nakama.check_sender_and_show_name(c, this.isOfficial, this.target);
        if (c.content['filename']) this.ModulateFileEmbedMessage(c);
        this.info['last_read_id'] = this.info['last_comment_id'];
        this.messages.push(c);
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
    }
    // 마지막 대화 기록을 받아온다
    this.pull_msg_history();
    setTimeout(() => {
      this.content_panel.scrollIntoView({ block: 'start' });
    }, 500);
  }

  ionViewWillEnter() {
    this.follow_resize();
  }

  p5canvas: p5;
  /** 창 조절에 따른 최대 화면 크기 조정 */
  follow_resize() {
    setTimeout(() => {
      let sketch = (p: p5) => {
        let mainTable = document.getElementById('main_table');
        let mainDiv = document.getElementById('main_div');
        let inputTable = document.getElementById('input_table');
        let ext_menu = document.getElementById('ext_menu');
        p.setup = () => {
          setTimeout(() => {
            p.windowResized();
          }, 100);
          p.noLoop();
        }
        p.windowResized = () => {
          setTimeout(() => {
            mainDiv.setAttribute('style', `max-width: ${mainTable.parentElement.offsetWidth}px; max-height: ${mainTable.parentElement.clientHeight - inputTable.offsetHeight - ext_menu.offsetHeight}px`);
          }, 0);
        }
      }
      this.p5canvas = new p5(sketch);
    }, 50);
  }

  /** 사용자 입력 */
  userInput = {
    file: undefined as FileInfo,
    text: '',
  }
  inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];

  /** 자동 열람 파일 크기 제한 */
  FILESIZE_LIMIT = 5000000;
  pullable = true;
  /** 서버로부터 메시지 더 받아오기
   * @param isHistory 옛날 정보 불러오기 유무, false면 최신정보 불러오기 진행
   */
  pull_msg_history(isHistory = true) {
    if (!this.pullable) return;
    this.pullable = false;
    if (isHistory) {
      if ((this.info['status'] == 'online' || this.info['status'] == 'pending')) // 온라인 기반 리스트 받아오기
        this.nakama.servers[this.isOfficial][this.target].client.listChannelMessages(
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
              this.messages.unshift(msg);
              this.modulate_chatmsg(0, this.messages.length);
            });
            this.next_cursor = v.next_cursor;
            this.prev_cursor = v.prev_cursor;
            this.pullable = true;
            if (!this.foundLastRead) this.pull_msg_history();
            this.nakama.saveListedMessage(this.messages, this.info, this.isOfficial, this.target);
          });
      else { // 오프라인 기반 리스트 알려주기
        if (this.info['redirect']['type'] == 3) // 그룹대화라면 공개여부 검토
          if (!this.nakama.groups[this.isOfficial][this.target][this.info['group_id']]['open']) {
            let tmp = [{
              content: {
                msg: this.lang.text['ChatRoom']['closed_group_must_online'],
              }
            }, {
              content: {
                msg: this.lang.text['ChatRoom']['closed_group_not_allow'],
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
    setTimeout(() => {
      this.p5canvas.windowResized();
      setTimeout(() => {
        this.content_panel.scrollIntoView({ block: 'start' });
      }, 0);
    }, 120);
  }

  send() {
    if (!this.userInput.text && !this.userInput['file']) return;
    let result = {};
    result['msg'] = this.userInput.text;
    let upload: string[] = [];
    if (this.userInput.file) { // 파일 첨부시
      result['filename'] = this.userInput.file.name;
      result['filesize'] = this.userInput.file.size;
      result['file_ext'] = this.userInput.file.ext;
      result['type'] = this.userInput.file.type;
      result['msg'] = result['msg'];
      const SIZE_LIMIT = 240000;
      let seek = 0;
      const RESULT_LIMIT = this.userInput.file.result.length;
      while (seek < RESULT_LIMIT) {
        let next = seek + SIZE_LIMIT;
        if (next > RESULT_LIMIT)
          next = RESULT_LIMIT;
        upload.push(this.userInput.file.result.substring(seek, next));
        seek = next;
      }
      result['partsize'] = upload.length;
    }
    this.nakama.servers[this.isOfficial][this.target].socket
      .writeChatMessage(this.info['id'], result).then(v => {
        /** 업로드가 진행중인 메시지 개체 */
        if (upload.length) { // 첨부 파일이 포함된 경우
          // 로컬에 파일을 저장
          this.indexed.saveFileToUserPath(this.userInput.file.result, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${v.message_id}.${this.userInput.file.ext}`);
          // 서버에 파일을 업로드
          this.nakama.WriteStorage_From_channel(v, upload, this.isOfficial, this.target);
        }
        delete this.userInput.file;
        this.userInput.text = '';
        this.inputPlaceholder = this.lang.text['ChatRoom']['input_placeholder'];
      });
  }

  /** 메시지 정보 상세 */
  message_detail(msg: any) {
    console.log('긴 클릭시 행동.. 메시지 상세 정보 표시: ', msg);
  }

  /** 메시지 내 파일 정보, 파일 다운받기 */
  file_detail(msg: any) {
    this.indexed.checkIfFileExist(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`, (v) => {
      if (v) { // 파일이 존재하는 경우
        if (!msg.content['text'])
          msg.content['text'] = this.lang.text['ChatRoom']['downloaded'];
        this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`,
          msg.content['type'],
          v => {
            let url = URL.createObjectURL(v);
            this.modulate_thumbnail(msg, url);
          });
        this.open_viewer(msg, `servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`);
      } else { // 가지고 있는 파일이 아닐 경우
        try { // 전송중이라면 무시
          if (this.nakama.channel_transfer[this.isOfficial][this.target][msg.channel_id][msg.message_id])
            return;
          else throw new Error("Need to download file");
        } catch (_e) { // 전송중이 아니라면 다운받기
          if (isPlatform == 'DesktopPWA') {
            if (!this.isHistoryLoaded)
              this.nakama.ReadStorage_From_channel(msg, this.isOfficial, this.target, (resultModified) => {
                let url = URL.createObjectURL(resultModified);
                this.modulate_thumbnail(msg, url);
              });
          } else if (isPlatform != 'MobilePWA') {
            if (msg.content['viewer'] == 'disabled') {
              if (!this.isHistoryLoaded)
                this.alertCtrl.create({
                  header: this.lang.text['ChatRoom']['cannot_open_from_mobile'],
                  message: this.lang.text['ChatRoom']['cannot_open_with_viewer'],
                  buttons: [{
                    text: this.lang.text['ChatRoom']['download_anyway'],
                    handler: () => {
                      this.nakama.ReadStorage_From_channel(msg, this.isOfficial, this.target, (resultModified) => {
                        let url = URL.createObjectURL(resultModified);
                        this.modulate_thumbnail(msg, url);
                      });
                    }
                  }]
                }).then(v => v.present());
            } else {
              if (!this.isHistoryLoaded)
                this.nakama.ReadStorage_From_channel(msg, this.isOfficial, this.target, (resultModified) => {
                  let url = URL.createObjectURL(resultModified);
                  this.modulate_thumbnail(msg, url);
                });
            }
          }
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
    let NeedShowMsgDate = Boolean(this.messages[i]['msgDate']);
    this.messages[i]['showInfo']['date'] = NeedShowMsgDate;
    // 발신인과 시간 표시
    let NeedShowSender = !this.messages[i].content.noti && this.messages[i].user_display_name;
    this.messages[i]['showInfo']['sender'] = NeedShowSender;
    // 이전 메시지와 정보를 비교하여 이전 메시지의 상태를 결정
    if (i - 1 >= 0) {
      NeedShowMsgDate = NeedShowMsgDate && (!this.messages[i - 1] || this.messages[i]['msgDate'] != this.messages[i - 1]['msgDate']);
      NeedShowSender = NeedShowSender && (!this.messages[i - 1] || this.messages[i - 1]['isLastRead'] || this.messages[i].sender_id != this.messages[i - 1].sender_id || this.messages[i - 1].content.noti || this.messages[i]['msgDate'] != this.messages[i - 1]['msgDate'])
    }
    // 다음 메시지와 정보를 비교하여 다음 메시지의 상태를 결정
    if (i + 1 < j) {
      this.messages[i + 1]['showInfo']['date'] = this.messages[i]['msgDate'] != this.messages[i + 1]['msgDate'];
      this.messages[i + 1]['showInfo']['sender'] = this.messages[i].sender_id != this.messages[i + 1].sender_id;
    }
  }

  /** 메시지에 썸네일 콘텐츠를 생성 */
  modulate_thumbnail(msg: any, ObjectURL: string) {
    switch (msg.content['viewer']) {
      case 'image':
        if (msg.content['img']) return; // 이미 썸네일이 있다면 제외
        if (msg.content['file_ext'].toLowerCase() == 'gif') {
          msg.content['img'] = this.sanitizer.bypassSecurityTrustUrl(ObjectURL);
          setTimeout(() => {
            URL.revokeObjectURL(ObjectURL);
          }, 0);
        } else { // 멈춘 이미지 (gif 외)
          new p5((p: p5) => {
            p.setup = () => {
              p.smooth();
              p.loadImage(ObjectURL, v => {
                const SIDE_LIMIT = 192;
                if (v.width > v.height) {
                  if (v.width > SIDE_LIMIT)
                    v.resize(SIDE_LIMIT, v.height / v.width * SIDE_LIMIT);
                } else if (v.height > SIDE_LIMIT)
                  v.resize(v.width / v.height * SIDE_LIMIT, SIDE_LIMIT);
                msg.content['img'] = v['canvas'].toDataURL();
                URL.revokeObjectURL(ObjectURL);
                p.remove();
              }, e => {
                console.error('이미지 불러오기 실패: ', e);
                URL.revokeObjectURL(ObjectURL);
                p.remove();
              });
            }
          });
        }
        break;
      case 'text':
        new p5((p: p5) => {
          p.setup = () => {
            p.loadStrings(ObjectURL, v => {
              msg.content['text'] = v.join('\n');
              URL.revokeObjectURL(ObjectURL);
              p.remove();
            }, e => {
              console.error('텍스트 열람 불가: ', e);
              URL.revokeObjectURL(ObjectURL);
              p.remove();
            });
          }
        });
        break;
      default:
        console.error('예상하지 못한 카테고리-viewer분류: ', msg);
        URL.revokeObjectURL(ObjectURL);
        break;
    }
  }

  /** 콘텐츠 카테고리 분류 */
  set_viewer_category(msg: any) {
    try { // 자동지정 타입이 있는 경우
      if (msg.content['type'].indexOf('image/') == 0) // 분류상 이미지
        msg.content['viewer'] = 'image';
      else if (msg.content['type'].indexOf('audio/') == 0) // 분류상 소리
        msg.content['viewer'] = 'audio';
      else if (msg.content['type'].indexOf('video/') == 0) // 분류상 비디오
        msg.content['viewer'] = 'video';
      else if (msg.content['type'].indexOf('text/') == 0) // 분류상 텍스트 문서
        msg.content['viewer'] = 'text';
      else throw new Error("자동지정되지 않은 타입");
    } catch (error) { // 자동지정 타입이 없는 경우
      switch (msg.content['file_ext']) {
        // 모델링류
        // case 'obj':
        // case 'stl':
        // case 'glb':
        // case 'gltf':
        // 고도엔진 패키지 파일
        case 'pck':
          msg.content['viewer'] = 'godot';
          break;
        // 이미지류
        case 'png':
        case 'jpeg':
        case 'jpg':
        case 'webp':
        case 'gif':
          msg.content['viewer'] = 'image';
          break;
        // 사운드류
        case 'wav':
        case 'ogg':
        case 'mp3':
          msg.content['viewer'] = 'audio';
          break;
        // 비디오류
        case 'mp4':
        case 'ogv':
        case 'webm':
          msg.content['viewer'] = 'video';
          break;
        // 텍스트류
        case 'txt':
        case 'cs':
        case 'gd':
        case 'py':
        case 'yml':
        case 'gitignore':
        case 'md':
        case 'json':
        case 'csv':
        case 'ts':
        case 'js':
        case 'shader':
          msg.content['viewer'] = 'text';
          break;
        default: // 뷰어 제한 파일
          msg.content['viewer'] = 'disabled';
          break;
      }
    }
  }

  /** 파일이 포함된 메시지 구조화, 자동 썸네일 작업 */
  ModulateFileEmbedMessage(msg: any) {
    this.set_viewer_category(msg);
    this.indexed.checkIfFileExist(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`, (b) => {
      if (b) {
        msg.content['text'] = this.lang.text['ChatRoom']['downloaded'];
        if (msg.content['filesize'] < this.FILESIZE_LIMIT) // 너무 크지 않은 파일에 대해서만 자동 썸네일 구성
          this.indexed.loadBlobFromUserPath(`servers/${this.isOfficial}/${this.target}/channels/${this.info.id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`,
            msg.content['type'],
            v => {
              let url = URL.createObjectURL(v);
              this.modulate_thumbnail(msg, url);
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
      case 'disabled':
        this.alert_download(msg, path);
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
        v.onDidDismiss().then((_v) => {
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
        v.onDidDismiss().then((_v) => {
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

  /** 열람 불가 파일 다운로드로 유도 */
  alert_download(msg: any, path: string) {
    if (isPlatform == 'DesktopPWA')
      this.alertCtrl.create({
        header: this.lang.text['ChatRoom']['viewer_not_support'],
        message: this.lang.text['ChatRoom']['cannot_open_file'],
        buttons: [{
          text: this.lang.text['ChatRoom']['export_download'],
          handler: () => {
            this.indexed.DownloadFileFromUserPath(path, msg.content['type'], msg.content['filename']);
          }
        }]
      }).then(v => v.present());
    else this.p5toast.show({
      text: this.lang.text['ChatRoom']['cannot_open_file'],
    });
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
    this.p5canvas.remove();
  }
}
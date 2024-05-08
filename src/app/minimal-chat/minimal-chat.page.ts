// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { ILocalNotificationAction, ILocalNotificationActionType } from '@awesome-cordova-plugins/local-notifications/ngx';
import { IonInput, ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';
import { StatusManageService } from '../status-manage.service';
import { LanguageSettingService } from '../language-setting.service';
import { LocalGroupServerService } from '../local-group-server.service';
import { isPlatform } from '../app.component';
import { FILE_BINARY_LIMIT, FileInfo, GlobalActService, isDarkMode } from '../global-act.service';
import clipboard from 'clipboardy';
import { P5ToastService } from '../p5-toast.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IndexedDBService } from '../indexed-db.service';
import { IonicViewerPage } from '../portal/subscribes/chat-room/ionic-viewer/ionic-viewer.page';

/** MiniRanchat 에 있던 기능 이주, 대화창 구성 */
@Component({
  selector: 'app-minimal-chat',
  templateUrl: './minimal-chat.page.html',
  styleUrls: ['./minimal-chat.page.scss'],
})
export class MinimalChatPage implements OnInit {

  constructor(
    public client: MiniranchatClientService,
    public modalCtrl: ModalController,
    private device: Device,
    private noti: LocalNotiService,
    private title: Title,
    private params: NavParams,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private local_server: LocalGroupServerService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
  ) { }

  uuid = this.device.uuid;
  header_title: string;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'ranchat';
  iconColor = 'd8d8d8';
  lnId = 11;
  /** 새 대화 버튼 disabled 토글 */
  req_refreshed = false;
  minimal_chat_log: HTMLElement;
  /** 그룹사설서버 여부 */
  isCustomDedicated = false;
  isLocalAddress = false;
  SelectedAddress = '';
  addresses: any[];
  isMobileApp = false;
  QRCodeSRC: any;
  /** 내 사용자 이름 */
  MyUserName: string;

  reply_act: ILocalNotificationAction[];

  /** 이 창 열기(알림 상호작용) */
  open_this = (ev: any) => {
    // 알림 아이디가 같으면 진입 허용
    if (ev['id'] == this.lnId) {
      this.modalCtrl.create({
        component: MinimalChatPage,
        componentProps: {
          address: this.params.get('address'),
          name: this.params.get('name'),
        },
      }).then(v => v.present());
    }
  }

  /** 주인장이 공유할 IP주소를 선택합니다  
   * 자체 서버가 있다면 그 주소를, 아니라면 비보안 주소를 생성합니다
   */
  async SelectOtherAddress(ev: any) {
    let address_text: string = ev.detail.value;
    let extract = address_text.substring(address_text.indexOf('(') + 1, address_text.indexOf(')'));
    try { // 사용자 지정 서버 업로드 시도 우선
      let HasLocalPage = `${location.protocol}//${extract}:8080`;
      const cont = new AbortController();
      const id = setTimeout(() => {
        cont.abort();
      }, 500);
      let res = await fetch(HasLocalPage, { signal: cont.signal });
      clearTimeout(id);
      if (res.ok) this.SelectedAddress = `${location.protocol}//${extract}:8080/www/?group_dedi=${extract}`;
    } catch (e) {
      this.SelectedAddress = `http://pjcone.ddns.net/?group_dedi=${extract}`;
    }
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
  }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.replaceState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.modalCtrl.dismiss();
    };
  }

  async open_url_link(url: string) {
    // 근데 주소가 메인 주소라면 QR행동으로 처리하기
    if (url.indexOf('https://is2you2.github.io/pjcone_pwa/?') == 0 || url.indexOf('http://pjcone.ddns.net/?') == 0) {
      let init = this.global.CatchGETs(url) || {};
      this.global.initialize();
      try {
        await this.global.AddressToQRCodeAct(init);
      } catch (e) {
        this.p5toast.show({
          text: `${this.lang.text['ChatRoom']['QRLinkFailed']}: ${e}`,
        });
      }
    } else window.open(url, '_system')
  }

  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.isMobileApp = isPlatform == 'Android' || isPlatform == 'iOS';
    this.local_server.funcs.onCheck = (v: any) => {
      let keys = Object.keys(v);
      let results: any[] = [];
      keys.forEach(key => {
        if (v[key]['ipv4Addresses'].length)
          v[key]['ipv4Addresses'].forEach((_address: any) => {
            results.push({
              address: _address,
              key: key,
            });
          });
        this.addresses = results;
      });
    }
    if (this.client.p5canvas) this.client.p5canvas.remove();
    this.local_server.check_addresses();
    this.header_title = this.lang.text['MinimalChat']['header_title_ranchat'];
    let get_address = this.params.get('address');
    this.MyUserName = this.params.get('name');
    if (get_address) {
      this.lnId = 12;
      this.header_title = this.lang.text['MinimalChat']['header_title_group'];
      this.client.status['dedicated_groupchat'] = 'custom';
      this.Header = 'simplechat';
      this.isCustomDedicated = true;
      this.isLocalAddress = get_address == 'ws://127.0.0.1';
      // 서버 주인 외의 사람이 진입한 경우 공유를 용이하게 QRCode를 즉시 게시
      if (!this.isLocalAddress) {
        this.SelectedAddress = `${location.protocol}//${location.host}${window['sub_path']}?group_dedi=${get_address.split('ws://').pop()}`;
        this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
      }
    }
    this.noti.RemoveListener(`send${'dedicated_groupchat'}`);
    this.noti.RemoveListener(`reconn${'dedicated_groupchat'}`);
    this.noti.RemoveListener(`exit${'dedicated_groupchat'}`);
    this.noti.ClearNoti(this.lnId);
    this.title.setTitle(this.lang.text['MinimalChat']['WebTitle_group']);
    this.noti.Current = this.Header;
    this.minimal_chat_log = document.getElementById('minimal_chat_div');
    this.minimal_chat_log.onscroll = (_ev: any) => {
      if (this.minimal_chat_log.scrollHeight == this.minimal_chat_log.scrollTop + this.minimal_chat_log.clientHeight)
        this.scroll_down();
    }
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/simplechat.png`);

    if (!this.client.client['dedicated_groupchat'] || this.client.client['dedicated_groupchat'].readyState != this.client.client['dedicated_groupchat'].OPEN
      && !(this.client.p5canvas && this.client.p5canvas['OnDediMessage'])) {
      this.noti.SetListener(`send${'dedicated_groupchat'}`, (v: any, eopts: any) => {
        this.noti.ClearNoti(v['id']);
        this.send(eopts['text']);
      });
      this.noti.SetListener(`reconn${'dedicated_groupchat'}`, (v: any) => {
        this.noti.ClearNoti(v['id']);
      });
      this.noti.SetListener(`exit${'dedicated_groupchat'}`, (v: any) => {
        this.noti.ClearNoti(v['id']);
        this.quit_chat();
      });
      this.reply_act = [{
        id: `send${'dedicated_groupchat'}`,
        type: ILocalNotificationActionType.INPUT,
        title: this.lang.text['MinimalChat']['Noti_Reply'],
      }];
      this.client.userInput['dedicated_groupchat'].logs.length = 0;
      let joinMessage = { color: isDarkMode ? 'bbb' : '444', text: this.lang.text['MinimalChat']['joinChat_group'] };
      this.client.userInput['dedicated_groupchat'].logs.push(joinMessage);
      this.client.userInput['dedicated_groupchat'].last_message = joinMessage;
      this.client.initialize('dedicated_groupchat', get_address);
    }
    this.client.funcs['dedicated_groupchat'].onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        let isMe = this.uuid == data['uid'];
        let target = isMe ? (this.MyUserName || this.lang.text['MinimalChat']['name_me']) : (data['name'] || this.lang.text['MinimalChat']['name_stranger_group']);
        let color = data['uid'] ? (data['uid'].replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6) : isDarkMode ? '888888' : '444444';
        if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage'](color);
        if (data['msg']) { // 채널 메시지
          let sep: string[] = data['msg'].split(' ');
          let msg_arr = [];
          for (let i = 0, j = sep.length; i < j; i++) {
            if (sep[i].indexOf('http://') == 0 || sep[i].indexOf('https://') == 0) {
              msg_arr.push({ text: ' ' });
              msg_arr.push({ href: true, text: sep[i] });
            } else msg_arr.push({ text: ' ' + sep[i] });
          }
          let getMessage = { color: color, text: msg_arr, target: target };
          this.client.userInput['dedicated_groupchat'].logs.push(getMessage);
          this.client.userInput['dedicated_groupchat'].last_message = getMessage;
        } else if (data['type']) {
          switch (data['type']) {
            case 'join': // 사용자 진입
              let UserJoin = { color: color, text: [{ text: ' ' + this.lang.text['MinimalChat']['user_join_comment'] }], target: target };
              this.client.userInput['dedicated_groupchat'].logs.push(UserJoin);
              this.client.userInput['dedicated_groupchat'].last_message = UserJoin;
              break;
            case 'leave': // 사용자 퇴장
              let UserLeave = { color: color, text: [{ text: ' ' + this.lang.text['MinimalChat']['user_out_comment'] }], target: target };
              this.client.userInput['dedicated_groupchat'].logs.push(UserLeave);
              this.client.userInput['dedicated_groupchat'].last_message = UserLeave;
              break;
            case 'file': // 파일 정보 전송 (url)
              let FileAttach = { color: color, file: data, target: target };
              this.client.userInput['dedicated_groupchat'].logs.push(FileAttach);
              this.client.userInput['dedicated_groupchat'].last_message = FileAttach;
              if (!data.info.url) { // 분할 파일인 경우 누적 준비하기
                let FileInfo: FileInfo = data.info;
                this.indexed.checkIfFileExist(FileInfo.path, b => {
                  if (!b) {
                    if (!this.client.DownloadPartManager[data.uid])
                      this.client.DownloadPartManager[data.uid] = {};
                    if (!this.client.DownloadPartManager[data.uid][data.temp_id])
                      this.client.DownloadPartManager[data.uid][data.temp_id] = FileAttach;
                    FileAttach['Progress'] = FileInfo.partsize;
                  }
                });
              }
              break;
            case 'part': // 분할 파일 정보 수신
              this.indexed.checkIfFileExist(data.path, b => {
                if (!b) { // 파일이 없다면 파트파일 받기
                  try {
                    this.client.DownloadPartManager[data.uid][data.temp_id]['Progress']--;
                  } catch (e) { }
                  this.indexed.saveBase64ToUserPath(',' + data.part, `${data.path}_${data.index}`);
                }
              });
              return; // 알림 생성하지 않음
            case 'EOF': // 파일 수신 마무리하기
              this.indexed.checkIfFileExist(data.path, b => {
                if (!b) { // 파일이 없다면 파트를 모아서 파일 만들기
                  new Promise(async (done, err) => {
                    let GatheringInt8Array = [];
                    let ByteSize = 0;
                    for (let i = 0, j = data.partsize; i < j; i++) {
                      try {
                        let part = await this.indexed.GetFileInfoFromDB(`${data.path}_${i}`);
                        ByteSize += part.contents.length;
                        GatheringInt8Array[i] = part;
                      } catch (e) {
                        console.log('파일 병합하기 오류: ', e);
                        break;
                      }
                    }
                    try {
                      let SaveForm: Int8Array = new Int8Array(ByteSize);
                      let offset = 0;
                      for (let i = 0, j = GatheringInt8Array.length; i < j; i++) {
                        SaveForm.set(GatheringInt8Array[i].contents, offset);
                        offset += GatheringInt8Array[i].contents.length;
                      }
                      await this.indexed.saveInt8ArrayToUserPath(SaveForm, data.path);
                      for (let i = 0, j = data['partsize']; i < j; i++)
                        this.indexed.removeFileFromUserPath(`${data.path}_${i}`)
                      await this.indexed.removeFileFromUserPath(`${data.path}.history`)
                    } catch (e) {
                      console.log('파일 최종 저장하기 오류: ', e);
                      err();
                    }
                    done(undefined);
                  });
                  delete this.client.DownloadPartManager[data.uid][data.temp_id]['Progress'];
                  delete this.client.DownloadPartManager[data.uid][data.temp_id];
                }
              });
              return; // 알림 생성하지 않음
          }
        }
        let alert_this: any = 'certified';
        if (data['count']) this.client.ConnectedNow['dedicated_groupchat'] = data['count'];
        if (data['msg'])
          this.noti.PushLocal({
            id: this.lnId,
            title: target,
            body: data['msg'],
            group_ln: 'simplechat',
            extra_ln: {
              page: {
                component: 'MinimalChatPage',
                componentProps: {
                  address: this.params.get('address'),
                  name: this.params.get('name'),
                  noti_id: this.Header,
                },
              },
            },
            smallIcon_ln: 'simplechat',
            iconColor_ln: this.iconColor,
            autoCancel_ln: true,
            // actions_ln: this.reply_act,
          }, this.Header, this.open_this);
        else if (data['type']) {
          let isJoin = data['type'] == 'join';
          if (!isJoin) alert_this = 'pending';
          this.noti.PushLocal({
            id: this.lnId,
            title: isJoin ? this.lang.text['MinimalChat']['user_join'] : this.lang.text['MinimalChat']['user_out'],
            body: target + ` | ${isJoin ? this.lang.text['MinimalChat']['user_join_comment'] : this.lang.text['MinimalChat']['user_out_comment']}`,
            group_ln: 'simplechat',
            extra_ln: {
              page: {
                component: 'MinimalChatPage',
                componentProps: {
                  address: this.params.get('address'),
                  name: this.params.get('name'),
                  noti_id: this.Header,
                },
              },
            },
            smallIcon_ln: 'simplechat',
            iconColor_ln: this.iconColor,
            autoCancel_ln: true,
          }, this.Header, this.open_this);
        }
        this.statusBar.settings['dedicated_groupchat'] = alert_this;
        setTimeout(() => {
          if (this.statusBar.settings['dedicated_groupchat'] == alert_this)
            this.statusBar.settings['dedicated_groupchat'] = 'online';
        }, 250);
      } catch (e) {
        switch (v) {
          case 'GOT_MATCHED':
            this.statusBar.settings['dedicated_groupchat'] = 'certified';
            setTimeout(() => {
              if (this.statusBar.settings['dedicated_groupchat'] == 'certified')
                this.statusBar.settings['dedicated_groupchat'] = 'online';
            }, 250);
            this.client.userInput['dedicated_groupchat'].logs.length = 0;
            let GotMatched = { color: isDarkMode ? '8bb' : '488', text: this.lang.text['MinimalChat']['meet_someone'] };
            this.client.userInput['dedicated_groupchat'].logs.push(GotMatched);
            this.client.userInput['dedicated_groupchat'].last_message = GotMatched;
            this.noti.PushLocal({
              id: this.lnId,
              title: this.lang.text['MinimalChat']['meet_someone'],
              group_ln: 'simplechat',
              // actions_ln: [{
              //   id: `send${'dedicated_groupchat'}`,
              //   type: ILocalNotificationActionType.INPUT,
              //   title: this.lang.text['MinimalChat']['Noti_Greeting']
              // }],
              extra_ln: {
                page: {
                  component: 'MinimalChatPage',
                  componentProps: {
                    address: this.params.get('address'),
                    name: this.params.get('name'),
                    noti_id: this.Header,
                  },
                },
              },
              autoCancel_ln: true,
              smallIcon_ln: 'simplechat',
              iconColor_ln: this.iconColor,
            }, this.Header, this.open_this);
            break;
          case 'PARTNER_OUT':
            this.statusBar.settings['dedicated_groupchat'] = 'pending';
            setTimeout(() => {
              if (this.statusBar.settings['dedicated_groupchat'] == 'pending')
                this.statusBar.settings['dedicated_groupchat'] = 'online';
            }, 250);
            let UserLeave = { color: isDarkMode ? 'b88' : '844', text: this.lang.text['MinimalChat']['leave_someone'] };
            this.client.userInput['dedicated_groupchat'].logs.push(UserLeave);
            this.client.userInput['dedicated_groupchat'].last_message = UserLeave;
            this.noti.PushLocal({
              id: this.lnId,
              title: this.lang.text['MinimalChat']['leave_someone'],
              group_ln: 'simplechat',
              extra_ln: {
                page: {
                  component: 'MinimalChatPage',
                  componentProps: {
                    address: this.params.get('address'),
                    name: this.params.get('name'),
                    noti_id: this.Header,
                  },
                },
              },
              autoCancel_ln: true,
              smallIcon_ln: 'simplechat',
              iconColor_ln: this.iconColor,
            }, this.Header, this.open_this);
            break;
          default:
            let sep = v.split(':');
            this.client.ConnectedNow['dedicated_groupchat'] = parseInt(sep[1]);
            break;
        }
      }
      this.auto_scroll_down();
    }
    this.client.funcs['dedicated_groupchat'].onclose = (_v: any) => {
      this.statusBar.settings['dedicated_groupchat'] = 'missing';
      setTimeout(() => {
        this.statusBar.settings['dedicated_groupchat'] = 'offline';
      }, 1500);
      let failedJoin = { color: 'faa', text: this.lang.text['MinimalChat']['failed_to_join'] };
      this.client.userInput['dedicated_groupchat'].logs.push(failedJoin);
      this.client.userInput['dedicated_groupchat'].last_message = failedJoin;
      this.noti.PushLocal({
        id: this.lnId,
        title: this.lang.text['MinimalChat']['failed_to_join'],
        group_ln: 'simplechat',
        extra_ln: {
          page: {
            component: 'MinimalChatPage',
            componentProps: {
              address: this.params.get('address'),
              name: this.params.get('name'),
              noti_id: this.Header,
            },
          },
        },
        // actions_ln: [{
        //   id: `exit${'dedicated_groupchat'}`,
        //   title: this.lang.text['MinimalChat']['exit_chat'],
        //   launch: false,
        // }],
        autoCancel_ln: true,
        smallIcon_ln: 'simplechat',
        iconColor_ln: this.iconColor,
      }, this.Header, this.open_this);
      if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage']('ff0000');
    }
    this.client.funcs['dedicated_groupchat'].onopen = (_v: any) => {
      this.statusBar.settings['dedicated_groupchat'] = 'online';
      if (get_address) {
        let count = {
          uid: this.uuid,
          name: this.MyUserName,
          type: 'join',
        }
        this.client.send('dedicated_groupchat', JSON.stringify(count));
      }
      this.client.funcs['dedicated_groupchat'].onclose = (_v: any) => {
        this.statusBar.settings['dedicated_groupchat'] = 'missing';
        setTimeout(() => {
          this.statusBar.settings['dedicated_groupchat'] = 'offline';
        }, 1500);
        let text = this.lang.text['MinimalChat']['cannot_join'];
        let GotMessage = { color: 'faa', text: text };
        this.client.userInput['dedicated_groupchat'].logs.push(GotMessage);
        this.client.userInput['dedicated_groupchat'].last_message = GotMessage;
        this.noti.PushLocal({
          id: this.lnId,
          title: text,
          group_ln: 'simplechat',
          extra_ln: {
            page: {
              component: 'MinimalChatPage',
              componentProps: {
                address: this.params.get('address'),
                name: this.params.get('name'),
                noti_id: this.Header,
              },
            },
          },
          // actions_ln: [{
          //   id: `exit${'dedicated_groupchat'}`,
          //   title: this.lang.text['MinimalChat']['exit_chat'],
          //   launch: false,
          // }],
          autoCancel_ln: true,
          smallIcon_ln: 'simplechat',
          iconColor_ln: this.iconColor,
        }, this.Header, this.open_this);
        if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage']('ff0000');
      }
    }
  }

  /** 파일 첨부 버튼 클릭시 */
  SelectAttach() {
    document.getElementById('minimal_chat_file').click();
  }
  /** 파일 보내기 / 즉시 발송됨  
   * 파일 쪼개기 후 순차적으로 보냄
   */
  async SendAttachAct(ev: any) {
    let file = ev.target.files[0];
    let FileInfo: FileInfo = {};
    FileInfo.blob = file;
    FileInfo.filename = file.name;
    FileInfo.size = file.size;
    FileInfo.file_ext = file.name.split('.').pop();
    FileInfo.type = file.type;
    this.global.set_viewer_category(FileInfo);
    FileInfo['content_related_creator'] = [{
      user_id: this.MyUserName,
      timestamp: new Date().getTime(),
      display_name: this.MyUserName,
      various: 'loaded',
    }];
    FileInfo['content_creator'] = {
      user_id: this.MyUserName,
      timestamp: new Date().getTime(),
      display_name: this.MyUserName,
      various: 'loaded',
    };
    let TempId = `${Date.now()}`;
    let json = {
      type: 'file',
      info: FileInfo,
      uid: this.uuid,
      temp_id: TempId,
      name: this.MyUserName,
    }
    try { // FFS 발송 시도
      let url = await this.global.try_upload_to_user_custom_fs(FileInfo, 'minimal_chat');
      if (!url) throw '분할 전송 시도 필요';
      else {
        FileInfo.url = url;
        this.client.FFS_Urls.push(url);
        delete FileInfo.blob;
        this.client.send('dedicated_groupchat', JSON.stringify(json));
        this.focus_on_input();
      }
    } catch (e) { // 분할 전송처리
      FileInfo.path = `tmp_files/dedi_chat/${TempId}.${FileInfo.file_ext}`;
      await this.indexed.saveBlobToUserPath(FileInfo.blob, FileInfo.path);
      let ReqInfo = await this.indexed.GetFileInfoFromDB(FileInfo.path);
      FileInfo.partsize = Math.ceil(FileInfo.size / FILE_BINARY_LIMIT);
      delete FileInfo.blob;
      this.client.send('dedicated_groupchat', JSON.stringify(json));
      this.focus_on_input();
      for (let i = 0; i < FileInfo.partsize; i++) {
        new Promise((done) => setTimeout(done, 500));
        let part = this.global.req_file_part_base64(ReqInfo, i, FileInfo.path);
        let json = {
          type: 'part',
          path: FileInfo.path,
          index: i,
          part: part,
          temp_id: TempId,
        }
        this.client.send('dedicated_groupchat', JSON.stringify(json));
      }
      new Promise((done) => setTimeout(done, 500));
      let EOF = {
        type: 'EOF',
        path: FileInfo.path,
        partsize: FileInfo.partsize,
        temp_id: TempId,
      }
      this.client.send('dedicated_groupchat', JSON.stringify(EOF));
    }
  }

  /** 파일 뷰어로 해당 파일 열기 */
  open_file_viewer(FileInfo: any) {
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: { content: FileInfo },
        path: FileInfo.path,
        noEdit: true,
      },
      cssClass: 'fullscreen',
    }).then(v => {
      v.onDidDismiss().then(v => {
        if (v.data && v.data['share']) this.modalCtrl.dismiss();
      });
      v.present();
    });
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_qr_address() {
    this.mClipboard.copy(this.SelectedAddress)
      .catch(_e => {
        clipboard.write(this.SelectedAddress).then(() => {
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${this.SelectedAddress}`,
            });
        }).catch(_e => { });
      });
  }

  @ViewChild('minimalchat_input') minimalchat_input: IonInput;

  ionViewDidEnter() {
    setTimeout(() => {
      this.scroll_down();
    }, 0);
  }

  scroll_down() {
    let scrollHeight = this.minimal_chat_log.scrollHeight;
    this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
  }

  /** 모바일 키보드 높이 맞추기용 */
  focus_on_input(force?: number) {
    this.minimalchat_input.setFocus();
    this.auto_scroll_down(force);
  }

  auto_scroll_down(force?: number) {
    setTimeout(() => {
      let scrollHeight = this.minimal_chat_log.scrollHeight;
      if (scrollHeight < this.minimal_chat_log.scrollTop + this.minimal_chat_log.clientHeight + 120) {
        this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
    }, force || 0);
  }

  /** 메시지 보내기 */
  send(text?: string) {
    this.statusBar.settings['dedicated_groupchat'] = 'certified';
    setTimeout(() => {
      if (this.statusBar.settings['dedicated_groupchat'] == 'certified')
        this.statusBar.settings['dedicated_groupchat'] = 'online';
    }, 250);
    let data = {
      uid: this.uuid,
      msg: text || this.client.userInput['dedicated_groupchat'].text,
    }
    if (!data.msg.trim()) return;
    data['name'] = this.MyUserName;
    this.client.send('dedicated_groupchat', JSON.stringify(data));
    this.client.userInput['dedicated_groupchat'].text = '';
    this.focus_on_input();
  }

  /** 채팅 앱 종료하기 */
  quit_chat() {
    this.client.funcs['dedicated_groupchat'].onclose = () => {
      this.statusBar.settings['dedicated_groupchat'] = 'missing';
      setTimeout(() => {
        this.statusBar.settings['dedicated_groupchat'] = 'offline';
      }, 1500);
      let LeaveMsg = { color: isDarkMode ? 'ffa' : '884', text: this.lang.text['MinimalChat']['leave_chat_group'] };
      this.client.userInput['dedicated_groupchat'].logs.push(LeaveMsg);
      this.client.userInput['dedicated_groupchat'].last_message = LeaveMsg;
      let scrollHeight = this.minimal_chat_log.scrollHeight;
      this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
    this.noti.RemoveListener(`send${'dedicated_groupchat'}`);
    this.noti.RemoveListener(`reconn${'dedicated_groupchat'}`);
    this.noti.RemoveListener(`exit${'dedicated_groupchat'}`);
    this.noti.ClearNoti(this.lnId);
    this.client.disconnect('dedicated_groupchat');
    // 첨부했던 파일들 삭제
    this.indexed.GetFileListFromDB('tmp_files/dedi_chat', list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    for (let i = 0, j = this.client.FFS_Urls.length; i < j; i++)
      this.global.remove_files_from_storage_with_key(this.client.FFS_Urls[i], 'minimal_chat');
    this.client.FFS_Urls.length = 0;
    this.client.userInput.dedicated_groupchat.logs.length = 0;
    this.client.DownloadPartManager = {};
    if (this.params.get('address') == 'ws://127.0.0.1')
      this.local_server.stop();
    this.modalCtrl.dismiss();
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.noti.Current = undefined;
    if (this.client.IsConnected) this.client.CreateRejoinButton();
  }
}

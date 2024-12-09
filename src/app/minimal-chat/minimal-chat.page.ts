import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AlertController, IonInput, IonSelect, LoadingController, NavController } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';
import { StatusManageService } from '../status-manage.service';
import { LanguageSettingService } from '../language-setting.service';
import { isPlatform } from '../app.component';
import { ContentCreatorInfo, FILE_BINARY_LIMIT, FileInfo, GlobalActService, isDarkMode } from '../global-act.service';
import { P5ToastService } from '../p5-toast.service';
import { IndexedDBService } from '../indexed-db.service';
import * as p5 from 'p5';
import { ActivatedRoute, Router } from '@angular/router';
import { VoiceRecorder } from '@langx/capacitor-voice-recorder';
import { ExtendButtonForm } from '../portal/subscribes/chat-room/chat-room.page';
import { NakamaService, ServerInfo } from '../nakama.service';

/** MiniRanchat 에 있던 기능 이주, 대화창 구성 */
@Component({
  selector: 'app-minimal-chat',
  templateUrl: './minimal-chat.page.html',
  styleUrls: ['./minimal-chat.page.scss'],
})
export class MinimalChatPage implements OnInit, OnDestroy {

  constructor(
    public client: MiniranchatClientService,
    private noti: LocalNotiService,
    private title: Title,
    public navCtrl: NavController,
    private route: ActivatedRoute,
    private router: Router,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    public global: GlobalActService,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    public nakama: NakamaService,
  ) { }
  header_title: string;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'simplechat';
  iconColor = 'd8d8d8';
  lnId = 12;
  /** 새 대화 버튼 disabled 토글 */
  req_refreshed = false;
  minimal_chat_log: HTMLElement;
  addresses: any[];

  /** 이 창 열기(알림 상호작용) */
  open_this = (_ev: any) => {
    if (this.noti.Current == this.Header)
      window.focus();
    else this.client.RejoinGroupChat();
  }

  ShowExtMenus = false;
  ToggleExtMenu(force?: boolean) {
    this.ShowExtMenus = force ?? !this.ShowExtMenus;
    setTimeout(() => {
      this.auto_scroll_down();
    }, 0);
  }
  useVoiceRecording = false;
  /** 확장 버튼 행동들 */
  extended_buttons: ExtendButtonForm[] = [
    { // 0
      icon: 'document-attach-outline',
      name: this.lang.text['ChatRoom']['attachments'],
      act: async () => {
        this.new_attach({ detail: { value: 'load' } });
      },
      context: () => {
        this.new_attach({ detail: { value: 'link' } });
        return false;
      }
    }, { // 1
      icon_img: 'voidDraw.png',
      name: this.lang.text['ChatRoom']['voidDraw'],
      act: () => {
        this.new_attach({ detail: { value: 'image' } });
      }
    },
    { // 2
      icon: 'reader-outline',
      name: this.lang.text['ChatRoom']['newText'],
      act: () => {
        this.new_attach({ detail: { value: 'text' } });
      }
    }, { // 3
      icon: 'camera-outline',
      name: this.lang.text['ChatRoom']['Camera'],
      act: () => {
        this.new_attach({ detail: { value: 'camera' } });
      }
    }, { // 4
      icon: 'mic-circle-outline',
      name: this.lang.text['ChatRoom']['Voice'],
      act: async () => {
        this.useVoiceRecording = !this.useVoiceRecording;
        if (this.useVoiceRecording) { // 녹음 시작
          let req = await VoiceRecorder.hasAudioRecordingPermission();
          if (req.value) { // 권한 있음
            this.extended_buttons[4].icon = 'stop-circle-outline';
            this.extended_buttons[4].name = this.lang.text['ChatRoom']['VoiceStop'];
            this.p5toast.show({
              text: this.lang.text['ChatRoom']['StartVRecord'],
            });
            await VoiceRecorder.startRecording();
          } else { // 권한이 없다면 권한 요청 및 UI 복구
            this.useVoiceRecording = false;
            this.extended_buttons[4].icon = 'mic-circle-outline';
            await VoiceRecorder.requestAudioRecordingPermission();
          }
        } else await this.StopAndSaveVoiceRecording();
      }
    }, { // 5
      icon: 'trash-outline',
      name: this.lang.text['MinimalChat']['TrashChat'],
      act: () => {
        this.client.userInput.logs.length = 0;
        let resetLog = { color: isDarkMode ? 'bbb' : '444', text: this.lang.text['MinimalChat']['TrashChatLog'], isSystem: true };
        this.client.userInput.logs.push(resetLog);
        this.ShowExtMenus = false;
      },
    }];

  async StopAndSaveVoiceRecording() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['AddPost']['SavingRecord'] });
    loading.present();
    try {
      let blob = await this.global.StopAndSaveVoiceRecording();
      await this.SendAttachAct({ target: { files: [blob] } });
    } catch (e) { }
    loading.dismiss();
    this.extended_buttons[4].icon = 'mic-circle-outline';
    this.extended_buttons[4].name = this.lang.text['ChatRoom']['Voice'];
  }

  @ViewChild('MinimalChatServer') MinimalChatServer: IonSelect;
  /** 사설 서버를 입력하여 사용하는지 여부 */
  NeedInputCustomAddress = false;
  /** 빠른진입으로 들어온 경우 QR코드를 보여주지 않음 */
  JoinedQuick = false;
  ngOnInit() {
    this.global.StoreShortCutAct('minimal-chat-init');
    this.route.queryParams.subscribe(async _p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      await new Promise(res => setTimeout(res, 100)); // init 지연
      if (navParams) {
        this.client.MyUserName = navParams.name;
        this.client.JoinedChannel = navParams.channel || this.client.JoinedChannel;
        this.JoinedQuick = navParams.quick;
        // QRCode 빠른 진입으로 들어온 경우 주소를 이미 가지고 있음
        if (navParams.address) {
          this.UserInputCustomAddress = navParams.address;
          this.init_joinChat();
        }
      }
    });
    window.onfocus = () => {
      if (this.lnId) this.noti.ClearNoti(this.lnId);
      this.noti.Current = this.Header;
    }
    this.header_title = this.lang.text['MinimalChat']['header_title_group'];
    this.minimal_chat_log = document.getElementById('minimal_chat_div');
    this.minimal_chat_log.onscroll = (_ev: any) => {
      if (this.minimal_chat_log.scrollHeight == this.minimal_chat_log.scrollTop + this.minimal_chat_log.clientHeight)
        this.scroll_down();
    }
    this.ServerList = this.client.nakama.get_all_online_server();
    setTimeout(() => {
      if (this.MinimalChatServer) {
        this.MinimalChatServer.value = this.ServerList[0] || 'local';
        this.SelectAddressTarget({ detail: { value: this.MinimalChatServer.value } });
      } else this.NeedInputCustomAddress = true;
    }, 0);
    if (this.client.cacheAddress) this.CreateQRCode();
    setTimeout(() => {
      this.CreateDrop();
    }, 100);
  }

  /** 하단 입력칸 */
  DomMinimalChatInput: HTMLElement;
  ionViewWillEnter() {
    this.noti.Current = this.Header;
    this.WaitingLoaded = true;
    this.DomMinimalChatInput = document.getElementById('minimalchat_input').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    this.client.RemoveFloatButton();
    this.DomMinimalChatInput.onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        stack.push({ file: clipboardItem });
      if (stack.length != 1) return;
      this.SendAttachAct({ target: { files: [stack[0].file] } });
      return false;
    }
    if (this.client.IsConnected) this.focus_on_input();
  }

  AddShortCut() {
    this.global.p5KeyShortCut['EnterAct'] = (ev: any) => {
      if (ev['ctrlKey']) {
        if (this.client.status == 'idle')
          this.init_joinChat();
      } else if (document.activeElement == this.DomMinimalChatInput) {
        this.scroll_down();
      } else setTimeout(() => {
        this.focus_on_input();
      }, 0);
    }
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  /** 새 파일 만들기 */
  async new_attach(ev: any) {
    switch (ev.detail.value) {
      case 'camera':
        try {
          let result = await this.global.from_camera('tmp_files/square/', { display_name: this.client.MyUserName });
          if (result) this.TrySendingAttach(result);
        } catch (e) {
          console.log('촬영 실패: ', e);
          this.p5toast.show({
            text: `${this.lang.text['GlobalAct']['ErrorFromCamera']}: ${e}`,
          });
        }
        this.AddShortCut();
        this.auto_scroll_down(100);
        break;
      case 'text':
        let new_textfile_name = this.global.TextEditorNewFileName();
        this.global.PageDismissAct['minimal-textedit'] = (v: any) => {
          if (v.data) {
            let result = this.global.TextEditorAfterAct(v.data, { display_name: this.client.MyUserName });
            this.TrySendingAttach(result);
            this.auto_scroll_down();
          }
          delete this.global.PageDismissAct['minimal-textedit'];
        }
        this.global.ActLikeModal('ionic-viewer', {
          info: {
            content: {
              is_new: 'text',
              type: 'text/plain',
              viewer: 'text',
              filename: new_textfile_name,
            },
          },
          noEdit: true,
          dismiss: 'minimal-textedit',
        });
        break;
      case 'image':
        this.global.PageDismissAct['minimal-image'] = async (v: any) => {
          if (v.data) {
            let result = await this.global.voidDraw_fileAct_callback(v, 'tmp_files/square/', { display_name: this.client.MyUserName });
            this.TrySendingAttach(result);
          }
          delete this.global.PageDismissAct['minimal-image'];
        }
        this.global.ActLikeModal('void-draw', {
          dismiss: 'minimal-image',
        });
        break;
      case 'load': // 불러오기 행동 병합
        this.SelectAttach();
        this.AddShortCut();
        break;
      case 'link':
        let pasted_url: string;
        try {
          try {
            let clipboard = await this.global.GetValueFromClipboard();
            switch (clipboard.type) {
              case 'text/plain':
                pasted_url = clipboard.value;
                break;
              case 'image/png':
                this.SendAttachAct({ target: { files: [clipboard.value] } });
                return;
              case 'error':
                throw clipboard.value;
            }
          } catch (e) {
            throw e;
          }
          try { // DataURL 주소인지 검토
            let blob = this.global.Base64ToBlob(pasted_url);
            let getType = pasted_url.split(';')[0].split(':')[1];
            let file = new File([blob],
              `${this.lang.text['ChatRoom']['FileLink']}.${getType.split('/').pop()}`, {
              type: getType,
            });
            this.SendAttachAct({ target: { files: [file] } });
            throw 'done';
          } catch (e) {
            switch (e) {
              case 'done':
                throw e;
            }
          }
          try { // 정상적인 주소인지 검토
            if (pasted_url.indexOf('http:') != 0 && pasted_url.indexOf('https:') != 0) throw '올바른 웹 주소가 아님';
          } catch (e) {
            throw e;
          }
          let this_file: FileInfo = {};
          this_file.url = pasted_url;
          this_file['content_related_creator'] = [];
          this_file['content_related_creator'].push({
            user_id: this.client.uuid,
            timestamp: new Date().getTime(),
            display_name: this.client.MyUserName,
            various: 'link',
          });
          this_file['content_creator'] = {
            user_id: this.client.uuid,
            timestamp: new Date().getTime(),
            display_name: this.client.MyUserName,
            various: 'link',
          };
          let sep = this_file.url.split('.');
          this_file.file_ext = sep.pop().split('?').shift();
          this_file.filename = decodeURIComponent(`${sep.pop().split('/').pop() || this.lang.text['ChatRoom']['ExternalLinkFile']}.${this_file.file_ext}`).split('_').pop();
          this.global.set_viewer_category_from_ext(this_file);
          this_file.type = '';
          this_file.typeheader = this_file.viewer;
          let json = {
            type: 'file',
            info: this_file,
            name: this.client.MyUserName,
          }
          this.client.send(JSON.stringify(json));
        } catch (e) {
          if (e == 'done')
            throw e;
          else throw `인식 불가능한 URL 정보: ${e}`;
        }
        break;
    }
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
              this.SendAttachAct({ target: { files: [file.file] } });
              loading.dismiss();
            } else { // 여러 파일 발송 여부 검토 후, 아니라고 하면 첫 파일만
              this.alertCtrl.create({
                header: this.lang.text['ChatRoom']['MultipleSend'],
                message: `${this.lang.text['ChatRoom']['CountFile']}: ${Drops.length}`,
                buttons: [{
                  text: this.lang.text['ChatRoom']['Send'],
                  handler: () => {
                    for (let i = 0, j = Drops.length; i < j; i++)
                      this.SendAttachAct({ target: { files: [Drops[i].file] } });
                  }
                }]
              }).then(v => {
                this.global.StoreShortCutAct('minimal-multiple-send');
                this.global.p5KeyShortCut['Escape'] = () => {
                  v.dismiss();
                }
                v.onDidDismiss().then(() => {
                  this.global.RestoreShortCutAct('minimal-multiple-send');
                });
                v.present();
              });
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

  QRCodeSRC: any;
  QRCodeTargetString: string;
  /** QR코드 이미지 생성 */
  async CreateQRCode() {
    if (this.JoinedQuick) return;
    this.QRCodeSRC = '';
    let header_address = await this.global.GetHeaderAddress();
    this.QRCodeTargetString = `${header_address}?group_dedi=${this.client.cacheAddress},${this.client.JoinedChannel || 'public'}`;
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.QRCodeTargetString.replace(' ', '%20'));
    this.focus_on_input();
  }

  ServerList: any[];
  /** 사용자가 직접 서버 주소를 입력 */
  UserInputCustomAddress = undefined;
  /** 연결 대상 선택 */
  SelectAddressTarget(ev: any) {
    this.header_title = this.lang.text['MinimalChat']['header_title_group'];
    this.title.setTitle(this.lang.text['MinimalChat']['WebTitle_group']);
    switch (ev.detail.value) {
      case 'local':
        this.client.cacheServerInfo = undefined;
        this.UserInputCustomAddress = '';
        this.NeedInputCustomAddress = true;
        break;
      default: // 다른 원격 서버
        this.client.cacheServerInfo = ev.detail.value.info;
        this.UserInputCustomAddress = `${this.client.cacheServerInfo.useSSL ? 'wss' : 'ws'}://${this.client.cacheServerInfo.address}:${this.client.cacheServerInfo.square_port || 12013}`;
        this.NeedInputCustomAddress = false;
        break;
    }
  }

  /** 대상을 선택했다면 서버에 접속하기
   * @param get_address ws://{address} 로 구성된 웹소켓 대상 주소, 포트는 자동처리이므로 제외한다
   */
  init_joinChat() {
    this.client.status = 'custom';
    this.Header = 'simplechat';
    this.noti.ClearNoti(this.lnId);
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/simplechat.png`);
    try {
      if (!this.client.client || this.client.client.readyState != this.client.client.OPEN
        && !this.client.p5OnDediMessage) {
        this.client.userInput.logs.length = 0;
        let joinMessage = { color: isDarkMode ? 'bbb' : '444', text: this.lang.text['MinimalChat']['joinChat_group'], isSystem: true };
        this.client.userInput.logs.push(joinMessage);
        this.client.userInput.last_message = joinMessage;
        let split_fullAddress = this.UserInputCustomAddress.split('://');
        let address = split_fullAddress.pop().split(':');
        let protocol = split_fullAddress.pop();
        if (protocol) {
          protocol += ':';
        } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'wss:' : 'ws:';
        let target_address = `${protocol}//${address[0]}`;
        this.client.initialize(target_address, address[1]);
      }
      const PWA_Action = [{
        title: this.lang.text['MinimalChat']['Noti_Reply'],
        action: 'sq_reply',
        type: 'text',
      }];
      this.client.funcs.onmessage = (v: string) => {
        try {
          let data = JSON.parse(v);
          if (!this.client.JoinedChannel) this.client.JoinedChannel = data['channel'];
          if (!this.client.uuid)
            this.client.uuid = data['uid'];
          let isMe = this.client.uuid == data['uid'];
          let target = isMe ? (this.client.MyUserName || this.lang.text['MinimalChat']['name_me']) : (data['name'] || this.lang.text['MinimalChat']['name_stranger_group']);
          let color = data['uid'] ? (data['uid'].replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6) : isDarkMode ? '888888' : '444444';
          if (this.client.p5OnDediMessage) this.client.p5OnDediMessage(color);
          if (data['msg']) { // 채널 메시지
            let sep: string[] = data['msg'].split(' ');
            let msg_arr = [];
            let normal_text = '';
            for (let i = 0, j = sep.length; i < j; i++)
              if (sep[i].indexOf('http://') == 0 || sep[i].indexOf('https://') == 0) {
                msg_arr.push({ text: ' ' + normal_text + ' ' });
                normal_text = '';
                msg_arr.push({ href: true, text: sep[i] });
              } else normal_text += ' ' + sep[i];
            if (normal_text) msg_arr.push({ text: ' ' + normal_text });
            let getMessage = { color: color, text: msg_arr, target: target, isMe: isMe };
            this.client.userInput.logs.push(getMessage);
            this.client.userInput.last_message = getMessage;
          } else if (data['type']) {
            switch (data['type']) {
              case 'join': // 사용자 진입
                let UserJoin = { color: color, text: [{ text: ' ' + this.lang.text['MinimalChat']['user_join_comment'] }], target: target, isSystem: true };
                this.client.userInput.logs.push(UserJoin);
                this.client.userInput.last_message = UserJoin;
                break;
              case 'leave': // 사용자 퇴장
                let UserLeave = { color: color, text: [{ text: ' ' + this.lang.text['MinimalChat']['user_out_comment'] }], target: target, isSystem: true };
                this.client.userInput.logs.push(UserLeave);
                this.client.userInput.last_message = UserLeave;
                break;
              case 'file': // 파일 정보 전송 (url)
                let FileAttach = { color: color, file: data, target: target, isMe: isMe };
                this.client.userInput.logs.push(FileAttach);
                this.client.userInput.last_message = FileAttach;
                if (!data.info.url) { // 분할 파일인 경우 누적 준비하기
                  let FileInfo: FileInfo = data.info;
                  if (!this.client.DownloadPartManager[data.uid])
                    this.client.DownloadPartManager[data.uid] = {};
                  if (!this.client.DownloadPartManager[data.uid][data.temp_id])
                    this.client.DownloadPartManager[data.uid][data.temp_id] = FileAttach;
                  FileAttach['Progress'] = FileInfo.partsize;
                }
                break;
              case 'part': // 분할 파일 정보 수신
                this.client.DownloadPartManager[data.uid][data.temp_id]['Progress']--;
                this.indexed.checkIfFileExist(data.path, b => {
                  if (!b) { // 파일이 없다면 파트파일 받기
                    this.indexed.saveBase64ToUserPath(',' + data.part, `${data.path}_${data.index}`);
                  }
                });
                return; // 알림 생성하지 않음
              case 'EOF': // 파일 수신 마무리하기
                this.indexed.checkIfFileExist(data.path, async b => {
                  if (!b) { // 파일이 없다면 파트를 모아서 파일 만들기
                    await new Promise(async (done, err) => {
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
                  } else this.indexed.removeFileFromUserPath(`${data.path}.history`);
                });
                return; // 알림 생성하지 않음
            }
          }
          let alert_this: any = 'certified';
          if (data['count']) this.client.ConnectedNow = data['count'];
          if (data['msg'])
            this.noti.PushLocal({
              id: this.lnId,
              title: target,
              body: data['msg'],
              actions_wm: PWA_Action,
              smallIcon_ln: 'simplechat',
            }, this.Header, this.open_this);
          else if (data['type']) {
            switch (data['type']) {
              case 'join': { // 사용자 들어옴
                this.noti.PushLocal({
                  id: this.lnId,
                  title: this.lang.text['MinimalChat']['user_join'],
                  body: target + ` | ${this.lang.text['MinimalChat']['user_join_comment']}`,
                  actions_wm: PWA_Action,
                  smallIcon_ln: 'simplechat',
                }, this.Header, this.open_this);
              } break;
              case 'leave': { // 사용자 나감
                alert_this = 'pending';
                this.noti.PushLocal({
                  id: this.lnId,
                  title: this.lang.text['MinimalChat']['user_out'],
                  body: target + ` | ${this.lang.text['MinimalChat']['user_out_comment']}`,
                  actions_wm: PWA_Action,
                  smallIcon_ln: 'simplechat',
                }, this.Header, this.open_this);
              } break;
              case 'file': { // 파일 전송을 시작함
                this.noti.PushLocal({
                  id: this.lnId,
                  title: target,
                  body: this.lang.text['MinimalChat']['user_send_attach'],
                  actions_wm: PWA_Action,
                  smallIcon_ln: 'simplechat',
                }, this.Header, this.open_this);
              } break;
            }
          }
          this.statusBar.settings['dedicated_groupchat'] = alert_this;
          setTimeout(() => {
            if (this.statusBar.settings['dedicated_groupchat'] == alert_this)
              this.statusBar.settings['dedicated_groupchat'] = 'online';
          }, 250);
        } catch (e) { }
        this.auto_scroll_down();
      }
      this.client.funcs.onclose = (_v: any) => {
        this.WebSocketOnCloseAct();
      }
      this.client.funcs.onopen = (_v: any) => {
        this.CreateQRCode();
        this.statusBar.settings['dedicated_groupchat'] = 'online';
        let count = {
          name: this.client.MyUserName,
          type: 'join',
          channel: this.client.JoinedChannel || 'public',
        }
        this.client.send(JSON.stringify(count));
        this.client.funcs.onclose = (_v: any) => {
          this.statusBar.settings['dedicated_groupchat'] = 'missing';
          setTimeout(() => {
            this.statusBar.settings['dedicated_groupchat'] = 'offline';
          }, 1500);
          let text = this.lang.text['MinimalChat']['cannot_join'];
          let GotMessage = { color: 'faa', text: text, isSystem: true };
          this.client.userInput.logs.push(GotMessage);
          this.client.userInput.last_message = GotMessage;
          this.noti.PushLocal({
            id: this.lnId,
            title: text,
            actions_wm: PWA_Action,
            smallIcon_ln: 'simplechat',
          }, this.Header, this.open_this);
          if (this.client.p5OnDediMessage) this.client.p5OnDediMessage('ff0000');
        }
      }
    } catch (e) {
      console.log('광장 채널 접속 실패: ', e);
      this.WebSocketOnCloseAct();
    }
  }

  /** 공통된 종료행동 공동관리용 */
  WebSocketOnCloseAct() {
    this.statusBar.settings['dedicated_groupchat'] = 'missing';
    setTimeout(() => {
      this.statusBar.settings['dedicated_groupchat'] = 'offline';
    }, 1500);
    let failedJoin = { color: 'faa', text: this.lang.text['MinimalChat']['failed_to_join'], isSystem: true };
    this.client.userInput.logs.push(failedJoin);
    this.client.userInput.last_message = failedJoin;
    this.noti.PushLocal({
      id: this.lnId,
      title: this.lang.text['MinimalChat']['failed_to_join'],
      smallIcon_ln: 'simplechat',
    }, this.Header, this.open_this);
    if (this.client.p5OnDediMessage) this.client.p5OnDediMessage('ff0000');
    this.client.disconnect();
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_qr_address(target_string = this.QRCodeTargetString) {
    this.global.WriteValueToClipboard('text/plain', target_string);
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
      user_id: this.client.uuid,
      timestamp: new Date().getTime(),
      display_name: this.client.MyUserName,
      various: 'loaded',
    }];
    FileInfo['content_creator'] = {
      user_id: this.client.uuid,
      timestamp: new Date().getTime(),
      display_name: this.client.MyUserName,
      various: 'loaded',
    };
    this.TrySendingAttach(FileInfo);
  }

  /** 첨부파일을 발송하기 */
  async TrySendingAttach(FileInfo: FileInfo) {
    let TempId = `${Date.now()}`;
    let json = {
      type: 'file',
      info: FileInfo,
      temp_id: TempId,
      name: this.client.MyUserName,
    }
    try { // FFS 발송 시도
      let TargetAddress: string;
      try {
        TargetAddress = `${this.client.cacheServerInfo.useSSL ? 'https' : 'http'}://${this.client.cacheServerInfo.address}:${this.client.cacheServerInfo.apache_port || 9002}`;
      } catch (e) {
        console.log('대상 주소 생성 오류: ', e);
      }
      let url = await this.global.try_upload_to_user_custom_fs(FileInfo, `tmp_${this.client.JoinedChannel || 'public'}_${this.client.uuid}`,
        undefined, TargetAddress);
      if (!url) throw '분할 전송 시도 필요';
      else {
        FileInfo.url = url;
        delete FileInfo.blob;
        this.client.send(JSON.stringify(json));
        this.focus_on_input();
      }
    } catch (e) { // 분할 전송처리
      if (FileInfo.url) {
        let res = await fetch(FileInfo.url);
        if (res.ok) {
          let blob = await res.blob();
          FileInfo.blob = blob;
        }
      }
      FileInfo.path = `tmp_files/sqaure/${TempId}.${FileInfo.file_ext}`;
      await this.indexed.saveBlobToUserPath(FileInfo.blob, FileInfo.path);
      let ReqInfo = await this.indexed.GetFileInfoFromDB(FileInfo.path);
      FileInfo.partsize = Math.ceil(FileInfo.size / FILE_BINARY_LIMIT);
      delete FileInfo.blob;
      this.client.send(JSON.stringify(json));
      this.focus_on_input();
      for (let i = 0; i < FileInfo.partsize; i++) {
        await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
        let part = this.global.req_file_part_base64(ReqInfo, i, FileInfo.path);
        let json = {
          type: 'part',
          path: FileInfo.path,
          index: i,
          part: part,
          temp_id: TempId,
        }
        this.client.send(JSON.stringify(json));
      }
      await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
      let EOF = {
        type: 'EOF',
        path: FileInfo.path,
        partsize: FileInfo.partsize,
        temp_id: TempId,
      }
      this.client.send(JSON.stringify(EOF));
    }
  }

  WaitingLoaded = false;
  /** 정확히 현재 페이지가 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (!this.WaitingLoaded) {
      await new Promise((done) => setTimeout(done, 0));
    }
    return true;
  }

  /** 파일 뷰어로 해당 파일 열기 */
  open_file_viewer(FileInfo: any) {
    let attaches = [];
    for (let i = 0, j = this.client.userInput.logs.length; i < j; i++)
      try {
        if (this.client.userInput.logs[i].file.info.filename)
          attaches.push({ content: JSON.parse(JSON.stringify(this.client.userInput.logs[i].file.info)) });
      } catch (e) { }
    this.global.PageDismissAct['minimal-ionic-viewer'] = async (v: any) => {
      if (v.data) {
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
            this.global.PageDismissAct['minimal-ionic-viewer-edit'] = (v: any) => {
              if (v.data) {
                v.data['loadingCtrl'].dismiss();
                let base64 = v.data['img'];
                let path = `tmp_files/sqaure/${v.data['name']}`;
                this.indexed.saveBase64ToUserPath(base64, path);
                let blob = this.global.Base64ToBlob(base64, 'image/png');
                blob['name'] = v.data['name'];
                this.SendAttachAct({ target: { files: [blob] } });
              }
              delete this.global.PageDismissAct['minimal-ionic-viewer-edit'];
            }
            await this.WaitingCurrent();
            this.global.ActLikeModal('void-draw', {
              path: v.data.path || FileInfo.path,
              width: v.data.width,
              height: v.data.height,
              type: v.data.filetype,
              isDarkMode: v.data.isDarkMode,
              scrollHeight: v.data.scrollHeight,
              dismiss: 'minimal-ionic-viewer-edit',
            });
            return;
          case 'text':
            v.data.blob['name'] = this.global.TextEditorNewFileName();
            v.data.path = `tmp_files/texteditor/${v.data.blob['name']}`;
            this.SendAttachAct({ target: { files: [v.data.blob] } });
            break;
        }
      }
      delete this.global.PageDismissAct['minimal-ionic-viewer'];
    }
    this.global.ActLikeModal('ionic-viewer', {
      info: { content: FileInfo },
      path: FileInfo.path,
      relevance: attaches,
      dismiss: 'minimal-ionic-viewer',
    });
  }

  @ViewChild('minimalchat_input') minimalchat_input: IonInput;

  ionViewDidEnter() {
    this.AddShortCut();
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
    if (isPlatform == 'DesktopPWA')
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
      msg: text || this.client.userInput.text,
    }
    if (!data.msg.trim()) return;
    this.ToggleExtMenu(false);
    data['name'] = this.client.MyUserName;
    this.client.send(JSON.stringify(data));
    this.client.userInput.text = '';
    this.focus_on_input();
  }

  /** 채팅 앱 종료하기 */
  quit_chat() {
    this.client.funcs.onclose = () => {
      this.statusBar.settings['dedicated_groupchat'] = 'missing';
      setTimeout(() => {
        this.statusBar.settings['dedicated_groupchat'] = 'offline';
      }, 1500);
      let LeaveMsg = { color: isDarkMode ? 'ffa' : '884', text: this.lang.text['MinimalChat']['leave_chat_group'], isSystem: true };
      this.client.userInput.logs.push(LeaveMsg);
      this.client.userInput.last_message = LeaveMsg;
      let scrollHeight = this.minimal_chat_log.scrollHeight;
      this.minimal_chat_log.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
    this.UserInputCustomAddress = '';
    this.noti.ClearNoti(this.lnId);
    if (this.client.status == 'idle') this.navCtrl.pop();
    // 첨부했던 파일들 삭제
    this.indexed.GetFileListFromDB('tmp_files/sqaure', list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    this.client.disconnect();
    this.client.DownloadPartManager = {};
  }

  ionViewWillLeave() {
    this.WaitingLoaded = false;
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.noti.Current = '';
    if (this.client.IsConnected) this.client.CreateRejoinButton();
    delete this.global.p5KeyShortCut['EnterAct'];
    delete this.global.p5KeyShortCut['Escape'];
    if (this.useVoiceRecording) this.StopAndSaveVoiceRecording();
  }

  ngOnDestroy() {
    this.global.RestoreShortCutAct('minimal-chat-init');
    this.route.queryParams['unsubscribe']();
    window.onfocus = null;
    this.minimal_chat_log.onscroll = null;
    this.DomMinimalChatInput.onpaste = null;
    if (this.p5canvas) this.p5canvas.remove();
  }
}

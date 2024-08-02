import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AlertController, IonInput, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { LocalNotiService } from '../local-noti.service';
import { MiniranchatClientService } from '../miniranchat-client.service';
import { StatusManageService } from '../status-manage.service';
import { LanguageSettingService } from '../language-setting.service';
import { SERVER_PATH_ROOT, isPlatform } from '../app.component';
import { ContentCreatorInfo, FILE_BINARY_LIMIT, FileInfo, GlobalActService, isDarkMode } from '../global-act.service';
import clipboard from 'clipboardy';
import { P5ToastService } from '../p5-toast.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IndexedDBService } from '../indexed-db.service';
import { IonicViewerPage } from '../portal/subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { VoidDrawPage } from '../portal/subscribes/chat-room/void-draw/void-draw.page';
import * as p5 from 'p5';

/** MiniRanchat 에 있던 기능 이주, 대화창 구성 */
@Component({
  selector: 'app-minimal-chat',
  templateUrl: './minimal-chat.page.html',
  styleUrls: ['./minimal-chat.page.scss'],
})
export class MinimalChatPage implements OnInit, OnDestroy {

  constructor(
    public client: MiniranchatClientService,
    public modalCtrl: ModalController,
    private noti: LocalNotiService,
    private title: Title,
    private params: NavParams,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
    private p5toast: P5ToastService,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
  ) { }
  header_title: string;
  /** 페이지 구분자는 페이지에 사용될 아이콘 이름을 따라가도록 */
  Header = 'ranchat';
  iconColor = 'd8d8d8';
  lnId = 12;
  /** 새 대화 버튼 disabled 토글 */
  req_refreshed = false;
  minimal_chat_log: HTMLElement;
  addresses: any[];
  isMobileApp = false;

  /** 이 창 열기(알림 상호작용) */
  open_this = (ev: any) => {
    if (this.noti.Current == this.Header)
      window.focus();
    else this.client.RejoinGroupChat();
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
    if (url.indexOf('https://is2you2.github.io/devtalk_pwa/?') == 0 || url.indexOf('http://pjcone.ddns.net/?') == 0) {
      let init = this.global.CatchGETs(url) || {};
      this.global.initialize();
      try {
        await this.client.nakama.AddressToQRCodeAct(init);
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
    if (this.client.p5canvas) this.client.p5canvas.remove();
    this.header_title = this.lang.text['MinimalChat']['header_title_group'];
    this.client.MyUserName = this.params.get('name');
    this.minimal_chat_log = document.getElementById('minimal_chat_div');
    this.minimal_chat_log.onscroll = (_ev: any) => {
      if (this.minimal_chat_log.scrollHeight == this.minimal_chat_log.scrollTop + this.minimal_chat_log.clientHeight)
        this.scroll_down();
    }
    this.ServerList = this.client.nakama.get_all_online_server();
    this.SelectAddressTarget({ detail: { value: 'local' } });
    if (this.client.cacheAddress) this.CreateQRCode();
    // QRCode 빠른 진입으로 들어온 경우 주소를 이미 가지고 있음
    if (this.params.get('address')) {
      this.UserInputCustomAddress = this.params.get('address');
      this.init_joinChat();
    }
    setTimeout(() => {
      this.CreateDrop();
    }, 100);
  }

  ionViewWillEnter() {
    document.getElementById('minimalchat_input').onpaste = (ev: any) => {
      let stack = [];
      for (const clipboardItem of ev.clipboardData.files)
        if (clipboardItem.type.startsWith('image/'))
          stack.push({ file: clipboardItem });
      if (stack.length != 1) return;
      this.SendAttachAct({ target: { files: [stack[0].file] } });
      return false;
    }
    this.focus_on_input();
    this.global.p5key['KeyShortCut']['EnterAct'] = () => {
      if (document.activeElement != document.getElementById('minimalchat_input'))
        setTimeout(() => {
          this.focus_on_input();
        }, 0);
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
                // 이전 페이지의 단축키 보관했다가 재등록시키기
                let CacheShortCut = this.global.p5key['KeyShortCut'];
                this.global.p5key['KeyShortCut'] = {};
                this.global.p5key['KeyShortCut']['Escape'] = () => {
                  v.dismiss();
                }
                v.onDidDismiss().then(() => {
                  this.global.p5key['KeyShortCut'] = CacheShortCut;
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
    this.QRCodeSRC = 'loading';
    let checkIfNoSecure = this.client.cacheAddress.indexOf('ws:') == 0;
    let header_address: string;
    if (checkIfNoSecure) {
      try { // 사용자 지정 서버 업로드 시도 우선
        let extract = 'http://' + this.client.cacheAddress.split('://')[1];
        let HasLocalPage = `${extract}:8080/www/`;
        const cont = new AbortController();
        const id = setTimeout(() => {
          cont.abort();
        }, 500);
        let res = await fetch(HasLocalPage, { signal: cont.signal });
        clearTimeout(id);
        if (res.ok) header_address = `${extract}:8080/www/`;
      } catch (e) {
        header_address = 'http://pjcone.ddns.net/';
      }
    } else header_address = `${SERVER_PATH_ROOT}devtalk_pwa/`;
    this.QRCodeTargetString = `${header_address}?group_dedi=${this.client.cacheAddress.split('://')[1]},${this.client.JoinedChannel || 'public'}`;
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.QRCodeTargetString);
  }

  ServerList: any[];
  NeedInputCustomAddress = false;
  /** 사용자가 직접 서버 주소를 입력 */
  UserInputCustomAddress = undefined;
  /** 연결 대상 선택 */
  SelectAddressTarget(ev: any) {
    this.header_title = this.lang.text['MinimalChat']['header_title_group'];
    this.title.setTitle(this.lang.text['MinimalChat']['WebTitle_group']);
    switch (ev.detail.value) {
      case 'local':
        this.UserInputCustomAddress = '';
        this.NeedInputCustomAddress = true;
        break;
      default: // 다른 원격 서버
        let info = ev.detail.value.info;
        this.UserInputCustomAddress = info.address;
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
    this.noti.Current = this.Header;
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', `assets/icon/simplechat.png`);

    if (!this.client.client || this.client.client.readyState != this.client.client.OPEN
      && !(this.client.p5canvas && this.client.p5canvas['OnDediMessage'])) {
      this.client.userInput.logs.length = 0;
      let joinMessage = { color: isDarkMode ? 'bbb' : '444', text: this.lang.text['MinimalChat']['joinChat_group'], isSystem: true };
      this.client.userInput.logs.push(joinMessage);
      this.client.userInput.last_message = joinMessage;
      let checkProtocol = this.UserInputCustomAddress.replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, '');
      let target_address = `${checkProtocol ? 'wss:' : 'ws:'}//${this.UserInputCustomAddress}`;
      this.client.initialize(target_address);
    }
    this.client.funcs.onmessage = (v: string) => {
      try {
        let data = JSON.parse(v);
        if (!this.client.JoinedChannel) this.client.JoinedChannel = data['channel'];
        if (!this.client.uuid) this.client.uuid = data['uid'];
        if (!this.QRCodeSRC) this.CreateQRCode();
        let isMe = this.client.uuid == data['uid'];
        let target = isMe ? (this.client.MyUserName || this.lang.text['MinimalChat']['name_me']) : (data['name'] || this.lang.text['MinimalChat']['name_stranger_group']);
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
        if (data['count']) this.client.ConnectedNow = data['count'];
        if (data['msg'])
          this.noti.PushLocal({
            id: this.lnId,
            title: target,
            body: data['msg'],
            group_ln: 'simplechat',
            extra_ln: {
              type: 'MinimalChatPage',
              componentProps: {
                address: this.params.get('address'),
                name: this.params.get('name'),
              },
            },
            actions: ['group_dedi'],
            smallIcon_ln: 'simplechat',
            iconColor_ln: this.iconColor,
            autoCancel_ln: true,
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
              type: 'MinimalChatPage',
              componentProps: {
                address: this.params.get('address'),
                name: this.params.get('name'),
              },
            },
            actions: ['group_dedi'],
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
      } catch (e) { }
      this.auto_scroll_down();
    }
    this.client.funcs.onclose = (_v: any) => {
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
        group_ln: 'simplechat',
        extra_ln: {
          type: 'MinimalChatPage',
          componentProps: {
            address: this.params.get('address'),
            name: this.params.get('name'),
          },
        },
        autoCancel_ln: true,
        smallIcon_ln: 'simplechat',
        iconColor_ln: this.iconColor,
      }, this.Header, this.open_this);
      if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage']('ff0000');
      this.client.disconnect();
    }
    this.client.funcs.onopen = (_v: any) => {
      this.statusBar.settings['dedicated_groupchat'] = 'online';
      let count = {
        name: this.client.MyUserName,
        type: 'join',
        channel: this.params.get('channel') || this.client.JoinedChannel || 'public',
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
          group_ln: 'simplechat',
          extra_ln: {
            type: 'MinimalChatPage',
            componentProps: {
              address: this.params.get('address'),
              name: this.params.get('name'),
            },
          },
          actions: ['group_dedi'],
          autoCancel_ln: true,
          smallIcon_ln: 'simplechat',
          iconColor_ln: this.iconColor,
        }, this.Header, this.open_this);
        if (this.client.p5canvas && this.client.p5canvas['OnDediMessage']) this.client.p5canvas['OnDediMessage']('ff0000');
      }
    }
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_qr_address(target_string = this.QRCodeTargetString) {
    this.mClipboard.copy(target_string)
      .catch(_e => {
        clipboard.write(target_string).then(() => {
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${target_string}`,
            });
        }).catch(_e => { });
      });
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
      user_id: this.client.MyUserName,
      timestamp: new Date().getTime(),
      display_name: this.client.MyUserName,
      various: 'loaded',
    }];
    FileInfo['content_creator'] = {
      user_id: this.client.MyUserName,
      timestamp: new Date().getTime(),
      display_name: this.client.MyUserName,
      various: 'loaded',
    };
    let TempId = `${Date.now()}`;
    let json = {
      type: 'file',
      info: FileInfo,
      temp_id: TempId,
      name: this.client.MyUserName,
    }
    try { // FFS 발송 시도
      let url = await this.global.try_upload_to_user_custom_fs(FileInfo, 'minimal_chat');
      if (!url) throw '분할 전송 시도 필요';
      else {
        FileInfo.url = url;
        this.client.FFS_Urls.push(url);
        delete FileInfo.blob;
        this.client.send(JSON.stringify(json));
        this.focus_on_input();
      }
    } catch (e) { // 분할 전송처리
      FileInfo.path = `tmp_files/dedi_chat/${TempId}.${FileInfo.file_ext}`;
      await this.indexed.saveBlobToUserPath(FileInfo.blob, FileInfo.path);
      let ReqInfo = await this.indexed.GetFileInfoFromDB(FileInfo.path);
      FileInfo.partsize = Math.ceil(FileInfo.size / FILE_BINARY_LIMIT);
      delete FileInfo.blob;
      this.client.send(JSON.stringify(json));
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
        this.client.send(JSON.stringify(json));
      }
      new Promise((done) => setTimeout(done, 500));
      let EOF = {
        type: 'EOF',
        path: FileInfo.path,
        partsize: FileInfo.partsize,
        temp_id: TempId,
      }
      this.client.send(JSON.stringify(EOF));
    }
  }

  /** 파일 뷰어로 해당 파일 열기 */
  open_file_viewer(FileInfo: any) {
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: { content: FileInfo },
        path: FileInfo.path,
        noTextEdit: true,
      },
      cssClass: 'fullscreen',
    }).then(v => {
      v.onDidDismiss().then(v => {
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
              this.modalCtrl.create({
                component: VoidDrawPage,
                componentProps: {
                  path: v.data.path || FileInfo.path,
                  width: v.data.width,
                  height: v.data.height,
                  isDarkMode: v.data.isDarkMode,
                  scrollHeight: v.data.scrollHeight,
                },
                cssClass: 'fullscreen',
              }).then(v => {
                v.onWillDismiss().then(async v => {
                  if (v.data) {
                    v.data['loadingCtrl'].dismiss();
                    let base64 = v.data['img'];
                    let path = `tmp_files/dedi_chat/${v.data['name']}`;
                    this.indexed.saveBase64ToUserPath(base64, path);
                    let blob = this.global.Base64ToBlob(base64, 'image/png');
                    blob['name'] = v.data['name'];
                    this.SendAttachAct({ target: { files: [blob] } });
                  }
                });
                v.present();
              });
              return;
          }
          if (v.data['share']) // 다른 채널에 공유하기면 페이지 벗어나기
            this.modalCtrl.dismiss();
        }
      });
      v.present();
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
      msg: text || this.client.userInput.text,
    }
    if (!data.msg.trim()) return;
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
    this.noti.ClearNoti(this.lnId);
    if (this.client.status == 'idle') this.modalCtrl.dismiss();
    this.client.disconnect();
    // 첨부했던 파일들 삭제
    this.indexed.GetFileListFromDB('tmp_files/dedi_chat', list => list.forEach(path => this.indexed.removeFileFromUserPath(path)));
    for (let i = 0, j = this.client.FFS_Urls.length; i < j; i++)
      this.global.remove_files_from_storage_with_key(this.client.FFS_Urls[i], 'minimal_chat');
    this.client.FFS_Urls.length = 0;
    this.client.DownloadPartManager = {};
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
    this.noti.Current = undefined;
    if (this.client.IsConnected) this.client.CreateRejoinButton();
    delete this.global.p5key['KeyShortCut']['EnterAct'];
  }
  ngOnDestroy(): void {
    if (this.p5canvas)
      this.p5canvas.remove()
  }
}

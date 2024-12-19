import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonModal, LoadingController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
function import_p5sound() {
  if (window.location.protocol != 'http:' || window.location.host.indexOf('localhost') == 0) {
    import('p5/lib/addons/p5.sound');
  }
}
import_p5sound();
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ContentCreatorInfo, FileInfo, GlobalActService, isDarkMode } from 'src/app/global-act.service';
import { NakamaService } from 'src/app/nakama.service';
import { IonPopover, NavController } from '@ionic/angular/common';
import * as domtoimage from "dom-to-image";
import hljs from "highlight.js";
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import php from 'highlight.js/lib/languages/php';
import json from 'highlight.js/lib/languages/json';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import perl from 'highlight.js/lib/languages/perl';
import basic from 'highlight.js/lib/languages/basic';
import properties from 'highlight.js/lib/languages/properties';
import { ActivatedRoute, Router } from '@angular/router';
import * as marked from "marked";

@Component({
  selector: 'app-ionic-viewer',
  templateUrl: './ionic-viewer.page.html',
  styleUrls: ['./ionic-viewer.page.scss'],
})
export class IonicViewerPage implements OnInit, OnDestroy {

  constructor(
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private loadingCtrl: LoadingController,
    public global: GlobalActService,
    public nakama: NakamaService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
  ) { }

  ngOnDestroy() {
    if (this.CacheMediaObject) {
      if (this.CacheMediaObject.elt != document.pictureInPictureElement)
        this.CacheMediaObject.remove();
      this.CacheMediaObject = null;
    }
    let vid_obj = document.getElementById(this.CurrentVideoId);
    if (vid_obj && vid_obj != document.pictureInPictureElement)
      vid_obj.remove();
    if (!document.pictureInPictureElement) {
      if (this.global.PIPLinkedVideoElement) {
        this.global.PIPLinkedVideoElement.onloadedmetadata = null;
        this.global.PIPLinkedVideoElement.onended = null;
        this.global.PIPLinkedVideoElement.onleavepictureinpicture = null;
      }
      this.global.PIPLinkedVideoElement = null;
      URL.revokeObjectURL(this.FileURL);
    }

    this.cont.abort('파일 뷰어 벗어남');
    this.cont = null;
    if (this.FilenameElement) {
      this.FilenameElement.onblur = null;
      this.FilenameElement.onfocus = null;
    }
    this.global.RestoreShortCutAct('ionic-viewer');
    this.route.queryParams['unsubscribe']();
    if (this.global.PageDismissAct[this.navParams.dismiss])
      this.global.PageDismissAct[this.navParams.dismiss]({});
    this.RemoveP5Relative();
  }

  blob: Blob;
  FileInfo: FileInfo = {};

  p5canvas: p5;
  p5TextArea: HTMLTextAreaElement;
  p5SyntaxHighlightReader: HTMLDivElement;
  RemoveP5Relative() {
    if (this.p5TextArea) {
      this.p5TextArea.remove();
      this.p5TextArea = null;
    }
    if (this.p5SyntaxHighlightReader) {
      this.p5SyntaxHighlightReader.remove();
      this.p5SyntaxHighlightReader = null;
    }
    if (this.p5canvas) {
      try {
        this.p5canvas.remove();
      } catch (e) { }
      this.p5canvas = null;
    }
  }

  FileURL: string;
  ContentBox: HTMLElement;
  FileHeader: HTMLElement;
  FromUserFsDir: boolean;
  CurrentFileSize: string;

  content_creator: ContentCreatorInfo;
  content_related_creator: ContentCreatorInfo[];
  isOfficial: string;
  target: string;
  channelId: string;
  useP5Navigator = true;
  MessageInfo: any;
  /** 내가 보낸 첨부파일인지 검토 */
  IsMyMessage = false;
  Relevances: any[];
  RelevanceIndex = 0;
  /** 상단 숫자를 누르면 첨부파일 번호를 입력할 수 있음, true 일 때 보여짐 */
  CanInputValue = false;
  HaveRelevances = false;
  NeedDownloadFile = false;
  ContentOnLoad = false;
  ContentFailedLoad = true;
  isDownloading = false;
  CurrentViewId: string;
  OpenInChannelChat = false;
  isChannelOnline = true;
  /** 이미지 편집이 가능하다면 해당 메뉴를 보여주기 */
  showEdit = true;
  showEditText = false;
  /** HTML, Markdown 등의 경우 보기 방식을 변경할 수 있음, 변경 가능한지 여부 */
  isConvertible = false;
  /** HTML 직접보기로 보는지 여부 */
  isHTMLViewer = false;
  // 아래 다중 창 지원을 위한 id 분리처리
  ContentBoxId = 'ContentBox';
  FileHeaderId = 'FileHeader';
  TextEditorFileNameId = 'TextEditorFileName';
  menu_triggerId = 'menu_trigger';
  content_viewer_canvasId = 'content_viewer_canvas';

  RelevancesInputId = 'RelevancesInputId';
  /** 첨부파일 순번 라벨을 인풋으로 변경하기 */
  FocusOnIndexInput() {
    this.CanInputValue = true;
    setTimeout(() => {
      document.getElementById(this.RelevancesInputId)?.['focus']();
    }, 100);
  }

  /** 사용자가 직접 첨부파일 순번 입력시 */
  ChangeRelevanceIndex(ev: any) {
    // 엔터를 눌러 종료
    if (ev.key == 'Enter') {
      let targetIndex = Number(ev.target['value']);
      this.ChangeToAnother(targetIndex - this.RelevanceIndex);
      setTimeout(() => {
        this.CanInputValue = false;
      }, 0);
    }
  }

  /** HTML 직접보기 전환  
   * 마크다운 등 전환 보기가 필요한 녀석들은 전부 공유한다
   */
  async ToggleHTMLViewer() {
    this.isHTMLViewer = !this.isHTMLViewer;
    if (this.isHTMLViewer) {
      this.p5canvas.remove();
      // 온전한 재생을 위해 저장 후 재생시킴
      if (this.FileURL.indexOf('blob:') != 0) {
        await this.DownloadFileFromURL();
        let blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo.type);
        this.FileURL = URL.createObjectURL(blob);
      }
      this.p5canvas = new p5((p: p5) => {
        p.setup = () => {
          switch (this.FileInfo.file_ext) {
            case 'html': {
              let iframe = p.createElement('iframe');
              iframe.elt.src = this.FileURL;
              iframe.style('width', '100%');
              iframe.style('height', '100%');
              iframe.style('border', '0');
              iframe.parent(this.canvasDiv);
            } break;
            case 'md':
            case 'markdown': {
              let div = p.createDiv();
              div.style('width', '100%');
              div.style('height', '100%');
              div.style('padding', '16px');
              let markdown_readable = marked.parse(this.p5TextArea.textContent);
              div.elt.innerHTML = markdown_readable;
              div.parent(this.canvasDiv);
            } break;
          }
        }
        p.keyPressed = (ev: any) => {
          if (ev['code'] == 'Escape')
            this.navCtrl.pop();
        }
      });
    } else this.ChangeToAnother(0);
  }

  navParams: any;
  ngOnInit() {
    this.RelevancesInputId = `RelevancesInputId_${Date.now()}`;
    this.cont = new AbortController();
    this.global.StoreShortCutAct('ionic-viewer');
    this.ContentBoxId = `ContentBox_${Date.now()}`;
    this.FileHeaderId = `FileHeader_${Date.now()}`;
    this.TextEditorFileNameId = `TextEditorFileName_${Date.now()}`;
    this.menu_triggerId = `menu_trigger_${Date.now()}`;
    this.content_viewer_canvasId = `content_viewer_canvas_${Date.now()}`;
    this.route.queryParams.subscribe(async _p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        if (!navParams) throw '페이지 복귀';
        this.navParams = navParams;
      } catch (e) {
        this.WaitingLoaded.block = false;
        this.ChangeContentWithKeyInput();
        this.BlockReinit = true;
      }
    });
  }

  WaitingLoaded = {
    block: false,
    share: false,
  };
  ionViewWillEnter() {
    this.global.portalHint = false;
    this.global.BlockMainShortcut = true;
    this.WaitingLoaded.block = true;
    this.PageWillDestroy = false;
  }
  /** 정확히 현재 페이지에서 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (!this.WaitingLoaded.block) {
      await new Promise((done) => setTimeout(done, 0));
    }
    while (this.WaitingLoaded.share) {
      await new Promise((done) => setTimeout(done, 0));
    }
  }

  ionViewDidEnter() {
    this.InnerChangedPage = false;
    this.initialize();
  }

  /** 재진입시 초기화 행동 무시하기 */
  BlockReinit = false;
  initialize() {
    if (this.BlockReinit) return;
    this.MessageInfo = this.navParams.info;
    this.OpenInChannelChat = this.MessageInfo['code'] !== undefined;
    this.CurrentViewId = this.MessageInfo.message_id;
    this.FileInfo = this.MessageInfo.content;
    this.ContentBox = document.getElementById(this.ContentBoxId);
    this.FileHeader = document.getElementById(this.FileHeaderId);
    this.isOfficial = this.navParams.isOfficial;
    this.target = this.navParams.target;
    this.channelId = this.navParams.channel_id;
    try {
      this.IsMyMessage = this.isOfficial == 'local' || this.MessageInfo.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id;
    } catch (e) {
      this.IsMyMessage = false;
    }
    this.isQuickLaunchViewer = this.navParams.quick;
    try {
      this.isChannelOnline = this.nakama.channels_orig[this.isOfficial][this.target][this.MessageInfo['channel_id']].info['status'] == 'online';
      this.isChannelOnline = this.isChannelOnline || this.nakama.channels_orig[this.isOfficial][this.target][this.MessageInfo['channel_id']]['status'] == 'online'
        || this.nakama.channels_orig[this.isOfficial][this.target][this.MessageInfo['channel_id']]['status'] == 'pending';
    } catch (e) { }
    this.FromUserFsDir = this.navParams.no_edit || false;
    switch (this.FileInfo['is_new']) {
      case 'code':
      case 'text':
        break;
      default:
        this.Relevances = this.navParams.relevance || [];
        if (this.Relevances) {
          for (let i = 0, j = this.Relevances.length; i < j; i++)
            if (this.Relevances[i]['message_id'] && this.MessageInfo['message_id']) {
              if (this.Relevances[i]['message_id'] == this.MessageInfo['message_id']) {
                this.RelevanceIndex = i + 1;
                break;
              }
            } else {
              if (this.Relevances[i].content['path'])
                if (this.Relevances[i].content['path'] == this.MessageInfo.content['path']) {
                  this.RelevanceIndex = i + 1;
                  break;
                }
              if (this.Relevances[i].content['url'])
                if (this.Relevances[i].content['url'] == this.MessageInfo.content['url']) {
                  this.RelevanceIndex = i + 1;
                  break;
                }
            }
          this.HaveRelevances = Boolean(this.Relevances.length > 1);
        } else this.HaveRelevances = false;
        this.CreateContentInfo();
        // 채널 채팅으로부터 들어온 경우 모든 대화 목록으로부터 연관 콘테츠 불러오기
        if (this.channelId) {
          const VeryFirstTime = new Date(this.navParams?.relevance[0]?.create_time).getTime();
          let LoadAllRelevances = async () => {
            const TARGET_FOLDER_PATH = `servers/${this.isOfficial}/${this.target}/channels/${this.channelId}/chats/`;
            let list = await this.indexed.GetFileListFromDB(TARGET_FOLDER_PATH);
            for (let i = list.length - 1; i >= 0; i--) {
              let fileInfo = await this.indexed.GetFileInfoFromDB(list[i]);
              switch (fileInfo.mode) {
                // 파일인 경우
                case 33206:
                  let blob = await this.indexed.loadBlobFromUserPath(list[i], '');
                  let text = await blob.text();
                  let json = JSON.parse(text);
                  for (let j = json.length - 1; j >= 0; j--) {
                    const CurrentMsg = json[j];
                    // 파일이 있는 메시지에 한해서 누적시키기
                    if (json[j]?.code != 2 && json[j]?.content?.filename) {
                      if (VeryFirstTime > new Date(json[j].create_time).getTime()) {
                        this.Relevances.unshift(CurrentMsg);
                        this.RelevanceIndex++;
                      }
                    }
                  }
                  break;
                // 폴더인 경우
                case 16893:
                default:
                  break;
              }
            }
          }
          LoadAllRelevances();
        }
        break;
    }
    this.showEdit = !Boolean(this.navParams.noEdit);
    this.init_viewer();
  }

  /** 채널 채팅을 통해 진입한 경우, 해당 메시지 찾아주기 기능 */
  FindMessage() {
    if (this.global.PageDismissAct[this.navParams.dismiss])
      this.global.PageDismissAct[this.navParams.dismiss]({
        data: {
          type: 'find',
          messageId: this.MessageInfo.message_id,
          timestamp: this.MessageInfo.create_time,
        }
      });
    this.navCtrl.pop();
  }

  /** 콘텐츠를 우클릭시 메뉴 발현 */
  canvasDivContextMenu() {
    if (this.FileInfo.viewer != 'blender' && this.FileInfo.viewer != 'text' && this.FileInfo.viewer != 'code') {
      this.OpenFileMenu();
      return false;
    }
  }

  canvasDiv: HTMLElement;
  async reinit_content_data(msg: any) {
    this.CacheMediaObject = null;
    this.CurrentFileSize = null;
    this.NewTextFileName = '';
    this.NeedDownloadFile = false;
    this.ContentOnLoad = false;
    this.ContentFailedLoad = true;
    this.isTextEditMode = false;
    this.isConvertible = false;
    this.isHTMLViewer = false;
    this.MessageInfo = msg;
    try {
      this.IsMyMessage = this.isOfficial == 'local' || this.MessageInfo.sender_id == this.nakama.servers[this.isOfficial][this.target].session.user_id;
    } catch (e) {
      this.IsMyMessage = false;
    }
    this.CurrentViewId = this.MessageInfo.message_id;
    this.FileInfo = this.MessageInfo.content;
    if (this.PageWillDestroy) return;
    this.canvasDiv = document.getElementById(this.content_viewer_canvasId);
    if (this.canvasDiv)
      for (let i = 0, j = this.canvasDiv.childNodes.length; i < j; i++)
        try {
          this.canvasDiv.removeChild(this.canvasDiv.childNodes[i]);
        } catch (e) { }
    URL.revokeObjectURL(this.FileURL);
    if (this.FileInfo.url) {
      this.CreateContentInfo();
      this.NeedDownloadFile = false;
      await this.init_viewer();
    } else {
      let path = this.FileInfo['alt_path'] || this.FileInfo['path'] ||
        `servers/${this.isOfficial}/${this.target}/channels/${msg.channel_id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
      this.image_info['path'] = path;
      this.NeedDownloadFile = await this.indexed.checkIfFileExist(`${path}.history`);
      try {
        this.blob = await this.indexed.loadBlobFromUserPath(path, this.FileInfo['type']);
        this.CreateContentInfo();
        await this.init_viewer();
      } catch (e) {
        this.FileURL = null;
        this.blob = null;
        this.isDownloading = false;
        this.NeedDownloadFile = true;
        this.ContentOnLoad = true;
        this.ContentFailedLoad = false;
        this.CreateContentInfo();
        this.RemoveP5Relative();
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => { p.noCanvas() }
        });
      }
    }
  }

  /** 터치 상호작용 보완용 */
  ContentChanging = false;
  /** 첨부파일 종류별 전환시 하려는 추가행동 */
  ChangeToAnotherAdditionalAct: Function;
  async ChangeToAnother(direction: number) {
    if (this.ContentChanging) return;
    this.ContentChanging = true;
    let tmp_calced = this.RelevanceIndex + direction;
    if (tmp_calced <= 0 || tmp_calced > this.Relevances.length) {
      this.ContentChanging = false;
      return;
    }
    if (this.ChangeToAnotherAdditionalAct)
      this.ChangeToAnotherAdditionalAct();
    this.ChangeToAnotherAdditionalAct = null;
    this.RemoveP5Relative();
    this.RelevanceIndex = tmp_calced;
    this.FileInfo = { file_ext: '' };
    await this.reinit_content_data(this.Relevances[this.RelevanceIndex - 1]);
    this.ContentChanging = false;
    this.CanInputValue = false;
  }

  /** 지원하지 않는 파일에 대해 강제로 텍스트 읽기 시도 */
  ForceReadAsText() {
    if (this.ChangeToAnotherAdditionalAct)
      this.ChangeToAnotherAdditionalAct();
    this.ChangeToAnotherAdditionalAct = null;
    let copied = JSON.parse(JSON.stringify(this.Relevances[this.RelevanceIndex - 1]));
    copied.content['viewer'] = 'text';
    this.FileInfo = { file_ext: '' };
    this.reinit_content_data(copied);
  }

  /** SQL 강제 파일을 다운로드 */
  async DownloadCurrentFile(index?: number) {
    this.isDownloading = true;
    let startFrom = 0;
    let target = this.Relevances[index ?? (this.RelevanceIndex - 1)];
    let path = `servers/${this.isOfficial}/${this.target}/channels/${target.channel_id}/files/msg_${target.message_id}.${target.content['file_ext']}`;
    try {
      let v = await this.indexed.loadTextFromUserPath(`${path}.history`);
      let json = JSON.parse(v);
      startFrom = json['index'];
    } catch (e) { }
    let GetViewId = target.message_id;
    await this.nakama.ReadStorage_From_channel(target, path, this.isOfficial, this.target, startFrom);
    if (this.CurrentViewId == GetViewId) // 현재 보고 있을 때에만 열람 시도
      this.reinit_content_data(target);
  }

  /** 용량 표시 */
  // https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
  formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return;

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  CreateContentInfo() {
    try { // 파일 정보 검토
      this.content_creator = this.FileInfo['content_creator'] || { timestamp: this.FileInfo['timestamp'] } as any;
      this.content_creator.timeDisplay = new Date(this.content_creator.timestamp).toLocaleString();
      this.content_related_creator = this.FileInfo['content_related_creator'] || [];
      if (this.content_creator.user_id)
        try {
          this.content_creator.is_me =
            this.nakama.servers[this.isOfficial][this.target].session.user_id == this.content_creator.user_id;
        } catch (e) { }
      try {
        let CatchedName: string;
        try {
          CatchedName = this.nakama.GetOverrideName(this.content_creator.user_id, this.isOfficial, this.target);
          if (!CatchedName) CatchedName = this.nakama.users[this.isOfficial][this.target][this.content_creator.user_id]['display_name'];
        } catch (e) { }
        this.content_creator.publisher
          = this.content_creator.is_me ? this.nakama.users.self['display_name']
            : (CatchedName || this.content_creator.publisher || this.content_creator.display_name);
      } catch (e) { }
      this.set_various_display(this.content_creator);
      for (let i = 0, j = this.content_related_creator.length; i < j; i++) {
        if (this.content_related_creator[i].user_id) {
          try {
            this.content_related_creator[i].is_me =
              this.nakama.servers[this.isOfficial][this.target].session.user_id == this.content_related_creator[i].user_id;
          } catch (e) { }
        }
        this.content_related_creator[i].timeDisplay = new Date(this.content_related_creator[i].timestamp).toLocaleString();
      }
    } catch (e) { }
    try { // 시간순 정렬
      this.content_related_creator.sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1;
        else if (a.timestamp < b.timestamp) return 1;
        else return 0;
      });
    } catch (e) { }
    for (let rel_info of this.content_related_creator)
      delete rel_info.hidden;
    for (let related_creator of this.content_related_creator) {
      let CatchedName: string;
      try {
        CatchedName = this.nakama.GetOverrideName(related_creator.user_id, this.isOfficial, this.target);
        if (!CatchedName) CatchedName = this.nakama.users[this.isOfficial][this.target][related_creator.user_id]['display_name'];
      } catch (e) { }
      try {
        related_creator.publisher = related_creator.is_me ? this.nakama.users.self['display_name'] :
          (CatchedName || related_creator.publisher || related_creator.display_name);
      } catch (e) { }
    }
    try { // 중복 정보 통합
      if (this.content_creator.timestamp == this.content_related_creator[0].timestamp)
        this.content_related_creator[0].hidden = true;
    } catch (e) { }
  }

  set_various_display(target: ContentCreatorInfo) {
    switch (target.various) {
      case 'camera':
        target['various_display'] = this.lang.text['GlobalAct']['FromCamera'];
        break;
      case 'link':
        target['various_display'] = this.lang.text['ChatRoom']['ExternalLinkFile'];
        break;
      case 'loaded':
        target['various_display'] = this.lang.text['GlobalAct']['variousCreator'];
        break;
      case 'voidDraw':
        target['various_display'] = this.lang.text['GlobalAct']['FromVoidDraw'];
        break;
      case 'long_text':
        target['various_display'] = this.lang.text['GlobalAct']['FromAutoLongText'];
        break;
      case 'textedit':
        target['various_display'] = this.lang.text['GlobalAct']['FromTextEditor'];
        break;
      case 'shared':
        target['various_display'] = this.lang.text['GlobalAct']['SharedContent'];
        break;
      default:
        target['various_display'] = this.lang.text['GlobalAct']['UnknownSource'];
        break;
    }
  }

  close_text_edit() {
    if (this.FileInfo['is_new']) {
      this.navCtrl.pop();
    } else this.ChangeToAnother(0);
  }

  /** URL 링크인 경우 파일을 로컬에 다운받기 */
  async DownloadFileFromURL() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    this.ContentChanging = true;
    try {
      let res = await fetch(this.FileInfo.url, { signal: this.cont.signal });
      if (res.ok) {
        let blob = await res.blob();
        await this.indexed.saveBlobToUserPath(blob, this.FileInfo.alt_path || this.FileInfo.path);
        this.CurrentFileSize = this.formatBytes(this.FileInfo['size'] || this.FileInfo['filesize'] || blob.size);
      } else throw res.statusText;
    } catch (e) {
      console.log('다운받기 실패: ', e);
      this.p5toast.show({
        text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`,
      });
    }
    this.ContentChanging = false;
    loading.dismiss();
  }
  /** p5.video 가 생성된 경우 여기에 기록 */
  CacheMediaObject: any;
  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;
  /** 비디오/오디오 콘텐츠가 종료되면 끝에서 다음 콘텐츠로 자동 넘김 */
  AutoPlayNext = false;
  CurrentVideoId = 'ionicviewer_vid_obj';
  @ViewChild('FileMenu') FileMenu: IonPopover;
  async init_viewer() {
    if (this.FilenameElement) {
      this.FilenameElement.onblur = null;
      this.FilenameElement.onfocus = null;
    }
    try { // 로컬에서 파일 찾기 우선 작업
      this.blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo['type']);
      this.FileURL = URL.createObjectURL(this.blob);
      this.CurrentFileSize = this.formatBytes(this.FileInfo.size || this.FileInfo['filesize'] || this.blob?.size);
    } catch (e) {
      try { // 로컬에 파일이 없다면 URL 주소 정보를 검토하여 작업
        if (this.FileInfo.url) {
          let res = await fetch(this.FileInfo.url, { signal: this.cont.signal });
          if (!res.ok) throw 'URL 링크 깨짐';
          this.FileURL = this.FileInfo.url;
        } else throw 'URL 없음'
      } catch (e) { // 링크가 없거나 깨졌다면 로컬에서 불러오기 시도
        this.ContentOnLoad = true;
        this.ContentFailedLoad = Boolean(!this.FileURL);
      }
    }
    this.forceWrite = false;
    await new Promise((done) => setTimeout(done, 0));
    this.canvasDiv = document.getElementById(this.content_viewer_canvasId);
    if (this.canvasDiv) this.canvasDiv.style.backgroundImage = '';
    if (!this.WaitingLoaded.block) return;
    // 경우에 따라 로딩하는 캔버스를 구분
    switch (this.FileInfo['viewer']) {
      case 'image': // 이미지
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            this.canvasDiv.style.maxWidth = '100%';
            this.canvasDiv.style.overflow = 'hidden';
            this.ContentBox.style.overflow = 'hidden';
            p.noCanvas();
            let img = p.createElement('img');
            img.elt.hidden = true;
            img.elt.src = this.FileURL;
            img.elt.onload = () => {
              this.canvasDiv.style.backgroundImage = `url('${this.FileURL}')`;
              this.canvasDiv.style.backgroundRepeat = 'no-repeat';
              this.image_info['width'] = img.elt.naturalWidth;
              this.image_info['height'] = img.elt.naturalHeight;
              imageOriginalSize = p.createVector(img.elt.naturalWidth, img.elt.naturalHeight);
              if (this.image_info['width'] / this.image_info['height'] < this.canvasDiv.clientWidth / this.canvasDiv.clientHeight) {
                let tmp_width = this.image_info['width'] * this.canvasDiv.clientHeight / this.image_info['height'];
                this.canvasDiv.style.backgroundSize = `${tmp_width}px`;
                this.canvasDiv.style.backgroundPositionX = `${(this.canvasDiv.clientWidth - tmp_width) / 2}px`;
                this.canvasDiv.style.backgroundPositionY = `0px`;
              } else {
                this.canvasDiv.style.backgroundSize = `${this.canvasDiv.clientWidth}px`;
                this.canvasDiv.style.backgroundPositionX = `0px`;
                let imageRatio = this.canvasDiv.clientWidth / imageOriginalSize.x;
                let centerHeight =
                  this.canvasDiv.clientHeight / 2 - imageOriginalSize.y * imageRatio / 2;
                this.canvasDiv.style.backgroundPositionY = `${centerHeight}px`;
              }
              RePositioningImage();
              img.remove();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
              img.elt.onload = null;
            }
            p.noLoop();
          }
          p.draw = () => {
            if (ReinitImage) {
              ReinitLerp += .07;
              if (ReinitLerp >= 1) {
                ReinitImage = false;
                ReinitLerp = 1;
                isInitStatus = true;
                p.noLoop();
              }
              if (this.image_info['width'] / this.image_info['height'] < this.canvasDiv.clientWidth / this.canvasDiv.clientHeight) {
                let tmp_width = this.image_info['width'] * this.canvasDiv.clientHeight / this.image_info['height'];
                this.canvasDiv.style.backgroundSize = `${p.lerp(StartBackgroundSize, tmp_width, ReinitLerp)}px`;
                this.canvasDiv.style.backgroundPositionX = `${p.lerp(StartPositionX, (this.canvasDiv.clientWidth - tmp_width) / 2, ReinitLerp)}px`;
                this.canvasDiv.style.backgroundPositionY = `${p.lerp(StartPositionY, 0, ReinitLerp)}px`;
              } else {
                this.canvasDiv.style.backgroundSize = `${p.lerp(StartBackgroundSize, this.canvasDiv.clientWidth, ReinitLerp)}px`;
                this.canvasDiv.style.backgroundPositionX = `${p.lerp(StartPositionX, 0, ReinitLerp)}px`;
                let imageRatio = this.canvasDiv.clientWidth / imageOriginalSize.x;
                let centerHeight =
                  this.canvasDiv.clientHeight / 2 - imageOriginalSize.y * imageRatio / 2;
                this.canvasDiv.style.backgroundPositionY = `${p.lerp(StartPositionY, centerHeight, ReinitLerp)}px`;
              }
            }
          }
          // 재조정 애니메이션을 위한 추가 변수
          let ReinitImage = false;
          let ReinitLerp = 0;
          let StartBackgroundSize = 0;
          let StartPositionX = 0;
          let StartPositionY = 0;
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let RePositioningImage = () => {
            ReinitImage = true;
            ReinitLerp = 0;
            StartBackgroundSize = Number(this.canvasDiv.style.backgroundSize.split('px').shift());
            StartPositionX = Number(this.canvasDiv.style.backgroundPositionX.split('px').shift());
            StartPositionY = Number(this.canvasDiv.style.backgroundPositionY.split('px').shift());
            p.loop();
          }
          p.windowResized = () => {
            setTimeout(() => {
              RePositioningImage();
            }, 50);
          }
          let imageOriginalSize: p5.Vector;
          let lastPos: p5.Vector = p.createVector();
          let startPos: p5.Vector = p.createVector();
          let endPos: p5.Vector = p.createVector();
          let lastScale: number = 1;
          let TransformImage = () => {
            this.canvasDiv.style.backgroundPositionX = `${lastPos.x + endPos.x}px`;
            this.canvasDiv.style.backgroundPositionY = `${lastPos.y + endPos.y}px`;
          }
          let ScaleImage = (center: p5.Vector, ratio: number) => {
            let beforeCalced = lastScale;
            let Calced = lastScale * ratio;
            let posX = Number(this.canvasDiv.style.backgroundPositionX.split('px')[0]);
            let posY = Number(this.canvasDiv.style.backgroundPositionY.split('px')[0]);
            let widthMoved = (beforeCalced - Calced) * p.map(center.x, posX, posX + beforeCalced, 0, 1);
            let scaledImageHeight = (beforeCalced - Calced) / imageOriginalSize.x * imageOriginalSize.y;
            let heightMoved = scaledImageHeight * p.map(center.y, posY, posY + beforeCalced / imageOriginalSize.x * imageOriginalSize.y, 0, 1);
            this.canvasDiv.style.backgroundPositionX = `${posX + widthMoved}px`
            this.canvasDiv.style.backgroundPositionY = `${posY + heightMoved}px`;
            this.canvasDiv.style.backgroundSize = `${Calced}px`;
          }
          p.mousePressed = () => {
            if (!this.useP5Navigator) return;
            if (p.mouseButton == p.CENTER)
              RePositioningImage();
            if (isPlatform == 'DesktopPWA') {
              lastPos =
                p.createVector(
                  Number(this.canvasDiv.style.backgroundPositionX.split('px')[0]),
                  Number(this.canvasDiv.style.backgroundPositionY.split('px')[0]));
              startPos = p.createVector(p.mouseX, p.mouseY);
            }
          }
          p.mouseWheel = (ev: any) => {
            if (!this.useP5Navigator) return;
            lastScale = Number(this.canvasDiv.style.backgroundSize.split('px')[0]);
            ScaleImage(p.createVector(this.canvasDiv.clientWidth / 2, this.canvasDiv.clientHeight / 2), 1 - ev.delta / 1000);
          }
          p.mouseDragged = () => {
            if (!this.useP5Navigator) return;
            if (isPlatform == 'DesktopPWA') {
              endPos = p.createVector(p.mouseX, p.mouseY);
              endPos.sub(startPos);
              TransformImage();
            }
          }
          let touches: { [id: string]: p5.Vector } = {};
          /** 두 점 사이의 거리 */
          let dist_two: number;
          let Repositioning = false;
          /** init 직후 스케일 조정이 없는 상태인 경우 */
          let isInitStatus = true;
          p.touchStarted = (ev: any) => {
            if (!this.useP5Navigator) return;
            for (let i = 0, j = ev.changedTouches.length; i < j; i++)
              touches[ev.changedTouches[i].identifier] =
                p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
            let size = Object.keys(touches).length;
            switch (size) {
              case 1: // 첫 탭
                lastPos =
                  p.createVector(
                    Number(this.canvasDiv.style.backgroundPositionX.split('px')[0]),
                    Number(this.canvasDiv.style.backgroundPositionY.split('px')[0]));
                startPos = touches[ev.changedTouches[0].identifier].copy();
                break;
              case 2: // 두번째 손가락이 들어옴
                lastPos =
                  p.createVector(
                    Number(this.canvasDiv.style.backgroundPositionX.split('px')[0]),
                    Number(this.canvasDiv.style.backgroundPositionY.split('px')[0]));
                let firstCopy = touches[0].copy();
                dist_two = firstCopy.dist(touches[1]);
                startPos = firstCopy.add(touches[1]).div(2).copy();
                lastScale = Number(this.canvasDiv.style.backgroundSize.split('px')[0]);
                TransformImage();
                break;
              default: // 그 이상은 정렬
                Repositioning = true;
                RePositioningImage();
                break;
            }
          }
          p.touchMoved = (ev: any) => {
            if (!this.useP5Navigator) return;
            if (!Repositioning) {
              for (let i = 0, j = ev.changedTouches.length; i < j; i++)
                touches[ev.changedTouches[i].identifier] =
                  p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
              let size = Object.keys(touches).length;
              switch (size) {
                case 1: // 이동
                  endPos = touches[ev.changedTouches[0].identifier].copy();
                  endPos.sub(startPos);
                  if (!isInitStatus)
                    TransformImage();
                  break;
                case 2: // 이동, 스케일
                  isInitStatus = false;
                  let firstCopy = touches[0].copy();
                  let dist = firstCopy.dist(touches[1]);
                  endPos = firstCopy.add(touches[1]).div(2).copy();
                  let centerPos = endPos.copy()
                  endPos.sub(startPos);
                  TransformImage();
                  ScaleImage(centerPos, dist / dist_two);
                  break;
              }
            }
            if (!this.PageWillDestroy)
              return false;
          }
          const SWIPE_SIZE = 50;
          p.touchEnded = (ev: any) => {
            if (!this.useP5Navigator) return;
            if ('changedTouches' in ev) {
              for (let i = 0, j = ev.changedTouches.length; i < j; i++)
                delete touches[ev.changedTouches[i].identifier];
              let size = Object.keys(touches).length;
              switch (size) {
                case 1: // 아직 이동중
                  lastPos =
                    p.createVector(
                      Number(this.canvasDiv.style.backgroundPositionX.split('px')[0]),
                      Number(this.canvasDiv.style.backgroundPositionY.split('px')[0]));
                  startPos = touches[Object.keys(touches)[0]].copy();
                  break;
                case 0: // 손을 전부 뗌
                  if (isInitStatus && !Repositioning) {
                    if (endPos.x > SWIPE_SIZE)
                      this.ChangeToAnother(-1);
                    else if (endPos.x < -SWIPE_SIZE)
                      this.ChangeToAnother(1);
                  }
                  Repositioning = false;
                  break;
              }
            }
          }
        });
        break;
      case 'audio': // 오디오
        this.p5canvas = new p5((p: p5) => {
          let mediaObject: p5.MediaElement;
          let canvas: p5.Renderer;
          let musicList: p5.Element;
          /** 음악 리스트에서의 현재 재생하는 음악의 순번 */
          let CurrentIndex = -1;
          /** 현재 재생중인 음악 표시용 */
          let FocusOnThis = undefined;
          let fft: p5.FFT;
          let sound: p5.SoundFile;
          let gainNode: p5.Gain;
          let isSyncing = false;
          /** 보안 페이지로 스펙트럼 표시가 가능한지 검토 */
          let isSafePage = false;
          p.setup = () => {
            isSafePage = (window.location.protocol != 'http:' || window.location.host.indexOf('localhost') == 0);
            if (isSafePage) {
              canvas = p.createCanvas(this.canvasDiv.clientWidth, this.canvasDiv.clientHeight / 2);
              canvas.parent(this.canvasDiv);
              musicList = p.createDiv();
              musicList.style('display', 'block');
              musicList.style('width', '100%');
              musicList.style('height', '50%');
              musicList.style('max-height', `${this.canvasDiv.clientHeight / 2}px`);
              musicList.style('overflow-y', 'scroll');
              musicList.style('padding', '40px 16px 16px');
              musicList.parent(this.canvasDiv);
              /** 음악들만 모은 리스트 정보 */
              let playList = [];
              for (let i = 0, j = this.Relevances.length; i < j; i++)
                if (this.Relevances[i].content.viewer == 'audio') {
                  if (i == this.RelevanceIndex - 1) CurrentIndex = playList.length;
                  playList.push(this.Relevances[i]);
                }
              for (let i = 0, j = playList.length; i < j; i++) {
                let item = p.createDiv(playList[i].content.filename);
                item.style('padding', '10px');
                item.style('border', '1px solid #ccc');
                item.style('background-color', 'transparent');
                item.style('margin-bottom', '5px');
                item.style('border-radius', '5px');
                item.style('cursor', 'pointer');
                let targetIndex = i - CurrentIndex;
                if (targetIndex == 0) {
                  item.style('background-color', 'var(--list-shortcut-hint-background)');
                  FocusOnThis = item;
                }
                item.mouseClicked(() => {
                  if (CurrentIndex < 0) return;
                  if (targetIndex != 0) this.ChangeToAnother(targetIndex);
                });
                item.parent(musicList);
              }
              if (FocusOnThis) FocusOnThis.elt.scrollIntoView({ block: 'center', behavior: 'smooth' });
              p.frameRate(8);
              p.pixelDensity(.4);
              p.noStroke();
              p.loop();
            } else {
              p.noCanvas();
              p.noLoop();
            }
            let cacheURL = this.FileURL;
            mediaObject = p.createAudio([this.FileURL], () => {
              if (cacheURL != this.FileURL) {
                p.remove();
                return;
              }
              mediaObject['elt'].setAttribute('style', 'position: absolute; top: 50%; left: 50%; transform: translateX(-50%) translateY(-50%); width: 100%');
              let audioElements = document.querySelectorAll('audio');
              for (let i = 0, j = audioElements.length; i < j; i++)
                if (audioElements[i] != mediaObject.elt)
                  audioElements[i].remove();
              if (isSafePage) {
                fft = new p5.FFT();
                gainNode = new p5.Gain();
                gainNode.amp(0);
                p.loadSound(this.FileURL, v => {
                  if (cacheURL != this.FileURL) {
                    p.remove();
                    return;
                  }
                  this.ChangeToAnotherAdditionalAct = () => {
                    sound.disconnect();
                    gainNode.disconnect();
                  }
                  sound = v;
                  this.ContentOnLoad = true;
                  this.ContentFailedLoad = false;
                  sound.disconnect();
                  sound.play();
                  sound.connect(gainNode);
                  fft.setInput(v);
                }, e => {
                  console.log('음악 파일 읽기 실패: ', e);
                  this.ContentOnLoad = true;
                  this.ContentFailedLoad = true;
                });
              }
              this.canvasDiv.appendChild(mediaObject['elt']);
              mediaObject['elt'].onended = async () => {
                if (this.AutoPlayNext) {
                  let ChangeTo = -1;
                  for (let i = this.RelevanceIndex, j = this.Relevances.length, k = 1; i < j; i++, k++)
                    if (this.Relevances[i].content.viewer == 'audio') {
                      ChangeTo = k;
                      break;
                    }
                  if (ChangeTo > 0) {
                    if (this.PageWillDestroy) {
                      if (ChangeTo > this.Relevances.length) return;
                      this.RelevanceIndex = this.RelevanceIndex + ChangeTo;
                      let nextFileInfo = this.Relevances[this.RelevanceIndex - 1];
                      URL.revokeObjectURL(this.FileURL);
                      if (nextFileInfo.content.url) {
                        this.FileURL = nextFileInfo.content.url;
                      } else {
                        let blob = await this.indexed.loadBlobFromUserPath(nextFileInfo.content.path, nextFileInfo.content.type);
                        this.FileURL = URL.createObjectURL(blob);
                      }
                      mediaObject['elt'].src = this.FileURL;
                      mediaObject.play();
                    } else this.ChangeToAnother(ChangeTo);
                  }
                }
              }
              ResizeAudio();
              mediaObject['elt'].hidden = false;
              mediaObject['elt'].onplay = () => {
                if (sound) sound.play();
              }
              mediaObject['elt'].onpause = () => {
                if (sound) sound.pause();
              }
              mediaObject['elt'].onseeked = () => {
                if (sound) sound.jump(mediaObject.elt.currentTime, 0);
              }
              mediaObject['elt'].ontimeupdate = () => {
                if (!isSyncing) {
                  isSyncing = true;
                  if (sound) sound.jump(mediaObject.elt.currentTime, 0);
                  isSyncing = false;
                }
              }
              mediaObject['elt'].onloadedmetadata = () => {
                ResizeAudio();
                mediaObject['elt'].hidden = false;
                mediaObject['elt'].onloadedmetadata = null;
              }
              mediaObject.showControls();
              mediaObject.play();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            });
            mediaObject['elt'].hidden = true;
            numBins = p.floor(p.width / 30);
            this.CacheMediaObject = mediaObject;
          }
          /** 구간 수 (예: 8개의 구간으로 나누기) */
          let numBins = 16;
          /** 각 바간 간경 (옆으로) */
          let BinMargin = 2;
          /** 각 바의 파트 높이 (위로) */
          let SepBarHeight = 16;
          p.draw = () => {
            if (!isSafePage) return;
            p.clear(255, 255, 255, 0);
            if (sound && mediaObject) {
              let spectrum = fft.analyze();
              let binSize = Math.floor(spectrum.length / numBins);  // 각 구간에 해당하는 스펙트럼 크기
              let barWidth = p.width / numBins; // 바 너비 계산
              for (let i = 0, j = spectrum.length; i < j; i++) {
                let startBin = i * binSize;
                let endBin = (i + 1) * binSize;

                let avg = 0;
                // 각 구간의 평균을 구하기
                for (let j = startBin; j < endBin; j++)
                  avg += spectrum[j];
                avg /= binSize;
                // 평균 값을 높이로 변환하여 바를 그림
                let h = p.map(avg, 0, 255, 0, p.height);
                // 높이별로 바를 추가로 분리시킴
                for (let k = p.ceil(p.height / SepBarHeight), l = k; k >= 0; k--) {
                  if (p.height - SepBarHeight * k > h) break;
                  if (isDarkMode)
                    p.fill(p.min((l - k) * 10, 255), p.min((l - k) * 4, 255));
                  else p.fill(p.min(255 - (l - k) * 10, 255), p.min((l - k) * 4, 255));
                  // 바를 그릴 때 각 구간에 대해 하나의 바를 그립니다
                  p.rect(i * barWidth + BinMargin, SepBarHeight * k - BinMargin, barWidth - 2 * BinMargin, -SepBarHeight + BinMargin * 2);
                }
              }
            }
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeAudio = () => {
            if (isSafePage) {
              p.resizeCanvas(this.canvasDiv.clientWidth, this.canvasDiv.clientHeight / 2);
              musicList.style('max-height', `${this.canvasDiv.clientHeight / 2}px`);
              if (FocusOnThis) FocusOnThis.elt.scrollIntoView({ block: 'center', behavior: 'smooth' });
              numBins = p.floor(p.width / 30);
            }
          }
          p.windowResized = () => {
            musicList.style('max-height', '46px');
            setTimeout(() => {
              ResizeAudio();
            }, 100);
          }
          let startPos: p5.Vector = p.createVector();
          let touches: { [id: string]: p5.Vector } = {};
          p.touchStarted = (ev: any) => {
            if (!this.useP5Navigator || document.pictureInPictureElement) return;
            if ('changedTouches' in ev) {
              for (let i = 0, j = ev.changedTouches.length; i < j; i++)
                touches[ev.changedTouches[i].identifier] =
                  p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
              let size = Object.keys(touches).length;
              switch (size) {
                case 1: // 첫 탭
                  startPos = touches[ev.changedTouches[0].identifier].copy();
                  break;
                default: // 그 이상은 무시
                  break;
              }
            }
          }
          const SWIPE_SIZE = 50;
          p.touchEnded = (ev: any) => {
            if (!this.useP5Navigator || document.pictureInPictureElement) return;
            if ('changedTouches' in ev) {
              let lastPos: p5.Vector;
              for (let i = 0, j = ev.changedTouches.length; i < j; i++) {
                lastPos = p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
                delete touches[ev.changedTouches[i].identifier];
              }
              let size = Object.keys(touches).length;
              switch (size) {
                case 0: // 손을 전부 뗌
                  lastPos.sub(startPos);
                  if (lastPos.x > SWIPE_SIZE)
                    this.ChangeToAnother(-1);
                  else if (lastPos.x < -SWIPE_SIZE)
                    this.ChangeToAnother(1);
                  break;
              }
            }
          }
        });
        break;
      case 'video': // 비디오
        this.p5canvas = new p5((p: p5) => {
          let mediaObject: p5.MediaElement;
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            let cacheURL = this.FileURL;
            mediaObject = p.createVideo([this.FileURL], () => {
              if (cacheURL != this.FileURL) {
                p.remove();
                return;
              }
              let videoElements = document.querySelectorAll('video');
              for (let i = 0, j = videoElements.length; i < j; i++)
                if (videoElements[i] != mediaObject.elt)
                  videoElements[i].remove();
              this.CurrentVideoId = `ionicviewer_vid_obj_${Date.now()}`;
              mediaObject.id(this.CurrentVideoId);
              if (this.global.PIPLinkedVideoElement) {
                mediaObject.elt.remove();
                mediaObject.elt = this.global.PIPLinkedVideoElement;
                mediaObject.elt.setAttribute('src', this.FileURL);
              } else {
                this.global.PIPLinkedVideoElement = mediaObject['elt'];
                this.global.PIPLinkedVideoElement.onleavepictureinpicture = () => {
                  this.global.PIPLinkedVideoElement.onloadedmetadata = null;
                  this.global.PIPLinkedVideoElement.onended = null;
                  this.global.PIPLinkedVideoElement.onleavepictureinpicture = null;
                  // 페이지를 나간 상태라면 PIP 종료와 동시에 비디오 삭제
                  if (!document.getElementById(this.CurrentVideoId)) {
                    this.global.PIPLinkedVideoElement.onplay = null;
                    this.global.PIPLinkedVideoElement.src = '';
                    this.global.PIPLinkedVideoElement.load();
                    this.global.PIPLinkedVideoElement.remove();
                    this.global.PIPLinkedVideoElement = null;
                  }
                }
              }
              try {
                mediaObject.parent(this.canvasDiv);
              } catch (e) {
                mediaObject.remove();
              }
              this.image_info['width'] = mediaObject['elt']['videoWidth'];
              this.image_info['height'] = mediaObject['elt']['videoHeight'];
              ResizeVideo();
              mediaObject['elt'].hidden = false;
              mediaObject['elt'].onloadedmetadata = () => {
                this.image_info['width'] = mediaObject['elt']['videoWidth'];
                this.image_info['height'] = mediaObject['elt']['videoHeight'];
                ResizeVideo();
                mediaObject['elt'].hidden = false;
                mediaObject['elt'].onloadedmetadata = null;
              }
              mediaObject['elt'].onended = () => {
                if (this.AutoPlayNext) {
                  if (this.PageWillDestroy) {
                    SearchAndPlayNextVideo();
                  } else {
                    this.ChangeToAnother(1);
                    mediaObject['elt'].onended = null;
                  }
                } else if (this.PageWillDestroy) {
                  if (document.pictureInPictureElement)
                    document.exitPictureInPicture();
                }
              }
              mediaObject.showControls();
              mediaObject.play();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            });
            this.CacheMediaObject = mediaObject;
          }
          let SearchAndPlayNextVideo = async () => {
            let tmp_calced = this.RelevanceIndex + 1;
            if (tmp_calced > this.Relevances.length) {
              if (document.pictureInPictureElement)
                document.exitPictureInPicture();
              return;
            }
            this.RelevanceIndex = tmp_calced;
            let nextFileInfo = this.Relevances[this.RelevanceIndex - 1];
            if (nextFileInfo.content.viewer != 'video') {
              SearchAndPlayNextVideo();
              return;
            }
            URL.revokeObjectURL(this.FileURL);
            if (nextFileInfo.content.url) {
              this.FileURL = nextFileInfo.content.url;
            } else {
              let blob = await this.indexed.loadBlobFromUserPath(nextFileInfo.content.path, nextFileInfo.content.type);
              this.FileURL = URL.createObjectURL(blob);
            }
            mediaObject['elt'].src = this.FileURL;
            mediaObject.play();
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeVideo = () => {
            let canvasWidth = this.ContentBox.offsetWidth;
            let canvasHeight = this.ContentBox.offsetHeight - this.FileHeader.offsetHeight;
            let width = mediaObject['elt']['videoWidth'];
            let height = mediaObject['elt']['videoHeight'];
            if (width == 0 || height == 0) return;
            let canvasRatio = canvasWidth / canvasHeight;
            let videoRatio = width / height;
            if (canvasRatio > videoRatio) { // 세로 영상
              height = canvasHeight;
              width = width / mediaObject['elt']['videoHeight'] * height;
              mediaObject['elt'].setAttribute('style', 'position: relative; left: 50%; transform: translateX(-50%);');
            } else { // 가로 영상
              width = canvasWidth;
              height = (height / mediaObject['elt']['videoWidth'] * width) || (canvasHeight / 2);
              mediaObject['elt'].setAttribute('style', 'position: relative; top: 50%; left: 50%; transform: translateX(-50%) translateY(-50%);');
            }
            mediaObject['size'](width, height);
          }
          p.windowResized = () => {
            setTimeout(() => {
              ResizeVideo();
            }, 50);
          }
          let startPos: p5.Vector = p.createVector();
          let touches: { [id: string]: p5.Vector } = {};
          p.touchStarted = (ev: any) => {
            if (!this.useP5Navigator || document.pictureInPictureElement) return;
            if ('changedTouches' in ev) {
              for (let i = 0, j = ev.changedTouches.length; i < j; i++)
                touches[ev.changedTouches[i].identifier] =
                  p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
              let size = Object.keys(touches).length;
              switch (size) {
                case 1: // 첫 탭
                  startPos = touches[ev.changedTouches[0].identifier].copy();
                  break;
                default: // 그 이상은 무시
                  break;
              }
            }
          }
          const SWIPE_SIZE = 50;
          p.touchEnded = (ev: any) => {
            if (!this.useP5Navigator || document.pictureInPictureElement) return;
            if ('changedTouches' in ev) {
              let lastPos: p5.Vector;
              for (let i = 0, j = ev.changedTouches.length; i < j; i++) {
                lastPos = p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
                delete touches[ev.changedTouches[i].identifier];
              }
              let size = Object.keys(touches).length;
              switch (size) {
                case 0: // 손을 전부 뗌
                  lastPos.sub(startPos);
                  if (lastPos.x > SWIPE_SIZE)
                    this.ChangeToAnother(-1);
                  else if (lastPos.x < -SWIPE_SIZE)
                    this.ChangeToAnother(1);
                  break;
              }
            }
          }
        });
        break;
      case 'code':
      case 'text': // 텍스트 파일
        this.showEditText = !Boolean(this.navParams.noTextEdit);
        let ext_lower = this.FileInfo.file_ext?.toLowerCase();
        this.isConvertible = ext_lower == 'html' || ext_lower == 'markdown' || ext_lower == 'md';
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            let textArea = p.createElement('textarea');
            textArea.elt.disabled = true;
            textArea.elt.className = 'infobox';
            textArea.elt.setAttribute('style', 'height: 100%; display: block;');
            textArea.elt.textContent = '';
            let hint = p.createDiv('Enter');
            hint.style('position', 'absolute');
            hint.style('border-radius', '8px');
            hint.style('padding', '2px 8px');
            hint.style('margin', '4px');
            hint.style('pointer-events', 'none');
            hint.elt.className = 'shortcut_hint';
            hint.hide();
            hint.parent(this.canvasDiv);
            this.ShowEditShortcutHint = hint.elt;
            this.canvasDiv.appendChild(textArea.elt);
            this.p5TextArea = textArea.elt;
            if (this.FileInfo['is_new']) {
              this.open_text_editor();
            } else p.loadStrings(this.FileURL, v => {
              textArea.elt.textContent = v.join('\n');
              this.open_text_reader(p);
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            }, _e => {
              this.FileInfo['else'] = true; // 일반 미디어 파일이 아님을 알림
              this.ContentOnLoad = true;
            });
          }
          p.windowResized = () => {
            let target_height = window.innerHeight - 45 - 56;
            this.p5SyntaxHighlightReader.setAttribute('style', `height: ${target_height}px; display: ${this.isTextEditMode ? 'none' : 'block'}; overflow-y: scroll;`);
          }
          let startPos: p5.Vector = p.createVector();
          let touches: { [id: string]: p5.Vector } = {};
          p.touchStarted = (ev: any) => {
            if (!this.useP5Navigator || document.pictureInPictureElement) return;
            if ('changedTouches' in ev) {
              for (let i = 0, j = ev.changedTouches.length; i < j; i++)
                touches[ev.changedTouches[i].identifier] =
                  p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
              let size = Object.keys(touches).length;
              switch (size) {
                case 1: // 첫 탭
                  startPos = touches[ev.changedTouches[0].identifier].copy();
                  break;
                default: // 그 이상은 무시
                  break;
              }
            }
          }
          const SWIPE_SIZE = 50;
          p.touchEnded = (ev: any) => {
            if (!this.useP5Navigator || document.pictureInPictureElement) return;
            if ('changedTouches' in ev) {
              let lastPos: p5.Vector;
              for (let i = 0, j = ev.changedTouches.length; i < j; i++) {
                lastPos = p.createVector(ev.changedTouches[i].clientX, ev.changedTouches[i].clientY);
                delete touches[ev.changedTouches[i].identifier];
              }
              let size = Object.keys(touches).length;
              switch (size) {
                case 0: // 손을 전부 뗌
                  lastPos.sub(startPos);
                  // 텍스트는 보통 상하 스크롤을 쓰기 때문에 좌우 스크롤 비율을 2배로 조정한다
                  if (lastPos.x > SWIPE_SIZE * 2)
                    this.ChangeToAnother(-1);
                  else if (lastPos.x < -SWIPE_SIZE * 2)
                    this.ChangeToAnother(1);
                  break;
              }
            }
          }
        });
        break;
      case 'godot':
        let ThumbnailURL: string;
        let GetViewId = this.MessageInfo.message_id;
        try {
          let thumbnail = await this.indexed.loadBlobFromUserPath((this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.path)
            + '_thumbnail.png', '');
          ThumbnailURL = URL.createObjectURL(thumbnail);
        } catch (e) { }
        if (!this.FileInfo.blob)
          try {
            this.FileInfo.blob = await this.indexed.loadBlobFromUserPath(
              this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.path, '', undefined, this.indexed.ionicDB);
          } catch (e) { }
        if (!this.NeedDownloadFile && this.CurrentViewId == GetViewId)
          setTimeout(() => {
            this.FileInfo.cont = this.cont;
            this.global.CreateGodotIFrameWithDuplicateAct(this.FileInfo, this.content_viewer_canvasId, {
              path: 'tmp_files/duplicate/viewer.pck',
              alt_path: this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.path,
              url: this.FileInfo.url,
              background: ThumbnailURL,
              receive_image: async (base64: string, width: number, height: number) => {
                let tmp_path = 'tmp_files/modify_image.png';
                await this.indexed.saveBase64ToUserPath(',' + base64, tmp_path);
                if (this.global.PageDismissAct[this.navParams.dismiss])
                  this.global.PageDismissAct[this.navParams.dismiss]({
                    data: {
                      type: 'image',
                      path: tmp_path,
                      width: width,
                      height: height,
                      msg: this.MessageInfo,
                      index: this.RelevanceIndex - 1,
                    }
                  });
                this.navCtrl.pop();
              }
            }, () => {
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
              if (ThumbnailURL) URL.revokeObjectURL(ThumbnailURL);
            }, () => {
              this.ContentOnLoad = true;
              this.ContentFailedLoad = true;
              if (ThumbnailURL) URL.revokeObjectURL(ThumbnailURL);
            });
          }, 100);
        break;
      case 'blender':
        this.p5canvas = this.global.load_blender_file(this.canvasDiv, this.FileInfo,
          () => {
            this.ContentOnLoad = true;
            this.ContentFailedLoad = false;
          }, () => {
            this.ContentFailedLoad = true;
          }, this.cont);
        break;
      case 'pdf':
        this.showEdit = false;
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            let iframe = p.createElement('iframe');
            iframe.attribute('src', this.FileURL);
            iframe.attribute("frameborder", "0");
            iframe.attribute('class', 'full_screen');
            iframe.attribute('allow', 'fullscreen; encrypted-media');
            iframe.attribute('scrolling', 'no');
            iframe.attribute('withCredentials', 'true');
            iframe.attribute('type', 'application/pdf');
            iframe.parent(this.canvasDiv);
            this.ContentOnLoad = true;
            this.ContentFailedLoad = false;
          }
        });
        break;
      default:
        console.log('정의되지 않은 파일 정보: ', this.FileInfo['viewer']);
      case 'disabled': // 사용 불가
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => { p.noCanvas() }
        });
        this.ContentOnLoad = true;
        break;
    }
    this.ChangeContentWithKeyInput();
  }

  /** 파일 이름 입력칸 */
  FilenameElement: HTMLElement;
  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    if (this.p5canvas)
      this.p5canvas.keyPressed = async (ev) => {
        if (this.isHTMLViewer) return;
        if (this.InnerChangedPage) return;
        if (this.isTextEditMode) {
          switch (ev['key']) {
            case 'Enter': // 텍스트 편집기 저장하기
              if (document.activeElement == this.FilenameElement)
                setTimeout(() => {
                  this.p5TextArea.focus();
                }, 0);
              if (ev['ctrlKey']) this.SaveText();
              break;
            case 'Escape':
              this.navCtrl.pop();
              break;
          }
          return;
        }
        if (this.FileInfo.viewer == 'godot') return;
        const FileMenu: Function[] = [];
        if (!this.NeedDownloadFile && this.showEditText && this.showEdit)
          FileMenu.push(() => this.open_text_editor());
        if (!this.NeedDownloadFile && this.FileInfo['viewer'] != 'audio' && this.showEdit)
          FileMenu.push(() => this.modify_image());
        if (!this.NeedDownloadFile && !this.isQuickLaunchViewer)
          FileMenu.push(() => this.ShareContent());
        if (!this.NeedDownloadFile)
          FileMenu.push(() => this.download_file());
        if (!this.NeedDownloadFile && this.FileInfo['viewer'] == 'image')
          FileMenu.push(() => this.CopyImageToClipboard());
        FileMenu.push(() => this.open_bottom_modal());
        if (this.CurrentFileSize && this.FileInfo['url'])
          FileMenu.push(() => this.RemoveFile());
        if (!this.CurrentFileSize && this.FileInfo.path && !this.isQuickLaunchViewer)
          FileMenu.push(() => this.DownloadFileFromURL());
        if (this.FileInfo.url && !this.isQuickLaunchViewer)
          FileMenu.push(() => this.CopyQuickViewer());
        switch (ev['code']) {
          case 'Enter':
            if (!this.CanInputValue)
              this.FocusOnIndexInput();
            break;
          case 'KeyA': // 왼쪽 이동
          case 'ArrowLeft':
            this.ChangeToAnother(-1);
            break;
          case 'KeyW': // 위로 이동
            if (this.p5SyntaxHighlightReader)
              this.p5SyntaxHighlightReader.scrollTo({ top: this.p5SyntaxHighlightReader.scrollTop - this.p5SyntaxHighlightReader.clientHeight / 2, behavior: 'smooth' });
            break;
          case 'KeyS': // 아래로 이동
            if (ev['shiftKey']) {
              this.ShareContent();
            } else {
              if (this.p5SyntaxHighlightReader)
                this.p5SyntaxHighlightReader.scrollTo({ top: this.p5SyntaxHighlightReader.scrollTop + this.p5SyntaxHighlightReader.clientHeight / 2, behavior: 'smooth' });
            }
            break;
          case 'KeyD': // 오른쪽 이동
            // 다운로드
            if (ev['shiftKey']) {
              if (this.NeedDownloadFile)
                this.DownloadCurrentFile();
              else this.download_file();
            }
          case 'ArrowRight':
            if (!ev['shiftKey'])
              this.ChangeToAnother(1);
            break;
          case 'KeyE':
            if (ev['shiftKey'])
              this.modify_image();
            break;
          case 'KeyF': // 메뉴 열기 (우클릭)
            if (!ev['ctrlKey']) {
              if (ev['shiftKey'])
                this.FindMessage();
              else this.OpenFileMenu();
            }
            break;
          case 'KeyI': // 파일 정보 보기
            if (ev['ctrlKey'])
              this.open_bottom_modal();
            break;
          case 'KeyC': // 파일 정보 보기
            if (ev['shiftKey'])
              this.CopyImageToClipboard();
            break;
          case 'Digit1':
          case 'Digit2':
          case 'Digit3':
          case 'Digit4':
          case 'Digit5':
          case 'Digit6':
          case 'Digit7':
          case 'Digit8':
          case 'Digit9':
            if (this.isFileMenuOpened) {
              let GetNumber = Number(ev['code'].split('Digit')[1]);
              let index = (GetNumber + 9) % 10;
              if (index < FileMenu.length)
                FileMenu[index]();
              this.FileMenu.dismiss();
            }
            break;
          case 'Escape':
            if (!this.OpenModal && !this.isFileMenuOpened)
              this.navCtrl.pop();
        }
      }
  }

  /** 파일 메뉴가 열렸는지 검토 */
  isFileMenuOpened = false;
  OpenFileMenu() {
    this.isFileMenuOpened = true;
    this.FileMenu.onDidDismiss().then(() => {
      this.isFileMenuOpened = false;
      this.global.RestoreShortCutAct('ionic-menu');
    });
    this.global.StoreShortCutAct('ionic-menu');
    this.FileMenu.present();
  }

  @ViewChild('ShowContentInfoIonic') ShowContentInfoIonic: IonModal;

  /** 하단 모달이 열린 경우 */
  OpenModal = false;
  open_bottom_modal() {
    this.FileMenu.dismiss();
    this.useP5Navigator = false;
    this.global.StoreShortCutAct('ionic-modal');
    this.ShowContentInfoIonic.present();
    this.OpenModal = true;
    this.ShowContentInfoIonic.onDidDismiss().then(() => {
      this.OpenModal = false;
      this.global.RestoreShortCutAct('ionic-modal');
    });
  }
  /** 텍스트 편집기 상태인지 여부 */
  isTextEditMode = false;
  ShowEditShortcutHint: HTMLElement;
  open_text_editor() {
    if (this.p5SyntaxHighlightReader)
      this.p5SyntaxHighlightReader.style.display = 'none';
    this.p5TextArea.style.display = 'block';
    this.p5TextArea.disabled = false;
    this.isTextEditMode = true;
    this.isHTMLViewer = false;
    setTimeout(() => {
      let filename = document.getElementById(this.TextEditorFileNameId);
      this.FilenameElement = filename.childNodes[1].childNodes[1].childNodes[1] as HTMLElement;
      if (!this.FilenameElement.onblur)
        this.FilenameElement.onblur = () => {
          this.ShowEditShortcutHint.style.display = 'none';
        }
      if (!this.FilenameElement.onfocus)
        this.FilenameElement.onfocus = () => {
          if (this.global.ShowHint)
            this.ShowEditShortcutHint.style.display = 'inherit';
        }
      if (isPlatform == 'DesktopPWA' || this.FileInfo['is_new'])
        this.FilenameElement.focus();
    }, 500);
  }

  CurrentTextId = 'ionic_viewer_text_content';
  /** 구문 강조가 가능한 재구성처리 */
  open_text_reader(p = this.p5canvas) {
    if (!this.p5SyntaxHighlightReader) {
      let syntaxHighlightReader = p.createDiv();
      syntaxHighlightReader.elt.className = 'infobox';
      syntaxHighlightReader.elt.setAttribute('style', `height: ${this.p5TextArea.clientHeight}px; display: block; overflow-y: auto;`);
      syntaxHighlightReader.parent(this.canvasDiv);
      this.p5SyntaxHighlightReader = syntaxHighlightReader.elt;
    }
    // 구문 강조처리용 구성 변환
    let getText = this.p5TextArea.textContent;
    let ValuePair = {
      c: c,
      cs: csharp,
      js: javascript,
      ts: typescript,
      cc: cpp,
      cpp: cpp,
      php: php,
      yml: yaml,
      json: json,
      rs: rust,
      java: java,
      ino: java,
      pde: java,
      pl: perl,
      py: perl,
      gd: perl,
      bas: basic,
      prop: properties,
      properties: properties,
    }
    if (this.FileInfo.file_ext == 'json') {
      let json = JSON.parse(getText);
      getText = JSON.stringify(json, undefined, 2);
      this.p5TextArea.textContent = getText;
    }
    try {
      if (!ValuePair[this.FileInfo.file_ext]) throw '등록되지 않은 언어';
      hljs.registerLanguage(this.FileInfo.file_ext, ValuePair[this.FileInfo.file_ext]);
      const highlightedCode = hljs.highlight(getText, { language: this.FileInfo.file_ext });
      hljs.unregisterLanguage(this.FileInfo.file_ext);
      let highlighted = highlightedCode.value;
      let line = p.createDiv();
      let updateTextInChunks = (text, chunkSize = 1000) => {
        let index = 0;
        const div = line.elt;
        let insertChunk = () => {
          const chunk = text.slice(index, index + chunkSize);
          div.innerHTML += chunk;  // 텍스트를 계속 추가
          index += chunkSize;

          // 다음 덩어리를 삽입
          if (index < 100000) {
            if (!this.PageWillDestroy && !this.ContentChanging) {
              // 비동기적으로 처리
              if (index < text.length) {
                requestAnimationFrame(insertChunk);
              } else div.innerHTML = highlighted;
            }
          } else {
            div.innerHTML = highlighted;
          }
        }
        insertChunk();
      }
      updateTextInChunks(getText);
      this.CurrentTextId = `ionic_viewer_text_content_${Date.now()}`;
      line.id(this.CurrentTextId);
      line.style('white-space', 'pre-wrap');
      line.parent(this.p5SyntaxHighlightReader);
    } catch (e) {
      let line: p5.Element;
      // highlightjs 에서 지원하지 않는 것들을 별도 처리
      switch (this.FileInfo.file_ext) {
        case 'json': {
          let div = p.createDiv();
          div.elt.className = 'infobox';
          div.style('height: 100%; display: block');
          div.elt.src = this.FileInfo.thumbnail;
          div.parent(this.canvasDiv);
          div.remove();
          let textArea = p.createElement('textarea');
          textArea.elt.disabled = true;
          textArea.elt.className = 'infobox';
          textArea.elt.setAttribute('style', 'height: 100%; display: block;');
          textArea.elt.textContent = '';
          let hint = p.createDiv('Enter');
          hint.style('position', 'absolute');
          hint.style('border-radius', '8px');
          hint.style('padding', '2px 8px');
          hint.style('margin', '4px');
          hint.style('pointer-events', 'none');
          hint.elt.className = 'shortcut_hint';
          hint.hide();
          hint.parent(this.canvasDiv);
          this.ShowEditShortcutHint = hint.elt;
          this.canvasDiv.appendChild(textArea.elt);
          this.p5TextArea = textArea.elt;
          if (this.FileInfo['is_new']) {
            this.open_text_editor();
          } else p.loadStrings(this.FileURL, v => {
            textArea.elt.textContent = v.join('\n');
            this.open_text_reader(p);
            this.ContentOnLoad = true;
            this.ContentFailedLoad = false;
          }, _e => {
            this.FileInfo['else'] = true; // 일반 미디어 파일이 아님을 알림
            this.ContentOnLoad = true;
          });
          this.ContentOnLoad = true;
          this.ContentFailedLoad = false;
        } return;
        case 'html':
        case 'xml':
          getText = this.global.HTMLEncode(getText);
          line = p.createDiv(getText);
          this.w3CodeColor(line.elt);
          break;
        case 'css':
        case 'scss':
          line = p.createDiv(getText);
          this.w3CodeColor(line.elt, 'css');
          break;
        case 'js':
        case 'ts':
          line = p.createDiv(getText);
          this.w3CodeColor(line.elt, 'js');
          break;
        default:
          line = p.createDiv(getText)
          break;
      }
      line.id(this.CurrentTextId);
      line.style('white-space', 'pre-wrap');
      line.parent(this.p5SyntaxHighlightReader);
    }
    this.p5TextArea.style.display = 'none';
    this.p5SyntaxHighlightReader.style.display = 'block';
  }

  // https://www.w3schools.com/howto/tryit.asp?filename=tryhow_syntax_highlight
  w3CodeColor(elmnt: any, mode?: any) {
    var lang = (mode || "html");
    var elmntObj = (document.getElementById(elmnt) || elmnt);
    var elmntTxt = elmntObj.innerHTML;
    var tagcolor = "var(--syntax-text-coding-basic)";
    var tagnamecolor = "var(--syntax-text-coding-string)";
    var attributecolor = "var(--syntax-text-coding-equalmark)";
    var attributevaluecolor = "var(--syntax-text-coding-comments)";
    var commentcolor = "var(--syntax-text-coding-comments)";
    var cssselectorcolor = "var(--syntax-text-coding-string)";
    var csspropertycolor = "var(--syntax-text-coding-basic)";
    var csspropertyvaluecolor = "var(--syntax-text-coding-equalmark)";
    var cssdelimitercolor = "var(--syntax-text-coding-spechar)";
    var cssimportantcolor = "var(--syntax-text-coding-command)";
    var jscolor = 'var(--miniranchat-default-text)';
    var jskeywordcolor = "var(--syntax-text-coding-basic)";
    var jsstringcolor = "var(--syntax-text-coding-string)";
    var jsnumbercolor = 'var(--syntax-text-coding-number)';
    var jspropertycolor = "var(--syntax-text-coding-final)";
    if (!lang) { lang = "html"; }
    if (lang == "html") { elmntTxt = htmlMode(elmntTxt); }
    if (lang == "css") { elmntTxt = cssMode(elmntTxt); }
    if (lang == "js") { elmntTxt = jsMode(elmntTxt); }
    elmntObj.innerHTML = elmntTxt;

    function extract(str, start, end, func, repl) {
      var s, e, d = "", a = [];
      while (str.search(start) > -1) {
        s = str.search(start);
        e = str.indexOf(end, s);
        if (e == -1) { e = str.length; }
        if (repl) {
          a.push(func(str.substring(s, e + (end.length))));
          str = str.substring(0, s) + repl + str.substr(e + (end.length));
        } else {
          d += str.substring(0, s);
          d += func(str.substring(s, e + (end.length)));
          str = str.substr(e + (end.length));
        }
      }
      this.rest = d + str;
      this.arr = a;
    }
    function htmlMode(txt) {
      var rest = txt, done = "", php, comment, angular, startpos, endpos, note, i;
      comment = new extract(rest, "&lt;!--", "--&gt;", commentMode, "W3HTMLCOMMENTPOS");
      rest = comment.rest;
      while (rest.indexOf("&lt;") > -1) {
        note = "";
        startpos = rest.indexOf("&lt;");
        if (rest.substr(startpos, 9).toUpperCase() == "&LT;STYLE") { note = "css"; }
        if (rest.substr(startpos, 10).toUpperCase() == "&LT;SCRIPT") { note = "javascript"; }
        endpos = rest.indexOf("&gt;", startpos);
        if (endpos == -1) { endpos = rest.length; }
        done += rest.substring(0, startpos);
        done += tagMode(rest.substring(startpos, endpos + 4));
        rest = rest.substr(endpos + 4);
        if (note == "css") {
          endpos = rest.indexOf("&lt;/style&gt;");
          if (endpos > -1) {
            done += cssMode(rest.substring(0, endpos));
            rest = rest.substr(endpos);
          }
        }
        if (note == "javascript") {
          endpos = rest.indexOf("&lt;/script&gt;");
          if (endpos > -1) {
            done += jsMode(rest.substring(0, endpos));
            rest = rest.substr(endpos);
          }
        }
      }
      rest = done + rest;
      for (i = 0; i < comment.arr.length; i++) {
        rest = rest.replace("W3HTMLCOMMENTPOS", comment.arr[i]);
      }
      return rest;
    }
    function tagMode(txt) {
      var rest = txt, done = "", startpos, endpos, result;
      while (rest.search(/(\s|<br>)/) > -1) {
        startpos = rest.search(/(\s|<br>)/);
        endpos = rest.indexOf("&gt;");
        if (endpos == -1) { endpos = rest.length; }
        done += rest.substring(0, startpos);
        done += attributeMode(rest.substring(startpos, endpos));
        rest = rest.substr(endpos);
      }
      result = done + rest;
      result = "<span style=color:" + tagcolor + ">&lt;</span>" + result.substring(4);
      if (result.substr(result.length - 4, 4) == "&gt;") {
        result = result.substring(0, result.length - 4) + "<span style=color:" + tagcolor + ">&gt;</span>";
      }
      return "<span style=color:" + tagnamecolor + ">" + result + "</span>";
    }
    function attributeMode(txt) {
      var rest = txt, done = "", startpos, endpos, singlefnuttpos, doublefnuttpos, spacepos;
      while (rest.indexOf("=") > -1) {
        endpos = -1;
        startpos = rest.indexOf("=");
        singlefnuttpos = rest.indexOf("'", startpos);
        doublefnuttpos = rest.indexOf('"', startpos);
        spacepos = rest.indexOf(" ", startpos + 2);
        if (spacepos > -1 && (spacepos < singlefnuttpos || singlefnuttpos == -1) && (spacepos < doublefnuttpos || doublefnuttpos == -1)) {
          endpos = rest.indexOf(" ", startpos);
        } else if (doublefnuttpos > -1 && (doublefnuttpos < singlefnuttpos || singlefnuttpos == -1) && (doublefnuttpos < spacepos || spacepos == -1)) {
          endpos = rest.indexOf('"', rest.indexOf('"', startpos) + 1);
        } else if (singlefnuttpos > -1 && (singlefnuttpos < doublefnuttpos || doublefnuttpos == -1) && (singlefnuttpos < spacepos || spacepos == -1)) {
          endpos = rest.indexOf("'", rest.indexOf("'", startpos) + 1);
        }
        if (!endpos || endpos == -1 || endpos < startpos) { endpos = rest.length; }
        done += rest.substring(0, startpos);
        done += attributeValueMode(rest.substring(startpos, endpos + 1));
        rest = rest.substr(endpos + 1);
      }
      return "<span style=color:" + attributecolor + ">" + done + rest + "</span>";
    }
    function attributeValueMode(txt) {
      return "<span style=color:" + attributevaluecolor + ">" + txt + "</span>";
    }
    function commentMode(txt) {
      return "<span style=color:" + commentcolor + ">" + txt + "</span>";
    }
    function cssMode(txt) {
      var rest = txt, done = "", s, e, comment, i, midz, c, cc;
      comment = new extract(rest, /\/\*/, "*/", commentMode, "W3CSSCOMMENTPOS");
      rest = comment.rest;
      while (rest.search("{") > -1) {
        s = rest.search("{");
        midz = rest.substr(s + 1);
        cc = 1;
        c = 0;
        for (i = 0; i < midz.length; i++) {
          if (midz.substr(i, 1) == "{") { cc++; c++ }
          if (midz.substr(i, 1) == "}") { cc--; }
          if (cc == 0) { break; }
        }
        if (cc != 0) { c = 0; }
        e = s;
        for (i = 0; i <= c; i++) {
          e = rest.indexOf("}", e + 1);
        }
        if (e == -1) { e = rest.length; }
        done += rest.substring(0, s + 1);
        done += cssPropertyMode(rest.substring(s + 1, e));
        rest = rest.substr(e);
      }
      rest = done + rest;
      rest = rest.replace(/{/g, "<span style=color:" + cssdelimitercolor + ">{</span>");
      rest = rest.replace(/}/g, "<span style=color:" + cssdelimitercolor + ">}</span>");
      for (i = 0; i < comment.arr.length; i++) {
        rest = rest.replace("W3CSSCOMMENTPOS", comment.arr[i]);
      }
      return "<span style=color:" + cssselectorcolor + ">" + rest + "</span>";
    }
    function cssPropertyMode(txt) {
      var rest = txt, done = "", s, e, n, loop;
      if (rest.indexOf("{") > -1) { return cssMode(rest); }
      while (rest.search(":") > -1) {
        s = rest.search(":");
        loop = true;
        n = s;
        while (loop == true) {
          loop = false;
          e = rest.indexOf(";", n);
          if (rest.substring(e - 5, e + 1) == "&nbsp;") {
            loop = true;
            n = e + 1;
          }
        }
        if (e == -1) { e = rest.length; }
        done += rest.substring(0, s);
        done += cssPropertyValueMode(rest.substring(s, e + 1));
        rest = rest.substr(e + 1);
      }
      return "<span style=color:" + csspropertycolor + ">" + done + rest + "</span>";
    }
    function cssPropertyValueMode(txt) {
      var rest = txt, done = "", s;
      rest = "<span style=color:" + cssdelimitercolor + ">:</span>" + rest.substring(1);
      while (rest.search(/!important/i) > -1) {
        s = rest.search(/!important/i);
        done += rest.substring(0, s);
        done += cssImportantMode(rest.substring(s, s + 10));
        rest = rest.substr(s + 10);
      }
      let result = done + rest;
      if (result.substring(result.length - 1, 1) == ";" && result.substring(result.length - 6, 6) != "&nbsp;" && result.substring(result.length - 4, 4) != "&lt;" && result.substring(result.length - 4, 4) != "&gt;" && result.substring(result.length - 5, 5) != "&amp;") {
        result = result.substring(0, result.length - 1) + "<span style=color:" + cssdelimitercolor + ">;</span>";
      }
      return "<span style=color:" + csspropertyvaluecolor + ">" + result + "</span>";
    }
    function cssImportantMode(txt) {
      return "<span style=color:" + cssimportantcolor + ";font-weight:bold;>" + txt + "</span>";
    }
    function jsMode(txt) {
      var rest = txt, done = "", esc = [], i, cc, tt = "", sfnuttpos, dfnuttpos, compos, comlinepos, keywordpos, numpos, mypos, dotpos, y;
      for (i = 0; i < rest.length; i++) {
        cc = rest.substr(i, 1);
        if (cc == "\\") {
          esc.push(rest.substr(i, 2));
          cc = "W3JSESCAPE";
          i++;
        }
        tt += cc;
      }
      rest = tt;
      y = 1;
      while (y == 1) {
        sfnuttpos = getPos(rest, "'", "'", jsStringMode);
        dfnuttpos = getPos(rest, '"', '"', jsStringMode);
        compos = getPos(rest, /\/\*/, "*/", commentMode);
        comlinepos = getPos(rest, /\/\//, "<br>", commentMode);
        numpos = getNumPos(rest, jsNumberMode);
        keywordpos = getKeywordPos("js", rest, jsKeywordMode);
        dotpos = getDotPos(rest, jsPropertyMode);
        if (Math.max(numpos[0], sfnuttpos[0], dfnuttpos[0], compos[0], comlinepos[0], keywordpos[0], dotpos[0]) == -1) { break; }
        mypos = getMinPos([numpos, sfnuttpos, dfnuttpos, compos, comlinepos, keywordpos, dotpos]);
        if (mypos[0] == -1) { break; }
        if (mypos[0] > -1) {
          done += rest.substring(0, mypos[0]);
          done += mypos[2](rest.substring(mypos[0], mypos[1]));
          rest = rest.substr(mypos[1]);
        }
      }
      rest = done + rest;
      for (i = 0; i < esc.length; i++) {
        rest = rest.replace("W3JSESCAPE", esc[i]);
      }
      return "<span style=color:" + jscolor + ">" + rest + "</span>";
    }
    function jsStringMode(txt) {
      return "<span style=color:" + jsstringcolor + ">" + txt + "</span>";
    }
    function jsKeywordMode(txt) {
      return "<span style=color:" + jskeywordcolor + ">" + txt + "</span>";
    }
    function jsNumberMode(txt) {
      return "<span style=color:" + jsnumbercolor + ">" + txt + "</span>";
    }
    function jsPropertyMode(txt) {
      return "<span style=color:" + jspropertycolor + ">" + txt + "</span>";
    }
    function getDotPos(txt, func) {
      var x, i, j, s, e, arr = [".", "<", " ", ";", "(", "+", ")", "[", "]", ",", "&", ":", "{", "}", "/", "-", "*", "|", "%"];
      s = txt.indexOf(".");
      if (s > -1) {
        x = txt.substr(s + 1);
        for (j = 0; j < x.length; j++) {
          let cc = x[j];
          for (i = 0; i < arr.length; i++) {
            if (cc.indexOf(arr[i]) > -1) {
              e = j;
              return [s + 1, e + s + 1, func];
            }
          }
        }
      }
      return [-1, -1, func];
    }
    function getMinPos(args: any[]) {
      var i, arr = [];
      for (i = 0; i < args.length; i++) {
        if (args[i][0] > -1) {
          if (arr.length == 0 || args[i][0] < arr[0]) { arr = args[i]; }
        }
      }
      if (arr.length == 0) { arr = args[i]; }
      return arr;
    }
    function getKeywordPos(typ, txt, func) {
      var words, i, pos, rpos = -1, rpos2 = -1, patt;
      if (typ == "js") {
        words = ["abstract", "arguments", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete",
          "do", "double", "else", "enum", "eval", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import",
          "in", "instanceof", "int", "interface", "let", "long", "NaN", "native", "new", "null", "package", "private", "protected", "public", "return", "short", "static",
          "super", "switch", "synchronized", "this", "throw", "throws", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"];
      }
      for (i = 0; i < words.length; i++) {
        pos = txt.indexOf(words[i]);
        if (pos > -1) {
          patt = /\W/g;
          if (txt.substr(pos + words[i].length, 1).match(patt) && txt.substr(pos - 1, 1).match(patt)) {
            if (pos > -1 && (rpos == -1 || pos < rpos)) {
              rpos = pos;
              rpos2 = rpos + words[i].length;
            }
          }
        }
      }
      return [rpos, rpos2, func];
    }
    function getPos(txt, start, end, func) {
      var s, e;
      s = txt.search(start);
      e = txt.indexOf(end, s + (end.length));
      if (e == -1) { e = txt.length; }
      return [s, e + (end.length), func];
    }
    function getNumPos(txt, func) {
      var arr = ["<br>", " ", ";", "(", "+", ")", "[", "]", ",", "&", ":", "{", "}", "/", "-", "*", "|", "%", "="], i, j, c, startpos = 0, endpos, word;
      for (i = 0; i < txt.length; i++) {
        for (j = 0; j < arr.length; j++) {
          c = txt.substr(i, arr[j].length);
          if (c == arr[j]) {
            if (c == "-" && (txt.substr(i - 1, 1) == "e" || txt.substr(i - 1, 1) == "E")) {
              continue;
            }
            endpos = i;
            if (startpos < endpos) {
              word = txt.substring(startpos, endpos);
              if (!isNaN(word)) { return [startpos, endpos, func]; }
            }
            i += arr[j].length;
            startpos = i;
            i -= 1;
            break;
          }
        }
      }
      return [-1, -1, func];
    }
  }

  NewTextFileName = '';
  /** 저장 후 에디터 모드 종료 */
  async SaveText() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    // 채널 채팅에서는 별도 파일첨부로 처리
    if (!this.NewTextFileName) this.NewTextFileName = this.FileInfo.filename || this.FileInfo.name;
    if (this.NewTextFileName.indexOf('.') < 0) this.NewTextFileName += '.txt';
    let new_name = this.NewTextFileName || this.FileInfo.filename || this.FileInfo.name;
    let file_ext = new_name.split('.').pop();
    this.FileInfo.type = file_ext == 'html' ? 'text/html' : this.FileInfo.type;
    let blob = new Blob([this.p5TextArea.value], { type: this.FileInfo.type });
    blob['name'] = new_name;
    if (this.OpenInChannelChat) { // 채널 채팅에서 열람
      if (this.global.PageDismissAct[this.navParams.dismiss])
        this.global.PageDismissAct[this.navParams.dismiss]({
          data: {
            type: 'text',
            blob: blob,
            contentRelated: this.FileInfo.content_related_creator,
          }
        });
    } else { // 할 일에서는 직접 파일 수정 후 임시 교체
      let tmp_path = `tmp_files/texteditor/${this.FileInfo.filename || this.FileInfo.name}`;
      if (!this.FileInfo.path) this.FileInfo.path = tmp_path;
      await this.indexed.saveBlobToUserPath(blob, tmp_path);
      if (this.global.PageDismissAct[this.navParams.dismiss])
        this.global.PageDismissAct[this.navParams.dismiss]({
          data: {
            type: 'text',
            blob: blob,
            path: tmp_path,
            index: this.RelevanceIndex - 1,
          }
        });
    }
    loading.dismiss();
    this.navCtrl.pop();
  }

  image_info = {};

  /** 내장 그림판을 이용하여 그림 편집하기 */
  async modify_image() {
    switch (this.FileInfo['viewer']) {
      case 'image': { // 이미지인 경우, url 일 때
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        try {
          let blob: Blob;
          this.image_info['path'] = this.FileInfo.alt_path || this.FileInfo.path || this.navParams.path;
          if (this.FileInfo['url']) {
            this.image_info['path'] = `tmp_files/modify_image.${this.FileInfo.file_ext}`;
            blob = await fetch(this.FileInfo['url'], { signal: this.cont.signal }).then(r => r.blob(),);
            await this.indexed.saveBlobToUserPath(blob, this.image_info['path']);
          }
          if (this.global.PageDismissAct[this.navParams.dismiss])
            this.global.PageDismissAct[this.navParams.dismiss]({
              data: {
                type: 'image',
                ...this.image_info,
                path: this.image_info['path'],
                filetype: this.FileInfo.type,
                msg: this.MessageInfo,
                index: this.RelevanceIndex - 1,
              }
            });
          this.navCtrl.pop();
        } catch (e) {
          this.p5toast.show({
            text: `${this.lang.text['ContentViewer']['CannotEditFile']}: ${e}`,
          });
        }
        loading.dismiss();
      }
        break;
      case 'code':
      case 'text': // 텍스트를 이미지화하기
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        try {
          this.image_info['width'] = this.p5SyntaxHighlightReader.clientWidth;
          this.image_info['height'] = this.p5SyntaxHighlightReader.clientHeight;
          this.image_info['path'] = 'tmp_files/modify_image.png';
          this.image_info['scrollHeight'] = this.p5SyntaxHighlightReader.scrollTop;
          this.p5SyntaxHighlightReader.style.height = 'fit-content';
          let blob = await domtoimage.toBlob(this.p5SyntaxHighlightReader);
          await this.indexed.saveBlobToUserPath(blob, this.image_info['path']);
          if (this.global.PageDismissAct[this.navParams.dismiss])
            this.global.PageDismissAct[this.navParams.dismiss]({
              data: {
                type: 'image',
                ...this.image_info,
                path: this.image_info['path'],
                msg: this.MessageInfo,
                index: this.RelevanceIndex - 1,
                isDarkMode: isDarkMode,
              }
            });
          this.navCtrl.pop();
        } catch (e) {
          this.p5toast.show({
            text: `${this.lang.text['ContentViewer']['CannotEditFile']}: ${e}`,
          });
        }
        loading.dismiss();
        break;
      case 'video': // 마지막 프레임 저장하기
        try {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          this.p5canvas.pixelDensity(1);
          this.CacheMediaObject.pause();
          this.CacheMediaObject['size'](this.image_info['width'], this.image_info['height']);
          let canvas = this.p5canvas.createCanvas(this.image_info['width'], this.image_info['height']);
          this.p5canvas.image(this.CacheMediaObject, 0, 0, this.p5canvas.width, this.p5canvas.height);
          let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          try {
            loading.dismiss();
            this.image_info['path'] = 'tmp_files/modify_image.png';
            await this.indexed.saveBase64ToUserPath(base64, this.image_info['path']);
            if (this.global.PageDismissAct[this.navParams.dismiss])
              this.global.PageDismissAct[this.navParams.dismiss]({
                data: {
                  type: 'image',
                  ...this.image_info,
                  msg: this.MessageInfo,
                  index: this.RelevanceIndex - 1,
                }
              });
            this.navCtrl.pop();
          } catch (e) {
            console.log('파일 저장 오류: ', e);
          }
        } catch (e) {
          console.log('재생중인 비디오 이미지 추출 오류: ', e);
        }
        break;
      case 'blender': // 마지막 프레임 저장하기
        try {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          this.p5canvas.pixelDensity(1);
          let base64 = this.global.BlenderCanvasInside['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          try {
            loading.dismiss();
            this.image_info['path'] = 'tmp_files/modify_image.png';
            this.image_info['width'] = this.p5canvas.width;
            this.image_info['height'] = this.p5canvas.height;
            await this.indexed.saveBase64ToUserPath(base64, this.image_info['path']);
            if (this.global.PageDismissAct[this.navParams.dismiss])
              this.global.PageDismissAct[this.navParams.dismiss]({
                data: {
                  type: 'image',
                  ...this.image_info,
                  msg: this.MessageInfo,
                  index: this.RelevanceIndex - 1,
                  isDarkMode: isDarkMode,
                }
              });
            this.navCtrl.pop();
          } catch (e) {
            console.log('파일 저장 오류: ', e);
          }
        } catch (e) {
          console.log('재생중인 비디오 이미지 추출 오류: ', e);
        }
        break;
      case 'godot':
        this.global.godot_window['modify_image']();
        break;
      case 'pdf':
      default:
        console.log('편집 불가 파일 정보: ', this.FileInfo);
        break;
    }
  }

  /** 클립보드에 이미지 복사하기 */
  async CopyImageToClipboard() {
    let blob: Blob;
    try {
      if (this.FileInfo.url) {
        let res = await fetch(this.FileInfo.url);
        blob = await res.blob();
      } else blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.path, this.FileInfo.type);
      this.global.WriteValueToClipboard(blob.type, blob, 'image.png');
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['GlobalAct']['ClipboardFailed']}`,
      });
      return;
    }
  }

  /** 덮어쓰기 전단계 */
  forceWrite = false;
  /** url 파일로부터 파일 다운받기 */
  async download_file() {
    let hasFile = await this.indexed.checkIfFileExist(this.FileInfo.alt_path || this.FileInfo.path);
    if (hasFile) {
      this.indexed.DownloadFileFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo['type'], this.FileInfo['filename'] || this.FileInfo['name']);
    } else if (this.FileInfo['url']) {
      try {
        let link = document.createElement("a");
        link.target = '_blank';
        link.href = this.FileInfo['url'];
        link.download = this.FileInfo.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        link.remove();
      } catch (e) {
        console.log('다운받기 실패: ', e);
        this.p5toast.show({
          text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`
        });
      }
    }
  }

  QRCodeSRC: any;
  @ViewChild('QuickFileViewer') QuickFileViewer: IonModal;
  QuickMainAddress = '';
  /** 빠른진입으로 들어온 경우 일부 메뉴 가려짐 */
  isQuickLaunchViewer = false;
  /** 빠른 뷰어 링크 구성받기  
   * 이 링크를 사용하면 즉시 파일 뷰어로 해당 파일을 열 수 있음
   */
  async CopyQuickViewer() {
    this.FileMenu.dismiss();
    this.ContentChanging = true;
    this.useP5Navigator = false;
    this.OpenModal = true;
    let address = await this.global.GetHeaderAddress();
    this.QuickMainAddress = `${address}?fileviewer=${this.FileInfo.url},${this.FileInfo.viewer}`.replace(' ', '%20');
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.QuickMainAddress);
    this.QuickFileViewer.onDidDismiss().then(() => {
      this.ContentChanging = false;
      this.useP5Navigator = true;
      this.OpenModal = false;
      this.global.RestoreShortCutAct('quicklink-fileviewer');
    });
    this.global.StoreShortCutAct('quicklink-fileviewer');
    this.QuickFileViewer.present();
  }

  /** 빠른 진입 링크로 새로운 창에서 열기 */
  OpenNewWindow() {
    let OpenWindow = async () => {
      let address = await this.global.GetHeaderAddress();
      let result = `${address}?fileviewer=${this.FileInfo.url},${this.FileInfo.viewer}`;
      window.open(result, '_blank');
    }
    OpenWindow();
    return false;
  }

  /** 이 페이지에 있는지를 검토하는 녀석으로 사용중, p5 단축키 기능 제한용 */
  InnerChangedPage = false;
  ShareContent() {
    this.FileMenu.dismiss();
    let channels = this.nakama.rearrange_channels();
    for (let i = channels.length - 1; i >= 0; i--) {
      if (channels[i]['status'] == 'missing' || channels[i]['status'] == 'offline')
        channels.splice(i, 1);
    }
    for (let rel_info of this.content_related_creator)
      delete rel_info.hidden;
    if (channels.length) {
      this.useP5Navigator = false;
      this.global.PageDismissAct['share'] = async (v: any) => {
        await this.WaitingCurrent();
        this.useP5Navigator = true;
        this.global.BlockMainShortcut = true;
        if (this.BlockReinit && v.data) {
          if (this.global.PageDismissAct[this.navParams.dismiss])
            this.global.PageDismissAct[this.navParams.dismiss]({
              data: { share: true }
            });
          this.navCtrl.pop();
        }
        delete this.global.PageDismissAct['share'];
      }
      let channel_copied = JSON.parse(JSON.stringify(channels));
      delete channel_copied['update'];
      this.WaitingLoaded.share = true;
      this.global.BlockMainShortcut = false;
      this.global.ActLikeModal('share-content-to-other', {
        file: this.FileInfo,
        channels: channel_copied,
        block: this.WaitingLoaded,
      });
    } else this.p5toast.show({
      text: this.lang.text['ShareContentToOther']['NoChannelToShare'],
    });
  }

  RemoveFile() {
    this.RemoveFileAct();
    this.p5toast.show({
      text: `${this.lang.text['ContentViewer']['RemoveFile']}: ${this.FileInfo.alt_path || this.FileInfo.path}`,
    });
  }

  async RemoveFileAct() {
    URL.revokeObjectURL(this.FileURL);
    if (!this.FileInfo.url) delete this.FileInfo.thumbnail;
    delete this.FileInfo['text'];
    await this.indexed.removeFileFromUserPath(this.FileInfo.alt_path || this.FileInfo.path);
    this.RelevanceIndex -= 1;
    this.ChangeToAnother(1);
  }

  /** 페이지가 곧 삭제될 예정입니다  
   * reinit 행동 중첩막기를 위해 존재함
   */
  PageWillDestroy = false;
  async ionViewWillLeave() {
    this.global.portalHint = true;
    this.global.BlockMainShortcut = false;
    this.WaitingLoaded.block = false;
    this.PageWillDestroy = true;
    switch (this.FileInfo.viewer) {
      case 'video':
        try {
          let size = this.CacheMediaObject.size();
          let width: number, height: number;
          if (size.width > size.height) {
            height = size.height / size.width * 192;
            width = 192;
          } else {
            width = size.width / size.height * 192;
            height = 192;
          }
          let canvas = this.p5canvas.createCanvas(width, height);
          this.p5canvas.pixelDensity(1);
          this.p5canvas.imageMode(this.p5canvas.CORNER);
          this.p5canvas.image(this.CacheMediaObject, 0, 0, width, height);
          this.p5canvas.fill(255, 128);
          this.p5canvas.rect(0, 0, width, height);
          this.p5canvas.textWrap(this.p5canvas.CHAR);
          this.p5canvas.textSize(16);
          let margin_ratio = height / 16;
          this.p5canvas.push()
          this.p5canvas.translate(margin_ratio / 6, margin_ratio / 6);
          this.p5canvas.fill(0)
          this.p5canvas.text((this.FileInfo['filename'] || this.FileInfo['name']),
            margin_ratio, margin_ratio,
            width - margin_ratio * 2, height - margin_ratio * 2);
          this.p5canvas.filter(this.p5canvas.BLUR, 3, false);
          this.p5canvas.pop();
          this.p5canvas.fill(255);
          this.p5canvas.text((this.FileInfo['filename'] || this.FileInfo['name']),
            margin_ratio, margin_ratio,
            width - margin_ratio * 2, height - margin_ratio * 2);
          let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          try {
            if (!this.FileInfo.alt_path && !this.FileInfo.path) throw '경로 없는 파일';
            await this.indexed.saveBase64ToUserPath(base64, `${this.FileInfo.alt_path || this.FileInfo.path}_thumbnail.png`);
            this.FileInfo.thumbnail = base64;
            this.global.modulate_thumbnail(this.FileInfo, '', this.cont);
          } catch (e) {
            console.log('썸네일 저장 오류: ', e);
          }
        } catch (e) {
          setTimeout(() => {
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
              video.remove();
            });
          }, 500);
          console.log('비디오 썸네일 생성 취소: ', e);
        }
        break;
      case 'godot':
        if (!this.ContentFailedLoad)
          try {
            if (!this.FileInfo.alt_path && !this.FileInfo.path) throw '경로 없는 파일';
            this.global.godot_window['filename'] = this.FileInfo.filename || this.FileInfo.name;
            this.global.godot_window['create_thumbnail'](this.FileInfo);
            let list = await this.indexed.GetFileListFromDB('tmp_files', undefined, this.indexed.godotDB);
            list.forEach(path => this.indexed.removeFileFromUserPath(path, undefined, this.indexed.godotDB))
          } catch (e) {
            console.log('godot 썸네일 저장 오류: ', e);
          }
        break;
      case 'blender':
        try {
          if (!this.FileInfo.alt_path && !this.FileInfo.path) throw '경로 없는 파일';
          let base64 = this.global.BlenderCanvasInside['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          new p5((p: p5) => {
            p.setup = () => {
              p.loadImage(base64, async v => {
                let width: number, height: number;
                if (v.width > v.height) {
                  height = v.height / v.width * 192;
                  width = 192;
                } else {
                  width = v.width / v.height * 192;
                  height = 192;
                }
                let canvas = p.createCanvas(width, height);
                p.pixelDensity(1);
                p.imageMode(p.CORNER);
                p.image(v, 0, 0, p.width, p.height);
                p.fill(255, 128);
                p.rect(0, 0, width, height);
                p.textWrap(p.CHAR);
                p.textSize(16);
                let margin_ratio = height / 16;
                p.push();
                p.translate(margin_ratio / 6, margin_ratio / 6);
                p.fill(0);
                p.text((this.FileInfo['filename'] || this.FileInfo['name']),
                  margin_ratio, margin_ratio,
                  width - margin_ratio * 2, height - margin_ratio * 2);
                p.filter(p.BLUR, 3, false);
                p.pop();
                p.fill(255);
                p.text((this.FileInfo['filename'] || this.FileInfo['name']),
                  margin_ratio, margin_ratio,
                  width - margin_ratio * 2, height - margin_ratio * 2);
                let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
                await this.indexed.saveBase64ToUserPath(base64, `${this.FileInfo.alt_path || this.FileInfo.path}_thumbnail.png`);
                this.FileInfo.thumbnail = base64;
                this.global.modulate_thumbnail(this.FileInfo, '', this.cont);
                p.remove();
              }, e => {
                console.log('블렌더 썸네일 배경 받아오기 오류: ', e);
                p.remove();
              });
            }
          });
        } catch (e) {
          console.log('blender 썸네일 저장 오류: ', e);
        }
        if (this.global.BlenderLoadingCtrl) this.global.BlenderLoadingCtrl.dismiss();
        break;
      default:
        break;
    }
    this.InnerChangedPage = true;
  }

  /** 파일이 URL로 구성되어있는 경우 URL 주소를 복사함 */
  CopyURL() {
    if (this.FileInfo.url && this.IsMyMessage)
      this.copy_url(this.FileInfo.url.replace(' ', '%20'))
  }

  copy_url(data: string) {
    this.global.WriteValueToClipboard('text/plain', data);
  }
}

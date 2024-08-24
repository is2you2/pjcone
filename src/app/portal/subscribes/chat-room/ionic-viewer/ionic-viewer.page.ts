import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonModal, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ContentCreatorInfo, FileInfo, GlobalActService, isDarkMode } from 'src/app/global-act.service';
import { ShareContentToOtherPage } from 'src/app/share-content-to-other/share-content-to-other.page';
import { NakamaService } from 'src/app/nakama.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { LocalNotiService } from 'src/app/local-noti.service';
import { IonPopover } from '@ionic/angular/common';
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

@Component({
  selector: 'app-ionic-viewer',
  templateUrl: './ionic-viewer.page.html',
  styleUrls: ['./ionic-viewer.page.scss'],
})
export class IonicViewerPage implements OnInit, OnDestroy {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    public global: GlobalActService,
    public nakama: NakamaService,
    private mClipboard: Clipboard,
    private noti: LocalNotiService,
  ) { }
  ngOnDestroy(): void {
    this.cont.abort();
    if (this.p5viewerkey) this.p5viewerkey.remove();
    if (this.p5canvas) this.p5canvas.remove();
    if (this.VideoMediaObject) {
      if (this.VideoMediaObject.elt != document.pictureInPictureElement) {
        this.VideoMediaObject.elt.src = '';
        this.VideoMediaObject.elt.load();
        this.VideoMediaObject.remove();
      }
      this.VideoMediaObject = undefined;
    }
    if (!document.pictureInPictureElement)
      this.global.PIPLinkedVideoElement = undefined;
  }

  blob: Blob;
  FileInfo: FileInfo;
  p5canvas: p5;
  FileURL: string;
  ContentBox: HTMLElement;
  FileHeader: HTMLElement;
  FromUserFsDir: boolean;
  CurrentFileSize: string;

  content_creator: ContentCreatorInfo;
  content_related_creator: ContentCreatorInfo[];
  isOfficial: string;
  target: string;
  useP5Navigator = true;
  MessageInfo: any;
  Relevances: any[];
  RelevanceIndex = 0;
  HaveRelevances = false;
  NeedDownloadFile = false;
  ContentOnLoad = false;
  ContentFailedLoad = true;
  isDownloading = false;
  CurrentViewId: string;
  OpenInChannelChat = false;
  isChannelOnline = true;
  fromLocalChannel = false;
  /** 이미지 편집이 가능하다면 해당 메뉴를 보여주기 */
  showEdit = true;
  showEditText = false;
  /** HTML이라면 보기 방식을 변경할 수 있음, 변경 가능한지 여부 */
  isHTML = false;
  /** HTML 직접보기로 보는지 여부 */
  isHTMLViewer = false;

  /** HTML 직접보기 전환 */
  ToggleHTMLViewer() {
    this.isHTMLViewer = !this.isHTMLViewer;
    if (this.isHTMLViewer) {
      let text_viewer = document.getElementById('ionic_viewer_text_content');
      let content = text_viewer.innerText;
      text_viewer.innerText = undefined;
      text_viewer.innerHTML = content;
      let regex = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
      let match: any;
      while ((match = regex.exec(content)) !== null) {
        let scriptContent = match[1];
        eval(scriptContent);
      }
    } else this.ChangeToAnother(0);
  }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.replaceState(null, null, window.location.href);
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        this.BackButtonPressed = true;
        this.modalCtrl.dismiss();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  async ngOnInit() {
    this.InitBrowserBackButtonOverride();
    this.fromLocalChannel = this.navParams.get('local');
    this.MessageInfo = this.navParams.get('info');
    this.OpenInChannelChat = this.MessageInfo['code'] !== undefined;
    this.CurrentViewId = this.MessageInfo.message_id;
    this.FileInfo = this.MessageInfo.content;
    this.ContentBox = document.getElementById('ContentBox');
    this.FileHeader = document.getElementById('FileHeader');
    this.isOfficial = this.navParams.get('isOfficial');
    this.target = this.navParams.get('target');
    try {
      this.isChannelOnline = this.nakama.channels_orig[this.isOfficial][this.target][this.MessageInfo['channel_id']].info['status'] == 'online';
      this.isChannelOnline = this.isChannelOnline || this.nakama.channels_orig[this.isOfficial][this.target][this.MessageInfo['channel_id']]['status'] == 'online'
        || this.nakama.channels_orig[this.isOfficial][this.target][this.MessageInfo['channel_id']]['status'] == 'pending';
    } catch (e) { }
    this.FromUserFsDir = this.navParams.get('no_edit') || false;
    switch (this.FileInfo['is_new']) {
      case 'code':
      case 'text':
        break;
      default:
        this.Relevances = this.navParams.get('relevance') || [];
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
        break;
    }
    this.showEdit = !Boolean(this.navParams.get('noEdit'));
    this.ChangeContentWithKeyInput();
    this.isPWA = isPlatform != 'Android' && isPlatform != 'iOS';
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
    this.CurrentFileSize = undefined;
    this.NewTextFileName = '';
    this.NeedDownloadFile = false;
    this.ContentOnLoad = false;
    this.ContentFailedLoad = true;
    this.isTextEditMode = false;
    this.isHTML = false;
    this.isHTMLViewer = false;
    this.MessageInfo = msg;
    this.CurrentViewId = this.MessageInfo.message_id;
    this.FileInfo = this.MessageInfo.content;
    if (this.p5canvas) this.p5canvas.remove();
    this.canvasDiv = document.getElementById('content_viewer_canvas');
    if (this.canvasDiv)
      for (let i = 0, j = this.canvasDiv.childNodes.length; i < j; i++)
        this.canvasDiv.removeChild(this.canvasDiv.childNodes[i]);
    URL.revokeObjectURL(this.FileURL);
    if (this.FileInfo.url) {
      this.CreateContentInfo();
      this.NeedDownloadFile = false;
      this.ContentOnLoad = true;
      this.ionViewDidEnter();
    } else {
      let path = this.FileInfo['alt_path'] || this.FileInfo['path'] ||
        `servers/${this.isOfficial}/${this.target}/channels/${msg.channel_id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
      this.image_info['path'] = path;
      this.NeedDownloadFile = await this.indexed.checkIfFileExist(`${path}.history`);
      try {
        this.blob = await this.indexed.loadBlobFromUserPath(path, this.FileInfo['type']);
        this.CreateContentInfo();
        this.ionViewDidEnter();
      } catch (e) {
        this.FileURL = undefined;
        this.blob = undefined;
        this.isDownloading = false;
        this.NeedDownloadFile = true;
        this.ContentOnLoad = true;
        this.ContentFailedLoad = false;
        this.CreateContentInfo();
        if (this.p5canvas) this.p5canvas.remove();
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => { p.noCanvas() }
        });
      }
    }
  }

  /** 터치 상호작용 보완용 */
  ContentChanging = false;
  ChangeToAnother(direction: number) {
    if (this.ContentChanging) return;
    this.ContentChanging = true;
    let tmp_calced = this.RelevanceIndex + direction;
    if (tmp_calced <= 0 || tmp_calced > this.Relevances.length) {
      this.ContentChanging = false;
      return;
    }
    if (this.p5canvas) this.p5canvas.remove();
    this.RelevanceIndex = tmp_calced;
    this.FileInfo = { file_ext: '' };
    this.reinit_content_data(this.Relevances[this.RelevanceIndex - 1]);
    this.ContentChanging = false;
  }

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
        this.content_creator.publisher
          = this.content_creator.is_me ? this.nakama.users.self['display_name']
            : this.nakama.users[this.isOfficial][this.target][this.content_creator.user_id]['display_name'];
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
    try { // 중복 정보 통합
      this.content_related_creator[0].publisher
        = this.content_related_creator[0].is_me ? this.nakama.users.self['display_name']
          : this.nakama.users[this.isOfficial][this.target][this.content_related_creator[0].user_id]['display_name'];
      if (this.content_related_creator[0].timestamp == this.content_related_creator[1].timestamp) { // 외부에서 가져온 파일
        this.content_related_creator[0].publisher = this.content_related_creator[1].is_me ? this.nakama.users.self['display_name']
          : this.nakama.users[this.isOfficial][this.target][this.content_related_creator[1].user_id]['display_name'];
        this.content_related_creator.splice(1, 1);
      }
    } catch (e) {
      try { // 오프라인 재검토
        this.content_related_creator[0].publisher = this.content_related_creator[1].display_name;
        if (this.content_related_creator[0].timestamp == this.content_related_creator[1].timestamp) { // 외부에서 가져온 파일
          this.content_related_creator[0].publisher = this.content_related_creator[1].display_name;
          this.content_related_creator.splice(1, 1);
        }
      } catch (e) { }
      try {
        if (!this.content_related_creator[0].publisher)
          this.content_related_creator[0].publisher = this.content_related_creator[0].display_name;
      } catch (e) { }
    }
    try { // 시간순 정렬
      this.content_related_creator.sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1;
        else if (a.timestamp < b.timestamp) return 1;
        else return 0;
      });
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
      this.modalCtrl.dismiss();
    } else this.reinit_content_data(this.MessageInfo);
  }

  /** URL 링크인 경우 파일을 로컬에 다운받기 */
  async DownloadFileFromURL() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
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
    loading.dismiss();
  }
  /** p5.video 가 생성된 경우 여기에 기록 */
  VideoMediaObject: any;
  /** 파일 읽기 멈추기 위한 컨트롤러 */
  cont: AbortController;
  /** 비디오/오디오 콘텐츠가 종료되면 끝에서 다음 콘텐츠로 자동 넘김 */
  AutoPlayNext = false;
  @ViewChild('FileMenu') FileMenu: IonPopover;
  async ionViewDidEnter() {
    this.modalCtrl.getTop().then(self => {
      this.ModalSelf = self;
    });
    if (this.cont) this.cont.abort();
    this.cont = new AbortController();
    try { // 로컬에서 파일 찾기 우선 작업
      this.blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.alt_path || this.FileInfo.path || this.navParams.get('path'), this.FileInfo['type']);
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
    this.canvasDiv = document.getElementById('content_viewer_canvas');
    if (this.canvasDiv) this.canvasDiv.style.backgroundImage = '';
    if (this.p5canvas) this.p5canvas.remove();
    // 경우에 따라 로딩하는 캔버스를 구분
    switch (this.FileInfo['viewer']) {
      case 'image': // 이미지
        this.p5canvas = new p5((p: p5) => {
          p.setup = async () => {
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
              RePositioningImage();
              img.remove();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            }
            p.noLoop();
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let RePositioningImage = () => {
            if (this.image_info['width'] / this.image_info['height'] < this.canvasDiv.clientWidth / this.canvasDiv.clientHeight) {
              let tmp_width = this.image_info['width'] * this.canvasDiv.clientHeight / this.image_info['height'];
              this.canvasDiv.style.backgroundSize = `${tmp_width}px`;
              this.canvasDiv.style.backgroundPositionX = `${(this.canvasDiv.clientWidth - tmp_width) / 2}px`;
              this.canvasDiv.style.backgroundPositionY = `0px`;
            } else {
              this.canvasDiv.style.backgroundSize = `${this.canvasDiv.clientWidth}px`;
              this.canvasDiv.style.backgroundPositionX = '0px';
              let imageRatio = this.canvasDiv.clientWidth / imageOriginalSize.x;
              let centerHeight =
                this.canvasDiv.clientHeight / 2 - imageOriginalSize.y * imageRatio / 2;
              this.canvasDiv.style.backgroundPositionY = `${centerHeight}px`;
            }
            isInitStatus = true;
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
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            mediaObject = p.createAudio([this.FileURL], () => {
              this.canvasDiv.appendChild(mediaObject['elt']);
              mediaObject['elt'].onended = () => {
                if (this.AutoPlayNext)
                  this.ChangeToAnother(1);
              }
              ResizeAudio();
              mediaObject['elt'].hidden = false;
              mediaObject['elt'].onloadedmetadata = () => {
                ResizeAudio();
                mediaObject['elt'].hidden = false;
              }
              setTimeout(() => {
              }, 50);
              mediaObject.showControls();
              mediaObject.play();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            });
            mediaObject['elt'].hidden = true;
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeAudio = () => {
            let canvasWidth = this.ContentBox.offsetWidth;
            mediaObject['elt'].setAttribute('style', 'position: relative; top: 50%; left: 50%; transform: translateX(-50%) translateY(-50%);');
            mediaObject['size'](canvasWidth, 25);
          }
          p.windowResized = () => {
            setTimeout(() => {
              ResizeAudio();
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
      case 'video': // 비디오
        this.p5canvas = new p5((p: p5) => {
          let mediaObject: p5.MediaElement;
          p.setup = async () => {
            p.noCanvas();
            p.noLoop();
            mediaObject = p.createVideo([this.FileURL], () => {
              if (this.global.PIPLinkedVideoElement) {
                mediaObject.elt.remove();
                mediaObject.elt = this.global.PIPLinkedVideoElement;
                mediaObject.elt.setAttribute('src', this.FileURL);
              } else {
                this.global.PIPLinkedVideoElement = mediaObject['elt'];
                this.global.PIPLinkedVideoElement.onleavepictureinpicture = () => {
                  // 페이지를 나간 상태라면 PIP 종료와 동시에 비디오 삭제
                  if (!this.VideoMediaObject) {
                    this.global.PIPLinkedVideoElement.src = '';
                    this.global.PIPLinkedVideoElement.load();
                    this.global.PIPLinkedVideoElement.remove();
                    this.global.PIPLinkedVideoElement = undefined;
                  }
                }
              }
              if (this.canvasDiv)
                this.canvasDiv.appendChild(mediaObject['elt']);
              this.image_info['width'] = mediaObject['elt']['videoWidth'];
              this.image_info['height'] = mediaObject['elt']['videoHeight'];
              ResizeVideo();
              mediaObject['elt'].hidden = false;
              mediaObject['elt'].onloadedmetadata = () => {
                this.image_info['width'] = mediaObject['elt']['videoWidth'];
                this.image_info['height'] = mediaObject['elt']['videoHeight'];
                ResizeVideo();
                mediaObject['elt'].hidden = false;
              }
              mediaObject['elt'].onended = () => {
                if (this.AutoPlayNext)
                  this.ChangeToAnother(1);
              }
              mediaObject.showControls();
              mediaObject.play();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            });
            this.VideoMediaObject = mediaObject;
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
        this.showEditText = !Boolean(this.navParams.get('noTextEdit'));
        this.isHTML = this.FileInfo.file_ext?.toLowerCase() == 'html';
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            let textArea = p.createElement('textarea');
            textArea.elt.disabled = true;
            textArea.elt.className = 'infobox';
            textArea.elt.setAttribute('style', 'height: 100%; display: block;');
            textArea.elt.textContent = '';
            this.canvasDiv.appendChild(textArea.elt);
            p['TextArea'] = textArea.elt;
            if (this.FileInfo['is_new']) {
              this.open_text_editor(textArea.elt);
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
            p['SyntaxHighlightReader'].setAttribute('style', `height: ${target_height}px; display: ${this.isTextEditMode ? 'none' : 'block'}; overflow-y: scroll;`);
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
          let thumbnail = await this.indexed.loadBlobFromUserPath((this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.get('path'))
            + '_thumbnail.png', '');
          ThumbnailURL = URL.createObjectURL(thumbnail);
        } catch (e) { }
        if (!this.NeedDownloadFile && this.CurrentViewId == GetViewId)
          setTimeout(async () => {
            let createDuplicate = false;
            if (this.indexed.godotDB) {
              try {
                let blob = await this.indexed.loadBlobFromUserPath(
                  this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.get('path'), '', undefined, this.indexed.ionicDB);
                await this.indexed.GetGodotIndexedDB();
                await this.indexed.saveBlobToUserPath(blob, 'godot/app_userdata/Client/tmp_files/duplicate/viewer.pck', undefined, this.indexed.godotDB);
                createDuplicate = true;
              } catch (e) {
                console.log('내부 파일 없음: ', e);
              }
            }
            await this.global.CreateGodotIFrame('content_viewer_canvas', {
              path: 'tmp_files/duplicate/viewer.pck',
              alt_path: this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.get('path'),
              url: this.FileInfo.url,
              background: ThumbnailURL,
              receive_image: async (base64: string, width: number, height: number) => {
                let tmp_path = 'tmp_files/modify_image.png';
                await this.indexed.saveBase64ToUserPath(',' + base64, tmp_path);
                this.modalCtrl.dismiss({
                  type: 'image',
                  path: tmp_path,
                  width: width,
                  height: height,
                  msg: this.MessageInfo,
                  index: this.RelevanceIndex - 1,
                });
              }
            }, 'start_load_pck');
            if (!createDuplicate) {
              try { // 내부에 파일이 있는지 검토
                let blob = await this.indexed.loadBlobFromUserPath(
                  this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.get('path'), '', undefined, this.indexed.ionicDB);
                await this.indexed.GetGodotIndexedDB();
                await this.indexed.saveBlobToUserPath(blob, 'godot/app_userdata/Client/tmp_files/duplicate/viewer.pck', undefined, this.indexed.godotDB);
              } catch (e) { }
              await this.global.CreateGodotIFrame('content_viewer_canvas', {
                path: 'tmp_files/duplicate/viewer.pck',
                alt_path: this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.get('path'),
                url: this.FileInfo.url,
                background: ThumbnailURL,
                receive_image: async (base64: string, width: number, height: number) => {
                  let tmp_path = 'tmp_files/modify_image.png';
                  await this.indexed.saveBase64ToUserPath(',' + base64, tmp_path);
                  this.modalCtrl.dismiss({
                    type: 'image',
                    path: tmp_path,
                    width: width,
                    height: height,
                    msg: this.MessageInfo,
                    index: this.RelevanceIndex - 1,
                  });
                }
              }, 'start_load_pck');
            }
            this.ContentOnLoad = true;
            this.ContentFailedLoad = false;
            if (ThumbnailURL) URL.revokeObjectURL(ThumbnailURL);
            if (this.FileInfo.url)
              this.global.godot_window['download_url']();
            else this.global.godot_window['start_load_pck']();
          }, 100);
        break;
      case 'blender':
        let loading = await this.loadingCtrl.create({ message: this.lang.text['ContentViewer']['OnLoadContent'] });
        loading.present();
        this.p5canvas = this.global.load_blender_file(this.canvasDiv, this.FileInfo, loading,
          () => {
            this.ContentOnLoad = true;
            this.ContentFailedLoad = false;
          }, () => {
            this.ContentFailedLoad = true;
          }, this.cont);
        break;
      case 'pdf':
        if (isPlatform != 'Android') {
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
        }
      default:
        console.log('정의되지 않은 파일 정보: ', this.FileInfo['viewer']);
      case 'disabled': // 사용 불가
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => { p.noCanvas() }
        });
        this.ContentOnLoad = true;
        break;
    }
  }

  /** 이 modal 페이지 (this) */
  ModalSelf: HTMLIonModalElement;
  /** 단축키 행동용 p5 개체 분리 */
  p5viewerkey: p5;
  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    this.p5viewerkey = new p5((p: p5) => {
      p.keyPressed = async (ev) => {
        let getTop = await this.modalCtrl.getTop();
        if (this.ModalSelf != getTop) return;
        if (this.isHTMLViewer) return;
        if (this.isTextEditMode) {
          switch (ev['code']) {
            case 'Enter': // 텍스트 편집기 저장하기
            case 'NumpadEnter':
              let TextFileName = document.getElementById('TextEditorFileName');
              let inputElement = TextFileName.childNodes[1].childNodes[1].childNodes[1];
              if (document.activeElement == inputElement) this.SaveText();
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
        if (!this.NeedDownloadFile)
          FileMenu.push(() => this.ShareContent());
        if (!this.NeedDownloadFile && this.isPWA)
          FileMenu.push(() => this.download_file());
        FileMenu.push(() => this.open_bottom_modal());
        if (this.CurrentFileSize && this.FileInfo['url'])
          FileMenu.push(() => this.RemoveFile());
        if (!this.CurrentFileSize)
          FileMenu.push(() => this.DownloadFileFromURL());
        switch (ev['code']) {
          case 'KeyA': // 왼쪽 이동
          case 'ArrowLeft':
            this.ChangeToAnother(-1);
            break;
          case 'KeyS': // 파일 저장
            if (this.NeedDownloadFile)
              this.DownloadCurrentFile();
            else this.download_file();
            break;
          case 'KeyD': // 오른쪽 이동
          case 'ArrowRight':
            this.ChangeToAnother(1);
            break;
          case 'KeyF': // 메뉴 열기 (우클릭)
            this.OpenFileMenu();
            break;
          // 메뉴가 열려있지 않더라도 메뉴 내용을 행동함
          case 'Digit1':
          case 'Digit2':
          case 'Digit3':
          case 'Digit4':
          case 'Digit5':
          case 'Digit6':
          case 'Digit7':
          case 'Digit8':
          case 'Digit9':
          case 'Digit0':
            if (this.isFileMenuOpened) {
              let GetNumber = Number(ev['code'].split('Digit')[1]);
              let index = (GetNumber + 9) % 10;
              if (index < FileMenu.length)
                FileMenu[index]();
              this.FileMenu.dismiss();
            }
            break;
        }
      }
    });
  }

  /** 파일 메뉴가 열렸는지 검토 */
  isFileMenuOpened = false;
  OpenFileMenu() {
    this.isFileMenuOpened = true;
    this.FileMenu.onWillDismiss().then(() => {
      this.isFileMenuOpened = false;
    });
    this.FileMenu.present();
  }

  @ViewChild('ShowContentInfoIonic') ShowContentInfoIonic: IonModal;

  open_bottom_modal() {
    this.useP5Navigator = false;
    this.ShowContentInfoIonic.present();
  }
  /** 텍스트 편집기 상태인지 여부 */
  isTextEditMode = false;
  open_text_editor(_textarea = this.p5canvas['TextArea']) {
    if (this.p5canvas && this.p5canvas['SyntaxHighlightReader'])
      this.p5canvas['SyntaxHighlightReader'].style.display = 'none';
    _textarea.style.display = 'block';
    _textarea.disabled = false;
    setTimeout(() => {
      this.isTextEditMode = true;
      _textarea.focus();
    }, 500);
  }

  /** 구문 강조가 가능한 재구성처리 */
  open_text_reader(p = this.p5canvas) {
    if (!p['SyntaxHighlightReader']) {
      let syntaxHighlightReader = p.createDiv();
      syntaxHighlightReader.elt.className = 'infobox';
      syntaxHighlightReader.elt.setAttribute('style', `height: ${p['TextArea'].clientHeight}px; display: block; overflow-y: auto;`);
      this.canvasDiv.appendChild(syntaxHighlightReader.elt);
      p['SyntaxHighlightReader'] = syntaxHighlightReader.elt;
    }
    // 구문 강조처리용 구성 변환
    let getText = p['TextArea'].textContent;
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
      p['TextArea'].textContent = getText;
    }
    try {
      if (!ValuePair[this.FileInfo.file_ext]) throw '등록되지 않은 언어';
      hljs.registerLanguage(this.FileInfo.file_ext, ValuePair[this.FileInfo.file_ext]);
      const highlightedCode = hljs.highlight(getText, { language: this.FileInfo.file_ext });
      hljs.unregisterLanguage(this.FileInfo.file_ext);
      let highlighted = highlightedCode.value;
      let line = p.createDiv(highlighted);
      line.id('ionic_viewer_text_content');
      line.style('white-space', 'pre-wrap');
      line.parent(p['SyntaxHighlightReader']);
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
          this.canvasDiv.appendChild(textArea.elt);
          p['TextArea'] = textArea.elt;
          if (this.FileInfo['is_new']) {
            this.open_text_editor(textArea.elt);
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
          getText = this.HTMLEncode(getText);
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
      line.id('ionic_viewer_text_content');
      line.style('white-space', 'pre-wrap');
      line.parent(p['SyntaxHighlightReader']);
    }
    p['TextArea'].style.display = 'none';
    p['SyntaxHighlightReader'].style.display = 'block';
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

  /** HTML 내 특수 문자 허용 */
  HTMLEncode(str: any) {
    str = [...str];
    let i = str.length, aRet = [];
    while (i--) {
      let iC = str[i].codePointAt(0);
      if (iC < 65 || iC > 127 || (iC > 90 && iC < 97)) {
        aRet[i] = '&#' + iC + ';';
      } else {
        aRet[i] = str[i];
      }
    }
    return aRet.join('');
  }

  NewTextFileName = '';
  /** 저장 후 에디터 모드 종료 */
  async SaveText() {
    // 채널 채팅에서는 별도 파일첨부로 처리
    let blob = new Blob([this.p5canvas['TextArea'].value], { type: this.FileInfo.type });
    if (!this.NewTextFileName) this.NewTextFileName = this.FileInfo.filename || this.FileInfo.name;
    if (this.NewTextFileName.indexOf('.') < 0) this.NewTextFileName += '.txt';
    blob['name'] = this.NewTextFileName || this.FileInfo.filename || this.FileInfo.name;
    if (this.OpenInChannelChat) { // 채널 채팅에서 열람
      this.modalCtrl.dismiss({
        type: 'text',
        blob: blob,
        contentRelated: this.FileInfo.content_related_creator,
      });
    } else { // 할 일에서는 직접 파일 수정 후 임시 교체
      let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
      loading.present();
      let tmp_path = `tmp_files/texteditor/${this.FileInfo.filename || this.FileInfo.name}`;
      if (!this.FileInfo.path) this.FileInfo.path = tmp_path;
      await this.indexed.saveBlobToUserPath(blob, tmp_path);
      loading.dismiss();
      this.modalCtrl.dismiss({
        type: 'text',
        blob: blob,
        path: tmp_path,
        index: this.RelevanceIndex - 1,
      });
    }
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
          this.image_info['path'] = this.FileInfo.alt_path || this.FileInfo.path || this.navParams.get('path');
          if (this.FileInfo['url']) {
            this.image_info['path'] = 'tmp_files/modify_image.png';
            blob = await fetch(this.FileInfo['url'], { signal: this.cont.signal }).then(r => r.blob(),);
            await this.indexed.saveBlobToUserPath(blob, this.image_info['path']);
          }
          this.modalCtrl.dismiss({
            type: 'image',
            ...this.image_info,
            path: this.image_info['path'],
            msg: this.MessageInfo,
            index: this.RelevanceIndex - 1,
          });
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
          this.image_info['width'] = this.p5canvas['SyntaxHighlightReader'].clientWidth;
          this.image_info['height'] = this.p5canvas['SyntaxHighlightReader'].clientHeight;
          this.image_info['path'] = 'tmp_files/modify_image.png';
          this.image_info['scrollHeight'] = this.p5canvas['SyntaxHighlightReader'].scrollTop;
          this.p5canvas['SyntaxHighlightReader'].style.height = 'fit-content';
          let blob = await domtoimage.toBlob(this.p5canvas['SyntaxHighlightReader']);
          await this.indexed.saveBlobToUserPath(blob, this.image_info['path']);
          this.modalCtrl.dismiss({
            type: 'image',
            ...this.image_info,
            path: this.image_info['path'],
            msg: this.MessageInfo,
            index: this.RelevanceIndex - 1,
            isDarkMode: isDarkMode,
          });
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
          this.VideoMediaObject.pause();
          this.VideoMediaObject['size'](this.image_info['width'], this.image_info['height']);
          let canvas = this.p5canvas.createCanvas(this.image_info['width'], this.image_info['height']);
          this.p5canvas.image(this.VideoMediaObject, 0, 0, this.p5canvas.width, this.p5canvas.height);
          let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          try {
            loading.dismiss();
            this.image_info['path'] = 'tmp_files/modify_image.png';
            await this.indexed.saveBase64ToUserPath(base64, this.image_info['path']);
            this.modalCtrl.dismiss({
              type: 'image',
              ...this.image_info,
              msg: this.MessageInfo,
              index: this.RelevanceIndex - 1,
            });
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
          let base64 = this.p5canvas['canvas']['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          try {
            loading.dismiss();
            this.image_info['path'] = 'tmp_files/modify_image.png';
            this.image_info['width'] = this.p5canvas.width;
            this.image_info['height'] = this.p5canvas.height;
            await this.indexed.saveBase64ToUserPath(base64, this.image_info['path']);
            this.modalCtrl.dismiss({
              type: 'image',
              ...this.image_info,
              msg: this.MessageInfo,
              index: this.RelevanceIndex - 1,
              isDarkMode: isDarkMode,
            });
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

  /** 덮어쓰기 전단계 */
  forceWrite = false;
  isPWA = false;
  async download_file() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      let hasFile = await this.indexed.checkIfFileExist(this.FileInfo.alt_path || this.FileInfo.path);
      if (hasFile) {
        this.indexed.DownloadFileFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo['type'], this.FileInfo['filename'] || this.FileInfo['name']);
      } else if (this.FileInfo['url']) {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
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
        loading.dismiss();
      }
    }
  }

  ShareContent() {
    let channels = this.nakama.rearrange_channels();
    for (let i = channels.length - 1; i >= 0; i--) {
      if (channels[i]['status'] == 'missing' || channels[i]['status'] == 'offline')
        channels.splice(i, 1);
    }
    if (channels.length)
      this.modalCtrl.create({
        component: ShareContentToOtherPage,
        componentProps: {
          file: this.FileInfo,
          channels: channels,
        }
      }).then(v => {
        v.onDidDismiss().then((v) => {
          if (v.data) this.modalCtrl.dismiss({ share: true });
        });
        v.present();
      });
    else this.p5toast.show({
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

  async ionViewWillLeave() {
    switch (this.FileInfo.viewer) {
      case 'video':
        try {
          let size = this.VideoMediaObject.size();
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
          this.p5canvas.image(this.VideoMediaObject, 0, 0, width, height);
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
            await this.indexed.saveBase64ToUserPath(base64, `${this.FileInfo.alt_path || this.FileInfo.path}_thumbnail.png`);
            this.FileInfo.thumbnail = base64;
            this.global.modulate_thumbnail(this.FileInfo, '', this.cont);
            if (this.p5canvas) this.p5canvas.remove();
          } catch (e) {
            console.log('썸네일 저장 오류: ', e);
          }
        } catch (e) {
          console.log('비디오 썸네일 생성 취소: ', e);
        }
        break;
      case 'godot':
        try {
          this.global.godot_window['filename'] = this.FileInfo.filename || this.FileInfo.name;
          this.global.godot_window['create_thumbnail'](this.FileInfo);
          let list = await this.indexed.GetFileListFromDB('tmp_files', undefined, this.indexed.godotDB);
          list.forEach(path => this.indexed.removeFileFromUserPath(path, undefined, this.indexed.godotDB))
          if (this.p5canvas) this.p5canvas.remove();
        } catch (e) {
          console.log('godot 썸네일 저장 오류: ', e);
        }
        break;
      case 'blender':
        let base64 = this.p5canvas['canvas']['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
        try {
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
                if (this.p5canvas) this.p5canvas.remove();
              }, e => {
                console.log('블렌더 썸네일 배경 받아오기 오류: ', e);
                p.remove();
                if (this.p5canvas) this.p5canvas.remove();
              });
            }
          });
        } catch (e) {
          console.log('blender 썸네일 저장 오류: ', e);
        }
        break;
      default:
        if (this.p5canvas) this.p5canvas.remove();
        break;
    }
    URL.revokeObjectURL(this.FileURL);
  }

  ionViewDidLeave() {
    this.noti.ClearNoti(6);
  }

  /** 파일이 URL로 구성되어있는 경우 URL 주소를 복사함 */
  CopyURL() {
    if (this.FileInfo.url)
      this.copy_url(this.FileInfo.url)
  }

  copy_url(data: string) {
    this.mClipboard.copy(data)
      .catch(_e => {
        this.global.WriteValueToClipboard('text/plain', data);
      });
  }
}

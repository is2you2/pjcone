import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonModal, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ContentCreatorInfo, FileInfo, GlobalActService, isDarkMode } from 'src/app/global-act.service';
import { ShareContentToOtherPage } from 'src/app/share-content-to-other/share-content-to-other.page';
import { NakamaService } from 'src/app/nakama.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from 'clipboardy';
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
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import perl from 'highlight.js/lib/languages/perl';
import basic from 'highlight.js/lib/languages/basic';
import properties from 'highlight.js/lib/languages/properties';
import xml from 'highlight.js/lib/languages/xml';

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
    private file: File,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    public global: GlobalActService,
    public nakama: NakamaService,
    private mClipboard: Clipboard,
    private noti: LocalNotiService,
  ) { }
  ngOnDestroy(): void {
    if (this.p5viewerkey) this.p5viewerkey.remove();
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

  EventListenerAct = (ev: any) => {
    ev.detail.register(120, (_processNextHandler: any) => { });
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
        this.Relevances = this.navParams.get('relevance');
        if (this.Relevances) {
          for (let i = 0, j = this.Relevances.length; i < j; i++)
            if (this.Relevances[i]['message_id'] && this.MessageInfo['message_id']) {
              if (this.Relevances[i]['message_id'] == this.MessageInfo['message_id']) {
                this.RelevanceIndex = i + 1;
                break;
              }
            } else {
              if (this.Relevances[i].content['path'] == this.MessageInfo.content['path']) {
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
    if (this.FileInfo.viewer != 'blender')
      this.FileMenu.present();
    return false;
  }

  canvasDiv: HTMLElement;
  async reinit_content_data(msg: any) {
    this.CurrentFileSize = undefined;
    this.NewTextFileName = '';
    this.NeedDownloadFile = false;
    this.ContentOnLoad = false;
    this.ContentFailedLoad = true;
    this.isTextEditMode = false;
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

  async DownloadInOrder() {
    if (isPlatform == 'Android' || isPlatform == 'iOS')
      this.noti.noti.schedule({
        id: 6,
        title: this.lang.text['ContentViewer']['DownloadThisFile'],
        progressBar: { indeterminate: true },
        sound: null,
        smallIcon: 'res://diychat',
        color: 'b0b0b0',
      });
    for (let i = 0, j = this.Relevances.length; i < j; i++) { // 전체 다운로드시 개체 미리 생성하기
      if (!this.nakama.OnTransfer[this.isOfficial]) this.nakama.OnTransfer[this.isOfficial] = {};
      if (!this.nakama.OnTransfer[this.isOfficial][this.target]) this.nakama.OnTransfer[this.isOfficial][this.target] = {};
      if (!this.nakama.OnTransfer[this.isOfficial][this.target][this.Relevances[i].channel_id]) this.nakama.OnTransfer[this.isOfficial][this.target][this.Relevances[i].channel_id] = {};
      if (!this.nakama.OnTransfer[this.isOfficial][this.target][this.Relevances[i].channel_id][this.Relevances[i].message_id])
        this.nakama.OnTransfer[this.isOfficial][this.target][this.Relevances[i].channel_id][this.Relevances[i].message_id] = {};
    }
    for (let i = 0, j = this.Relevances.length; i < j; i++) {
      if (isPlatform == 'Android' || isPlatform == 'iOS')
        this.noti.noti.schedule({
          id: 6,
          title: `${this.lang.text['ContentViewer']['DownloadThisFile']}: ${j - i}`,
          progressBar: { value: i, maxValue: j },
          sound: null,
          smallIcon: 'res://diychat',
          color: 'b0b0b0',
        });
      let path = `servers/${this.isOfficial}/${this.target}/channels/${this.Relevances[i].channel_id}/files/msg_${this.Relevances[i].message_id}.${this.Relevances[i].content['file_ext']}`;
      let FileExist = await this.indexed.checkIfFileExist(path);
      if (!FileExist) try {
        await this.DownloadCurrentFile(i);
      } catch (e) {
        console.log(e);
      }
    }
    this.noti.ClearNoti(6);
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
    if (!+bytes) return '0 Bytes'

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
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['TodoDetail'] });
    loading.present();
    try {
      let res = await fetch(this.FileInfo.url);
      if (res.ok) {
        let blob = await res.blob();
        await this.indexed.saveBlobToUserPath(blob, this.FileInfo.path);
        this.CurrentFileSize = this.formatBytes(this.FileInfo.size || this.FileInfo['filesize'] || this.blob.size);
        this.p5toast.show({
          text: `${this.lang.text['ChatRoom']['FileSaved']}: ${this.FileInfo.filename}`,
        });
      } else throw res.statusText;
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`,
      });
    }
    loading.dismiss();
  }
  /** 비디오/오디오 콘텐츠가 종료되면 끝에서 다음 콘텐츠로 자동 넘김 */
  AutoPlayNext = false;
  @ViewChild('FileMenu') FileMenu: IonPopover;
  async ionViewDidEnter() {
    try {
      if (this.FileInfo.url) {
        let res = await fetch(this.FileInfo.url);
        if (!res.ok) throw 'URL 링크 깨짐';
        this.FileURL = this.FileInfo.url;
      } else throw 'URL 없음'
      // 로컬에 파일이 준비되어있다면 파일 크기를 표시
      this.indexed.checkIfFileExist(this.FileInfo.alt_path || this.FileInfo.path || this.navParams.get('path'), b => {
        if (b) this.CurrentFileSize = this.formatBytes(this.FileInfo.size || this.FileInfo['filesize'] || this.blob.size);
      });
    } catch (e) { // 링크가 없거나 깨졌다면 로컬에서 불러오기 시도
      try {
        this.blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.alt_path || this.FileInfo.path || this.navParams.get('path'), this.FileInfo['type']);
        this.FileURL = URL.createObjectURL(this.blob);
        this.CurrentFileSize = this.formatBytes(this.FileInfo.size || this.FileInfo['filesize'] || this.blob.size);
      } catch (e) {
        this.ContentOnLoad = true;
        this.ContentFailedLoad = Boolean(!this.FileURL);
      }
    }
    this.forceWrite = false;
    await new Promise((done) => setTimeout(done, 0));
    this.canvasDiv = document.getElementById('content_viewer_canvas');
    if (this.canvasDiv) this.canvasDiv.style.backgroundImage = '';
    document.removeEventListener('ionBackButton', this.EventListenerAct);
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
          var mediaObject: p5.MediaElement;
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            mediaObject = p.createAudio([this.FileURL], () => {
              this.canvasDiv.appendChild(mediaObject['elt']);
              mediaObject['elt'].onended = () => {
                if (this.AutoPlayNext)
                  this.ChangeToAnother(1);
              }
              setTimeout(() => {
                ResizeAudio();
                mediaObject['elt'].hidden = false;
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
          var mediaObject: p5.MediaElement;
          p.setup = async () => {
            p.noCanvas();
            p.noLoop();
            mediaObject = p.createVideo([this.FileURL], () => {
              if (this.global.PIPLinkedVideoElement) {
                mediaObject.elt.remove();
                mediaObject.elt = this.global.PIPLinkedVideoElement;
                mediaObject.elt.setAttribute('src', this.FileURL);
              } else this.global.PIPLinkedVideoElement = mediaObject['elt'];
              if (this.canvasDiv)
                this.canvasDiv.appendChild(mediaObject['elt']);
              mediaObject['elt'].onended = () => {
                if (this.AutoPlayNext)
                  this.ChangeToAnother(1);
              }
              setTimeout(() => {
                this.image_info['width'] = mediaObject['elt']['videoWidth'];
                this.image_info['height'] = mediaObject['elt']['videoHeight'];
                ResizeVideo();
                mediaObject['elt'].hidden = false;
              }, 50);
              mediaObject.showControls();
              mediaObject.play();
              this.ContentOnLoad = true;
              this.ContentFailedLoad = false;
            });
            mediaObject['elt'].hidden = true;
            p['VideoMedia'] = mediaObject;
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
        this.showEditText = true;
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            if (this.FileInfo.file_ext == 'json') { // json 뷰어 별도
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
            } else { // 일반 텍스트 파일
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
        document.addEventListener('ionBackButton', this.EventListenerAct);
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
                await this.indexed.saveBlobToUserPath(blob, 'tmp_files/duplicate/viewer.pck', undefined, this.indexed.godotDB);
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
              // modify_image
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
                await this.indexed.saveBlobToUserPath(blob, 'tmp_files/duplicate/viewer.pck', undefined, this.indexed.godotDB);
              } catch (e) { }
              await this.global.CreateGodotIFrame('content_viewer_canvas', {
                path: 'tmp_files/duplicate/viewer.pck',
                alt_path: this.FileInfo['alt_path'] || this.FileInfo['path'] || this.navParams.get('path'),
                url: this.FileInfo.url,
                background: ThumbnailURL,
                // modify_image
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
          });
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

  /** 단축키 행동용 p5 개체 분리 */
  p5viewerkey: p5;
  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    this.p5viewerkey = new p5((p: p5) => {
      p.keyPressed = (ev) => {
        if (this.isTextEditMode) return;
        if (this.FileInfo.viewer == 'godot') return;
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
        }
      }
    });
  }

  @ViewChild('ShowContentInfoIonic') ShowContentInfoIonic: IonModal;

  open_bottom_modal() {
    this.ShowContentInfoIonic.onDidDismiss().then(_v => {
      this.useP5Navigator = true;
    });
    this.useP5Navigator = false;
    this.ShowContentInfoIonic.present();
  }

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
      css: css,
      scss: scss,
      json: json,
      rs: rust,
      java: java,
      ino: java,
      pde: java,
      pl: perl,
      py: perl,
      gd: perl,
      xml: xml,
      html: xml,
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
      line.style('white-space', 'pre-wrap');
      line.parent(p['SyntaxHighlightReader']);
    } catch (e) {
      let line = p.createDiv(getText);
      line.style('white-space', 'pre-wrap');
      line.parent(p['SyntaxHighlightReader']);
    }
    p['TextArea'].style.display = 'none';
    p['SyntaxHighlightReader'].style.display = 'block';
  }

  /** HTML 내 특수 문자 허용 */
  HTMLEncode(str: any) {
    str = [...str];
    let i = str.length, aRet = [];
    while (i--) {
      var iC = str[i].codePointAt(0);
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
      this.p5toast.show({
        text: this.lang.text['ContentViewer']['fileSaved'],
      });
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
            blob = await fetch(this.FileInfo['url']).then(r => r.blob());
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
          this.p5canvas['SyntaxHighlightReader'].style.height = 'fit-content';
          let blob = await domtoimage.toBlob(this.p5canvas['SyntaxHighlightReader']);
          this.image_info['width'] = this.p5canvas['SyntaxHighlightReader'].clientWidth;
          this.image_info['height'] = this.p5canvas['SyntaxHighlightReader'].clientHeight;
          this.image_info['path'] = 'tmp_files/modify_image.png';
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
          this.p5canvas['VideoMedia'].pause();
          this.p5canvas['VideoMedia']['size'](this.image_info['width'], this.image_info['height']);
          let canvas = this.p5canvas.createCanvas(this.image_info['width'], this.image_info['height']);
          this.p5canvas.image(this.p5canvas['VideoMedia'], 0, 0, this.p5canvas.width, this.p5canvas.height);
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
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      if (this.FileInfo['url']) {
        try {
          let res = await fetch(this.FileInfo.url);
          let blob = await res.blob();
          if (res.ok) {
            await this.indexed.saveBlobToUserPath(blob, this.FileInfo.alt_path || this.FileInfo.path);
            this.indexed.DownloadFileFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo['type'], this.FileInfo['filename'] || this.FileInfo['name']);
          } else throw '제대로 다운받아지지 않음';
        } catch (e) {
          console.log('다운받기 실패: ', e);
          this.p5toast.show({
            text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`
          });
        }
      } else this.indexed.DownloadFileFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo['type'], this.FileInfo['filename'] || this.FileInfo['name']);
    else this.alertCtrl.create({
      header: this.lang.text['ContentViewer']['Filename'],
      inputs: [{
        name: 'filename',
        placeholder: this.FileInfo['filename'] || this.FileInfo['name'],
        type: 'text',
      }],
      buttons: [{
        text: this.lang.text['ContentViewer']['saveFile'],
        handler: async (input) => {
          if (this.FileInfo['url']) {
            try {
              let res = await fetch(this.FileInfo.url);
              let blob = await res.blob();
              if (res.ok) {
                await this.indexed.saveBlobToUserPath(blob, this.FileInfo.alt_path || this.FileInfo.path);
                this.DownloadFileAct(input);
              } else throw '제대로 다운받아지지 않음';
            } catch (e) {
              console.log('다운받기 실패: ', e);
              this.p5toast.show({
                text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`
              });
            }
          } else this.DownloadFileAct(input);
        }
      }]
    }).then(v => v.present());
  }

  /** 모바일용, 저장소에 저장하기 */
  async DownloadFileAct(input: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    let filename = input['filename'] ? input['filename'].replace(/:|\?|\/|\\|<|>/g, '') : (this.FileInfo['filename'] || this.FileInfo['name']);
    let blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.alt_path || this.FileInfo.path, this.FileInfo['type']);
    if (this.forceWrite && !input['filename'])
      this.file.writeExistingFile(this.file.externalDataDirectory, filename, blob)
        .then(_v => {
          this.forceWrite = false;
          loading.dismiss();
          this.p5toast.show({
            text: `${this.lang.text['ContentViewer']['OverWriteFile']}: ${filename}`,
          });
        });
    else this.file.writeFile(this.file.externalDataDirectory, filename, blob)
      .then(_v => {
        loading.dismiss();
        this.p5toast.show({
          text: this.lang.text['ContentViewer']['fileSaved'],
        });
      }).catch(e => {
        loading.dismiss();
        switch (e.code) {
          case 12:
            this.p5toast.show({
              text: this.lang.text['ContentViewer']['AlreadyExist'],
            });
            this.forceWrite = true;
            this.download_file();
            break;
          default:
            console.log('준비되지 않은 오류 반환: ', e);
            break;
        }
      });
  }

  /** 칩 선택시 내용을 상세히 알려줌 (p5toast) */
  toast_info(worker: any) {
    if (!worker['various_display'])
      this.set_various_display(worker);
    this.p5toast.show({
      text: worker['various_display'],
    });
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
    this.alertCtrl.create({
      header: this.lang.text['ContentViewer']['RemoveFile'],
      message: this.FileInfo.alt_path || this.FileInfo.path,
      buttons: [{
        text: this.lang.text['ChatRoom']['Delete'],
        handler: () => {
          this.RemoveFileAct();
        },
        cssClass: 'redfont',
      }]
    }).then(v => v.present());
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
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    switch (this.FileInfo.viewer) {
      case 'video':
        try {
          let size = this.p5canvas['VideoMedia'].size();
          let width: number, height: number;
          if (size.width > size.height) {
            width = 192;
            height = size.height / size.width * 192;
          } else {
            width = size.width / size.height * 192;
            height = 192;
          }
          let canvas = this.p5canvas.createCanvas(width, height);
          this.p5canvas.pixelDensity(1);
          this.p5canvas.imageMode(this.p5canvas.CORNER);
          this.p5canvas.image(this.p5canvas['VideoMedia'], 0, 0, width, height);
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
            this.global.modulate_thumbnail(this.FileInfo, '');
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
                  width = 192;
                  height = v.height / v.width * 192;
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
                this.global.modulate_thumbnail(this.FileInfo, '');
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
        clipboard.write(data).then(() => {
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${data}`,
            });
        }).catch(e => { });
      });
  }
}

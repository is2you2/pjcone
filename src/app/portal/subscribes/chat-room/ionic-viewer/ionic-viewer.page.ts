// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonModal, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { ShareContentToOtherPage } from 'src/app/share-content-to-other/share-content-to-other.page';
import { NakamaService } from 'src/app/nakama.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from 'clipboardy';
import { LocalNotiService } from 'src/app/local-noti.service';
import { IonPopover } from '@ionic/angular/common';
import * as domtoimage from "dom-to-image";

@Component({
  selector: 'app-ionic-viewer',
  templateUrl: './ionic-viewer.page.html',
  styleUrls: ['./ionic-viewer.page.scss'],
})
export class IonicViewerPage implements OnInit {

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
  isDownloading = false;
  CurrentViewId: string;
  OpenInChannelChat = false;
  isChannelOnline = true;
  fromLocalChannel = false;

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
  }

  canvasDiv: HTMLElement;
  async reinit_content_data(msg: any) {
    this.NewTextFileName = '';
    this.NeedDownloadFile = true;
    this.ContentOnLoad = false;
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
      let path = this.FileInfo['path'] ||
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
        this.ContentOnLoad = false;
        this.CreateContentInfo();
        if (this.p5canvas) this.p5canvas.remove();
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => { p.noCanvas() }
        });
        this.ChangeContentWithKeyInput();
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
      if (!this.FileInfo['url'])
        this.CurrentFileSize = this.formatBytes(this.FileInfo.size || this.FileInfo['filesize'] || this.blob.size);
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

  /** 비디오/오디오 콘텐츠가 종료되면 끝에서 다음 콘텐츠로 자동 넘김 */
  AutoPlayNext = false;
  @ViewChild('FileMenu') FileMenu: IonPopover;

  async ionViewDidEnter() {
    if (this.FileInfo.url) {
      this.FileURL = this.FileInfo.url;
    } else if (!this.FileInfo['is_new']) {
      try {
        this.blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.path || this.navParams.get('path'), this.FileInfo['type']);
        this.FileURL = URL.createObjectURL(this.blob);
      } catch (e) {
        console.log(e);
      }
    }
    this.forceWrite = false;
    this.canvasDiv = document.getElementById('content_viewer_canvas');
    if (this.canvasDiv.oncontextmenu == null) {
      this.canvasDiv.oncontextmenu = () => {
        if (this.FileInfo.viewer != 'blender')
          this.FileMenu.present();
        return false;
      }
    }
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
            }, _e => {
              this.canvasDiv.textContent = this.lang.text['ContentViewer']['CannotOpenText'];
              this.FileInfo['else'] = true; // 일반 미디어 파일이 아님을 알림
              this.ContentOnLoad = true;
            });
          }
          p.windowResized = () => {
            let target_height = window.innerHeight - 45 - 56;
            p['SyntaxHighlightReader'].setAttribute('style', `height: ${target_height}px; display: ${this.isTextEditMode ? 'none' : 'block'}; overflow-y: scroll;`);
          }
        });
        break;
      case 'godot':
        document.addEventListener('ionBackButton', this.EventListenerAct);
        let ThumbnailURL: string;
        let GetViewId = this.MessageInfo.message_id;
        try {
          let thumbnail = await this.indexed.loadBlobFromUserPath((this.FileInfo['path'] || this.navParams.get('path'))
            + '_thumbnail.png', '');
          ThumbnailURL = URL.createObjectURL(thumbnail);
        } catch (e) { }
        if (!this.NeedDownloadFile && this.CurrentViewId == GetViewId)
          setTimeout(async () => {
            let createDuplicate = false;
            if (this.indexed.godotDB) {
              try {
                let blob = await this.indexed.loadBlobFromUserPath(
                  this.FileInfo['path'] || this.navParams.get('path'), '', undefined, this.indexed.ionicDB);
                await this.indexed.GetGodotIndexedDB();
                await this.indexed.saveBlobToUserPath(blob, 'tmp_files/duplicate/viewer.pck', undefined, this.indexed.godotDB);
                createDuplicate = true;
              } catch (e) {
                console.log('내부 파일 없음: ', e);
              }
            }
            await this.global.CreateGodotIFrame('content_viewer_canvas', {
              path: 'tmp_files/duplicate/viewer.pck',
              alt_path: this.FileInfo['path'] || this.navParams.get('path'),
              ext: this.FileInfo['file_ext'],
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
                  this.FileInfo['path'] || this.navParams.get('path'), '', undefined, this.indexed.ionicDB);
                await this.indexed.GetGodotIndexedDB();
                await this.indexed.saveBlobToUserPath(blob, 'tmp_files/duplicate/viewer.pck', undefined, this.indexed.godotDB);
              } catch (e) { }
              await this.global.CreateGodotIFrame('content_viewer_canvas', {
                path: 'tmp_files/duplicate/viewer.pck',
                alt_path: this.FileInfo['path'] || this.navParams.get('path'),
                ext: this.FileInfo['file_ext'],
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
            if (ThumbnailURL) URL.revokeObjectURL(ThumbnailURL);
            if (this.FileInfo.url)
              this.global.godot_window['download_url']();
            else this.global.godot_window['start_load_pck']();
          }, 100);
        break;
      case 'blender':
        let loading = await this.loadingCtrl.create({ message: this.lang.text['ContentViewer']['OnLoadContent'] });
        loading.present();
        this.p5canvas = new p5((p: p5) => {
          /** 수집된 광원 */
          let lights = [];
          /** 수집된 메쉬들 */
          let meshes = [];
          /** 수집된 카메라 */
          let cameras = [];
          /** 텍스처 이미지 불러오기 [데이터 id로 분류]: p5.Image */
          let texture_images = {};
          let LogDiv: p5.Element;
          p.setup = async () => {
            let canvas = p.createCanvas(this.canvasDiv.clientWidth, this.canvasDiv.clientHeight, p.WEBGL);
            canvas.parent(this.canvasDiv);
            p['canvas'] = canvas;
            p.textureMode(p.NORMAL);
            p.textureWrap(p.REPEAT);
            p.clear(255, 255, 255, 0);
            p.pixelDensity(1);
            let blob: Blob;
            try {
              blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.path, this.FileInfo.type || '');
            } catch (e) {
              try {
                let from_url = await fetch(this.FileInfo.url);
                blob = await from_url.blob();
              } catch (e) {
                console.log('뷰어에서 파일 불러오기 실패: ', e);
              }
            }
            // js.blend 페이지 불러오기
            let jsBlend = p.createElement('iframe');
            jsBlend.elt.id = 'jsBlend';
            jsBlend.elt.setAttribute("src", "assets/js.blend/index.html");
            jsBlend.elt.setAttribute("frameborder", "0");
            jsBlend.elt.setAttribute('class', 'full_screen');
            jsBlend.elt.setAttribute('allow', 'fullscreen; encrypted-media');
            jsBlend.elt.setAttribute('scrolling', 'no');
            jsBlend.elt.setAttribute('withCredentials', 'true');
            jsBlend.elt.setAttribute('hidden', 'true');
            this.canvasDiv.appendChild(jsBlend.elt);
            jsBlend.elt.contentWindow['TARGET_FILE'] = blob;
            // 불러오기 로딩 관련 로그 보여주기
            jsBlend.elt.onload = async () => {
              if (!blob) { // 파일이 열리지 않음 알림
                this.p5toast.show({
                  text: this.lang.text['ContentViewer']['CannotOpenText'],
                });
                loading.dismiss();
                return;
              }
              LogDiv = p.createDiv()
              LogDiv.parent(this.canvasDiv);
              LogDiv.id('logDiv');
              LogDiv.style('position', 'absolute');
              LogDiv.style('width', '100%');
              LogDiv.style('height', '100%');
              LogDiv.style('max-height', `${this.canvasDiv.clientHeight}px`);
              LogDiv.style('pointer-events', 'none');
              let blend = await jsBlend.elt.contentWindow['JSBLEND'](blob);
              // 모든 개체를 돌며 개체에 맞는 생성 동작
              const RATIO = 100;
              /** 블랜더 파일 (ArrayBuffer) */
              let blenderFile = blend.file.AB;
              for (let i = 0; i < blend.file.objects.Object.length; i++) {
                /** 이 개체의 정보 */
                let obj = blend.file.objects.Object[i];
                loading.message = `${this.lang.text['ContentViewer']['ReadObject']}: ${obj.aname}`;
                // 공통 정보
                let location = p.createVector(
                  -obj.loc[0] * RATIO,
                  -obj.loc[2] * RATIO,
                  obj.loc[1] * RATIO
                );
                let rotation = p.createVector(
                  obj.rot[0],
                  obj.rot[2],
                  -obj.rot[1]
                );
                switch (obj.type) {
                  case 0: // empty
                    break;
                  case 1: { // mesh
                    { // 모델 정보 기반으로 Geometry 개체 만들기
                      let shape: any;
                      /** 모델의 정점 정보 수집 (position) */
                      let vertex_id = (obj.data.vdata.layers[0] || obj.data.vdata.layers).data;
                      /** 각 정점간 연결 정보 (x: 시작점, y: 대상점) */
                      let edge_id = (obj.data.edata.layers[0] || obj.data.edata.layers).data;
                      /** 각 면과 관련된 정보 */
                      let qface_info = (obj.data.ldata.layers[0] || obj.data.ldata.layers).data;
                      // 정보 기반 그리기 행동
                      p['beginGeometry']();
                      p.push();
                      p.translate(location);
                      p.scale(
                        obj.size[0],
                        obj.size[2],
                        obj.size[1]
                      );
                      let hasRot = obj.rot[0] + obj.rot[1] + obj.rot[2];
                      if (hasRot) {  // 각도가 설정되어있다면
                        LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-warning-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['MayGimbalLock']}</div>`;
                        p.rotate(p.HALF_PI, rotation);
                      }
                      try { // 정점 관계도 사용 구간
                        /** 정점간 관계도 구축 (선으로 연결되는지 여부 수집) */
                        let vertex_linked = [];
                        for (let i = 0, j = vertex_id.length; i < j; i++)
                          vertex_linked.push([]);
                        for (let i = 0, j = edge_id.length; i < j; i++) {
                          let edge_id_start = edge_id[i].x ?? edge_id[i].v1;
                          let edge_id_end = edge_id[i].y ?? edge_id[i].v2;
                          vertex_linked[edge_id_start].push(edge_id_end);
                          vertex_linked[edge_id_end].push(edge_id_start);
                        }
                        // 면 UV 직접 지정
                        let isPlaneMesh = qface_info.length == 4;
                        let plane_uv = [
                          { u: 0, v: 1 },
                          { u: 1, v: 1 },
                          { u: 1, v: 0 },
                          { u: 0, v: 0 },
                        ]
                        // 면 생성하기
                        for (let i = qface_info.length - 1,
                          head_id = undefined, last_id = undefined;
                          i >= 0; i--) {
                          /** 현재 사용할 정점 */
                          let current_id = qface_info[i]['i'];
                          // 가장 처음에 시작할 때, 그리기 시작
                          let vertexTargetX = vertex_id[current_id].x ?? vertex_id[current_id]['co'][0];
                          let vertexTargetY = vertex_id[current_id].y ?? vertex_id[current_id]['co'][1];
                          let vertexTargetZ = vertex_id[current_id].z ?? vertex_id[current_id]['co'][2];
                          if (last_id === undefined) {
                            p.beginShape();
                            if (isPlaneMesh)
                              p.vertex(
                                -vertexTargetX * RATIO,
                                -vertexTargetZ * RATIO,
                                vertexTargetY * RATIO,
                                plane_uv[i].u,
                                plane_uv[i].v,
                              );
                            else
                              p.vertex(
                                -vertexTargetX * RATIO,
                                -vertexTargetZ * RATIO,
                                vertexTargetY * RATIO
                              );
                            head_id = current_id;
                            last_id = current_id;
                            continue;
                          } // 아래, 처음 이후 그리기 동작
                          try {
                            // 현재 정점이 이전 정점으로부터 그려질 수 있는지 검토
                            let checkIfCanLinked = vertex_linked[last_id].includes(current_id);
                            if (!checkIfCanLinked) throw '마지막 점으로부터 그릴 수 없음';
                            if (isPlaneMesh)
                              p.vertex(
                                -vertexTargetX * RATIO,
                                -vertexTargetZ * RATIO,
                                vertexTargetY * RATIO,
                                plane_uv[i].u,
                                plane_uv[i].v,
                              );
                            else
                              p.vertex(
                                -vertexTargetX * RATIO,
                                -vertexTargetZ * RATIO,
                                vertexTargetY * RATIO
                              );
                            let checkIfCanClosed = false;
                            // 시작점이 곧 마지막 점이 아니라면, 시작점으로 돌아갈 수 있는지 여부 확인
                            if (last_id != head_id)
                              checkIfCanClosed = vertex_linked[current_id].includes(head_id);
                            if (checkIfCanClosed) throw '돌아갈 수 있는데 돌아가지 않는다면 새 시작점으로 인식';
                          } catch (e) { // 새 시작점으로 인식
                            p.endShape(p.CLOSE);
                            last_id = undefined;
                            continue;
                          }
                          last_id = current_id;
                        }
                      } catch (e) {
                        console.log('메쉬 정보 불러오기 오류: ', e);
                      }
                      p.pop();
                      shape = p['endGeometry']();
                      // 머터리얼 정보 받아오기
                      let imgtex_id: any;
                      let base_color: p5.Color;
                      let emission_color: p5.Color;
                      let emission_strength: number = 0;
                      try {
                        if (!obj.data.mat.length) throw 'no_mat';
                        for (let i = 0, j = obj.data.mat.length; i < j; i++) {
                          // 머터리얼 기반 색상 찾기
                          try {
                            let _BaseColor = obj.data.mat[i].nodetree.nodes.first.next.inputs.first.default_value.value;
                            base_color = p.color(
                              _BaseColor[0] * 255,
                              _BaseColor[1] * 255,
                              _BaseColor[2] * 255,
                              _BaseColor[3] * 255
                            );
                          } catch (e) {
                            console.log('베이스 색상 가져오기 실패: ', e);
                          }
                          try {
                            let _EmissionColor = obj.data.mat[i].nodetree.nodes.first.next.inputs.last.prev.default_value.value;
                            emission_strength = obj.data.mat[i].nodetree.nodes.first.next.inputs.last.default_value.value;
                            emission_color = p.color(
                              _EmissionColor[0] * 255,
                              _EmissionColor[1] * 255,
                              _EmissionColor[2] * 255,
                              _EmissionColor[3] * 255
                            );
                          } catch (e) {
                            console.log('이미션 정보 수집 실패: ', e);
                          }
                          // 이미지 텍스처 재질 받기
                          if (obj.data.mat[i].nodetree.nodes.last.id) { // 내장 이미지 파일을 읽어내기
                            let packedfile = obj.data.mat[i].nodetree.nodes.last.id.packedfile;
                            if (!packedfile) throw 'unpacked';
                            if (texture_images[packedfile.data['__data_address__']]) throw 'duplicated';
                            imgtex_id = packedfile.data['__data_address__'];
                            let data_size = packedfile.size;
                            let ImageBuffer = blenderFile.slice(imgtex_id, imgtex_id + data_size);
                            let blob = new Blob([ImageBuffer]);
                            let ImageTextureURL = URL.createObjectURL(blob);
                            p.loadImage(ImageTextureURL, v => {
                              texture_images[packedfile.data['__data_address__']] = v;
                              LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['OnWorkReadUV']}</div>`;
                              URL.revokeObjectURL(ImageTextureURL);
                            }, e => {
                              console.log('텍스쳐 불러오기 실패: ', e);
                              URL.revokeObjectURL(ImageTextureURL);
                            });
                          }
                        }
                      } catch (e) {
                        switch (e) {
                          case 'unpacked': // 파일에 내장되지 않음(링크 파일)
                            LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-warning-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['LinkedTexFile']}</div>`;
                            break;
                          case 'duplicated': // 중복 등록 행동 방지
                            break;
                          case 'no_mat':
                            LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-medium-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['NoMaterial']}</div>`;
                            break;
                          default: // 정의되지 않은 오류
                            console.log(obj.aname, '_재질 정보 불러오기 오류: ', e);
                            LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-danger-shade)">${obj.aname}: ${e}</div>`;
                            break;
                        }
                      }
                      // shade 옵션 (Flat/Smooth)
                      shape['computeNormals']();
                      // 개체 정보 누적
                      meshes.push({
                        id: obj.data.address,
                        name: obj.data.aname,
                        color: base_color,
                        emissionColor: emission_color,
                        emissionStrength: emission_strength,
                        texture: imgtex_id,
                        mesh: shape,
                      });
                    }
                    break;
                  }
                  case 10: { // lamp
                    // 빛의 종류 구분이 필요
                    if (lights.length < 5) {
                      LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-warning-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['OnWorkReadLightMode']}</div>`;
                      // 빛 정보 구분이 어려우므로 일단 포인트 조명으로 통일
                      lights.push({
                        type: 'point',
                        loc: location,
                        rot: rotation,
                        color: p.color(255, 255, 255),
                      });
                    } else LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-medium-shade)">${obj.aname}: ${this.lang.text['ContentViewer']['ReachLightLimit']}</div>`;
                    break;
                  }
                  case 11: // camera
                    break;
                  default: // 준비되지 않은 데이터 필터용
                    LogDiv.elt.innerHTML += `<div style="color: var(--ion-color-medium-shade)>${obj.aname}: ${this.lang.text['ContentViewer']['OnWorkObjectType']}_${obj.type}</div>`;
                    break;
                }
                await new Promise(res => setTimeout(res, 0));
              }
              loading.dismiss();
              setTimeout(() => {
                LogDiv.elt.remove();
              }, 8000);
              this.ContentOnLoad = true;
            };
          }
          p.draw = () => {
            p.clear(255, 255, 255, 0);
            p.orbitControl();
            if (lights.length) {
              for (let i = 0, j = lights.length; i < j; i++) {
                switch (lights[i].type) {
                  case 'point':
                    p.pointLight(lights[i].color, lights[i].loc);
                    break;
                  default:
                    break;
                }
              }
            } else // 빛이 없다면 기본 빛 부여
              p.lights();
            for (let i = 0, j = meshes.length; i < j; i++) {
              p.push();
              if (meshes[i].texture) {
                p.noStroke();
                if (texture_images[meshes[i].texture]) {
                  p.texture(texture_images[meshes[i].texture]);
                }
              } else {
                if (meshes[i].color) {
                  p.noStroke();
                  p.ambientMaterial(meshes[i].color);
                }
              }
              if (meshes[i].emissionStrength) {
                p.noStroke();
                p.emissiveMaterial(meshes[i].emissionColor);
              }
              p.model(meshes[i].mesh);
              p.pop();
            }
          }
          p.windowResized = () => {
            setTimeout(() => {
              this.canvasDiv.style.maxHeight = (window.innerHeight - 56 - 45) + 'px';
              if (LogDiv) LogDiv.style('max-height', `${this.canvasDiv.clientHeight}px`);
              p.resizeCanvas(this.canvasDiv.clientWidth, this.canvasDiv.clientHeight);
            }, 50);
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

  /** PC에서 키를 눌러 컨텐츠 전환 */
  ChangeContentWithKeyInput() {
    if (this.p5canvas) {
      this.p5canvas.keyPressed = (ev) => {
        if (this.isTextEditMode) return;
        switch (ev['code']) {
          case 'KeyA': // 왼쪽 이동
          case 'ArrowLeft':
            this.ChangeToAnother(-1);
            break;
          case 'KeyS': // 파일 저장
            this.download_file();
            break;
          case 'KeyD': // 오른쪽 이동
          case 'ArrowRight':
            this.ChangeToAnother(1);
            break;
          case 'KeyS': // 다운받기
            if (this.NeedDownloadFile)
              this.DownloadCurrentFile();
            break;
        }
      }
    }
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
      syntaxHighlightReader.elt.setAttribute('style', `height: ${p['TextArea'].clientHeight}px; display: block; overflow-y: scroll;`);
      this.canvasDiv.appendChild(syntaxHighlightReader.elt);
      p['SyntaxHighlightReader'] = syntaxHighlightReader.elt;
    }
    // 구문 강조처리용 구성 변환
    let getText = p['TextArea'].textContent;
    let text_as_line: string[] = getText.split('\n');
    /** 간단한 하이라이트 코드 구성 (정확히 일치하면 색상처리) */
    const SIMPLE_HIGHLIGHT_CODE = [
      // 구성
      'void', 'static', 'import', 'include', '#include', 'using',
      'from', 'as', 'public', 'protected', 'private', 'use', 'package', 'local',
      'program', 'namespace', 'begin', 'end', 'puts',
      'Private', 'Protected', 'Public', 'Sub', 'End',
      // 변수 ,종류
      'var', 'let',
      'String', 'char',
      'Integer', 'Float', 'Boolean', 'Array', 'NULL', 'Resource',
      'strings', 'integer', 'complex',
      'byte', 'ubyte', 'int', 'uint', 'short', 'ushort', 'long', 'ulong',
      'bvec2', 'bvec3', 'bvec4', 'ivec2', 'ivec3', 'ivec4',
      'uvec2', 'uvec3', 'uvec4', 'mat2', 'mat3', 'mat4',
      'Vector', 'Vector2', 'Vector3',
      'PVector', 'PImage', 'PGraphics',
      'float', 'double', 'number',
      'color',
      'bool', 'boolean',
      'Arary', 'Object', 'Table', 'TableRow', 'HashMap',
      'null', 'undefined', 'data',
      // 함수 구분
      'function', 'func', 'fn', 'def', 'fun',
      // 클래스 구분
      'class', 'extends', 'implements', 'object',
    ]
    /** 고정수 표현 */
    const FIXED_VALUE = [
      'final', 'const',
    ]
    /** 연산자 색상 */
    const OPERATOR = [
      'for', 'match', 'switch', 'if', 'else', 'elif', 'return', 'continue', 'pass',
      'loop', 'while', 'in', 'try', 'catch', 'and', 'or', 'do', 'then', 'yield',
    ];
    const COMPARISON_OP = [
      '!=', '>=', '<=', '==', '<', '>',
    ];
    /** 이게 존재하는 줄은 전부 주석색 */
    const ANNOTATION = [
      '#', '##', '<!--', '-->', '/**', '*/', '//',
    ];
    /** 값 대입 표시 */
    const EQUAL_MARK = ['='];
    /** 문법 */
    const SPECIAL_CHARACTER = [
      '{', '}', '<<', '>>', ':', '-', '(', ')', '[', ']', '>>>', '->', '<-', '=>', '<=',
    ];
    /** 명령어 */
    const COMMAND = [
      'SELECT', 'UPDATE', 'DELETE', 'INSERT INTO', 'CREATE DATABASE', 'ALTER DATABASE', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'DROP INDEX',
      'ECHO', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
      'ALTER', 'ADD',
      'echo', '<?php', '?>',
    ]
    for (let i = 0, j = text_as_line.length; i < j; i++) {
      // div 안에서 띄어쓰기 정보를 표현함
      let line = p.createDiv();
      let exact_line_text = text_as_line[i];
      let sep_by_whitespace = exact_line_text.split(' ');
      let isCommentLine = false;
      for (let k = 0, l = sep_by_whitespace.length; k < l; k++) {
        let text = this.HTMLEncode(sep_by_whitespace[k]);
        let isColored = false;
        // 특성 색상으로 강조 표시
        for (let m = 0, n = ANNOTATION.length; m < n; m++)
          if (sep_by_whitespace[k] == ANNOTATION[m]) {
            isCommentLine = true;
            break;
          }
        if (!isCommentLine) {
          for (let m = 0, n = EQUAL_MARK.length; m < n; m++)
            if (sep_by_whitespace[k] == EQUAL_MARK[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-equalmark)');
              word.parent(line);
              isColored = true;
              break;
            }
          if (isColored) continue;
          for (let m = 0, n = FIXED_VALUE.length; m < n; m++)
            if (sep_by_whitespace[k] == FIXED_VALUE[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-final)');
              word.parent(line);
              isColored = true;
              break;
            }
          for (let m = 0, n = COMPARISON_OP.length; m < n; m++)
            if (sep_by_whitespace[k] == COMPARISON_OP[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-comparion-op)');
              word.parent(line);
              isColored = true;
              break;
            }
          if (isColored) continue;
          if (isColored) continue;
          for (let m = 0, n = OPERATOR.length; m < n; m++)
            if (sep_by_whitespace[k] == OPERATOR[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-operator)');
              word.parent(line);
              isColored = true;
              break;
            }
          if (isColored) continue;
          for (let m = 0, n = SPECIAL_CHARACTER.length; m < n; m++)
            if (sep_by_whitespace[k] == SPECIAL_CHARACTER[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-spechar)');
              word.parent(line);
              isColored = true;
              break;
            }
          if (isColored) continue;
          for (let m = 0, n = COMMAND.length; m < n; m++)
            if (sep_by_whitespace[k] == COMMAND[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-command)');
              word.parent(line);
              isColored = true;
              break;
            }
          if (isColored) continue;
          for (let m = 0, n = SIMPLE_HIGHLIGHT_CODE.length; m < n; m++)
            if (sep_by_whitespace[k] == SIMPLE_HIGHLIGHT_CODE[m]) {
              let word = p.createSpan(text + '&nbsp');
              word.style('color', 'var(--syntax-text-coding-basic)');
              word.parent(line);
              isColored = true;
              break;
            }
          if (isColored) continue;
        }
        // 일반 평문
        let word = p.createSpan(text + '&nbsp');
        if (isCommentLine)
          word.style('color', 'var(--syntax-text-coding-comments)');
        word.parent(line);
      }
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
          this.image_info['path'] = this.FileInfo.path || this.navParams.get('path');
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
            isDarkMode: this.global.GetExactDarkMode(),
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
      default:
        console.log('편집 불가 파일 정보: ', this.FileInfo);
        break;
    }
  }

  /** 덮어쓰기 전단계 */
  forceWrite = false;
  async download_file() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      if (this.FileInfo['url']) {
        try {
          let res = await fetch(this.FileInfo.url);
          let blob = await res.blob();
          if (res.ok) {
            await this.indexed.saveBlobToUserPath(blob, this.FileInfo.path);
            this.indexed.DownloadFileFromUserPath(this.FileInfo.path, this.FileInfo['type'], this.FileInfo['filename'] || this.FileInfo['name']);
          } else throw '제대로 다운받아지지 않음';
        } catch (e) {
          console.log('다운받기 실패: ', e);
          this.p5toast.show({
            text: `${this.lang.text['Nakama']['FailedDownload']}: ${e}`
          });
        }
      } else this.indexed.DownloadFileFromUserPath(this.FileInfo.path, this.FileInfo['type'], this.FileInfo['filename'] || this.FileInfo['name']);
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
                await this.indexed.saveBlobToUserPath(blob, this.FileInfo.path);
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
    let blob = await this.indexed.loadBlobFromUserPath(this.FileInfo.path, this.FileInfo['type']);
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
          if (v.data) this.modalCtrl.dismiss();
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
      message: this.FileInfo.path,
      buttons: [{
        text: this.lang.text['TodoDetail']['remove'],
        handler: () => {
          this.RemoveFileAct();
        },
        cssClass: 'red_font',
      }]
    }).then(v => v.present());
  }

  async RemoveFileAct() {
    URL.revokeObjectURL(this.FileURL);
    delete this.FileInfo.thumbnail;
    delete this.FileInfo['text'];
    await this.indexed.removeFileFromUserPath(this.FileInfo.path);
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
          this.p5canvas.filter(this.p5canvas.BLUR, 3);
          this.p5canvas.pop();
          this.p5canvas.fill(255);
          this.p5canvas.text((this.FileInfo['filename'] || this.FileInfo['name']),
            margin_ratio, margin_ratio,
            width - margin_ratio * 2, height - margin_ratio * 2);
          let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
          try {
            await this.indexed.saveBase64ToUserPath(base64, `${this.FileInfo.path}_thumbnail.png`);
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
                p.filter(p.BLUR, 3);
                p.pop();
                p.fill(255);
                p.text((this.FileInfo['filename'] || this.FileInfo['name']),
                  margin_ratio, margin_ratio,
                  width - margin_ratio * 2, height - margin_ratio * 2);
                let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
                await this.indexed.saveBase64ToUserPath(base64, `${this.FileInfo.path}_thumbnail.png`);
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
    try {
      let is_exist = await this.file.checkFile(this.file.externalDataDirectory, `viewer_tmp.${this.FileInfo.file_ext}`);
      if (is_exist) await this.file.removeFile(this.file.externalDataDirectory, `viewer_tmp.${this.FileInfo.file_ext}`);
    } catch (e) { }
  }

  ionViewDidLeave() {
    this.noti.ClearNoti(6);
  }

  copy_url(data: string) {
    this.mClipboard.copy(data)
      .catch(_e => clipboard.write(data));
  }
}

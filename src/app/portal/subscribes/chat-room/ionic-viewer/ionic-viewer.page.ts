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
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';
import { ContentCreatorInfo, FileInfo, GlobalActService } from 'src/app/global-act.service';
import { ShareContentToOtherPage } from 'src/app/share-content-to-other/share-content-to-other.page';
import { NakamaService } from 'src/app/nakama.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from 'clipboardy';

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
    private fileOpener: FileOpener,
    public global: GlobalActService,
    public nakama: NakamaService,
    private mClipboard: Clipboard,
  ) { }

  blob: Blob;
  FileInfo: FileInfo;
  p5canvas: p5;
  FileURL: string;
  ContentBox: HTMLElement;
  FileHeader: HTMLElement;
  HasNoEditButton: boolean;

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
  isDownloading = false;

  EventListenerAct = (ev: any) => {
    ev.detail.register(120, (_processNextHandler: any) => { });
  }

  async ngOnInit() {
    this.MessageInfo = this.navParams.get('info');
    this.FileInfo = this.MessageInfo.content;
    this.ContentBox = document.getElementById('ContentBox');
    this.FileHeader = document.getElementById('FileHeader');
    this.isOfficial = this.navParams.get('isOfficial');
    this.target = this.navParams.get('target');
    this.HasNoEditButton = this.navParams.get('no_edit') || false;
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
    if (this.FileInfo.url) {
      this.FileURL = this.FileInfo.url;
    } else {
      this.blob = await this.indexed.loadBlobFromUserPath(this.navParams.get('path'), this.FileInfo['type']);
      this.FileURL = URL.createObjectURL(this.blob);
    }
    this.CreateContentInfo();
  }

  async reinit_content_data(msg: any) {
    this.NeedDownloadFile = false;
    this.FileInfo = msg.content;
    if (this.FileInfo.url) {
      this.FileURL = this.FileInfo.url;
    } else {
      let path = this.FileInfo['path'] ||
        `servers/${this.isOfficial}/${this.target}/channels/${msg.channel_id}/files/msg_${msg.message_id}.${msg.content['file_ext']}`;
      this.image_info['path'] = path;
      try {
        this.blob = await this.indexed.loadBlobFromUserPath(path, this.FileInfo['type']);
        this.FileURL = URL.createObjectURL(this.blob);
      } catch (e) {
        this.isDownloading = false;
        this.NeedDownloadFile = true;
      }
    }
    this.CreateContentInfo();
    this.ionViewDidEnter();
  }

  ChangeToAnother(direction: number) {
    let tmp_calced = this.RelevanceIndex + direction;
    if (tmp_calced <= 0 || tmp_calced > this.Relevances.length)
      return;
    this.RelevanceIndex = tmp_calced;
    this.reinit_content_data(this.Relevances[this.RelevanceIndex - 1]);
  }

  async DownloadCurrentFile() {
    this.isDownloading = true;
    await this.nakama.ReadStorage_From_channel(this.Relevances[this.RelevanceIndex - 1], this.image_info['path'], this.isOfficial, this.target);
    this.reinit_content_data(this.Relevances[this.RelevanceIndex - 1]);
  }

  CreateContentInfo() {
    try { // 파일 정보 검토
      this.content_creator = this.FileInfo['content_creator'];
      this.content_creator.timeDisplay = new Date(this.content_creator.timestamp).toLocaleString();
      this.content_related_creator = this.FileInfo['content_related_creator'];
      if (this.content_creator.user_id)
        this.content_creator.is_me =
          this.nakama.servers[this.isOfficial][this.target].session.user_id == this.content_creator.user_id;
      this.set_various_display(this.content_creator);
      for (let i = 0, j = this.content_related_creator.length; i < j; i++) {
        if (this.content_related_creator[i].user_id) {
          this.content_related_creator[i].is_me =
            this.nakama.servers[this.isOfficial][this.target].session.user_id == this.content_related_creator[i].user_id;
        }
        this.content_related_creator[i].timeDisplay = new Date(this.content_related_creator[i].timestamp).toLocaleString();
        this.set_various_display(this.content_related_creator[i]);
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
          this.content_related_creator[0].publisher = this.content_related_creator[1].display_name
          this.content_related_creator.splice(1, 1);
        }
      } catch (e) { }
      try {
        if (!this.content_related_creator[0].publisher)
          this.content_related_creator[0].publisher = this.content_related_creator[0].display_name;
      } catch (e) { }
    }
    try {
      this.content_related_creator.sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1;
        else if (a.timestamp < b.timestamp) return 1;
        else return 0;
      });
    } catch (e) { }
  }

  set_various_display(target: ContentCreatorInfo) {
    target['various_display'] = this.lang.text['GlobalAct']['UnknownSource'];
    switch (target.various) {
      case 'camera':
        target['various_display'] = this.lang.text['GlobalAct']['FromCamera'];
        break;
      case 'link':
        target['various_display'] = this.FileInfo.url;
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
    }
  }

  async ionViewDidEnter() {
    let canvasDiv = document.getElementById('content_viewer_canvas');
    canvasDiv.style.backgroundImage = '';
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    if (this.p5canvas) this.p5canvas.remove();
    // 경우에 따라 로딩하는 캔버스를 구분
    switch (this.FileInfo['viewer']) {
      case 'image': // 이미지
        this.p5canvas = new p5((p: p5) => {
          let iframe_sub: p5.Element;
          p.setup = async () => {
            canvasDiv.style.maxWidth = '100%';
            canvasDiv.style.overflow = 'hidden';
            this.ContentBox.style.overflow = 'hidden';
            p.noCanvas();
            let img = p.createElement('img');
            img.elt.hidden = true;
            img.elt.src = this.FileURL;
            img.elt.onload = () => {
              canvasDiv.style.backgroundImage = `url(${this.FileURL})`;
              canvasDiv.style.backgroundRepeat = 'no-repeat';
              canvasDiv.style.pointerEvents = 'none';
              this.image_info['width'] = img.elt.naturalWidth;
              this.image_info['height'] = img.elt.naturalHeight;
              imageOriginalSize = p.createVector(img.elt.naturalWidth, img.elt.naturalHeight);
              RePositioningImage();
              img.remove();
            }
            if (isPlatform == 'Android' || isPlatform == 'iOS') {
              iframe_sub = p.createElement('iframe');
              iframe_sub.elt.setAttribute("src", this.FileURL);
              iframe_sub.elt.setAttribute("frameborder", "0");
              iframe_sub.elt.setAttribute('class', 'full_screen');
              iframe_sub.elt.setAttribute('style', 'position: relative; pointer-events: all');
              iframe_sub.elt.hidden = true;
              canvasDiv.appendChild(iframe_sub.elt);
            }
            p.noLoop();
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let RePositioningImage = () => {
            if (this.image_info['width'] / this.image_info['height'] < canvasDiv.clientWidth / canvasDiv.clientHeight) {
              let tmp_width = this.image_info['width'] * canvasDiv.clientHeight / this.image_info['height'];
              canvasDiv.style.backgroundSize = `${tmp_width}px`;
              canvasDiv.style.backgroundPositionX = `${(canvasDiv.clientWidth - tmp_width) / 2}px`;
              canvasDiv.style.backgroundPositionY = `0px`;
            } else {
              canvasDiv.style.backgroundSize = `${canvasDiv.clientWidth}px`;
              canvasDiv.style.backgroundPositionX = '0px';
              let imageRatio = canvasDiv.clientWidth / imageOriginalSize.x;
              let centerHeight =
                canvasDiv.clientHeight / 2 - imageOriginalSize.y * imageRatio / 2;
              canvasDiv.style.backgroundPositionY = `${centerHeight}px`;
            }
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
            canvasDiv.style.backgroundPositionX = `${lastPos.x + endPos.x}px`;
            canvasDiv.style.backgroundPositionY = `${lastPos.y + endPos.y}px`;
          }
          let ScaleImage = (center: p5.Vector, ratio: number) => {
            let beforeCalced = lastScale;
            let Calced = lastScale * ratio;
            let posX = Number(canvasDiv.style.backgroundPositionX.split('px')[0]);
            let posY = Number(canvasDiv.style.backgroundPositionY.split('px')[0]);
            let widthMoved = (beforeCalced - Calced) * p.map(center.x, posX, posX + beforeCalced, 0, 1);
            let scaledImageHeight = (beforeCalced - Calced) / imageOriginalSize.x * imageOriginalSize.y;
            let heightMoved = scaledImageHeight * p.map(center.y, posY, posY + beforeCalced / imageOriginalSize.x * imageOriginalSize.y, 0, 1);
            canvasDiv.style.backgroundPositionX = `${posX + widthMoved}px`
            canvasDiv.style.backgroundPositionY = `${posY + heightMoved}px`;
            canvasDiv.style.backgroundSize = `${Calced}px`;
          }
          p.mousePressed = () => {
            if (!this.useP5Navigator) return;
            if (p.mouseButton == p.CENTER)
              RePositioningImage();
            if (isPlatform == 'DesktopPWA') {
              lastPos =
                p.createVector(
                  Number(canvasDiv.style.backgroundPositionX.split('px')[0]),
                  Number(canvasDiv.style.backgroundPositionY.split('px')[0]));
              startPos = p.createVector(p.mouseX, p.mouseY);
            }
          }
          p.mouseWheel = (ev: any) => {
            if (!this.useP5Navigator) return;
            lastScale = Number(canvasDiv.style.backgroundSize.split('px')[0]);
            ScaleImage(p.createVector(canvasDiv.clientWidth / 2, canvasDiv.clientHeight / 2), 1 - ev.delta / 1000);
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
                    Number(canvasDiv.style.backgroundPositionX.split('px')[0]),
                    Number(canvasDiv.style.backgroundPositionY.split('px')[0]));
                startPos = touches[ev.changedTouches[0].identifier].copy();
                break;
              case 2: // 두번째 손가락이 들어옴
                lastPos =
                  p.createVector(
                    Number(canvasDiv.style.backgroundPositionX.split('px')[0]),
                    Number(canvasDiv.style.backgroundPositionY.split('px')[0]));
                let firstCopy = touches[0].copy();
                dist_two = firstCopy.dist(touches[1]);
                startPos = firstCopy.add(touches[1]).div(2).copy();
                lastScale = Number(canvasDiv.style.backgroundSize.split('px')[0]);
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
                  TransformImage();
                  break;
                case 2: // 이동, 스케일
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
                      Number(canvasDiv.style.backgroundPositionX.split('px')[0]),
                      Number(canvasDiv.style.backgroundPositionY.split('px')[0]));
                  startPos = touches[Object.keys(touches)[0]].copy();
                  break;
                case 0: // 손을 전부 뗌
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
              canvasDiv.appendChild(mediaObject['elt']);
              mediaObject['elt'].hidden = true;
              setTimeout(() => {
                ResizeAudio();
                mediaObject['elt'].hidden = false;
              }, 50);
              mediaObject.showControls();
              mediaObject.play();
            });
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
        });
        break;
      case 'video': // 비디오
        this.p5canvas = new p5((p: p5) => {
          var mediaObject: p5.MediaElement;
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            mediaObject = p.createVideo([this.FileURL], () => {
              canvasDiv.appendChild(mediaObject['elt']);
              mediaObject['elt'].hidden = true;
              setTimeout(() => {
                this.image_info['width'] = mediaObject['elt']['videoWidth'];
                this.image_info['height'] = mediaObject['elt']['videoHeight'];
                ResizeVideo();
                mediaObject['elt'].hidden = false;
              }, 50);
              mediaObject.showControls();
              mediaObject.play();
            });
            p['VideoMedia'] = mediaObject;
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeVideo = () => {
            let canvasWidth = this.ContentBox.offsetWidth;
            let canvasHeight = this.ContentBox.offsetHeight - this.FileHeader.offsetHeight;
            let width = mediaObject['width'];
            let height = mediaObject['height'];
            mediaObject['elt'].setAttribute('style', 'position: relative; top: 50%; left: 50%; transform: translateX(-50%) translateY(-50%);');
            if (width < height) { // 가로 영상
              height = canvasHeight;
              width = width / mediaObject['height'] * height;
            } else { // 세로 영상
              width = canvasWidth;
              height = (height / mediaObject['width'] * width) || (canvasHeight / 2);
            }
            mediaObject['size'](width, height);
          }
          p.windowResized = () => {
            setTimeout(() => {
              ResizeVideo();
            }, 50);
          }
        });
        break;
      case 'text': // 텍스트 파일
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            p.noCanvas();
            p.noLoop();
            p.loadStrings(this.FileURL, v => {
              let textArea = p.createElement('textarea');
              textArea.elt.disabled = true;
              textArea.elt.className = 'infobox';
              textArea.elt.setAttribute('style', 'height: 100%; display: block;');
              textArea.elt.textContent = v.join('\n');
              canvasDiv.appendChild(textArea.elt);
              p['TextArea'] = textArea;
            }, e => {
              console.error('열람할 수 없는 파일: ', e);
              canvasDiv.textContent = '열람할 수 없는 파일입니다.';
              this.FileInfo['else'] = true; // 일반 미디어 파일이 아님을 알림
            });
          }
        });
        break;
      case 'godot':
        document.addEventListener('ionBackButton', this.EventListenerAct)
        await this.global.CreateGodotIFrame('content_viewer_canvas', {
          local_url: 'assets/data/godot/viewer.pck',
          title: 'ViewerEx',
          path: this.FileInfo['path'] || this.navParams.get('path'),
          ext: this.FileInfo['file_ext'],
          force_logo: true,
          // modify_image
          receive_image: async (base64: string, width: number, height: number) => {
            let tmp_path = 'tmp_files/modify_image.png';
            await this.indexed.saveBase64ToUserPath(',' + base64, tmp_path);
            this.modalCtrl.dismiss({
              path: tmp_path,
              width: width,
              height: height,
              msg: this.HaveRelevances ? this.Relevances[this.RelevanceIndex - 1] : this.MessageInfo,
              index: this.RelevanceIndex - 1,
            });
          }
        }, 'create_thumbnail');
        break;
      case 'disabled':
        try {
          await this.file.writeFile(this.file.externalDataDirectory, `viewer_tmp.${this.FileInfo.file_ext}`, this.blob);
          this.fileOpener.open(this.file.externalDataDirectory + `viewer_tmp.${this.FileInfo.file_ext}`, this.FileInfo['type'] || `application/${this.FileInfo['file_ext']}`);
        } catch (e) {
          console.log('open file failed: ', e);
          this.p5toast.show({
            text: `${this.lang.text['ChatRoom']['cannot_open_file']}: ${e.message}`,
          });
        }
        break;
    }
  }

  @ViewChild(IonModal) ShowContentInfoIonic: IonModal;

  open_bottom_modal() {
    this.ShowContentInfoIonic.onDidDismiss().then(_v => {
      this.useP5Navigator = true;
    });
    this.useP5Navigator = false;
    this.ShowContentInfoIonic.present();
  }

  image_info = {};

  /** 내장 그림판을 이용하여 그림 편집하기 */
  async modify_image() {
    switch (this.FileInfo['viewer']) {
      case 'image': // 이미지인 경우, url 일 때
        if (this.FileInfo.url) {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          try {
            let blob = await fetch(this.FileInfo['url']).then(r => r.blob());
            this.image_info['path'] = `tmp_files/external_image_edit/image_download.${this.FileInfo.file_ext}`;
            await this.indexed.saveBlobToUserPath(blob, this.image_info['path']);
            this.modalCtrl.dismiss({
              ...this.image_info,
              msg: this.HaveRelevances ? this.Relevances[this.RelevanceIndex - 1] : this.MessageInfo,
              index: this.RelevanceIndex - 1,
            });
          } catch (e) {
            this.p5toast.show({
              text: `${this.lang.text['ContentViewer']['CannotEditFile']}: ${e}`,
            });
          }
          loading.dismiss();
        } else this.modalCtrl.dismiss({
          ...this.image_info,
          path: this.FileInfo.path,
          msg: this.HaveRelevances ? this.Relevances[this.RelevanceIndex - 1] : this.MessageInfo,
          index: this.RelevanceIndex - 1,
        });
        break;
      case 'text': // 텍스트를 이미지화하기
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        this.image_info['width'] = this.p5canvas['TextArea'].clientWidth;
        this.image_info['height'] = this.p5canvas['TextArea'].scrollHeight;
        this.p5canvas.createCanvas(this.image_info['width'], this.image_info['height']);
        this.p5canvas.textSize(16);
        this.p5canvas.textWrap(this.p5canvas.WORD);
        let margin = this.p5canvas.width * .05;
        this.p5canvas.text(this.p5canvas['TextArea'].textContent,
          margin, margin, this.p5canvas.width - margin * 2);
        this.p5canvas.saveFrames('', 'png', 1, 1, async c => {
          try {
            loading.dismiss();
            this.image_info['path'] = 'tmp_files/text_edit/text_copy.png';
            await this.indexed.saveBase64ToUserPath(c[0]['imageData'].replace(/"|=|\\/g, ''),
              this.image_info['path']);
            this.modalCtrl.dismiss({
              ...this.image_info,
              msg: this.HaveRelevances ? this.Relevances[this.RelevanceIndex - 1] : this.MessageInfo,
              index: this.RelevanceIndex - 1,
            });
          } catch (e) {
            console.log('파일 저장 오류: ', e);
          }
        });
        break;
      case 'video': // 마지막 프레임 저장하기
        try {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          this.p5canvas['VideoMedia'].pause();
          this.p5canvas.createCanvas(this.image_info['width'], this.image_info['height']);
          this.p5canvas.image(this.p5canvas['VideoMedia'], 0, 0, this.image_info['width'], this.image_info['height']);
          this.p5canvas.saveFrames('', 'png', 1, 1, async c => {
            try {
              loading.dismiss();
              this.image_info['path'] = 'tmp_files/video_edit/frame.png';
              await this.indexed.saveBase64ToUserPath(c[0]['imageData'].replace(/"|=|\\/g, ''),
                this.image_info['path']);
              this.modalCtrl.dismiss({
                ...this.image_info,
                msg: this.HaveRelevances ? this.Relevances[this.RelevanceIndex - 1] : this.MessageInfo,
                index: this.RelevanceIndex - 1,
              });
            } catch (e) {
              console.log('파일 저장 오류: ', e);
            }
          });
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

  download_file() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.indexed.DownloadFileFromUserPath(this.navParams.get('path'), this.FileInfo['type'], this.FileInfo['filename']);
    else {
      this.alertCtrl.create({
        header: this.lang.text['ContentViewer']['Filename'],
        inputs: [{
          name: 'filename',
          placeholder: this.FileInfo['filename'],
          type: 'text',
        }],
        buttons: [{
          text: this.lang.text['ContentViewer']['saveFile'],
          handler: async (input) => {
            let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
            loading.present();
            let filename = input['filename'] ? `${input['filename'].replace(/:|\?|\/|\\|<|>/g, '')}.${this.FileInfo['file_ext']}` : this.FileInfo['filename'];
            let blob = await this.indexed.loadBlobFromUserPath(this.navParams.get('path'), this.FileInfo['type']);
            this.file.writeFile(this.file.externalDataDirectory, filename, blob)
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
                    this.download_file();
                    break;
                  default:
                    console.log('준비되지 않은 오류 반환: ', e);
                    break;
                }
              });
          }
        }]
      }).then(v => v.present());
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
          if (v.data) this.modalCtrl.dismiss()
        });
        v.present();
      });
    else this.p5toast.show({
      text: this.lang.text['ShareContentToOther']['NoChannelToShare'],
    });
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
          this.p5canvas.createCanvas(width, height);
          this.p5canvas.image(this.p5canvas['VideoMedia'], 0, 0, width, height);
          this.p5canvas.fill(255, 128);
          this.p5canvas.rect(0, 0, width, height);
          this.p5canvas.textWrap(this.p5canvas.CHAR);
          this.p5canvas.textSize(16);
          let margin_ratio = height / 16;
          this.p5canvas.push()
          this.p5canvas.translate(margin_ratio / 6, margin_ratio / 6);
          this.p5canvas.fill(0)
          this.p5canvas.text(this.FileInfo['filename'],
            margin_ratio, margin_ratio,
            width - margin_ratio * 2, height - margin_ratio * 2);
          this.p5canvas.filter(this.p5canvas.BLUR, 3);
          this.p5canvas.pop();
          this.p5canvas.fill(255);
          this.p5canvas.text(this.FileInfo['filename'],
            margin_ratio, margin_ratio,
            width - margin_ratio * 2, height - margin_ratio * 2);
          this.p5canvas.saveFrames('', 'png', 1, 1, async c => {
            try {
              await this.indexed.saveBase64ToUserPath(c[0]['imageData'].replace(/"|=|\\/g, ''),
                `${this.FileInfo.path}_thumbnail.png`);
              this.global.modulate_thumbnail(this.FileInfo, '');
            } catch (e) {
              console.log('썸네일 저장 오류: ', e);
            }
          });
        } catch (e) {
          console.log('작업중 오류보기: ', e);
        }
        break;
      case 'godot':
        try {
          this.global.godot_window['filename'] = this.FileInfo.filename;
          this.global.godot_window['create_thumbnail'](this.FileInfo);
        } catch (e) { }
        break;
    }
    if (this.p5canvas) this.p5canvas.remove();
    if (this.FileURL)
      URL.revokeObjectURL(this.FileURL);
    let is_exist = this.file.checkFile(this.file.externalDataDirectory, `viewer_tmp.${this.FileInfo.file_ext}`);
    if (is_exist) this.file.removeFile(this.file.externalDataDirectory, `viewer_tmp.${this.FileInfo.file_ext}`);
  }

  copy_url() {
    this.mClipboard.copy(this.FileInfo['url'])
      .catch(_e => clipboard.write(this.FileInfo['url']));
  }
}

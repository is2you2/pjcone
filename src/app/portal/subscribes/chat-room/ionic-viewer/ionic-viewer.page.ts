// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

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
  ) { }

  cant_dedicated: boolean;
  FileInfo: any;
  p5canvas: p5;
  FileURL: string;
  ContentBox: HTMLElement;
  FileHeader: HTMLElement;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.FileInfo = this.navParams.get('info');
    this.ContentBox = document.getElementById('ContentBox');
    this.FileHeader = document.getElementById('FileHeader');
    this.indexed.loadBlobFromUserPath(this.navParams.get('path'), this.FileInfo['type'], (blob) => {
      this.FileURL = URL.createObjectURL(blob);
    });
  }

  ionViewDidEnter() {
    let canvasDiv = document.getElementById('p5canvas');
    // 경우에 따라 로딩하는 캔버스를 구분
    switch (this.FileInfo['viewer']) {
      case 'image': // 이미지
        this.p5canvas = new p5((p: p5) => {
          const IMAGE_ELEMENT_ID = 'ImageEle';
          let img: p5.Element;
          let iframe_sub: HTMLIFrameElement;
          p.setup = () => {
            let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
            canvas.style('margin', '0');
            canvas.style('position', 'relative');
            canvas.style('pointer-events', 'none');
            img = p.createImg(this.FileURL, this.FileInfo['filename']);
            img.id(IMAGE_ELEMENT_ID);
            img.parent(canvasDiv);
            img.style("position", 'relative');
            setTimeout(() => {
              RePositioningImage();
            }, 50);
            if (isPlatform == 'Android' || isPlatform == 'iOS') {
              iframe_sub = document.createElement('iframe');
              iframe_sub.setAttribute("src", this.FileURL);
              iframe_sub.setAttribute("frameborder", "0");
              iframe_sub.setAttribute('class', 'full_screen');
              iframe_sub.setAttribute('style', 'position: relative; pointer-events: all');
              iframe_sub.hidden = true;
              canvasDiv.appendChild(iframe_sub);
            }
            p.noLoop();
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let RePositioningImage = () => {
            let canvasHeight = this.ContentBox.offsetHeight - this.FileHeader.offsetHeight;
            if (img.size()['height'] < canvasHeight) {
              img.style("top", '50%');
              img.style("transform", 'translateY(-50%');
            }
          }
          p.windowResized = () => {
            setTimeout(() => {
              RePositioningImage();
            }, 50);
          }
          p.mouseClicked = (ev: any) => {
            if (ev.target.id == IMAGE_ELEMENT_ID) {
              if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
                window.open(this.FileURL);
              else {
                img.remove();
                iframe_sub.hidden = false;
              }
            }
          }
        });
        break;
      case 'audio': // 오디오
        this.p5canvas = new p5((p: p5) => {
          var mediaObject: p5.MediaElement;
          p.setup = () => {
            let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
            canvas.style('margin', '0');
            canvas.style('position', 'relative');
            canvas.style('pointer-events', 'none');
            p.noLoop();
            mediaObject = p.createAudio([this.FileURL], () => {
              canvasDiv.appendChild(mediaObject['elt']);
              canvas.parent(canvasDiv);
              setTimeout(() => {
                ResizeAudio();
              }, 50);
              mediaObject.showControls();
              mediaObject.play();
            });
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeAudio = () => {
            if (this.FileInfo['viewer'] != 'audio') return;
            let canvasWidth = this.ContentBox.offsetWidth;
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
            let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
            canvas.style('margin', '0');
            canvas.style('position', 'relative');
            canvas.style('pointer-events', 'none');
            p.noLoop();
            mediaObject = p.createVideo([this.FileURL], () => {
              canvasDiv.appendChild(mediaObject['elt']);
              canvas.parent(canvasDiv);
              setTimeout(() => {
                ResizeVideo();
              }, 50);
              mediaObject.showControls();
              mediaObject.play();
            });
          }
          /** 미디어 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeVideo = () => {
            if (this.FileInfo['viewer'] != 'video') return;
            let canvasWidth = this.ContentBox.offsetWidth;
            let canvasHeight = this.ContentBox.offsetHeight - this.FileHeader.offsetHeight;
            let width = mediaObject['width'];
            let height = mediaObject['height'];
            if (width > height) { // 가로 영상
              width = canvasWidth;
              height = height / mediaObject['width'] * width;
            } else { // 세로 영상
              height = canvasHeight;
              width = width / mediaObject['height'] * height;
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
      default: // 텍스트 파일과 모르는 파일들
        this.p5canvas = new p5((p: p5) => {
          p.setup = () => {
            let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
            canvas.style('margin', '0');
            canvas.style('position', 'relative');
            canvas.style('pointer-events', 'none');
            p.noLoop();
            p.loadStrings(this.FileURL, v => {
              let textArea = document.createElement("textarea");
              textArea.disabled = true;
              textArea.className = 'infobox';
              textArea.setAttribute('style', 'height: 100%; display: block;');
              textArea.textContent = v.join('\n');
              canvasDiv.appendChild(textArea);
            }, e => {
              console.error('열람할 수 없는 파일: ', e);
              canvasDiv.textContent = '열람할 수 없는 파일입니다.';
            });
          }
        });
        break;
    }
  }

  download_file() {
    this.indexed.DownloadFileFromUserPath(this.navParams.get('path'), this.FileInfo['type'], this.FileInfo['filename']);
  }

  ionViewWillLeave() {
    if (this.p5canvas)
      this.p5canvas.remove();
    if (this.FileURL)
      URL.revokeObjectURL(this.FileURL);
  }
}

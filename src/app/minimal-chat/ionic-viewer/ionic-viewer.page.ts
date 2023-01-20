import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
import { IndexedDBService } from 'src/app/indexed-db.service';

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
    let canvasDiv = document.getElementById('p5canvas');
    this.ContentBox = document.getElementById('ContentBox');
    this.FileHeader = document.getElementById('FileHeader');
    this.indexed.loadBlobFromUserPath(this.navParams.get('path'), (blob) => {
      this.FileURL = URL.createObjectURL(blob);
      setTimeout(() => {
        // 경우에 따라 로딩하는 캔버스를 구분
        switch (this.FileInfo['viewer']) {
          case 'image': // 이미지
            this.p5canvas = new p5((p: p5) => {
              p.setup = () => {
                let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
                canvas.style('margin', '0');
                canvas.style('position', 'relative');
                canvas.style('pointer-events', 'none');
                p.noLoop();
                let img = p.createImg(this.FileURL, this.FileInfo['filename']);
                img.parent(canvasDiv);
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
                  canvas.parent(canvasDiv);
                  canvasDiv.appendChild(mediaObject['elt']);
                  ResizeAudio();
                  mediaObject.showControls();
                  mediaObject.loop();
                  // mediaObject.volume(0);
                });
              }
              /** 오디오 플레이어 크기 및 캔버스 크기 조정 */
              let ResizeAudio = () => {
                if (this.FileInfo['viewer'] != 'audio') return;
                let canvasWidth = this.ContentBox.offsetWidth;
                mediaObject['size'](canvasWidth, undefined);
                p.resizeCanvas(canvasWidth, 100);
                p.background(255);
                p.line(0, 0, p.width, p.height);
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
                  ResizeVideo();
                  mediaObject.showControls();
                  mediaObject.loop();
                  // mediaObject.volume(0);
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
      }, 50);
    });
  }

  download_file() {
    this.indexed.DownloadFileFromUserPath(this.navParams.get('path'), this.FileInfo['filename']);
  }

  ionViewDidLeave() {
    if (this.p5canvas)
      this.p5canvas.remove();
    if (this.FileURL)
      URL.revokeObjectURL(this.FileURL);
  }
}

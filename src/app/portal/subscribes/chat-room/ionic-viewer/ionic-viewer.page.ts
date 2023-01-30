import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";
import 'p5/lib/addons/p5.sound';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { P5ToastService } from 'src/app/p5-toast.service';
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
    private p5toast: P5ToastService,
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
          p.setup = () => {
            let canvas = p.createCanvas(canvasDiv.clientWidth, canvasDiv.clientHeight);
            canvas.style('margin', '0');
            canvas.style('position', 'relative');
            canvas.style('pointer-events', 'none');
            p.noLoop();
            let img = p.createImg(this.FileURL, this.FileInfo['filename']);
            img.parent(canvasDiv);
            p.loadImage(this.FileURL, _v => {
            }, e => {
              console.error('이미지 불러오기 실패: ', e);
              this.p5toast.show({
                text: `파일 열기 실패: ${e}`,
              });
            });
          }
        });
        break;
      case 'audio': // 오디오
        this.p5canvas = new p5((p: p5) => {
          let ContentBox = this.ContentBox;
          /** 오디오 플레이어 */
          class AudioController {
            pos: p5.Vector;
            constructor() {
              this.pos = p.createVector(p.width / 2, p.height - 40);
            }
            display() {
              p.push();
              p.rect(this.pos.x, this.pos.y, ContentBox.offsetWidth - 20, 60, 8);
              p.pop();
            }
          }
          /** 오디오 분석기 */
          class AudioAnalyzer {
            pos: p5.Vector;
            constructor() {
              this.pos = p.createVector(p.width / 2, p.height - 110);
            }
            display() {
              p.push();
              p.rect(this.pos.x, this.pos.y, ContentBox.offsetWidth - 20, 60);
              p.pop();
            }
          }
          let player: AudioController;
          let analyzer: AudioAnalyzer;
          let sound: p5.SoundFile;
          let soundLength: number;
          const MARGIN = 10;
          const PLAYER_HEIGHT = 150;
          p.setup = () => {
            let canvas = p.createCanvas(canvasDiv.clientWidth, PLAYER_HEIGHT);
            canvas.parent(canvasDiv);
            player = new AudioController();
            analyzer = new AudioAnalyzer();
            p.smooth();
            p.imageMode(p.CENTER);
            p.rectMode(p.CENTER);
            p.noLoop();
            p.loadSound(this.FileURL, (v: p5.SoundFile) => {
              sound = v;
              soundLength = v.duration();
              console.log(v);
              v.play();
              p.loop();
            }, e => {
              console.error('오디오 열람 불가:', e);
              this.p5toast.show({
                text: `파일 열기 실패: ${e}`,
              });
            });
            ResizeAudio();
          }
          p.draw = () => {
            if (!sound) return;
            p.clear(0, 0, 0, 0);
            analyzer.display();
            p.push();
            let currentPos = p.map(sound.currentTime(), 0, soundLength, MARGIN, p.width - MARGIN);
            p.line(currentPos, 0, currentPos, p.height);
            p.pop();
            player.display();
          }
          /** 오디오 플레이어 크기 및 캔버스 크기 조정 */
          let ResizeAudio = () => {
            if (this.FileInfo['viewer'] != 'audio') return;
            let canvasWidth = this.ContentBox.offsetWidth;
            p.resizeCanvas(canvasWidth, PLAYER_HEIGHT);
            player.pos = p.createVector(canvasWidth / 2, PLAYER_HEIGHT - 40);
            analyzer.pos = p.createVector(canvasWidth / 2, PLAYER_HEIGHT - 110);
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

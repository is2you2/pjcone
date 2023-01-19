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

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.FileInfo = this.navParams.get('info');
    this.indexed.loadBlobFromUserPath(this.navParams.get('path'), (blob) => {
      this.FileURL = URL.createObjectURL(blob);
      let sketch = (p: p5) => {
        p.setup = () => {
          let canvasDiv = document.getElementById('p5canvas')
          switch (this.FileInfo['viewer']) {
            case 'image': // 이미지
              break;
            case 'audio': // 오디오
              break;
            case 'video': // 비디오
              break;
            default: // 텍스트 파일과 모르는 파일들
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
              break;
          }
        }
      }
      this.p5canvas = new p5(sketch);
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

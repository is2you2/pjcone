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

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.FileInfo = this.navParams.get('info');
    console.log('넘겨받은 정보: ', this.navParams.data);
  }

  download_file() {
    this.indexed.DownloadFileFromUserPath(this.navParams.get('path'), this.FileInfo['filename']);
  }
}

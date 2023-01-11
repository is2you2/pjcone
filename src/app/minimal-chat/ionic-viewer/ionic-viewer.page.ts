import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import * as p5 from "p5";

@Component({
  selector: 'app-ionic-viewer',
  templateUrl: './ionic-viewer.page.html',
  styleUrls: ['./ionic-viewer.page.scss'],
})
export class IonicViewerPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
  ) { }

  cant_dedicated: boolean;
  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
  }

  download_file() {
    console.log('지금 연 파일을 다운받기: ', this.navParams.data);
  }
}

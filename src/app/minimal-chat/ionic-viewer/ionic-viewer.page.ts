import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';

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

  ngOnInit() {
    console.log(this.navParams.data);
  }

  download_file() {
    console.log('지금 연 파일을 다운받기: ', this.navParams.data);
  }
}

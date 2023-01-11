import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-godot-viewer',
  templateUrl: './godot-viewer.page.html',
  styleUrls: ['./godot-viewer.page.scss'],
})
export class GodotViewerPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private global: GlobalActService,
  ) { }

  ngOnInit() {
    console.log(this.navParams.data);
  }

  download_file() {
    console.log('지금 연 파일을 다운받기: ', this.navParams.data);
  }
}

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-post-viewer',
  templateUrl: './post-viewer.page.html',
  styleUrls: ['./post-viewer.page.scss'],
})
export class PostViewerPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParam: NavParams,
    public lang: LanguageSettingService,
  ) { }

  PostInfo: any;
  FileURLs = [];
  ngOnInit() {
    this.PostInfo = this.navParam.get('data');
    console.log(this.PostInfo);
    if (this.PostInfo['mainImage']) {
      let FileURL = URL.createObjectURL(this.PostInfo['mainImage']['blob']);
      this.PostInfo['mainImage']['MainThumbnail'] = FileURL;
      this.FileURLs.push(FileURL);
    }
    this.create_content();
  }

  p5canvas: p5;
  create_content() {
    console.log(this.PostInfo);
    let contentDiv = document.getElementById('PostContent');
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        console.log('p5 on');
      }
    });
  }

  ionViewDidLeave() {
    if (this.p5canvas)
      this.p5canvas.remove();
    for (let i = 0, j = this.FileURLs.length; i < j; i++)
      URL.revokeObjectURL(this.FileURLs[i]);
  }
}

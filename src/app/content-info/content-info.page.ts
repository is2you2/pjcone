import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { ContentCreatorInfo } from '../global-act.service';
import { LanguageSettingService } from '../language-setting.service';
import { NakamaService } from '../nakama.service';

@Component({
  selector: 'app-content-info',
  templateUrl: './content-info.page.html',
  styleUrls: ['./content-info.page.scss'],
})
export class ContentInfoPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public modalCtrl: ModalController,
    private navParams: NavParams,
    public nakama: NakamaService,
  ) { }

  content_creator: ContentCreatorInfo;
  content_related_creator: ContentCreatorInfo[];
  isOfficial: string;
  target: string;

  ngOnInit() {
    let info = this.navParams.get('info');
    this.isOfficial = this.navParams.get('isOfficial');
    this.target = this.navParams.get('target');
    this.content_creator = info['content_creator'];
    this.content_creator.timeDisplay = new Date(this.content_creator.timestamp).toLocaleString();
    this.content_related_creator = info['content_related_creator'];
    try { // 중복 정보 통합
      if (this.content_related_creator[0].timestamp == this.content_related_creator[1].timestamp) { // 외부에서 가져온 파일
        if (this.content_related_creator[0].various)
          this.content_related_creator[0].publisher = this.content_related_creator[1].display_name;
        this.content_related_creator.splice(1, 1);
      }
    } catch (e) { }
    this.content_related_creator.reverse();
    if (this.content_creator.user_id)
      this.content_creator.is_me =
        this.nakama.servers[this.isOfficial][this.target].session.user_id == this.content_creator.user_id;
    for (let i = 0, j = this.content_related_creator.length; i < j; i++) {
      if (this.content_related_creator[i].user_id) {
        this.content_related_creator[i].is_me =
          this.nakama.servers[this.isOfficial][this.target].session.user_id == this.content_related_creator[i].user_id;
      }
      this.content_related_creator[i].timeDisplay = new Date(this.content_related_creator[i].timestamp).toLocaleString();
    }
  }

}

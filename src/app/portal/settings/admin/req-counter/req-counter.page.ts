import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { WscService } from 'src/app/wsc.service';

@Component({
  selector: 'app-req-counter',
  templateUrl: './req-counter.page.html',
  styleUrls: ['./req-counter.page.scss'],
})
export class ReqCounterPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private wsc: WscService,
  ) { }

  /** 보여지는 데이터 */
  calcs = {
    assistant: {
      current: 0,
      maximum: 0,
      stack: 0,
    },
    sc1_custom: {
      current: 0,
      maximum: 0,
      stack: 0,
    },
    minichat: {
      current: 0,
      maximum: 0,
      stack: 0,
    },
  };

  ngOnInit() {
    this.wsc.received['req_count'] = (json: any) => {
      let data = JSON.parse(json['data']);
      let assistant = JSON.parse(data['assistant']);
      let sc1_custom = JSON.parse(data['sc1_custom']);
      let minichat = JSON.parse(data['minichat']);
      this.calcs.assistant = assistant;
      this.calcs.sc1_custom = sc1_custom;
      this.calcs.minichat = minichat;
    }
    this.refresh_count();
  }

  refresh_count() {
    this.wsc.send(JSON.stringify({ act: 'req_count' }));
  }

  ionViewWillLeave() {
    delete this.wsc.received['req_count'];
  }
}

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

  /** 접속자 수 */
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

  /** 베터리 상태 */
  battery = {
    percent: -1,
    time: -1,
    state: 0,
  }

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
    this.wsc.received['req_battery'] = (json: any) => {
      let data = JSON.parse(json['data']);
      this.battery = data;
    }
    this.refresh_count();
    this.refresh_battery();
  }

  refresh_count() {
    this.wsc.send(JSON.stringify({ act: 'req_count' }));
  }

  refresh_battery() {
    this.wsc.send(JSON.stringify({ act: 'req_battery' }));
  }

  ionViewWillLeave() {
    delete this.wsc.received['req_count'];
    delete this.wsc.received['req_battery'];
  }
}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-tool-management',
  templateUrl: './tool-management.page.html',
  styleUrls: ['./tool-management.page.scss'],
})
export class ToolManagementPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
  ) { }

  /** { text: name, toggle: isDisabled } */
  list = [];

  ngOnInit() {
    let data: string[] = this.navParams.get('data');
    data.forEach(path => {
      this.list.push({ text: path.substring(5), toggle: false });
    });
  }

  /** 툴 다시 다운받기 */
  async redownload_tool(i: number) {
    try {
      this.list[i]['toggle'] = true;
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_pck/${this.list[i]['text']}`);
      if (res.ok) { // 다운로드에 성공한다면
        let blob = await res.blob();
        let reader: any = new FileReader();
        reader = reader._realReader ?? reader;
        reader.onload = (ev: any) => {
          this.indexed.saveFileToUserPath(ev.target.result.replace(/"|\\|=/g, ''), `acts/${this.list[i]['text']}`, () => {
            this.list[i]['toggle'] = false;
            this.p5toast.show({
              text: `${this.lang.text['ToolManager']['redownloadSucc']}: ${this.list[i]['text']}`,
            });
          });
        };
        reader.readAsDataURL(blob);
      } else throw "없는 툴이라고 판단됩니다.";
    } catch (e) { // 로컬 정보 기반으로 광고
      console.log(e);
      this.list[i]['toggle'] = false;
      this.p5toast.show({
        text: `${this.lang.text['ToolManager']['redownloadFailed']}: ${this.list[i]}`,
      });
    }
  }

  /** 툴을 기기에서 삭제 */
  remove_tool(i: number) {
    this.indexed.removeFileFromUserPath(`acts/${this.list[i]}`);
    this.list.splice(i, 1);
  }

}

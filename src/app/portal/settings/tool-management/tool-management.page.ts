// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

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
  ) { }

  list = [];

  ngOnInit() {
    let data: string[] = this.navParams.get('data');
    data.forEach(path => {
      this.list.push(path.substring(5));
    });
  }

  /** 툴을 기기에서 삭제 */
  remove_tool(i: number) {
    this.indexed.removeFileFromUserPath(`acts/${this.list[i]}`);
    this.list.splice(i, 1);
  }

}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

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
    private indexed: IndexedDBService,
    public lang: LanguageSettingService,
  ) { }

  cant_dedicated: boolean;
  FileInfo: any;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.FileInfo = this.navParams.get('info');
    this.global.CreateGodotIFrame('godot-viewer', {
      act: 'godot-viewer',
      title: 'ViewerEx',
      path: this.navParams.get('path'),
      ext: this.FileInfo['file_ext']
    });
    console.log('넘겨받은 정보: ', this.navParams.data);
  }

  download_file() {
    this.indexed.DownloadFileFromUserPath(this.navParams.get('path'), this.FileInfo['type'], this.FileInfo['filename']);
  }
}

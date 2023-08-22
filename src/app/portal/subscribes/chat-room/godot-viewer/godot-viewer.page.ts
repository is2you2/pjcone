// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { AlertController, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ShareContentToOtherPage } from 'src/app/share-content-to-other/share-content-to-other.page';

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
    private file: File,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
  ) { }

  FileInfo: any;

  EventListenerAct = (ev: any) => {
    ev.detail.register(120, (_processNextHandler: any) => { });
  }

  ngOnInit() {
    this.FileInfo = this.navParams.get('info');
  }

  async ionViewDidEnter() {
    document.addEventListener('ionBackButton', this.EventListenerAct)
    await this.global.CreateGodotIFrame('viewer', {
      local_url: 'assets/data/godot/viewer.pck',
      title: 'ViewerEx',
      path: this.navParams.get('path'),
      ext: this.FileInfo['file_ext'],
      force_logo: true,
      // modify_image
      receive_image: (base64: string, width: number, height: number) => {
        this.modalCtrl.dismiss({
          base64: ',' + base64,
          width: width,
          height: height,
        });
      }
    }, 'create_thumbnail');
  }

  snapshot_modify() {
    this.global.godot_window['modify_image']();
  }

  download_file() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.indexed.DownloadFileFromUserPath(this.navParams.get('path'), this.FileInfo['type'], this.FileInfo['filename']);
    else {
      this.alertCtrl.create({
        header: this.lang.text['ContentViewer']['Filename'],
        inputs: [{
          name: 'filename',
          placeholder: this.FileInfo['filename'],
          type: 'text',
        }],
        buttons: [{
          text: this.lang.text['ContentViewer']['saveFile'],
          handler: async (input) => {
            let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
            loading.present();
            let filename = input['filename'] ? `${input['filename'].replace(/:|\?|\/|\\|<|>/g, '')}.${this.FileInfo['file_ext']}` : this.FileInfo['filename'];
            let blob = await this.indexed.loadBlobFromUserPath(this.navParams.get('path'), this.FileInfo['type']);
            this.file.writeFile(this.file.externalDataDirectory, filename, blob)
              .then(_v => {
                loading.dismiss();
                this.p5toast.show({
                  text: this.lang.text['ContentViewer']['fileSaved'],
                });
              }).catch(e => {
                loading.dismiss();
                switch (e.code) {
                  case 12:
                    this.p5toast.show({
                      text: this.lang.text['ContentViewer']['AlreadyExist'],
                    });
                    this.download_file();
                    break;
                  default:
                    console.log('준비되지 않은 오류 반환: ', e);
                    break;
                }
              });
          }
        }]
      }).then(v => v.present());
    }
  }

  ShareContent() {
    let channels = this.nakama.rearrange_channels();
    for (let i = channels.length - 1; i >= 0; i--) {
      if (channels[i]['status'] == 'missing' || channels[i]['status'] == 'offline')
        channels.splice(i, 1);
    }
    if (channels.length)
      this.modalCtrl.create({
        component: ShareContentToOtherPage,
        componentProps: {
          file: this.FileInfo,
          channels: channels,
        }
      }).then(v => {
        v.onDidDismiss().then((_v) => this.modalCtrl.dismiss());
        v.present();
      });
    else this.p5toast.show({
      text: this.lang.text['ShareContentToOther']['NoChannelToShare'],
    });
  }

  ionViewWillLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.global.godot_window['filename'] = this.FileInfo.filename;
    this.global.godot_window['create_thumbnail'](this.FileInfo);
  }
}

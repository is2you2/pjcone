// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-void-draw',
  templateUrl: './void-draw.page.html',
  styleUrls: ['./void-draw.page.scss'],
})
export class VoidDrawPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    public global: GlobalActService,
    private navParams: NavParams,
    private indexed: IndexedDBService,
  ) { }

  ngOnInit() { }
  mainLoading: HTMLIonLoadingElement;
  initialized = false;

  EventListenerAct = (ev: any) => {
    ev.detail.register(130, (_processNextHandler: any) => { });
  }

  async ionViewDidEnter() {
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.mainLoading = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['UseThisImage'] });
    await this.global.CreateGodotIFrame('voidDraw', {
      local_url: 'assets/data/godot/voidDraw.pck',
      title: 'voidDraw',
      image: Boolean(this.navParams.data['path']),
      // new_canvas: 이미지 새로 만들기
      // change_color: 선 색상 변경하기
      // save_image: 이미지 저장하기
      // undo_draw: 그리기 되돌리기
      // redo_draw: 그리기 다시하기
      receive_image: (base64: string, is_modify = false) => {
        let image = 'data:image/png;base64,' + base64.replace(/"|=|\\/g, '');
        let newDate = new Date();
        let year = newDate.getUTCFullYear();
        let month = ("0" + (newDate.getMonth() + 1)).slice(-2);
        let date = ("0" + newDate.getDate()).slice(-2);
        let hour = ("0" + newDate.getHours()).slice(-2);
        let minute = ("0" + newDate.getMinutes()).slice(-2);
        let second = ("0" + newDate.getSeconds()).slice(-2);
        this.modalCtrl.dismiss({
          name: `voidDraw_${year}-${month}-${date}_${hour}-${minute}-${second}.png`,
          img: image,
          loadingCtrl: this.mainLoading,
          is_modify: is_modify,
        });
      }
    }, 'new_canvas');
    this.initialized = true;
    if (this.navParams.data['path'])
      this.global.godot_window['new_canvas'](JSON.stringify({
        width: this.navParams.data.width,
        height: this.navParams.data.height,
        path: '/userfs/' + this.navParams.data.path,
      }));
  }

  change_color() {
    if (this.initialized)
      this.global.godot_window.change_color()
  }

  new_image() {
    if (!this.initialized) return;
    const DEFAULT_SIZE = 432;
    this.alertCtrl.create({
      header: this.lang.text['voidDraw']['newDraw'],
      inputs: [{
        name: 'width',
        type: 'number',
        placeholder: `${this.lang.text['voidDraw']['width']} (${this.lang.text['voidDraw']['default_size']}: ${DEFAULT_SIZE})`,
      }, {
        name: 'height',
        type: 'number',
        placeholder: `${this.lang.text['voidDraw']['height']} (${this.lang.text['voidDraw']['default_size']}: ${DEFAULT_SIZE})`,
      }],
      buttons: [{
        text: this.lang.text['voidDraw']['CreateNew'],
        handler: (v) => {
          if (!v.width) v.width = DEFAULT_SIZE;
          if (!v.height) v.height = DEFAULT_SIZE;
          this.global.godot_window['new_canvas'](JSON.stringify(v));
        }
      }],
    }).then(v => v.present());
  }

  change_line_weight() {
    if (!this.initialized) return;
    this.alertCtrl.create({
      header: this.lang.text['voidDraw']['changeWeight'],
      inputs: [{
        name: 'weight',
        type: 'number',
        placeholder: `${this.lang.text['voidDraw']['weight']} (${this.lang.text['voidDraw']['default_size']}: 1)`,
      }],
      buttons: [{
        text: this.lang.text['voidDraw']['apply'],
        handler: (v) => {
          this.global.godot_window['set_line_weight'](v.weight || 1);
        }
      }],
    }).then(v => v.present());
  }

  /** Undo, Redo 등 행동을 위한 함수 */
  act_history(direction: number) {
    switch (direction) {
      case -1: // Undo
        this.global.godot_window['undo_draw']();
        break;
      case 1: // Redo
        this.global.godot_window['redo_draw']();
        break;
      default:
        console.error('있을 수 없는 동작 요청: ', direction);
        break;
    }
  }

  is_cropping = false;

  open_crop_tool() {
    if (!this.initialized) return;
    this.global.godot_window['open_crop_tool']();
    this.is_cropping = true;
  }

  apply_crop() {
    if (!this.initialized) return;
    this.global.godot_window['resize_canvas']();
    this.is_cropping = false;
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    if (this.is_cropping) {
      this.global.godot_window['resize_canvas']();
      this.is_cropping = false;
    } else {
      this.mainLoading.present();
      this.WithoutSave = false;
      setTimeout(() => {
        this.global.godot_window['save_image']();
      }, 100);
    }
  }

  WithoutSave = true;
  ionViewDidLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.indexed.removeFileFromUserPath('tmp_files/modify_image.png', undefined, this.indexed.godotDB);
    if (this.WithoutSave)
      this.mainLoading.remove();
  }
}

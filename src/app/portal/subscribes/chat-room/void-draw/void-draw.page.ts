// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
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
    private global: GlobalActService,
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.global.CreateGodotIFrame('p5_void_draw', {
      act: 'voidDraw',
      title: 'voidDraw',
      // new_canvas: 이미지 새로 만들기
      // save_image: 이미지 저장하기
      receive_image: (base64: string) => {
        this.loadingCtrl.create({
          message: this.lang.text['voidDraw']['UseThisImage'],
        }).then(v => {
          let image = 'data:image/png;base64,' + base64.replace(/"|=|\\/g, '');
          v.present()
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
          });
          v.dismiss();
        });
      }
    });
  }

  new_image() {
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
    this.alertCtrl.create({
      header: this.lang.text['voidDraw']['newDraw'],
      inputs: [{
        name: 'weight',
        type: 'number',
        placeholder: `${this.lang.text['voidDraw']['weight']} (${this.lang.text['voidDraw']['default_size']}: 3)`,
      }],
      buttons: [{
        text: this.lang.text['voidDraw']['CreateNew'],
        handler: (v) => {
          this.global.godot_window['set_line_weight'](v.weight || 3);
        }
      }],
    }).then(v => v.present());
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    this.global.godot_window['save_image']();
  }

  ionViewDidLeave() {
  }
}

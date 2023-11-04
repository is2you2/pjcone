// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
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
    this.global.p5key['KeyShortCut']['HistoryAct'] = (ShiftPressed: boolean) => {
      if (ShiftPressed) { // Redo
        this.act_history(1);
      } else { // Undo
        this.act_history(-1);
      }
    }
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.mainLoading = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['UseThisImage'] });
    this.create_p5voidDraw();
    if (this.navParams.data['path'])
      this.p5voidDraw['new_canvas']({
        width: this.navParams.data.width,
        height: this.navParams.data.height,
        path: this.navParams.data.path,
      });
    else this.p5voidDraw['new_canvas']();
  }

  p5voidDraw: p5;
  create_p5voidDraw() {
    let targetDiv = document.getElementById('voidDraw');
    this.p5voidDraw = new p5((p: p5) => {
      /** 배경 이미지 */
      let BaseImage: p5.Image;
      let canvas: p5.Renderer;
      p.setup = () => {
        let initData = { width: 432, height: 432 };
        p.pixelDensity(1);
        p.smooth();
        p['new_canvas'] = async (data: any) => { // 첨부파일이 있으면 덮어씌우기
          initData = { ...initData, ...data };
          if (initData['path']) { // 배경 이미지 파일이 포함됨
            let blob = await this.indexed.loadBlobFromUserPath(initData['path'], '');
            let FileURL = URL.createObjectURL(blob);
            p.loadImage(FileURL, v => {
              BaseImage = v;
              URL.revokeObjectURL(FileURL);
            }, e => {
              console.error('그림판 배경 이미지 불러오기 오류: ', e);
              URL.revokeObjectURL(FileURL);
            });
          }
          if (canvas) p.remove();

          let targetWidth = 432;
          let targetHeight = 432;
          if (initData.width > initData.height) { // 가로 이미지
            targetWidth = initData.width / initData.height * targetDiv.clientHeight;
            targetHeight = targetDiv.clientHeight;
          } else { // 세로 이미지
            targetWidth = targetDiv.clientWidth;
            targetHeight = initData.height / initData.width * targetDiv.clientWidth;
          }
          canvas = p.createCanvas(targetWidth, targetHeight);
          canvas.parent(targetDiv);
          // 화면 비율에 맞게 작업 해상도 낮추기
          p['SetCanvasViewportInit']();
          p.background(255, 0, 0);
        }
        p['set_line_weight'] = () => {

        }
        p['change_color'] = () => {

        }
        p['save_image'] = () => {
          this.mainLoading.dismiss();
        }
        p['history_act'] = (direction: number) => {
          console.log(direction);
        }
        p['open_crop_tool'] = () => {

        }
        p['SetCanvasViewportInit'] = () => {
          canvas.style('position', 'relative');
          canvas.style('top', '50%');
          canvas.style('left', '50%');
          canvas.style('transform', 'translateX(-50%) translateY(-50%)');
        }
        this.initialized = true;
      }
      p.windowResized = () => {
        p['SetCanvasViewportInit']();
      }
    });
  }

  change_color() {
    if (this.initialized)
      this.p5voidDraw['change_color']();
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
          else v.width = Number(v.width);
          if (!v.height) v.height = DEFAULT_SIZE;
          else v.height = Number(v.height);
          this.p5voidDraw['new_canvas'](v);
        }
      }],
    }).then(v => v.present());
  }

  change_line_weight() {
    if (!this.initialized) return;
    this.p5voidDraw['set_line_weight']();
  }

  /** Undo, Redo 등 행동을 위한 함수  
   * 생성 지연에 따른 오류 방지용
   */
  act_history(direction: number) {
    this.p5voidDraw['history_act'](direction);
  }

  open_crop_tool() {
    if (!this.initialized) return;
    this.p5voidDraw['open_crop_tool']();
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    this.mainLoading.present();
    this.WithoutSave = false;
    setTimeout(() => {
      this.p5voidDraw['save_image']();
    }, 100);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['HistoryAct'];
  }

  WithoutSave = true;
  ionViewDidLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.indexed.removeFileFromUserPath('tmp_files/modify_image.png');
    if (this.WithoutSave)
      this.mainLoading.remove();
  }
}

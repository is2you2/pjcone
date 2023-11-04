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
    this.global.p5key['KeyShortCut']['HistoryAct'] = (key: string) => {
      switch (key) {
        case 'Z':
          this.act_history(-1);
          break;
        case 'X':
          this.act_history(1);
          break;
        case 'C':
          this.p5voidDraw['change_color']();
          break;
        case 'V':
          this.p5voidDraw['set_line_weight']();
          break;
      }
    }
    this.global.p5key['KeyShortCut']['AddAct'] = () => {
      this.new_image();
    }
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.mainLoading = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['UseThisImage'] });
    this.create_new_canvas({
      width: this.navParams.data.width,
      height: this.navParams.data.height,
      path: this.navParams.data.path,
    });
  }

  /** 새 캔버스 생성 행동 분리 */
  create_new_canvas(inputInfo?: any) {
    inputInfo['width'] = inputInfo['width'] || 432;
    inputInfo['height'] = inputInfo['height'] || 432;
    if (this.p5voidDraw) this.p5voidDraw.remove();
    this.create_p5voidDraw(inputInfo);
  }

  p5voidDraw: p5;
  create_p5voidDraw(initData: any) {
    let targetDiv = document.getElementById('voidDraw');
    this.p5voidDraw = new p5((p: p5) => {
      /** 스케일 조정 편의를 위해 모든게 여기서 작업됨 */
      let ActualCanvas: p5.Graphics;
      /** 편집하려는 이미지 */
      let BaseImage: p5.Image;
      let canvas: p5.Renderer;
      p.setup = async () => {
        p.pixelDensity(1);
        p.smooth();
        p.noLoop();
        p.imageMode(p.CENTER);
        // 정보 초기화
        BaseImage = undefined;
        if (ActualCanvas) ActualCanvas.remove();
        ActualCanvas = undefined;
        if (canvas) p.remove();
        canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        RelativePosition.x = p.width / 2;
        RelativePosition.y = p.height / 2;
        canvas.parent(targetDiv);
        p['set_line_weight'] = () => {
          console.log('set_line_weight');
        }
        p['change_color'] = () => {
          console.log('change_color');
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
          canvas.hide();
          p.resizeCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
          RelativePosition.x = p.width / 2;
          RelativePosition.y = p.height / 2;
          let windowRatio = targetDiv.clientWidth / targetDiv.clientHeight;
          let canvasRatio = ActualCanvas.width / ActualCanvas.height;
          if (windowRatio < canvasRatio)
            RelativeScale = targetDiv.clientWidth / ActualCanvas.width;
          else RelativeScale = targetDiv.clientHeight / ActualCanvas.height;
          canvas.show();
          p.redraw();
        }
        ActualCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
        ActualCanvas.smooth();
        ActualCanvas.noLoop();
        // 사용자 그리기 판넬 생성
        if (initData['path']) { // 배경 이미지 파일이 포함됨
          let blob = await this.indexed.loadBlobFromUserPath(initData['path'], '');
          let FileURL = URL.createObjectURL(blob);
          p.loadImage(FileURL, v => {
            ActualCanvas.resizeCanvas(v.width, v.height);
            ActualCanvas.imageMode(p.CENTER);
            BaseImage = v;
            URL.revokeObjectURL(FileURL);
            p['SetCanvasViewportInit']();
            p.redraw();
          }, e => {
            console.error('그림판 배경 이미지 불러오기 오류: ', e);
            URL.revokeObjectURL(FileURL);
          });
        } else {
          p['SetCanvasViewportInit']();
          p.redraw();
        }
        this.initialized = true;
      }
      /** Viewport 행동을 위한 변수들 */
      let RelativePosition = p.createVector();
      let RelativeScale = 1;
      /** 이미지 Crop 시 상대적 위치 기록 */
      let CropPosition = p.createVector();
      p.draw = () => {
        p.clear(255, 255, 255, 255);
        p.push();
        p.translate(RelativePosition);
        p.scale(RelativeScale);
        ActualCanvas.background(255);
        ActualCanvas.push();
        ActualCanvas.translate(CropPosition);
        if (BaseImage) ActualCanvas.image(BaseImage, 0, 0);
        ActualCanvas.pop();
        ActualCanvas.redraw();
        p.image(ActualCanvas, 0, 0);
        p.pop();
      }
      p.windowResized = () => {
        setTimeout(() => {
          p['SetCanvasViewportInit']();
        }, 0);
      }
      p.mousePressed = (ev: any) => {
        switch (ev['which']) {
          case 1: // 왼쪽
            break;
          case 2: // 가운데
            p['SetCanvasViewportInit']();
            break;
        }
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
          this.create_new_canvas(v);
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
    delete this.global.p5key['KeyShortCut']['AddAct'];
    if (this.p5voidDraw) this.p5voidDraw.remove();
  }

  WithoutSave = true;
  ionViewDidLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    this.indexed.removeFileFromUserPath('tmp_files/modify_image.png');
    if (this.WithoutSave)
      this.mainLoading.remove();
  }
}

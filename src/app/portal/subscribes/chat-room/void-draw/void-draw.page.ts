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
      /** 배경이미지 전용 캔버스 */
      let ImageCanvas: p5.Graphics;
      let canvas: p5.Renderer;
      let TopMenu: p5.Element;
      let BottomMenu: p5.Element;
      /** 되돌리기류 행동이 상황에 따라 동작하지 않음을 UI로 표시해야함 */
      let UndoButton: any;
      let RedoButton: any;
      /** 임시방편 색상 선택기 */
      let p5ColorPicker = p.createColorPicker('#000');
      /** 임시방편 선두께 설정 */
      let isWeightSetToggle = false;
      let SetBrushSize = p.min(initData['width'], initData['heigth']);
      let WeightSlider = p.createSlider(1, SetBrushSize / 10, SetBrushSize / 100);
      p.setup = async () => {
        WeightSlider.parent(targetDiv);
        WeightSlider.hide();
        p.pixelDensity(1);
        p.smooth();
        p.noLoop();
        p.imageMode(p.CENTER);
        // 정보 초기화
        ImageCanvas = undefined;
        if (ActualCanvas) ActualCanvas.remove();
        ActualCanvas = undefined;
        if (canvas) p.remove();
        canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        RelativePosition.x = p.width / 2;
        RelativePosition.y = p.height / 2;
        canvas.parent(targetDiv);
        p['set_line_weight'] = () => {
          isWeightSetToggle = !isWeightSetToggle;
          if (isWeightSetToggle) {
            WeightSlider.show();
          } else {
            WeightSlider.hide();
          }
        }
        p['change_color'] = () => {
          console.log('change_color');
        }
        p['save_image'] = () => {
          this.mainLoading.dismiss();
        }
        p['history_act'] = (direction: number) => {
          HistoryPointer = p.min(p.max(0, HistoryPointer + direction), DrawingStack.length);
          switch (direction) {
            case 1: // Redo
              UndoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer == DrawingStack.length)
                RedoButton.style.fill = 'var(--ion-color-medium)';
              for (let i = 0, j = DrawingStack[HistoryPointer - 1].pos.length - LINE_POINTS_COUNT + 1; i < j; i++)
                updateCurrentDrawingCurve(DrawingStack[HistoryPointer - 1], i);
              break;
            case -1: // Undo
              RedoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer < 1) {
                UndoButton.style.fill = 'var(--ion-color-medium)';
                ActualCanvas.clear(255, 255, 255, 255);
                p.redraw();
              } else updateActualCanvas();
              break;
          }
        }
        p['open_crop_tool'] = () => {

        }
        /** 상하단 메뉴 생성 */
        TopMenu = p.createElement('table');
        TopMenu.style('position: absolute; top: 0px;');
        TopMenu.style(`width: 100%; height: ${BUTTON_HEIGHT}px;`);
        TopMenu.style('background-color: var(--voidDraw-menu-background);')
        TopMenu.parent(targetDiv);
        let top_row = TopMenu.elt.insertRow(0); // 상단 메뉴
        let AddCell = top_row.insertCell(0); // 추가
        AddCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="add"></ion-icon>`;
        AddCell.style.textAlign = 'center';
        AddCell.style.cursor = 'pointer';
        AddCell.onclick = () => { this.new_image() }
        let CropCell = top_row.insertCell(1); // Crop
        CropCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="crop"></ion-icon>`;
        CropCell.style.textAlign = 'center';
        CropCell.style.cursor = 'pointer';
        CropCell.onclick = () => { this.open_crop_tool() }
        let ApplyCell = top_row.insertCell(2);
        ApplyCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="checkmark"></ion-icon>`;
        ApplyCell.style.textAlign = 'center';
        ApplyCell.style.cursor = 'pointer';
        ApplyCell.onclick = () => { this.dismiss_draw() }

        BottomMenu = p.createElement('table');
        BottomMenu.style('position: absolute; bottom: 0px;');
        BottomMenu.style(`width: 100%; height: ${BUTTON_HEIGHT}px;`);
        BottomMenu.style('background-color: var(--voidDraw-menu-background);')
        BottomMenu.parent(targetDiv);
        let bottom_row = BottomMenu.elt.insertRow(0); // 하단 메뉴
        let UndoCell = bottom_row.insertCell(0); // Undo
        UndoCell.innerHTML = `<ion-icon id="undoIcon" style="width: 27px; height: 27px" name="arrow-undo"></ion-icon>`;
        UndoButton = document.getElementById('undoIcon');
        UndoButton.style.fill = 'var(--ion-color-medium)';
        UndoCell.style.textAlign = 'center';
        UndoCell.style.cursor = 'pointer';
        UndoCell.onclick = () => { this.act_history(-1) }
        let RedoCell = bottom_row.insertCell(1); // Redo
        RedoCell.innerHTML = `<ion-icon id="redoIcon" style="width: 27px; height: 27px" name="arrow-redo"></ion-icon>`;
        RedoButton = document.getElementById('redoIcon');
        RedoButton.style.fill = 'var(--ion-color-medium)';
        RedoCell.style.textAlign = 'center';
        RedoCell.style.cursor = 'pointer';
        RedoCell.onclick = () => { this.act_history(1) }
        let ColorCell = bottom_row.insertCell(2); // 선 색상 변경
        // ColorCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="color-palette"></ion-icon>`;
        p5ColorPicker.parent(ColorCell);
        ColorCell.style.textAlign = 'center';
        ColorCell.style.cursor = 'pointer';
        // ColorCell.onclick = () => { this.change_color() }
        let WeightCell = bottom_row.insertCell(3); // 선 두께 변경
        WeightCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="pencil"></ion-icon>`;
        WeightCell.style.textAlign = 'center';
        WeightCell.style.cursor = 'pointer';
        WeightCell.onclick = () => { this.change_line_weight() }
        p['SetCanvasViewportInit'] = () => {
          canvas.hide();
          p.resizeCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
          RelativePosition.x = p.width / 2;
          RelativePosition.y = p.height / 2;
          let HeightExceptMenu = targetDiv.clientHeight - 112;
          let windowRatio = targetDiv.clientWidth / HeightExceptMenu;
          let canvasRatio = ActualCanvas.width / ActualCanvas.height;
          if (windowRatio < canvasRatio)
            RelativeScale = targetDiv.clientWidth / ActualCanvas.width;
          else RelativeScale = HeightExceptMenu / ActualCanvas.height;
          canvas.show();
          console.log(p.width, '/', WeightSlider.width);
          console.log(p.height, '/', WeightSlider.height);
          WeightSlider.position(p.width - WeightSlider.width, p.height - WeightSlider.height - BUTTON_HEIGHT);
          p.redraw();
        }
        ActualCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
        ActualCanvas.smooth();
        ActualCanvas.noLoop();
        ActualCanvas.noFill();
        // 사용자 그리기 판넬 생성
        if (initData['path']) { // 배경 이미지 파일이 포함됨
          let blob = await this.indexed.loadBlobFromUserPath(initData['path'], '');
          let FileURL = URL.createObjectURL(blob);
          p.loadImage(FileURL, v => {
            ActualCanvas.resizeCanvas(v.width, v.height);
            ImageCanvas = p.createGraphics(v.width, v.height, p.WEBGL);
            ImageCanvas.noLoop();
            ImageCanvas.background(255);
            ImageCanvas.imageMode(p.CENTER);
            ImageCanvas.image(v, 0, 0);
            URL.revokeObjectURL(FileURL);
            p['SetCanvasViewportInit']();
            p.redraw();
          }, e => {
            console.error('그림판 배경 이미지 불러오기 오류: ', e);
            URL.revokeObjectURL(FileURL);
          });
        } else {
          ImageCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
          ImageCanvas.noLoop();
          ImageCanvas.background(255);
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
        if (ImageCanvas) {
          ImageCanvas.push();
          ImageCanvas.translate(CropPosition);
          p.image(ImageCanvas, 0, 0);
          ImageCanvas.pop();
        }
        if (ActualCanvas) {
          ActualCanvas.push();
          ActualCanvas.translate(CropPosition);
          p.image(ActualCanvas, 0, 0);
          ActualCanvas.pop();
        }
        p.pop();
      }
      /** 그려진 자유선 정보 저장  
       * DrawingStack[i] = [{ pos: [{x, y}, ..], color: p5.Color, weight: number }, ..]
       */
      let DrawingStack = [];
      /** 선을 어디까지 그리는지, 히스토리 행동용 */
      let HistoryPointer = 0;
      /** 전체 그리기, 동작 취소 등 전체 업데이트가 필요할 때 사용 */
      let updateActualCanvas = () => {
        ActualCanvas.clear(255, 255, 255, 255);
        // 모든 그리기 행동 시도
        for (let i = HistoryPointer - 1; i >= 0; i--)
          for (let j = 0, k = DrawingStack[i].pos.length - LINE_POINTS_COUNT + 1; j < k; j++)
            updateCurrentDrawingCurve(DrawingStack[i], j);
        ActualCanvas.redraw();
      }
      /** 그리기에 필요한 선의 수 */
      const LINE_POINTS_COUNT = 2;
      /** 마지막 행동에 해당하는 선 그리기 **지금은 직선 그리기임** */
      let updateCurrentDrawingCurve = (targetDraw = CurrentDraw, index = targetDraw['pos'].length - LINE_POINTS_COUNT) => {
        let TargetLine: any = targetDraw['pos'].slice(index, index + LINE_POINTS_COUNT);
        ActualCanvas.push();
        ActualCanvas.stroke(targetDraw['color']);
        ActualCanvas.strokeWeight(targetDraw['weight']);
        ActualCanvas.line(
          TargetLine[0].x, TargetLine[0].y,
          TargetLine[1].x, TargetLine[1].y
        );
        // ActualCanvas.curve(
        //   TargetLine[0].x, TargetLine[0].y,
        //   TargetLine[1].x, TargetLine[1].y,
        //   TargetLine[2].x, TargetLine[2].y,
        //   TargetLine[3].x, TargetLine[3].y);
        ActualCanvas.pop();
        p.redraw();
      }
      p.windowResized = () => {
        setTimeout(() => {
          p['SetCanvasViewportInit']();
        }, 0);
      }
      let CurrentDraw = {};
      const BUTTON_HEIGHT = 56;
      p.mousePressed = (ev: any) => {
        if (p.mouseY < BUTTON_HEIGHT || p.mouseY > p.height - BUTTON_HEIGHT) return;
        if (DrawingStack.length > HistoryPointer)
          DrawingStack.length = HistoryPointer;
        switch (ev['which']) {
          case 1: // 왼쪽
            DrawStartAct();
            UndoButton.style.fill = 'var(--ion-color-dark)';
            break;
          case 2: // 가운데
            p['SetCanvasViewportInit']();
            break;
        }
      }
      /** 그리기 시작 행동 (PC/터치스크린 공용) */
      let DrawStartAct = (_x?: number, _y?: number) => {
        let pos = MousePosToActualCanvasPosition(_x, _y);
        let _pos = { x: pos.x, y: pos.y };
        CurrentDraw = {
          pos: [],
          color: p5ColorPicker['color'](),
          weight: Number(WeightSlider.value()),
        };
        for (let i = 0; i < LINE_POINTS_COUNT; i++)
          CurrentDraw['pos'].push(_pos);
        DrawingStack.push(CurrentDraw);
        HistoryPointer = DrawingStack.length;
        updateCurrentDrawingCurve();
      }
      p.mouseDragged = (ev: any) => {
        if (p.mouseY < BUTTON_HEIGHT || p.mouseY > p.height - BUTTON_HEIGHT) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            let pos = MousePosToActualCanvasPosition();
            let _pos = { x: pos.x, y: pos.y };
            CurrentDraw['pos'].push(_pos);
            updateCurrentDrawingCurve();
            break;
        }
      }
      let MousePosToActualCanvasPosition = (x?: number, y?: number) => {
        let pos = p.createVector(x || p.mouseX, y || p.mouseY);
        pos.sub(RelativePosition);
        pos.div(RelativeScale);
        pos.sub(CropPosition);
        return pos;
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

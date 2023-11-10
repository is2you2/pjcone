// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
import { isPlatform } from 'src/app/app.component';
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
    this.global.p5key['KeyShortCut']['DeleteAct'] = () => {
      this.dismiss_draw();
    }
    this.global.p5key['KeyShortCut']['SKeyAct'] = () => {
      this.open_crop_tool();
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
      /** 배경이미지 캔버스, 복구 불가능한 이전 기록이 이곳에 같이 누적됨 */
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
      const PIXEL_DENSITY = 1;
      p.setup = async () => {
        WeightSlider.parent(targetDiv);
        WeightSlider.hide();
        p.pixelDensity(PIXEL_DENSITY);
        p.noLoop();
        p.noFill();
        p.imageMode(p.CENTER);
        canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        canvas.elt.addEventListener("contextmenu", (e: any) => e.preventDefault());
        canvas.parent(targetDiv);
        CamPosition.x = p.width / 2;
        CamPosition.y = p.height / 2;
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
          new p5((sp: p5) => {
            sp.setup = () => {
              sp.createCanvas(ActualCanvas.width, ActualCanvas.height);
              if (ImageCanvas)
                sp.image(ImageCanvas, 0, 0);
              if (ActualCanvas)
                sp.image(ActualCanvas, 0, 0);
              sp.saveFrames('', 'png', 1, 1, c => {
                let img = c[0]['imageData'].replace(/"|=|\\/g, '');
                this.modalCtrl.dismiss({
                  name: `voidDraw_${sp.year()}-${sp.nf(sp.month(), 2)}-${sp.nf(sp.day(), 2)}_${sp.nf(sp.hour(), 2)}-${sp.nf(sp.minute(), 2)}-${sp.nf(sp.second(), 2)}.png`,
                  img: img,
                  loadingCtrl: this.mainLoading,
                });
                sp.remove();
              });
            }
          });
        }
        p['history_act'] = (direction: number) => {
          HistoryPointer = p.min(p.max(0, HistoryPointer + direction), DrawingStack.length);
          switch (direction) {
            case 1: // Redo
              UndoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer == DrawingStack.length)
                RedoButton.style.fill = 'var(--ion-color-medium)';
              updateDrawingCurve(ActualCanvas, DrawingStack[HistoryPointer - 1]);
              break;
            case -1: // Undo
              RedoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer < 1) {
                UndoButton.style.fill = 'var(--ion-color-medium)';
                ActualCanvas.background(255, 0);
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
        CropCell.innerHTML = `<ion-icon id="CropToolNotReady" style="width: 27px; height: 27px" name="crop"></ion-icon>`;
        document.getElementById('CropToolNotReady').style.fill = 'var(--ion-color-medium)';
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
          ScaleCenter.x = p.width / 2;
          ScaleCenter.y = p.height / 2;
          CamPosition.x = 0;
          CamPosition.y = 0;
          let HeightExceptMenu = targetDiv.clientHeight - 112;
          let windowRatio = targetDiv.clientWidth / HeightExceptMenu;
          let canvasRatio = ActualCanvas.width / ActualCanvas.height;
          if (windowRatio < canvasRatio)
            CamScale = targetDiv.clientWidth / ActualCanvas.width;
          else CamScale = HeightExceptMenu / ActualCanvas.height;
          canvas.show();
          WeightSlider.position(p.width - WeightSlider.width, p.height - WeightSlider.height - BUTTON_HEIGHT);
          p.redraw();
        }
        ActualCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
        ActualCanvas.noLoop();
        ActualCanvas.noFill();
        ImageCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
        ImageCanvas.noLoop();
        ImageCanvas.noFill();
        ImageCanvas.background(255);
        ImageCanvas.imageMode(p.CENTER);
        // 사용자 그리기 판넬 생성
        if (initData['path']) { // 배경 이미지 파일이 포함됨
          let blob = await this.indexed.loadBlobFromUserPath(initData['path'], '');
          let FileURL = URL.createObjectURL(blob);
          p.loadImage(FileURL, v => {
            ActualCanvas.resizeCanvas(v.width, v.height);
            ImageCanvas.image(v, 0, 0);
            ImageCanvas.redraw();
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
      }
      /** Viewport 행동을 위한 변수들 */
      let CamPosition = p.createVector();
      let CamScale = 1;
      /** 확대 중심 */
      let ScaleCenter = p.createVector(0, 0);
      /** 이미지 Crop 시 상대적 위치 기록 */
      let CropPosition = p.createVector();
      p.draw = () => {
        p.clear(255, 255, 255, 255);
        p.push();
        p.translate(ScaleCenter);
        p.scale(CamScale);
        p.translate(CamPosition);
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
        if (CurrentDraw
          && CurrentDraw['pos']
          && CurrentDraw['pos'].length) {
          p.push();
          p.stroke(CurrentDraw['color']);
          p.strokeWeight(CurrentDraw['weight']);
          p.beginShape();
          for (let i = 0, j = CurrentDraw['pos'].length; i < j; i++)
            p.curveVertex(CurrentDraw['pos'][i].x, CurrentDraw['pos'][i].y);
          p.endShape();
          p.pop();
        }
        p.pop();
      }
      /** 그려진 자유선 정보 저장  
       * DrawingStack[i] = [{ pos: [{x, y}, ..], color: p5.Color, weight: number }, ..]
       */
      let DrawingStack = [];
      /** 선을 어디까지 그리는지, 히스토리 행동용 */
      let HistoryPointer = 0;
      /** 모바일 최적화를 위해 기록 길이 제한 */
      const CACHE_HISTORY_LENGTH = 16;
      /** 전체 그리기, 동작 취소 등 전체 업데이트가 필요할 때 사용 */
      let updateActualCanvas = () => {
        ActualCanvas.background(255, 0);
        // 모든 그리기 행동 시도
        for (let i = HistoryPointer - 1; i >= 0; i--)
          updateDrawingCurve(ActualCanvas, DrawingStack[i]);
      }
      /** 마지막 행동에 해당하는 선 전체 그리기 */
      let updateDrawingCurve = (TargetCanvas = ActualCanvas, targetDraw = CurrentDraw) => {
        TargetCanvas.push();
        TargetCanvas.noFill();
        TargetCanvas.stroke(targetDraw['color']);
        TargetCanvas.strokeWeight(targetDraw['weight']);
        TargetCanvas.beginShape();
        for (let i = 0, j = targetDraw['pos'].length; i < j; i++)
          TargetCanvas.curveVertex(targetDraw['pos'][i].x, targetDraw['pos'][i].y);
        TargetCanvas.endShape();
        TargetCanvas.pop();
        TargetCanvas.redraw();
        p.redraw();
      }
      p.windowResized = () => {
        setTimeout(() => {
          p['SetCanvasViewportInit']();
        }, 0);
      }
      let CurrentDraw = {};
      const BUTTON_HEIGHT = 56;
      /** 모든 터치 또는 마우스 포인터의 현재 지점 */
      let MouseAct: p5.Vector;
      /** 이동 연산용 시작점 */
      let MovementStartPosition: p5.Vector;
      /** 두 손가락 사이 거리 */
      let TouchBetween = 0;
      /** 스케일 시작점 */
      let ScaleStartRatio: number;
      /** 시작점 캐시 */
      let TempStartCamPosition: p5.Vector;
      let isClickOnMenu = false;
      p.mousePressed = (ev: any) => {
        if (p.mouseY < BUTTON_HEIGHT || p.mouseY > p.height - BUTTON_HEIGHT) {
          isClickOnMenu = true;
          return;
        }
        switch (ev['which']) {
          case 1: // 왼쪽
            DrawStartAct();
            break;
          case 3: // 오른쪽
            MovementStartPosition = p.createVector(p.mouseX, p.mouseY);
            TempStartCamPosition = CamPosition.copy();
            MouseAct = p.createVector(p.mouseX, p.mouseY);
            break;
          case 2: // 가운데
            p['SetCanvasViewportInit']();
            break;
        }
      }
      /** 그리기 시작 행동 (PC/터치스크린 공용) */
      let DrawStartAct = (_x?: number, _y?: number) => {
        UndoButton.style.fill = 'var(--ion-color-dark)';
        RedoButton.style.fill = 'var(--ion-color-medium)';
        let pos = MappingPosition(_x, _y);
        let _pos = { x: pos.x, y: pos.y };
        CurrentDraw = {
          pos: [],
          color: p5ColorPicker['color'](),
          weight: Number(WeightSlider.value()),
        };
        CurrentDraw['pos'].push(_pos);
        CurrentDraw['pos'].push(_pos);
        p.redraw();
      }
      p.mouseDragged = (ev: any) => {
        switch (ev['which']) {
          case 1: // 왼쪽
            let pos = MappingPosition();
            let _pos = { x: pos.x, y: pos.y };
            if (CurrentDraw)
              CurrentDraw['pos'].push(_pos);
            p.redraw();
            break;
          case 3: // 오른쪽
            MouseAct = p.createVector(p.mouseX, p.mouseY);
            CamPosition = TempStartCamPosition.copy().add(MouseAct.sub(MovementStartPosition).div(CamScale));
            p.redraw();
            break;
        }
      }
      p.mouseWheel = (ev: any) => {
        if (p.mouseY < BUTTON_HEIGHT || p.mouseY > p.height - BUTTON_HEIGHT) {
          isClickOnMenu = true;
          return;
        }
        PrepareZoomAct(MappingPosition());
        let delta = ev['deltaY'];
        if (delta < 0)
          CamScale *= 1.1;
        else CamScale *= .9;
        p.redraw();
      }
      p.mouseReleased = (ev: any) => {
        switch (ev['which']) {
          case 1: // 왼쪽
            if (!isClickOnMenu) {
              let pos = MappingPosition();
              let _pos = { x: pos.x, y: pos.y };
              if (CurrentDraw) {
                CurrentDraw['pos'].push(_pos);
                CurrentDraw['pos'].push(_pos);
              }
              ReleaseAllAct();
            }
            break;
        }
        isClickOnMenu = false;
      }
      /** 확대 중심점을 조정 */
      let PrepareZoomAct = (center: p5.Vector) => {
        ScaleCenter = p.createVector(p.mouseX, p.mouseY);
        CamPosition = center.mult(-1);
      }
      /** 화면 상의 마우스 위치를 할 일 공간 내 위치로 변경 */
      let MappingPosition = (_x?: number, _y?: number) => {
        let mousePosition = p.createVector(_x || p.mouseX, _y || p.mouseY);
        mousePosition.sub(ScaleCenter);
        mousePosition.div(CamScale);
        mousePosition.sub(CamPosition);
        return mousePosition;
      }
      let touches = [];
      /** 터치 중인지 여부, 3손가락 터치시 행동 제약을 걸기 위해서 존재 */
      let isTouching = false;
      const HEADER_HEIGHT = 56;
      p.touchStarted = (ev: any) => {
        touches = ev['touches'];
        if (ev['changedTouches'][0].clientY < BUTTON_HEIGHT
          || ev['changedTouches'][0].clientY > p.height - BUTTON_HEIGHT) {
          isClickOnMenu = true;
          return;
        }
        isTouching = true;
        switch (touches.length) {
          case 1: // 그리기
            DrawStartAct(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
            break;
          case 2: // 패닝, 스케일
            let One = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - HEADER_HEIGHT);
            TouchBetween = One.dist(Two);
            MovementStartPosition = One.copy().add(Two).div(2);
            TempStartCamPosition = CamPosition.copy();
            ScaleStartRatio = CamScale;
            CurrentDraw = undefined;
            break;
          default: // 3개 또는 그 이상은 행동 초기화
            isTouching = false;
            p['SetCanvasViewportInit']();
            break;
        }
      }
      p.touchMoved = (ev: any) => {
        touches = ev['touches'];
        switch (touches.length) {
          case 1: { // 그리기
            let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
            let _pos = { x: pos.x, y: pos.y };
            if (CurrentDraw)
              CurrentDraw['pos'].push(_pos);
            p.redraw();
          }
            break;
          case 2: { // 스케일과 패닝
            let One = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - HEADER_HEIGHT);
            let CenterPos = One.copy().add(Two).div(2);
            let dist = One.dist(Two);
            CamScale = dist / TouchBetween * ScaleStartRatio;
            CamPosition = TempStartCamPosition.copy().add(CenterPos.sub(MovementStartPosition).div(CamScale));
            p.redraw();
          }
            break;
        }
        return false;
      }
      p.touchEnded = (ev: any) => {
        if (!ev['changedTouches']) return;
        touches = ev['touches'];
        isTouching = false;
        switch (touches.length) {
          case 0: // 모든 행동 종료
            if (!isClickOnMenu) {
              let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
              let _pos = { x: pos.x, y: pos.y };
              CurrentDraw['pos'].push(_pos);
              CurrentDraw['pos'].push(_pos);
              if (CurrentDraw)
                ReleaseAllAct();
            }
            break;
          case 1: // 패닝 종료
            if (!isTouching) return;
            PanningInit();
            TouchBetween = 0;
            CurrentDraw = undefined;
            break;
        }
        isClickOnMenu = false;
      }
      let PanningInit = () => {
        MovementStartPosition = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
        TempStartCamPosition = CamPosition.copy();
      }
      /** 모든 입력을 제거했을 때 공통 행동 */
      let ReleaseAllAct = () => {
        DrawingStack.length = HistoryPointer;
        DrawingStack.push(CurrentDraw);
        updateDrawingCurve(ActualCanvas, CurrentDraw);
        if (DrawingStack.length > CACHE_HISTORY_LENGTH) {
          let CachedDraw = DrawingStack.shift();
          updateDrawingCurve(ImageCanvas, CachedDraw);
        }
        HistoryPointer = DrawingStack.length;
        MovementStartPosition = undefined;
        isClickOnMenu = false;
        CurrentDraw = undefined;
        p.redraw();
      }
    });
  }

  change_color() {
    this.p5voidDraw['change_color']();
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
          else v.width = Number(v.width);
          if (!v.height) v.height = DEFAULT_SIZE;
          else v.height = Number(v.height);
          this.create_new_canvas(v);
        }
      }],
    }).then(v => v.present());
  }

  change_line_weight() {
    this.p5voidDraw['set_line_weight']();
  }

  /** Undo, Redo 등 행동을 위한 함수  
   * 생성 지연에 따른 오류 방지용
   */
  act_history(direction: number) {
    this.p5voidDraw['history_act'](direction);
  }

  open_crop_tool() {
    this.p5voidDraw['open_crop_tool']();
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    this.mainLoading.present();
    this.WithoutSave = false;
    this.p5voidDraw['save_image']();
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['HistoryAct'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    delete this.global.p5key['KeyShortCut']['DeleteAct'];
    delete this.global.p5key['KeyShortCut']['SKeyAct'];
    if (this.p5voidDraw) this.p5voidDraw.remove();
  }

  WithoutSave = true;
  ionViewDidLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    if (this.WithoutSave)
      this.mainLoading.remove();
  }
}

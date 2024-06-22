import { Component, OnInit, ViewChild, viewChild } from '@angular/core';
import { AlertController, IonSelect, LoadingController, ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
import { isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ToolServerService } from 'src/app/tool-server.service';
import { WebrtcService } from 'src/app/webrtc.service';

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
    private nakama: NakamaService,
    private p5toast: P5ToastService,
    private toolServer: ToolServerService,
    private webrtc: WebrtcService,
  ) { }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.replaceState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.modalCtrl.dismiss();
    };
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
  }
  mainLoading: HTMLIonLoadingElement;

  EventListenerAct = (ev: any) => {
    ev.detail.register(130, (_processNextHandler: any) => {
      if (this.isDrawServerConnected) {
        this.ReadyToShareAct = false;
        this.RemoteLoadingCtrl.dismiss();
        this.toolServer.stop('RemoteDraw');
        this.isDrawServerConnected = false;
        this.p5voidDraw['SetDrawable'](true);
        this.webrtc.close_webrtc();
      }
    });
  }

  isMobile = false;
  async ionViewDidEnter() {
    this.AddShortCut();
    document.addEventListener('ionBackButton', this.EventListenerAct);
    this.mainLoading = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['UseThisImage'] });
    this.create_new_canvas({
      width: this.navParams.data.width,
      height: this.navParams.data.height,
      path: this.navParams.data.path,
    });
    this.isMobile = isPlatform != 'DesktopPWA';
  }

  AddShortCut() {
    if (this.p5voidDraw && this.p5voidDraw['SetDrawable'])
      this.p5voidDraw['SetDrawable'](true);
    delete this.global.p5key['KeyShortCut']['Digit'];
    this.global.p5key['KeyShortCut']['HistoryAct'] = (key: string) => {
      switch (key) {
        case 'Z':
          this.p5voidDraw['history_act'](-1);
          break;
        case 'X':
          this.p5voidDraw['history_act'](1);
          break;
        case 'C':
          if (this.isCropMode) {
            this.p5voidDraw['apply_crop']();
          } else this.p5voidDraw['change_color']();
          break;
        case 'V':
          this.p5voidDraw['set_line_weight']();
          break;
      }
    }
    this.global.p5key['KeyShortCut']['AddAct'] = () => {
      this.ClickRemoteAddButton();
    }
    this.global.p5key['KeyShortCut']['SKeyAct'] = () => {
      this.open_crop_tool();
    }
    this.global.p5key['KeyShortCut']['DeleteAct'] = () => {
      if (this.isCropMode) {
        this.p5voidDraw['apply_crop']();
      } else this.dismiss_draw();
    }
    this.global.p5key['KeyShortCut']['FKeyAct'] = () => {
    }
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      if (this.isDrawServerConnected) {
        this.ReadyToShareAct = false;
        this.RemoteLoadingCtrl.dismiss();
        this.toolServer.stop('RemoteDraw');
        this.isDrawServerConnected = false;
        this.p5voidDraw['SetDrawable'](true);
        this.webrtc.close_webrtc();
      }
    }
  }

  /** 새 캔버스 생성 행동 분리 */
  async create_new_canvas(inputInfo?: any) {
    inputInfo['width'] = inputInfo['width'] || 432;
    inputInfo['height'] = inputInfo['height'] || 432;
    if (this.p5voidDraw) this.p5voidDraw.remove();
    this.create_p5voidDraw(inputInfo);
  }

  p5voidDraw: p5;
  QRCode: any;
  waiting(millis: number) {
    return new Promise((done) => setTimeout(() => {
      done(undefined);
    }, millis))
  }
  isCropMode = false;
  @ViewChild('RemoteDraw') RemoteDraw: IonSelect;
  create_p5voidDraw(initData: any) {
    let targetDiv = document.getElementById('voidDraw');
    this.isCropMode = false;
    this.p5voidDraw = new p5((p: p5) => {
      /** 스케일 조정 편의를 위해 모든게 여기서 작업됨 */
      let ActualCanvas: p5.Graphics;
      let ActualCanvasSizeHalf: p5.Vector;
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
      let strokeWeight = Math.min(initData['width'], initData['height']) / 100;
      let strokeRatio = 1;
      const PIXEL_DENSITY = 1;
      p.setup = async () => {
        p.pixelDensity(PIXEL_DENSITY);
        p.noLoop();
        p.noFill();
        p.imageMode(p.CENTER);
        canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        canvas.parent(targetDiv);
        CamPosition.x = p.width / 2;
        CamPosition.y = p.height / 2;
        p['set_line_weight'] = () => {
          this.alertCtrl.create({
            header: this.lang.text['voidDraw']['changeWeight'],
            inputs: [{
              label: this.lang.text['voidDraw']['weight'],
              name: 'weight',
              placeholder: `${strokeRatio}`,
              type: 'number',
            }],
            buttons: [{
              text: this.lang.text['voidDraw']['apply'],
              handler: (ev: any) => {
                if (ev['weight'])
                  strokeRatio = Number(ev['weight']);
              }
            }]
          }).then(v => {
            Drawable = false;
            v.onWillDismiss().then(() => {
              Drawable = true;
            });
            v.present();
          });
        }
        p['change_color'] = () => {
          p5ColorPicker.elt.click();
        }
        p['save_image'] = () => {
          new p5((sp: p5) => {
            sp.setup = () => {
              let canvas = sp.createCanvas(ActualCanvas.width, ActualCanvas.height);
              sp.pixelDensity(PIXEL_DENSITY);
              if (ImageCanvas)
                sp.image(ImageCanvas, 0, 0);
              if (ActualCanvas)
                sp.image(ActualCanvas, 0, 0);
              let base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
              this.modalCtrl.dismiss({
                name: `voidDraw_${sp.year()}-${sp.nf(sp.month(), 2)}-${sp.nf(sp.day(), 2)}_${sp.nf(sp.hour(), 2)}-${sp.nf(sp.minute(), 2)}-${sp.nf(sp.second(), 2)}.png`,
                img: base64,
                loadingCtrl: this.mainLoading,
              });
              sp.remove();
            }
          });
        }
        p['history_act'] = (direction: number) => {
          HistoryPointer = p.min(p.max(0, HistoryPointer + direction), p['DrawingStack'].length);
          switch (direction) {
            case 1: // Redo
              if (p['DrawingStack'].length)
                UndoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer == p['DrawingStack'].length)
                RedoButton.style.fill = 'var(--ion-color-medium)';
              updateDrawingCurve(ActualCanvas, p['DrawingStack'][HistoryPointer - 1]);
              break;
            case -1: // Undo
              if (p['DrawingStack'].length)
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
          if (this.isCropMode) { // 취소 행동으로 간주
            this.isCropMode = false;
            p.redraw();
          } else {
            this.isCropMode = true;
            CropSize.x = ActualCanvas.width;
            CropSize.y = ActualCanvas.height;
            CropModePosition.x = 0;
            CropModePosition.y = 0;
            p.redraw();
          }
        }
        p['apply_crop'] = () => {
          if (this.isMobile)
            CropModePosition.div(CamScale);
          ActualCanvas.resizeCanvas(CropSize.x, CropSize.y);
          ActualCanvasSizeHalf = p.createVector(ActualCanvas.width / 2, ActualCanvas.height / 2);
          CropPosition.sub(CropModePosition);
          updateActualCanvas();
          ImageCanvas.resizeCanvas(CropSize.x, CropSize.y);
          ImageCanvas.push();
          ImageCanvas.background(this.navParams.data['isDarkMode'] ? 26 : 255);
          ImageCanvas.translate(CropPosition);
          if (p['BaseImage'])
            ImageCanvas.image(p['BaseImage'], 0, 0);
          ImageCanvas.pop();
          ImageCanvas.redraw();
          this.isCropMode = false;
          p['SetCanvasViewportInit']();
        }
        p['SetDrawable'] = SetDrawable;
        /** 상하단 메뉴 생성 */
        TopMenu = p.createElement('table');
        TopMenu.style('position: absolute; top: 0px;');
        TopMenu.style(`width: 100%; height: ${BUTTON_HEIGHT}px;`);
        TopMenu.style('background-color: var(--voidDraw-menu-background);')
        TopMenu.parent(targetDiv);
        let top_row = TopMenu.elt.insertRow(0); // 상단 메뉴
        let AddTextCell = top_row.insertCell(0); // 추가
        if (isPlatform == 'MobilePWA') // 모바일 웹은 지원하지 않음
          AddTextCell.innerHTML = `<ion-icon id="RemoteIcon" style="width: 27px; height: 27px" name="wifi-outline"></ion-icon>`;
        else AddTextCell.innerHTML = `<ion-icon id="RemoteIcon" style="width: 27px; height: 27px" name="wifi-outline"></ion-icon>`;
        AddTextCell.style.textAlign = 'center';
        AddTextCell.style.cursor = 'pointer';
        AddTextCell.onclick = () => {
          this.ClickRemoteAddButton();
        } // 동작 준비중 // A 단축키 기능 재연결과 new_image() 삭제
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
        UndoCell.onclick = () => { this.p5voidDraw['history_act'](-1); }
        let RedoCell = bottom_row.insertCell(1); // Redo
        RedoCell.innerHTML = `<ion-icon id="redoIcon" style="width: 27px; height: 27px" name="arrow-redo"></ion-icon>`;
        RedoButton = document.getElementById('redoIcon');
        RedoButton.style.fill = 'var(--ion-color-medium)';
        RedoCell.style.textAlign = 'center';
        RedoCell.style.cursor = 'pointer';
        RedoCell.onclick = () => { this.p5voidDraw['history_act'](1); }
        let ColorCell = bottom_row.insertCell(2); // 선 색상 변경
        ColorCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="color-palette"></ion-icon>`;
        p5ColorPicker.style('width: 0px; height: 0px; opacity: 0;');
        p5ColorPicker.parent(ColorCell);
        p5ColorPicker.elt.oninput = () => {
          let color = p5ColorPicker['color']().levels;
          let color_hex = `#${p.hex(color[0], 2)}${p.hex(color[1], 2)}${p.hex(color[2], 2)}`;
          ColorCell.childNodes[0].style.color = color_hex;
        }
        ColorCell.style.textAlign = 'center';
        ColorCell.style.cursor = 'pointer';
        ColorCell.onclick = () => { p5ColorPicker.elt.click() }
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
          p.redraw();
        }
        ActualCanvas = p.createGraphics(initData.width, initData.height);
        ActualCanvasSizeHalf = p.createVector(ActualCanvas.width / 2, ActualCanvas.height / 2);
        ActualCanvas.pixelDensity(PIXEL_DENSITY);
        ActualCanvas.noLoop();
        ActualCanvas.noFill();
        p['ActualCanvas'] = ActualCanvas;
        ImageCanvas = p.createGraphics(initData.width, initData.height);
        ImageCanvas.pixelDensity(PIXEL_DENSITY);
        ImageCanvas.noLoop();
        ImageCanvas.noFill();
        ImageCanvas.background(this.navParams.data['isDarkMode'] ? 26 : 255);
        p['ImageCanvas'] = ImageCanvas;
        // 사용자 그리기 판넬 생성
        if (initData['path']) { // 배경 이미지 파일이 포함됨
          let blob = await this.indexed.loadBlobFromUserPath(initData['path'], '');
          let FileURL = URL.createObjectURL(blob);
          p.loadImage(FileURL, v => {
            p['BaseImage'] = v;
            ImageCanvas.image(p['BaseImage'], 0, 0);
            ImageCanvas.redraw();
            URL.revokeObjectURL(FileURL);
            p['SetCanvasViewportInit']();
          }, e => {
            console.error('그림판 배경 이미지 불러오기 오류: ', e);
            ImageCanvas.redraw();
            URL.revokeObjectURL(FileURL);
            p['SetCanvasViewportInit']();
          });
        } else {
          ImageCanvas.redraw();
          p['SetCanvasViewportInit']();
        }
        if (initData['width'] < initData['height'])
          strokeWeight = strokeWeight / CamScale;
      }
      /** Viewport 행동을 위한 변수들 */
      let CamPosition = p.createVector();
      let CamScale = 1;
      /** 확대 중심 */
      let ScaleCenter = p.createVector(0, 0);
      /** 이미지 Crop 시 상대적 위치 기록 */
      let CropPosition = p.createVector();
      /** Crop 정보 편집시 사용됨 */
      let CropModePosition = p.createVector();
      let CropSize = p.createVector();
      p.draw = () => {
        p.clear(255, 255, 255, 255);
        p.push();
        p.translate(ScaleCenter);
        p.scale(CamScale);
        p.translate(CamPosition);
        p.image(ImageCanvas, 0, 0);
        p.image(ImageCanvas, 0, 0);
        if (ActualCanvas)
          p.image(ImageCanvas, 0, 0);
        if (ActualCanvas)
          p.image(ActualCanvas, 0, 0);
        if (this.isCropMode) {
          p.push();
          p.translate(-ActualCanvas.width / 2, -ActualCanvas.height / 2);
          p.translate(CropModePosition);
          p.noStroke();
          p.fill(0, 100);
          p.rect(0, 0, CropSize.x, CropSize.y);
          p.stroke(255, 0, 0);
          p.strokeWeight(8);
          p.beginShape(p.LINES);
          p.vertex(0, 0);
          p.vertex(CropSize.x, 0);
          p.vertex(CropSize.x, 0);
          p.vertex(CropSize.x, CropSize.y * .8);
          p.vertex(0, 0);
          p.vertex(0, CropSize.y);
          p.vertex(0, CropSize.y);
          p.vertex(CropSize.x * .8, CropSize.y);
          p.stroke(255, 255, 0);
          p.vertex(CropSize.x * .8, CropSize.y);
          p.vertex(CropSize.x, CropSize.y);
          p.vertex(CropSize.x, CropSize.y * .8);
          p.vertex(CropSize.x, CropSize.y);
          p.endShape();
          p.pop();
        } else { // Crop 이 아니라면 그리기 모드
          if (CurrentDraw
            && CurrentDraw['pos']
            && CurrentDraw['pos'].length) {
            p.push();
            p.translate(CropPosition);
            p.stroke(CurrentDraw['color']);
            p.strokeWeight(CurrentDraw['weight']);
            p.beginShape();
            for (let i = 0, j = CurrentDraw['pos'].length; i < j; i++)
              p.curveVertex(CurrentDraw['pos'][i].x - ActualCanvasSizeHalf.x, CurrentDraw['pos'][i].y - ActualCanvasSizeHalf.y);
            p.endShape();
            p.pop();
          }
        }
        p.pop();
      }
      p['DrawingStack'] = [];
      /** 선을 어디까지 그리는지, 히스토리 행동용 */
      let HistoryPointer = 0;
      /** 전체 그리기, 동작 취소 등 전체 업데이트가 필요할 때 사용 */
      let updateActualCanvas = () => {
        ActualCanvas.clear(255, 255, 255, 255);
        // 모든 그리기 행동 시도
        for (let i = 0; i < HistoryPointer; i++)
          updateDrawingCurve(ActualCanvas, p['DrawingStack'][i]);
      }
      /** 마지막 행동에 해당하는 선 전체 그리기 */
      let updateDrawingCurve = (TargetCanvas: p5.Graphics, targetDraw = CurrentDraw) => {
        if (!targetDraw['color']) return;
        TargetCanvas.push();
        TargetCanvas.translate(CropPosition);
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
      /** 이미지 자르기 이동 시작점 (포인터의 위치 기록) */
      let CropStartPosition: p5.Vector;
      /** 스케일 행동 검토용 시작점 / 분리된 정보 */
      let CropStartScalePos: p5.Vector;
      /** 두 손가락 사이 거리 */
      let TouchBetween = 0;
      /** 스케일 시작점 */
      let ScaleStartRatio: number;
      /** 시작점 캐시 */
      let TempStartCamPosition: p5.Vector;
      /** Crop 크기 조정 여부 */
      let isCropSizing = false;
      let CropStartSize: p5.Vector;
      let isClickOnMenu = false;
      p.mousePressed = (ev: any) => {
        if (!Drawable) return;
        if (p.mouseY < BUTTON_HEIGHT || p.mouseY > p.height - BUTTON_HEIGHT) {
          isClickOnMenu = true;
          return;
        }
        switch (ev['which']) {
          case 1: // 왼쪽
            if (this.isCropMode) {
              CropModeStartAct();
            } else DrawStartAct();
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
      let CropModeStartAct = (_x?: number, _y?: number) => {
        let ClickedPos = MappingPosition(_x, _y);
        let CornerPos = CropModePosition.copy().add(CropSize).sub(p.createVector(ActualCanvas.width / 2, ActualCanvas.height / 2));
        let dist = ClickedPos.dist(CornerPos);
        let targetDist = p.max(CropSize.x, CropSize.y) * .2;
        isCropSizing = dist < targetDist;
        if (isCropSizing) {
          CropStartScalePos = p.createVector(p.mouseX, p.mouseY);
          CropStartSize = CropSize.copy();
        } else CropStartPosition = p.createVector(p.mouseX, p.mouseY).sub(CropModePosition.mult(CamScale));
      }
      /** 그리기 시작 행동 (PC/터치스크린 공용) */
      let DrawStartAct = (_x?: number, _y?: number) => {
        UndoButton.style.fill = 'var(--ion-color-dark)';
        RedoButton.style.fill = 'var(--ion-color-medium)';
        let pos = MappingPosition(_x, _y);
        pos.sub(CropPosition);
        pos.add(ActualCanvasSizeHalf);
        let _pos = { x: pos.x, y: pos.y };
        let color = p5ColorPicker['color']().levels;
        let color_hex = `#${p.hex(color[0], 2)}${p.hex(color[1], 2)}${p.hex(color[2], 2)}`;
        CurrentDraw = {
          pos: [],
          color: color_hex,
          weight: strokeWeight * strokeRatio,
        };
        CurrentDraw['pos'].push(_pos);
        CurrentDraw['pos'].push(_pos);
        p.redraw();
      }
      p.mouseDragged = (ev: any) => {
        if (!Drawable) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            if (this.isCropMode && !isClickOnMenu) {
              let CurrentPosition = p.createVector(p.mouseX, p.mouseY);
              if (isCropSizing) {
                CropSize = CropStartSize.copy().add(CropStartScalePos.copy().sub(CurrentPosition).div(-CamScale));
              } else CropModePosition = CropStartPosition.copy().sub(CurrentPosition).div(-CamScale);
              p.redraw();
            } else {
              let pos = MappingPosition();
              pos.sub(CropPosition);
              pos.add(ActualCanvasSizeHalf);
              let _pos = { x: pos.x, y: pos.y };
              if (CurrentDraw && CurrentDraw['pos'])
                CurrentDraw['pos'].push(_pos);
              p.redraw();
            }
            break;
          case 3: // 오른쪽
            MouseAct = p.createVector(p.mouseX, p.mouseY);
            CamPosition = TempStartCamPosition.copy().add(MouseAct.sub(MovementStartPosition).div(CamScale));
            p.redraw();
            break;
        }
      }
      p.mouseWheel = (ev: any) => {
        if (!Drawable) return;
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
        if (!Drawable) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            if (this.isCropMode) {
            } else if (!isClickOnMenu) {
              let pos = MappingPosition();
              pos.sub(CropPosition);
              pos.add(ActualCanvasSizeHalf);
              let _pos = { x: pos.x, y: pos.y };
              if (CurrentDraw) {
                try {
                  CurrentDraw['pos'].push(_pos);
                  CurrentDraw['pos'].push(_pos);
                } catch (e) { }
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
      /** 그리기 가능 여부, 메뉴 생성시 그리기 불가처리를 위해 존재함 */
      let Drawable = true;
      /** 그리기 막기 */
      let SetDrawable = (tog: boolean) => {
        Drawable = tog;
      }
      const HEADER_HEIGHT = 56;
      p.touchStarted = (ev: any) => {
        if (!Drawable) return;
        touches = ev['touches'];
        if (ev['changedTouches'][0].clientY < BUTTON_HEIGHT
          || ev['changedTouches'][0].clientY > p.height - BUTTON_HEIGHT) {
          isClickOnMenu = true;
          return;
        }
        isTouching = true;
        switch (touches.length) {
          case 1: // 그리기
            if (this.isCropMode) {
              CropModeStartAct(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
            } else DrawStartAct(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
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
        if (!Drawable || !isTouching) return;
        touches = ev['touches'];
        switch (touches.length) {
          case 1: { // 그리기
            if (this.isCropMode && !isClickOnMenu) {
              let CurrentPosition = p.createVector(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
              if (isCropSizing) {
                CropSize = CropStartSize.copy().add(CropStartScalePos.copy().sub(CurrentPosition).div(-CamScale));
              } else CropModePosition = CropStartPosition.copy().sub(CurrentPosition).div(-CamScale);
              p.redraw();
            } else {
              let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
              pos.sub(CropPosition);
              pos.add(ActualCanvasSizeHalf);
              let _pos = { x: pos.x, y: pos.y };
              if (CurrentDraw && CurrentDraw['pos'])
                CurrentDraw['pos'].push(_pos);
              p.redraw();
            }
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
        if (!Drawable || !ev['changedTouches']) return;
        touches = ev['touches'];
        isTouching = false;
        switch (touches.length) {
          case 0: // 모든 행동 종료
            if (this.isCropMode) {
            } else if (!isClickOnMenu) {
              if (CurrentDraw) {
                let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
                pos.sub(CropPosition);
                pos.add(ActualCanvasSizeHalf);
                let _pos = { x: pos.x, y: pos.y };
                CurrentDraw['pos'].push(_pos);
                CurrentDraw['pos'].push(_pos);
                ReleaseAllAct();
              }
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
        p['DrawingStack'].length = HistoryPointer;
        if (CurrentDraw) {
          p['DrawingStack'].push(CurrentDraw);
          updateDrawingCurve(ActualCanvas, CurrentDraw);
        }
        HistoryPointer = p['DrawingStack'].length;
        MovementStartPosition = undefined;
        isClickOnMenu = false;
        CurrentDraw = undefined;
        p.redraw();
      }
    });
  }

  /** 원격 추가 버튼 눌릴 때 */
  ClickRemoteAddButton() {
    if (this.isDrawServerConnected) return;
    // 웹 페이지에서는 모바일로 연결할 수 있도록 인터페이스 준비
    this.ServerList = this.nakama.get_all_online_server();
    if (this.ServerList.length) {
      this.p5voidDraw['SetDrawable'](false);
      this.RemoteDraw.open();
    } else this.RemoteBridgeServerSelected({ detail: { value: 'local' } });
  }

  /** 중계서버 사용 가능한 서버 */
  ServerList = [];
  /** 로컬 웹소켓 서버 생성 여부 검토 */
  isDrawServerConnected = false;
  /** 취소할 수 있는 구성을 위해 기억함 */
  RemoteLoadingCtrl: HTMLIonLoadingElement;
  /** 서버 연결 보조용 웹소켓 삭제를 위해 기억함 */
  IceWebRTCWsClient: WebSocket;
  /** WebRTC 구성이 완료되었고 행동을 공유할 준비가 끝남 */
  ReadyToShareAct = false;
  /** 서버가 있는 경우 서버를 선택 */
  async RemoteBridgeServerSelected(ev: any) {
    let target = ev.detail.value;
    switch (target) {
      case 'local': // 웹이면 내부망을 가정하고 즉시 ip 주소 입력기를 준비함
        if (this.isDrawServerConnected) return;
        if (isPlatform == 'DesktopPWA') {
          let is_ws_on = undefined;
          this.alertCtrl.create({
            header: this.lang.text['voidDraw']['LocalAddrInput'],
            inputs: [{
              type: 'text',
              placeholder: '0.0.0.0',
            }],
            buttons: [{
              text: this.lang.text['voidDraw']['Confirm'],
              handler: (ev: any) => {
                this.p5voidDraw['SetDrawable'](false);
                if (ev[0]) {
                  is_ws_on = true;
                  this.loadingCtrl.create({ message: `${this.lang.text['voidDraw']['WaitingConnection']}: ${ev[0]}` })
                    .then(v => {
                      this.RemoteLoadingCtrl = v;
                      this.RemoteLoadingCtrl.present();
                      this.IceWebRTCWsClient = new WebSocket(`ws://${ev[0]}:12012/`);
                      this.isDrawServerConnected = true;
                      this.IceWebRTCWsClient.onopen = () => {
                        this.p5toast.show({
                          text: `${this.lang.text['voidDraw']['Connected']}: ${ev[0]}`,
                        });
                        this.IceWebRTCWsClient.send(JSON.stringify({
                          type: 'size',
                          width: this.p5voidDraw['ActualCanvas'].width,
                          height: this.p5voidDraw['ActualCanvas'].height,
                          imgWidth: this.p5voidDraw['ImageCanvas'].width,
                          imgHeight: this.p5voidDraw['ImageCanvas'].height,
                        }));
                        this.p5voidDraw['SetDrawable'](true);
                      }
                      this.IceWebRTCWsClient.onmessage = (ev: any) => {
                        let json = JSON.parse(ev['data']);
                        switch (json.type) {
                          case 'init':
                            this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Init'];
                            this.webrtc.initialize('data').then(() => {
                              this.IceWebRTCWsClient.send(JSON.stringify({
                                type: 'socket_react',
                                act: 'WEBRTC_INIT_REQ_SIGNAL',
                              }));
                            });
                            break;
                          case 'socket_react': // nakama.socket_react
                            switch (json['act']) {
                              case 'WEBRTC_REPLY_INIT_SIGNAL':
                                this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Reply'];
                                this.nakama.socket_reactive[json['act']](json['data_str']);
                                if (json['data_str'] == 'EOL') {
                                  this.webrtc.CreateAnswer(this.IceWebRTCWsClient);
                                  this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Ice'];
                                }
                                break;
                              case 'WEBRTC_ICE_CANDIDATES':
                                this.nakama.socket_reactive[json['act']](json['data_str'], this.IceWebRTCWsClient);
                                v.dismiss();
                                this.IceWebRTCWsClient.send(JSON.stringify({
                                  type: 'init_end',
                                }));
                                this.ReadyToShareAct = true;
                                break;
                            }
                            break;
                          default:
                            console.log('지정되지 않은 정보: ', json);
                            break;
                        }
                      }
                      this.IceWebRTCWsClient.onclose = () => {
                        this.ReadyToShareAct = false;
                        v.dismiss();
                        this.isDrawServerConnected = false;
                        this.p5toast.show({
                          text: this.lang.text['TodoDetail']['Disconnected'],
                        });
                        this.AddShortCut();
                      }
                    });
                } else this.p5toast.show({
                  text: this.lang.text['voidDraw']['InputAddress'],
                });
              }
            }]
          }).then(v => {
            v.onDidDismiss().then(() => {
              if (!is_ws_on) this.AddShortCut();
            });
            this.RemoveShortCut();
            v.present();
          });
        } else { // 앱에서는 서버 열기 구성
          this.RemoteLoadingCtrl = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['WaitingConnection'] });
          this.RemoteLoadingCtrl.present();
          this.p5voidDraw['SetDrawable'](false);
          this.toolServer.initialize('RemoteDraw', 12012,
            () => { // OnStart
              this.isDrawServerConnected = true;
            }, (conn: any) => { // OnConnect
              this.p5toast.show({
                text: `${this.lang.text['voidDraw']['Connected']}: ${conn.remoteAddr}`,
              });
            }, (conn: any, json: any) => { // OnMessage
              switch (json.type) {
                case 'size': // 상대방 캔버스 크기 정보를 기반으로 새 캔버스 생성
                  this.create_new_canvas({
                    width: json.width,
                    height: json.height,
                  });
                  this.p5voidDraw['redraw']();
                  // 그림판이 준비되었다면 WebRTC 구성을 시도
                  this.webrtc.initialize('data').then(() => {
                    this.webrtc.CreateOfffer();
                    this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Init'];
                    this.toolServer.send_to('RemoteDraw', this.toolServer.list['RemoteDraw'].users[0], JSON.stringify({
                      type: 'init',
                    }));
                  });
                  break;
                case 'socket_react': // nakama.socket_react
                  switch (json['act']) {
                    case 'WEBRTC_INIT_REQ_SIGNAL':
                      this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Reply'];
                      this.nakama.socket_reactive[json['act']]({
                        server: this.toolServer,
                        target: 'RemoteDraw',
                        user: this.toolServer.list['RemoteDraw'].users[0],
                      });
                      break;
                    case 'WEBRTC_RECEIVE_ANSWER':
                      this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Ice'];
                      this.nakama.socket_reactive[json['act']](json['data_str'], {
                        server: this.toolServer,
                        target: 'RemoteDraw',
                        user: this.toolServer.list['RemoteDraw'].users[0],
                      });
                      this.ReadyToShareAct = true;
                      break;
                  }
                  break;
                case 'init_end':
                  this.RemoteLoadingCtrl.dismiss();
                  break;
                default:
                  console.log('정보 지정되지 않음:', json);
                  break;
              }
            }, (conn: any) => { // OnDisconnect
              this.toolServer.stop('RemoteDraw');
              this.isDrawServerConnected = false;
              this.p5voidDraw['SetDrawable'](true);
              this.p5toast.show({
                text: this.lang.text['TodoDetail']['Disconnected'],
              });
              this.ReadyToShareAct = false;
            });
        }
        break;
      default: // 서버 중계를 가정하고 selfmatch를 활용하여 정보 발송
        console.log('서버에서: ', target);
        this.loadingCtrl.create({ message: this.lang.text['voidDraw']['WaitingConnection'] })
          .then(v => {
            this.RemoteLoadingCtrl = v;
            v.present();
          });
        break;
    }
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

  open_crop_tool() {
    this.p5voidDraw['open_crop_tool']();
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    if (this.isCropMode)
      this.p5voidDraw['apply_crop']();
    else {
      this.mainLoading.present();
      this.WithoutSave = false;
      this.p5voidDraw['save_image']();
    }
  }

  /** 항목이 취소되었을 때 그리기 복구 */
  ionSelectCancel() {
    if (this.p5voidDraw && this.p5voidDraw['SetDrawable'])
      this.p5voidDraw['SetDrawable'](true);
  }

  RemoveShortCut() {
    if (this.p5voidDraw && this.p5voidDraw['SetDrawable'])
      this.p5voidDraw['SetDrawable'](false);
    delete this.global.p5key['KeyShortCut']['HistoryAct'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    delete this.global.p5key['KeyShortCut']['DeleteAct'];
    delete this.global.p5key['KeyShortCut']['SKeyAct'];
    delete this.global.p5key['KeyShortCut']['FKeyAct'];
    delete this.global.p5key['KeyShortCut']['Escape'];
  }

  ionViewWillLeave() {
    this.RemoveShortCut();
    if (this.p5voidDraw) this.p5voidDraw.remove();
    this.toolServer.stop('RemoteDraw');
    if (this.IceWebRTCWsClient) {
      this.IceWebRTCWsClient.close();

      this.RemoteLoadingCtrl.dismiss();
      this.toolServer.stop('RemoteDraw');
      this.isDrawServerConnected = false;

      this.webrtc.close_webrtc();
    }
  }

  WithoutSave = true;
  ionViewDidLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    if (this.WithoutSave)
      this.mainLoading.remove();
  }
}

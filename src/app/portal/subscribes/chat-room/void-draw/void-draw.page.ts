// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonModal, LoadingController, ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
import { SERVER_PATH_ROOT, isPlatform } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { ToolServerService } from 'src/app/tool-server.service';

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
    public toolServer: ToolServerService,
    private p5toast: P5ToastService,
  ) { }

  ngOnInit() { }
  mainLoading: HTMLIonLoadingElement;

  EventListenerAct = (ev: any) => {
    ev.detail.register(130, (_processNextHandler: any) => { });
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
      addresses: this.navParams.data.addresses,
    });
    this.isMobile = isPlatform != 'DesktopPWA';
  }

  AddShortCut() {
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
      this.new_image();
    }
    this.global.p5key['KeyShortCut']['SKeyAct'] = () => {
      // this.StartSharedDraw();
      this.open_crop_tool();
    }
    this.global.p5key['KeyShortCut']['DeleteAct'] = () => {
      if (this.isCropMode) {
        this.p5voidDraw['apply_crop']();
      } else this.dismiss_draw();
    }
    this.global.p5key['KeyShortCut']['FKeyAct'] = () => {
    }
  }

  /** 새 캔버스 생성 행동 분리 */
  async create_new_canvas(inputInfo?: any) {
    if (inputInfo['addresses']) {
      for (let i = 0, j = inputInfo['addresses'].length; i < j; i++)
        if (!this.UserWS)
          try {
            this.UserWS = await this.createUserWS(inputInfo['addresses'][i]);
          } catch (e) { }
      if (this.UserWS) {
        this.p5toast.show({
          text: this.lang.text['voidDraw']['ConnectedToServer'],
        });
        if (this.p5voidDraw) this.p5voidDraw.remove();
      } else { // 연결에 실패함
        this.p5toast.show({
          text: this.lang.text['voidDraw']['DisconnectedFromServer'],
        });
        if (!this.p5voidDraw)
          this.create_p5voidDraw({
            width: 432,
            height: 432,
          });
      }
    } else {
      inputInfo['width'] = inputInfo['width'] || 432;
      inputInfo['height'] = inputInfo['height'] || 432;
      if (this.UserWS) this.UserWS.close();
      this.isCropable = true;
      if (this.p5voidDraw) this.p5voidDraw.remove();
      this.create_p5voidDraw(inputInfo);
    }
  }

  p5voidDraw: p5;
  @ViewChild('VoidDrawServer') VoidDrawServer: IonModal;
  QRCode: any;
  InputServerAddress: string;
  InputJoinAddress() {
    this.create_new_canvas({
      addresses: [this.InputServerAddress],
    });
    this.VoidDrawServer.dismiss();
  }
  /** 공유 그림판 발송자 */
  UserWS: WebSocket;
  uuidSelf: string;
  /** 웹 소켓 생성하기 */
  createUserWS(address: string, isSelf = false): Promise<WebSocket> {
    return new Promise((done, err) => {
      let ws = new WebSocket(`ws://${address}:12022/`);
      /** 배경 이미지 정보 누적 */
      let BGImgBase64 = '';
      /** 전체 그리기 정보 누적 */
      let DrawHistory = '';
      this.uuidSelf = '';
      ws.onopen = () => {
        BGImgBase64 = '';
        if (!isSelf) {
          this.isCropable = false;
          ws.send(JSON.stringify({ type: 'REQ_INIT' }));
        }
        done(ws);
      }
      let tmp_draw_part = {};
      ws.onmessage = (ev: any) => {
        let json = JSON.parse(ev.data);
        switch (json['type']) {
          case 'CANVAS_SIZE': // 캔버스 생성 우선
            this.create_p5voidDraw({
              width: json['width'],
              height: json['height'],
            });
            break;
          case 'CurrentDrawing': // 선 그리기 중
            this.SharedCurrentDraw[json['uuid']]['pos'].push(json['pos']);
            this.p5voidDraw.redraw();
            break;
          case 'CurrentDrawStart': // 선 그리기 시작
            this.SharedCurrentDraw[json['uuid']] = {
              pos: json['pos'],
              color: json['color'],
              weight: json['weight'],
              uuid: this.uuidSelf,
            }
            this.p5voidDraw.redraw();
            break;
          case 'CurrentDrawEndPart': // 선 그리기 종료
            if (tmp_draw_part[json['uuid']] === undefined)
              tmp_draw_part[json['uuid']] = '';
            tmp_draw_part[json['uuid']] += json['part'];
            break;
          case 'CurrentDrawEndPartEOL':
            let RemoteDraw = JSON.parse(tmp_draw_part[json['uuid']]);
            if (this.SharedDraw[json['uuid']] === undefined)
              this.SharedDraw[json['uuid']] = [];
            this.SharedDraw[json['uuid']].push(RemoteDraw);
            this.p5voidDraw.redraw();
            this.p5voidDraw['UpdateRemoteDrawLine'](json['uuid'], RemoteDraw);
            delete tmp_draw_part[json['uuid']];
            break;
          case 'DRAW_PART': // 전체 선 정보 누적
            DrawHistory += json['part'];
            break;
          case 'DRAW_EOL': // 전체 선 정보 전부 받음
            {
              let json = JSON.parse(DrawHistory);
              this.SharedDraw = json;
              let keys = Object.keys(this.SharedDraw);
              for (let i = 0, j = keys.length; i < j; i++)
                this.p5voidDraw['UpdateRemoteDraw'](keys[i]);
              this.p5voidDraw.redraw();
            }
            break;
          case 'IMAGE_PART': // 이미지 공유받음
            BGImgBase64 += json['part'];
            break;
          case 'IMAGE_EOL': // 이미지 전부 발송됨 알림
            BGImgBase64 = BGImgBase64.replace(/"|=|\\/g, '');
            this.p5voidDraw.loadImage(BGImgBase64, v => {
              this.p5voidDraw['BaseImage'] = v;
              this.p5voidDraw['ImageCanvas'].image(this.p5voidDraw['BaseImage'], 0, 0);
              this.p5voidDraw['ImageCanvas'].redraw();
              this.p5voidDraw['SetCanvasViewportInit']();
            }, e => {
              console.error('그림판 배경 이미지 불러오기 오류: ', e);
              this.p5voidDraw['ImageCanvas'].redraw();
              BGImgBase64 = '';
            });
            break;
          case 'UUID_SELF':
            this.uuidSelf = json['uuid'];
            break;
          default:
            break;
        }
      }
      ws.onclose = () => {
        this.isCropable = true;
        this.UserWS = undefined;
        err();
      }
    });
  }
  SharedDraw = {};
  /** 공유받은 현재 그리기 정보  
   * SharedCurrentDraw[uuid] = { pos: [], display_name, color, weight }
   */
  SharedCurrentDraw = {};
  StartSharedDraw() {
    if (this.isMobile)
      this.toolServer.initialize('voidDraw', 12022, async () => {
        // OnStart
        this.QRCode = this.global.readasQRCodeFromString(
          `${SERVER_PATH_ROOT}pjcone_pwa/?voidDraw=${this.toolServer.addresses}`
        );
        this.p5toast.show({
          text: this.lang.text['voidDraw']['ServerStarted'],
        });
        this.UserWS = await this.createUserWS('127.0.0.1', true);
      }, (conn) => {
        // onConnect
        this.toolServer.send_to('voidDraw', conn.uuid, JSON.stringify({
          type: 'UUID_SELF',
          uuid: conn.uuid,
        }));
      }, async (conn: any, json: any) => {
        // OnMessage
        switch (json['type']) {
          case 'REQ_INIT': // 첫 동작 요청
            // 캔버스 크기 정보 공유
            let data = {
              type: 'CANVAS_SIZE',
              width: this.p5voidDraw['ActualCanvas'].width,
              height: this.p5voidDraw['ActualCanvas'].height,
            }
            this.toolServer.send_to('voidDraw', conn.uuid, JSON.stringify(data));
            // 캔버스 그리기 기록 공유
            {
              let copied = { ...this.SharedDraw };
              copied[this.uuidSelf] = this.p5voidDraw['DrawingStack'];
              let json_str = JSON.stringify(copied);
              let part = json_str.match(/(.{1,80})/g);
              for (let i = 0, j = part.length; i < j; i++) {
                this.toolServer.send_to('voidDraw', conn.uuid, JSON.stringify({
                  type: 'DRAW_PART',
                  part: part[i],
                }));
                await this.waiting(0);
              }
              this.toolServer.send_to('voidDraw', conn.uuid, JSON.stringify({ type: 'DRAW_EOL' }));
            }
            // 캔버스 배경이미지 공유
            if (this.p5voidDraw['BaseImage']) {
              this.p5voidDraw['BaseImage'].loadPixels();
              let base64 = this.p5voidDraw['BaseImage'].canvas.toDataURL("image/jpeg", .1);
              let part = base64.match(/(.{1,80})/g);
              for (let i = 0, j = part.length; i < j; i++) {
                this.toolServer.send_to('voidDraw', conn.uuid, JSON.stringify({
                  type: 'IMAGE_PART',
                  part: part[i],
                }));
                await this.waiting(0);
              }
              this.toolServer.send_to('voidDraw', conn.uuid, JSON.stringify({ type: 'IMAGE_EOL' }));
            }
            break;
          default: // 나머지 정보들은 자신을 제외한 사람들에게 릴레이처리
            for (let i = 0, j = this.toolServer.list['voidDraw']['users'].length; i < j; i++)
              if (this.toolServer.list['voidDraw']['users'][i] != conn.uuid)
                this.toolServer.send_to('voidDraw', this.toolServer.list['voidDraw']['users'][i],
                  JSON.stringify(json));
            break;
        }
      }, (_conn) => {
        // onDisconnect
      });
    this.RemoveShortCut();
    this.VoidDrawServer.present();
  }
  waiting(millis: number) {
    return new Promise((done) => setTimeout(() => {
      done(undefined);
    }, millis))
  }
  isCropMode = false;
  create_p5voidDraw(initData: any) {
    let targetDiv = document.getElementById('voidDraw');
    this.isCropMode = false;
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
      let SetBrushSize = p.min(initData['width'], initData['heigth']);
      let strokeWeight = SetBrushSize / 100;
      const PIXEL_DENSITY = 1;
      p.setup = async () => {
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
          this.alertCtrl.create({
            header: this.lang.text['voidDraw']['changeWeight'],
            inputs: [{
              label: this.lang.text['voidDraw']['weight'],
              name: 'weight',
              placeholder: `${strokeWeight}`,
              type: 'number',
            }],
            buttons: [{
              text: this.lang.text['voidDraw']['apply'],
              handler: (ev: any) => {
                if (ev['weight'])
                  strokeWeight = Number(ev['weight']);
              }
            }]
          }).then(v => v.present());
        }
        p['change_color'] = () => {
          p5ColorPicker.elt.click();
        }
        p['save_image'] = () => {
          new p5((sp: p5) => {
            sp.setup = () => {
              sp.createCanvas(ActualCanvas.width, ActualCanvas.height);
              sp.pixelDensity(PIXEL_DENSITY);
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
          HistoryPointer = p.min(p.max(0, HistoryPointer + direction), p['DrawingStack'].length);
          switch (direction) {
            case 1: // Redo
              UndoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer == p['DrawingStack'].length)
                RedoButton.style.fill = 'var(--ion-color-medium)';
              updateDrawingCurve(ActualCanvas, p['DrawingStack'][HistoryPointer - 1]);
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
          let BeforeResize = p.createVector(ActualCanvas.width, ActualCanvas.height);
          ActualCanvas.resizeCanvas(CropSize.x, CropSize.y);
          CropPosition.sub(CropModePosition);
          CropPosition.add(BeforeResize.sub(CropSize).div(2));
          updateActualCanvas();
          ImageCanvas.resizeCanvas(CropSize.x, CropSize.y);
          ImageCanvas.push();
          ImageCanvas.background(255);
          ImageCanvas.translate(CropPosition);
          if (p['BaseImage'])
            ImageCanvas.image(p['BaseImage'], 0, 0);
          ImageCanvas.pop();
          ImageCanvas.redraw();
          this.isCropMode = false;
          p['SetCanvasViewportInit']();
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
        // let QRCell = top_row.insertCell(1); // 공유 그림판 온
        // QRCell.innerHTML = `<ion-icon color="dark" style="width: 27px; height: 27px" name="wifi-outline"></ion-icon>`;
        // QRCell.style.textAlign = 'center';
        // QRCell.style.cursor = 'pointer';
        // QRCell.onclick = () => {
        //   this.StartSharedDraw();
        // }
        let CropCell = top_row.insertCell(1); // Crop
        CropCell.innerHTML = `<ion-icon id="CropToolIcon" style="width: 27px; height: 27px" name="crop"></ion-icon>`;
        if (!this.isCropable)
          document.getElementById('CropToolIcon').style.fill = 'var(--ion-color-medium)';
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
        // ColorCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="color-palette"></ion-icon>`;
        p5ColorPicker.parent(ColorCell);
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
        // 해당 사용자의 모든 선 다시 그리기
        p['UpdateRemoteDraw'] = (uuid: string, pointer: number) => {
          console.log(this.SharedDraw);
          console.log('UpdateRemoteDraw: ', uuid, '/', pointer);
        }
        // 해당 사용자의 특정 선 정보를 그리기
        p['UpdateRemoteDrawLine'] = (uuid: string, DrawInfo: any) => {
          console.log('UpdateRemoteDrawLine: ', uuid, '/', DrawInfo);
          this.SharedDraw[uuid].push(DrawInfo);
        }
        ActualCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
        ActualCanvas.pixelDensity(PIXEL_DENSITY);
        ActualCanvas.noLoop();
        ActualCanvas.noFill();
        p['ActualCanvas'] = ActualCanvas;
        ImageCanvas = p.createGraphics(initData.width, initData.height, p.WEBGL);
        ImageCanvas.pixelDensity(PIXEL_DENSITY);
        ImageCanvas.noLoop();
        ImageCanvas.noFill();
        ImageCanvas.background(255);
        ImageCanvas.imageMode(p.CENTER);
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
          });
        } else {
          ImageCanvas.redraw();
          p['SetCanvasViewportInit']();
        }
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
        if (ImageCanvas)
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
              p.curveVertex(CurrentDraw['pos'][i].x, CurrentDraw['pos'][i].y);
            p.endShape();
            p.pop();
          }
        }
        if (this.UserWS) { // 공유 그림판 상태라면
          let keys = Object.keys(this.SharedCurrentDraw);
          p.push();
          p.translate(CropPosition);
          for (let i = 0, j = keys.length; i < j; i++) {
            p.stroke(this.SharedCurrentDraw[keys[i]]['color']);
            p.strokeWeight(this.SharedCurrentDraw[keys[i]]['weight']);
            p.beginShape();
            for (let k = 0, l = this.SharedCurrentDraw[keys[i]]['pos'].length; k < l; k++)
              p.curveVertex(this.SharedCurrentDraw[keys[i]]['pos'][k].x, this.SharedCurrentDraw[keys[i]]['pos'][k].y);
            p.endShape();
          }
          p.pop();
        }
        p.pop();
      }
      p['DrawingStack'] = [];
      /** 선을 어디까지 그리는지, 히스토리 행동용 */
      let HistoryPointer = 0;
      /** 전체 그리기, 동작 취소 등 전체 업데이트가 필요할 때 사용 */
      let updateActualCanvas = () => {
        ActualCanvas.background(255, 0);
        // 모든 그리기 행동 시도
        for (let i = 0; i < HistoryPointer; i++)
          updateDrawingCurve(ActualCanvas, p['DrawingStack'][i]);
      }
      /** 마지막 행동에 해당하는 선 전체 그리기 */
      let updateDrawingCurve = (TargetCanvas: p5.Graphics, targetDraw = CurrentDraw) => {
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
        let targetDist = p.max(ActualCanvas.width, ActualCanvas.height) * .2;
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
        let _pos = { x: pos.x, y: pos.y };
        let color = p5ColorPicker['color']().levels;
        let color_hex = `#${p.hex(color[0], 2)}${p.hex(color[1], 2)}${p.hex(color[2], 2)}`;
        if (this.UserWS) {
          let json = {
            type: 'CurrentDrawStart',
            pos: [],
            color: color_hex,
            weight: strokeWeight,
            uuid: this.uuidSelf,
          }
          json['pos'].push(_pos);
          json['pos'].push(_pos);
          this.UserWS.send(JSON.stringify(json));
        }
        CurrentDraw = {
          pos: [],
          color: color_hex,
          weight: strokeWeight,
        };
        CurrentDraw['pos'].push(_pos);
        CurrentDraw['pos'].push(_pos);
        p.redraw();
      }
      p.mouseDragged = (ev: any) => {
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
              let _pos = { x: pos.x, y: pos.y };
              if (this.UserWS) {
                let json = {
                  type: 'CurrentDrawing',
                  pos: _pos,
                  uuid: this.uuidSelf,
                }
                ShareDrawing(json);
              }
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
            if (this.isCropMode) {
            } else if (!isClickOnMenu) {
              let pos = MappingPosition();
              pos.sub(CropPosition);
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
      let AllowSend = true;
      /** 지연 동기화처리 */
      let ShareDrawing = (json: any) => {
        if (AllowSend) {
          this.UserWS.send(JSON.stringify(json));
          AllowSend = false;
          setTimeout(() => {
            AllowSend = true;
          }, 100);
        }
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
        if (!isTouching) return;
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
              let _pos = { x: pos.x, y: pos.y };
              if (this.UserWS) {
                let json = {
                  type: 'CurrentDrawing',
                  pos: _pos,
                  uuid: this.uuidSelf,
                }
                ShareDrawing(json);
              }
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
      /** 그리기 종료시 해당 선 전체 정보 공유 */
      let SharedDrawingEnd = async () => {
        let copied = JSON.stringify(CurrentDraw);
        let part = copied.match(/(.{1,80})/g);
        for (let i = 0, j = part.length; i < j; i++) {
          let json = {
            type: 'CurrentDrawEndPart',
            uuid: this.uuidSelf,
            part: part[i],
          }
          this.UserWS.send(JSON.stringify(json));
          await this.waiting(0);
        }
        let json = {
          type: 'CurrentDrawEndPartEOL',
          uuid: this.uuidSelf,
        }
        this.UserWS.send(JSON.stringify(json));
      }
      p.touchEnded = (ev: any) => {
        if (!ev['changedTouches']) return;
        touches = ev['touches'];
        isTouching = false;
        switch (touches.length) {
          case 0: // 모든 행동 종료
            if (this.isCropMode) {
            } else if (!isClickOnMenu) {
              if (CurrentDraw) {
                let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - BUTTON_HEIGHT);
                pos.sub(CropPosition);
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
        if (this.UserWS)
          SharedDrawingEnd();
        CurrentDraw = undefined;
        p.redraw();
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

  /** 원격 참여자 Crop 행동 제한 */
  isCropable = true;
  open_crop_tool() {
    if (this.isCropable)
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

  RemoveShortCut() {
    delete this.global.p5key['KeyShortCut']['HistoryAct'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    delete this.global.p5key['KeyShortCut']['DeleteAct'];
    delete this.global.p5key['KeyShortCut']['SKeyAct'];
    delete this.global.p5key['KeyShortCut']['FKeyAct'];
  }

  ionViewWillLeave() {
    this.toolServer.stop('voidDraw');
    this.RemoveShortCut();
    if (this.p5voidDraw) this.p5voidDraw.remove();
  }

  WithoutSave = true;
  ionViewDidLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
    if (this.WithoutSave)
      this.mainLoading.remove();
  }
}

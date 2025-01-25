import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonSelect, LoadingController, NavController } from '@ionic/angular';
import * as p5 from 'p5';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { WebrtcService } from 'src/app/webrtc.service';
import { ActivatedRoute, Router } from '@angular/router';
import { IonModal } from '@ionic/angular/common';
import { P5LoadingService } from 'src/app/p5-loading.service';

@Component({
  selector: 'app-void-draw',
  templateUrl: './void-draw.page.html',
  styleUrls: ['./void-draw.page.scss'],
})
export class VoidDrawPage implements OnInit, OnDestroy {

  constructor(
    public lang: LanguageSettingService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    public global: GlobalActService,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private p5toast: P5ToastService,
    private webrtc: WebrtcService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private p5loading: P5LoadingService,
  ) { }
  ngOnDestroy(): void {
    this.route.queryParams['unsubscribe']();
    if (this.global.PageDismissAct[this.navParams.dismiss])
      this.global.PageDismissAct[this.navParams.dismiss]({});
    if (this.p5ActualCanvas) {
      this.p5ActualCanvas.remove();
      this.p5ActualCanvas = null;
    }
    if (!this.AlreadyExistServer && this.TargetRemoteAddress)
      this.nakama.RemoveWebRTCServer(this.TargetRemoteAddress.split('://').pop());
    if (this.p5ImageCanvas) {
      this.p5ImageCanvas.remove();
      this.p5ImageCanvas = null;
    }
    if (this.p5voidDraw) this.p5voidDraw.remove();
    if (this.IceWebRTCWsClient) {
      this.IceWebRTCWsClient.close(1000, 'close ');
      this.CancelRemoteAct();
    }
    this.AddrQRShare.dismiss();
    this.ChangeTransparent.dismiss();
    this.ChangeResolution.dismiss();
  }

  PageId = 'voiddraw';

  /** 페이지 진입 후 페이지가 준비되었을 때 행동시키기 */
  QueueAfterLoad: Function;
  navParams: any;
  ngOnInit() {
    this.PageId = `voiddraw_${Date.now()}`;
    this.route.queryParams.subscribe(async _p => {
      try {
        const navParams = this.router.getCurrentNavigation().extras.state;
        if (!navParams) throw '페이지 복귀';
        this.navParams = navParams || {};
        this.voidDrawId = `voidDraw_${Date.now()}`;
        this.QueueAfterLoad = () => {
          this.create_new_canvas({
            width: navParams.width,
            height: navParams.height,
            path: navParams.path,
            type: navParams.type,
          });
          if (navParams.remote)
            setTimeout(() => {
              this.Port = navParams.remote.port;
              this.username = navParams.remote.username;
              this.password = navParams.remote.password;
              this.CreateRemoteLocalClient(navParams.remote.address, navParams.remote.channel);
            }, 1000);
        }
      } catch (e) {
        console.log('그림판 정보 받지 못함: ', e);
        this.p5SetDrawable(true);
      }
    });
    this.ToggleAutoResolution = Boolean(localStorage.getItem('voiddraw_autoRes'));
  }

  voidDrawId = 'voidDraw';
  ionViewWillEnter() {
    this.WillLeaveHere = false;
    this.global.portalHint = false;
    this.QueueAfterLoad?.();
    this.p5SetCanvasViewportInit?.();
    this.QueueAfterLoad = null;
    this.p5SetDrawable?.(true);
  }

  async ionViewDidEnter() {
    this.global.StoreShortCutAct('void-draw')
    this.AddShortCut();
    await this.p5loading.update({
      id: this.PageId,
      message: this.lang.text['voidDraw']['UseThisImage'],
      forceEnd: null,
    }, true);
    // 다른 페이지에서 진입하는 경우가 있으므로 remove가 분리되어있어야함
    this.p5loading.remove(this.PageId);
  }

  AddShortCut() {
    delete this.global.p5KeyShortCut['Digit'];
    this.global.p5KeyShortCut['HistoryAct'] = (ev: any) => {
      let key = ev['code'].slice(-1);
      switch (key) {
        case 'Z':
          this.p5history_act(-1);
          break;
        case 'X':
          this.p5history_act(1);
          break;
        case 'C':
          if (ev['shiftKey'])
            this.p5change_color();
          else this.p5change_color_detail();
          break;
      }
    }
    this.global.p5KeyShortCut['AddAct'] = () => {
      this.ClickRemoteAddButton();
    }
    this.global.p5KeyShortCut['SKeyAct'] = (ev: any) => {
      if (ev['shiftKey']) {
        this.open_crop_tool_contextmenu();
      } else this.p5open_crop_tool();
    }
    this.global.p5KeyShortCut['DeleteAct'] = () => {
      if (this.isCropMode) {
        this.p5apply_crop();
      } else this.dismiss_draw();
    }
    this.global.p5KeyShortCut['FKeyAct'] = () => {
      this.ToggleFocusMode();
    }
    this.global.p5KeyShortCut['Escape'] = () => {
      if (this.isDrawServerCreated)
        this.CancelRemoteAct();
      else this.navCtrl.pop();
    }
  }

  /** 원격과 관련된 행동 취소시 사용 */
  CancelRemoteAct() {
    if (this.ReadyToShareAct) {
      this.ReadyToShareAct = false;
      if (this.RemoteLoadingCtrl) this.RemoteLoadingCtrl.dismiss();
      this.isDrawServerCreated = false;
      this.p5SetDrawable(true);
      this.webrtc.close_webrtc(this.PageId);
      this.dismiss_draw(true);
    }
  }

  /** 새 캔버스 생성 행동 분리 */
  create_new_canvas(inputInfo?: any) {
    inputInfo['width'] = inputInfo['width'] || 432;
    inputInfo['height'] = inputInfo['height'] || 432;
    if (this.p5ActualCanvas) {
      this.p5ActualCanvas.remove();
      this.p5ActualCanvas = null;
    }
    if (this.p5ImageCanvas) {
      this.p5ImageCanvas.remove();
      this.p5ImageCanvas = null;
    }
    if (this.p5voidDraw) this.p5voidDraw.remove();
    this.create_p5voidDraw(inputInfo);
  }

  p5voidDraw: p5;
  /** 선의 시작 굵기 지정 */
  LineDefaultWeight: number;
  /** 투명도 값을 각각 관리하기 */
  LineDefaultTransparent: number;
  /** 빠른 색상 선택시 사용하는 두께 */
  LineQuickWeight: number;
  /** 빠른 색상 선택시 기본 투명도 */
  LineQuickTransparent: number;
  /** 그냥 붓 설정을 변경할 때, 현재 그리기 두께 */
  ChangeDefaultLineWeight: Function;
  /** 그냥 붓의 투명도를 조정할 때 */
  ChangeDefaultLineTransparent: Function;
  /** 빠른 색상 선택시 사용하게 될 두께 */
  ChangeQuickLineColor: Function;
  /** 빠른 색 선택시 투명도를 조절할 때 */
  ChangeQuickTransparent: Function;
  p5change_color: Function;
  p5change_color_detail: Function;
  p5save_image: Function;
  p5history_act: Function;
  p5DrawingStack: any[] = [];
  p5open_crop_tool: Function;
  p5apply_crop: Function;
  p5BaseImage: p5.Image;
  p5SetCanvasViewportInit: Function;
  p5SetDrawable: Function;
  p5ActualCanvas: p5.Graphics;
  p5ImageCanvas: p5.Graphics;
  p5getCropPos: Function;
  p5setCropPos: Function;
  p5getCropSize: Function;
  p5setCropSize: Function;
  p5RemoteDrawStart: Function;
  p5RemoteDrawing: Function;
  p5RemoteDrawingEnd: Function;
  p5updateRemoteCurve: Function;
  p5CancelCurrentDraw: Function;
  p5ClearCurrentDraw: Function;

  // 색상 상세 조정용
  colorPickRed = 0;
  colorPickGreen = 0;
  colorPickBlue = 0;
  colorPickAlpha = 255;
  ColorSliderUpdate: Function;
  CheckIfDismissAct(ev: any) {
    switch (ev.target.id) {
      case 'RemoteDrawQR':
        this.AddrQRShare.dismiss();
        break;
      case 'colordetailOuter':
        this.ChangeTransparent.dismiss();
        break;
      case 'resolutiondetailOuter':
        this.ChangeResolution.dismiss();
        break;
    }
  }

  saveContextmenu() {
    this.p5save_image(true);
    return false;
  }
  QRCode: any;
  isCropMode = false;
  @ViewChild('RemoteDraw') RemoteDraw: IonSelect;
  @ViewChild('ChangeTransparent') ChangeTransparent: IonModal;
  create_p5voidDraw(initData: any) {
    let targetDiv = document.getElementById(this.voidDrawId);
    this.isCropMode = false;
    this.p5voidDraw = new p5((p: p5) => {
      /** 스케일 조정 편의를 위해 모든게 여기서 작업됨 */
      let ActualCanvas: p5.Graphics;
      let ActualCanvasSizeHalf: p5.Vector;
      /** 배경이미지 캔버스, 복구 불가능한 이전 기록이 이곳에 같이 누적됨 */
      let ImageCanvas: p5.Graphics;
      let DrawBeforeCanvas: p5.Graphics;
      let DrawBeforeBaked: p5.Image;
      let TopMenu: p5.Element;
      let BottomMenu: p5.Element;
      /** 되돌리기류 행동이 상황에 따라 동작하지 않음을 UI로 표시해야함 */
      let UndoButton: any;
      let RedoButton: any;
      /** 임시방편 색상 선택기 */
      let p5ColorPicker = p.createColorPicker('#000');
      let strokeWeight = Math.min(initData['width'], initData['height']) / 100;
      let strokeRatio: number;
      let change_checkmark: Function;
      /** 기본 붓을 사용하는지, 빠른 붓을 사용하는지 추적: true 일 때 기본 붓 */
      let isDefaultSet = true;
      /** 붓질 기록 최대 길이 제한 */
      const MAX_HISTORY_LEN = 20;
      const PIXEL_DENSITY = 1;
      /** 빠른 붓 설정이 변경되면 즉시 적용도 시킴 */
      const QuickChangeAct = () => {
        if (isDefaultSet) return;
        this.colorPickAlpha = this.LineQuickTransparent;
        strokeRatio = Number(this.LineQuickWeight) || 1;
      }
      let canvas: p5.Renderer;
      p.setup = async () => {
        const DefaultStrokeWeight = localStorage.getItem('voiddraw-lineweight') || 1;
        strokeRatio = Number(DefaultStrokeWeight);
        this.LineDefaultWeight = Number(DefaultStrokeWeight);
        this.LineDefaultTransparent = Number(localStorage.getItem('voiddraw-transparent') || 255);
        this.colorPickAlpha = this.LineDefaultTransparent;
        this.LineQuickWeight = Number(localStorage.getItem('voiddraw-quick-lineweight') || 1);
        this.LineQuickTransparent = Number(localStorage.getItem('voiddraw-quick-transparent') || 138);
        p5ColorPicker.style('position', 'absolute');
        p.pixelDensity(PIXEL_DENSITY);
        p.noLoop();
        p.noFill();
        p.imageMode(p.CENTER);
        canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        canvas.parent(targetDiv);
        CamPosition.x = p.width / 2;
        CamPosition.y = p.height / 2;
        this.ChangeDefaultLineWeight = () => {
          strokeRatio = Number(this.LineDefaultWeight) || 1;
          localStorage.setItem('voiddraw-lineweight', `${this.LineDefaultWeight || 1}`);
        }
        this.ChangeDefaultLineTransparent = () => {
          localStorage.setItem('voiddraw-transparent', `${this.LineDefaultTransparent || 255}`);
          this.ColorSliderUpdate();
        }
        this.ChangeQuickLineColor = () => {
          localStorage.setItem('voiddraw-quick-lineweight', `${this.LineQuickWeight || 1}`);
          QuickChangeAct();
        }
        this.ChangeQuickTransparent = () => {
          this.colorPickAlpha = this.LineQuickTransparent;
          localStorage.setItem('voiddraw-quick-transparent', `${this.LineQuickTransparent || 138}`);
          QuickChangeAct();
        }
        let OnClickDetector = true;
        this.p5change_color = () => {
          isDefaultSet = false;
          OnClickDetector = false;
          p5ColorPicker.elt.click();
        }
        this.p5change_color_detail = () => {
          if (!OnClickDetector) {
            OnClickDetector = true;
            return;
          }
          this.ChangeTransparent.onDidDismiss().then(() => {
            Drawable = true;
            isClickOnMenu = false;
            this.global.RestoreShortCutAct('draw-transparent');
          });
          Drawable = false;
          this.global.StoreShortCutAct('draw-transparent');
          this.global.p5KeyShortCut['EnterAct'] = () => {
            if (document.activeElement == document.getElementById('voiddraw_default_weight'))
              this.ChangeTransparent.dismiss();
          }
          this.ChangeTransparent.present();
          OnClickDetector = true;
        }
        this.p5save_image = (only_save = false, for_clipboard = false) => {
          new p5((sp: p5) => {
            sp.setup = () => {
              let canvas = sp.createCanvas(this.resolutionEffectedWidth, this.resolutionEffectedHeight);
              sp.pixelDensity(PIXEL_DENSITY);
              if (ImageCanvas && ImageCanvas.elt)
                sp.image(ImageCanvas, 0, 0, this.resolutionEffectedWidth, this.resolutionEffectedHeight);
              if (DrawBeforeCanvas)
                sp.image(DrawBeforeCanvas, 0, 0, this.resolutionEffectedWidth, this.resolutionEffectedHeight);
              if (ActualCanvas && ActualCanvas.elt)
                sp.image(ActualCanvas, 0, 0, this.resolutionEffectedWidth, this.resolutionEffectedHeight);
              const base64 = canvas['elt']['toDataURL']("image/png").replace("image/png", "image/octet-stream");
              const tmp_filename = `voidDraw_${sp.year()}-${sp.nf(sp.month(), 2)}-${sp.nf(sp.day(), 2)}_${sp.nf(sp.hour(), 2)}-${sp.nf(sp.minute(), 2)}-${sp.nf(sp.second(), 2)}.png`;
              const blob = this.global.Base64ToBlob(base64, 'image/png');
              let showToast = async () => {
                const FileURL = URL.createObjectURL(blob);
                await this.p5loading.update({
                  id: this.PageId,
                  image: FileURL,
                  forceEnd: 1000,
                });
                setTimeout(() => {
                  URL.revokeObjectURL(FileURL);
                }, 100);
              }
              showToast();
              // 결과물을 클립보드에 저장하기
              if (for_clipboard) {
                this.global.WriteValueToClipboard('image/png', blob, 'image.png', this.PageId)
                  .catch(_e => {
                    // 아케이드에서 원격 연결 후 벗어날 때 오류발생, 무시 가능함
                  });
                return;
              }
              // 다른 환경과 연대하여 결과물을 돌려줌
              if (!only_save) {
                if (this.navParams.dismiss && this.global.PageDismissAct[this.navParams.dismiss])
                  this.global.PageDismissAct[this.navParams.dismiss]({
                    data: {
                      name: tmp_filename,
                      img: base64,
                      loadingCtrl: this.PageId,
                    }
                  });
                this.navCtrl.pop();
              } else {
                // 그냥 지금 그림 저장하기
                this.p5loading.toast(`${this.lang.text['ContentViewer']['DownloadThisFile']}: ${tmp_filename}`, this.PageId);
                let link = sp.createA(base64, null);
                link.elt.download = tmp_filename;
                link.hide();
                link.parent(targetDiv);
                link.elt.click();
              }
              sp.remove();
            }
          });
        }
        this.p5history_act = (direction: number, fromRemote = false) => {
          let preCalced = HistoryPointer + direction;
          if (preCalced > this.p5DrawingStack.length) return;
          HistoryPointer = p.min(p.max(0, preCalced), this.p5DrawingStack.length);
          switch (direction) {
            case 1: // Redo
              if (this.p5DrawingStack.length)
                UndoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer == this.p5DrawingStack.length)
                RedoButton.style.fill = 'var(--ion-color-medium)';
              updateDrawingCurve(ActualCanvas, this.p5DrawingStack[HistoryPointer - 1]);
              break;
            case -1: // Undo
              if (this.p5DrawingStack.length)
                RedoButton.style.fill = 'var(--ion-color-dark)';
              if (HistoryPointer < 1) {
                UndoButton.style.fill = 'var(--ion-color-medium)';
                ActualCanvas.clear(255, 255, 255, 255);
                p.redraw();
              } else updateActualCanvas();
              break;
          }
          if (!fromRemote && this.ReadyToShareAct)
            this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
              type: 'same',
              act: 'history_act',
              data: direction,
            }));
        }
        this.p5open_crop_tool = () => {
          if (this.isCropMode) { // 취소 행동으로 간주
            this.isCropMode = false;
            p.redraw();
          } else {
            this.isCropMode = true;
            Drawable = true;
            CropSize.x = ActualCanvas.width;
            CropSize.y = ActualCanvas.height;
            CropModePosition.x = 0;
            CropModePosition.y = 0;
            p.redraw();
          }
          change_checkmark();
          isClickOnMenu = false;
        }
        if (this.ToggleAutoResolution) this.resolutionRatio = p.min(100, CamScale * 100);
        this.resolutionEffectedWidth = p.floor(initData.width * this.resolutionRatio / 100);
        this.resolutionEffectedHeight = p.floor(initData.height * this.resolutionRatio / 100);
        this.open_crop_tool_contextmenu = () => {
          this.ChangeResolution.onDidDismiss().then(() => {
            Drawable = true;
            isClickOnMenu = false;
            this.global.RestoreShortCutAct('resolution-detail');
          });
          Drawable = false;
          this.global.StoreShortCutAct('resolution-detail');
          this.global.p5KeyShortCut['EnterAct'] = () => {
            if (document.activeElement == document.getElementById('voiddraw_resolution'))
              this.ChangeResolution.dismiss();
          }
          this.ChangeResolution.present();
        }
        this.UserToggleAutoResolution = (own = true) => {
          if (this.ToggleAutoResolution) {
            localStorage.setItem('voiddraw_autoRes', `1`);
            this.p5SetCanvasViewportInit();
          } else localStorage.removeItem('voiddraw_autoRes');
          if (this.ReadyToShareAct && own)
            this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
              type: 'res_tog',
              data: this.ToggleAutoResolution,
            }));
        }
        this.ResolutionSliderUpdate = (own = true) => {
          p.pixelDensity(p.min(1, PIXEL_DENSITY * (Number(this.resolutionRatio) || 1) / 100 / CamScale));
          p.redraw();
          this.resolutionEffectedWidth = p.floor(ActualCanvas.width * (Number(this.resolutionRatio) || 1) / 100);
          this.resolutionEffectedHeight = p.floor(ActualCanvas.height * (Number(this.resolutionRatio) || 1) / 100);
          if (this.ReadyToShareAct && own)
            this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
              type: 'res_slider',
              data: this.resolutionRatio,
            }));
        }
        this.p5apply_crop = (is_host = true) => {
          ActualCanvas.resizeCanvas(CropSize.x, CropSize.y);
          ActualCanvasSizeHalf = p.createVector(ActualCanvas.width / 2, ActualCanvas.height / 2);
          if (is_host) CropPosition.sub(CropModePosition);
          updateActualCanvas();
          ImageCanvas.resizeCanvas(CropSize.x, CropSize.y);
          ImageCanvas.push();
          ImageCanvas.background(this.navParams.isDarkMode ? 26 : 255);
          ImageCanvas.translate(CropPosition);
          if (this.p5BaseImage)
            ImageCanvas.image(this.p5BaseImage, 0, 0);
          ImageCanvas.pop();
          ImageCanvas.redraw();
          DrawBeforeCanvas.resizeCanvas(CropSize.x, CropSize.y);
          DrawBeforeCanvas.push();
          if (DrawBeforeBaked) {
            DrawBeforeCanvas.translate(CropPosition);
            DrawBeforeCanvas.image(DrawBeforeBaked, BakedPosition.x, BakedPosition.y);
          }
          DrawBeforeCanvas.pop();
          DrawBeforeCanvas.redraw();
          let base64 = DrawBeforeCanvas.elt.toDataURL('image/png');
          p.loadImage(base64, v => {
            BakedPosition.x = -CropPosition.x;
            BakedPosition.y = -CropPosition.y;
            DrawBeforeBaked = v;
          });
          this.isCropMode = false;
          change_checkmark();
          if (this.ToggleAutoResolution) this.resolutionRatio = p.min(100, CamScale * 100);
          this.resolutionEffectedWidth = p.floor(CropSize.x * this.resolutionRatio / 100);
          this.resolutionEffectedHeight = p.floor(CropSize.y * this.resolutionRatio / 100);
          this.p5SetCanvasViewportInit();
          if (is_host && this.ReadyToShareAct) {
            let crop_pos = this.p5getCropPos();
            let crop_size = this.p5getCropSize();
            this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
              type: 'draw',
              act: 'crop',
              cropPX: crop_pos.x,
              cropPY: crop_pos.y,
              cropSX: crop_size.x,
              cropSY: crop_size.y,
            }));
          }
        }
        this.p5SetDrawable = SetDrawable;
        /** 상하단 메뉴 생성 */
        TopMenu = p.createElement('table');
        TopMenu.style('position: absolute; top: 0px;');
        TopMenu.style(`width: 100%; height: ${this.BUTTON_HEIGHT}px;`);
        TopMenu.style('background-color: var(--voidDraw-menu-background);')
        TopMenu.parent(targetDiv);
        this.p5MenuTable.push(TopMenu);
        let top_row = TopMenu.elt.insertRow(0); // 상단 메뉴
        let AddTextCell = top_row.insertCell(0); // 추가
        if (this.global.ShowHint)
          AddTextCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">A</div><ion-icon style="width: 27px; height: 27px" name="wifi-outline"></ion-icon></div>`;
        else AddTextCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="wifi-outline"></ion-icon>`;
        AddTextCell.style.textAlign = 'center';
        AddTextCell.style.cursor = 'pointer';
        AddTextCell.onclick = () => {
          this.ClickRemoteAddButton();
        } // 동작 준비중 // A 단축키 기능 재연결과 new_image() 삭제
        let CropCell = top_row.insertCell(1); // Crop
        if (this.global.ShowHint)
          CropCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">S</div><ion-icon style="width: 27px; height: 27px" name="crop"></ion-icon></div>`;
        else CropCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="crop"></ion-icon>`;
        CropCell.style.textAlign = 'center';
        CropCell.style.cursor = 'pointer';
        CropCell.onclick = () => { this.p5open_crop_tool() }
        CropCell.oncontextmenu = () => { this.open_crop_tool_contextmenu() }
        let ApplyCell = top_row.insertCell(2);
        if (this.global.ShowHint)
          ApplyCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">D</div><ion-icon style="width: 27px; height: 27px" name="checkmark"></ion-icon></div>`;
        else ApplyCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="checkmark"></ion-icon>`;
        ApplyCell.style.textAlign = 'center';
        ApplyCell.style.cursor = 'pointer';
        ApplyCell.onclick = () => { this.dismiss_draw() }
        change_checkmark = () => {
          if (this.isCropMode) {
            if (this.global.ShowHint)
              ApplyCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">D</div><ion-icon style="width: 27px; height: 27px" name="cut-sharp"></ion-icon></div>`;
            else ApplyCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="cut-sharp"></ion-icon>`;
          } else {
            if (this.global.ShowHint)
              ApplyCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">D</div><ion-icon style="width: 27px; height: 27px" name="checkmark"></ion-icon></div>`;
            else ApplyCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="checkmark"></ion-icon>`;
          }
        }
        BottomMenu = p.createElement('table');
        BottomMenu.style('position: absolute; bottom: 0px;');
        BottomMenu.style(`width: 100%; height: ${this.BUTTON_HEIGHT}px;`);
        BottomMenu.style('background-color: var(--voidDraw-menu-background);')
        BottomMenu.parent(targetDiv);
        this.p5MenuTable.push(BottomMenu);
        let bottom_row = BottomMenu.elt.insertRow(0); // 하단 메뉴
        let UndoCell = bottom_row.insertCell(0); // Undo
        if (this.global.ShowHint)
          UndoCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">Z</div><ion-icon id="undoIcon" style="width: 27px; height: 27px" name="arrow-undo"></ion-icon></div>`;
        else UndoCell.innerHTML = `<ion-icon id="undoIcon" style="width: 27px; height: 27px" name="arrow-undo"></ion-icon>`;
        UndoButton = document.getElementById('undoIcon');
        UndoButton.style.fill = 'var(--ion-color-medium)';
        UndoCell.style.textAlign = 'center';
        UndoCell.style.cursor = 'pointer';
        UndoCell.onclick = () => { this.p5history_act(-1); }
        let RedoCell = bottom_row.insertCell(1); // Redo
        if (this.global.ShowHint)
          RedoCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">X</div><ion-icon id="redoIcon" style="width: 27px; height: 27px" name="arrow-redo"></ion-icon></div>`;
        else RedoCell.innerHTML = `<ion-icon id="redoIcon" style="width: 27px; height: 27px" name="arrow-redo"></ion-icon>`;
        RedoButton = document.getElementById('redoIcon');
        RedoButton.style.fill = 'var(--ion-color-medium)';
        RedoCell.style.textAlign = 'center';
        RedoCell.style.cursor = 'pointer';
        RedoCell.onclick = () => { this.p5history_act(1); }
        let ColorCell = bottom_row.insertCell(2); // 선 색상 변경
        if (this.global.ShowHint)
          ColorCell.innerHTML = `<div><div class="shortcut_hint shortcut_voiddraw">C</div><ion-icon style="width: 27px; height: 27px" name="brush"></ion-icon></div>`;
        else ColorCell.innerHTML = `<ion-icon style="width: 27px; height: 27px" name="brush"></ion-icon>`;
        p5ColorPicker.style('width: 0px; height: 0px; opacity: 0;');
        p5ColorPicker.hide();
        p5ColorPicker.parent(ColorCell);
        p5ColorPicker.elt.oninput = () => {
          strokeRatio = Number(this.LineQuickWeight) || Number(this.LineDefaultWeight) || 1;
          let color = p5ColorPicker['color']().levels;
          let color_hex = `#${p.hex(color[0], 2)}${p.hex(color[1], 2)}${p.hex(color[2], 2)}`;
          ColorCell.childNodes[0].style.color = color_hex;
          this.colorPickRed = color[0];
          this.colorPickGreen = color[1];
          this.colorPickBlue = color[2];
          this.colorPickAlpha = this.LineQuickTransparent;
        }
        if (initData['path']) {
          p5ColorPicker.value('#ff0000');
          p5ColorPicker.elt.oninput();
        }
        ColorCell.style.textAlign = 'center';
        ColorCell.style.cursor = 'pointer';
        ColorCell.onclick = () => {
          this.p5change_color_detail();
        }
        ColorCell.oncontextmenu = () => {
          this.p5change_color();
          QuickChangeAct();
          return false;
        }
        this.ColorSliderUpdate = () => {
          isDefaultSet = true;
          this.colorPickAlpha = this.LineDefaultTransparent;
          strokeRatio = Number(this.LineDefaultWeight) || 1;
          let color_hex = `#${p.hex((Number(this.colorPickRed) || 0), 2)}${p.hex((Number(this.colorPickGreen) || 0), 2)}${p.hex((Number(this.colorPickBlue) || 0), 2)}`;
          p5ColorPicker.value(color_hex);
          let color_hex_with_alpha = `#${p.hex((Number(this.colorPickRed) || 0), 2)}${p.hex((Number(this.colorPickGreen) || 0), 2)}${p.hex((Number(this.colorPickBlue) || 0), 2)}`;
          ColorCell.childNodes[0].style.color = color_hex_with_alpha;
        }
        this.ColorSliderUpdate();
        this.p5SetCanvasViewportInit = () => {
          p.resizeCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
          StartCamPos = CamPosition.copy();
          StartCamScale = CamScale;
          StartScaleCenter = ScaleCenter.copy();
          ReinitLerp = 0;
          PlayReinitViewport = true;
          p.loop();
        }
        ActualCanvas = p.createGraphics(initData.width, initData.height);
        ActualCanvasSizeHalf = p.createVector(ActualCanvas.width / 2, ActualCanvas.height / 2);
        ActualCanvas.pixelDensity(PIXEL_DENSITY);
        ActualCanvas.noLoop();
        ActualCanvas.noFill();
        this.p5ActualCanvas = ActualCanvas;
        ImageCanvas = p.createGraphics(initData.width, initData.height);
        ImageCanvas.pixelDensity(PIXEL_DENSITY);
        ImageCanvas.noLoop();
        ImageCanvas.noFill();
        ImageCanvas.background(this.navParams.isDarkMode ? 26 : 255);
        this.p5ImageCanvas = ImageCanvas;
        DrawBeforeCanvas = p.createGraphics(initData.width, initData.height);
        DrawBeforeCanvas.pixelDensity(PIXEL_DENSITY);
        DrawBeforeCanvas.noLoop();
        DrawBeforeCanvas.noFill();
        DrawBeforeCanvas.clear(255, 255, 255, 255);
        // 사용자 그리기 판넬 생성
        if (initData['path']) { // 배경 이미지 파일이 포함됨
          let blob = await this.indexed.loadBlobFromUserPath(initData['path'], initData['type']);
          const FileURL = URL.createObjectURL(blob);
          p.loadImage(FileURL, v => {
            this.p5BaseImage = v;
            ImageCanvas.image(this.p5BaseImage, 0, 0);
            ImageCanvas.redraw();
            URL.revokeObjectURL(FileURL);
            setTimeout(() => {
              this.p5SetCanvasViewportInit();
            }, 100);
          }, e => {
            console.error('그림판 배경 이미지 불러오기 오류: ', e);
            ImageCanvas.redraw();
            URL.revokeObjectURL(FileURL);
            setTimeout(() => {
              this.p5SetCanvasViewportInit();
            }, 100);
          });
        } else {
          ImageCanvas.redraw();
          setTimeout(() => {
            this.p5SetCanvasViewportInit();
          }, 100);
        }
        if (initData['width'] < initData['height'])
          strokeWeight = strokeWeight / CamScale;
        this.p5getCropPos = getCropPos;
        this.p5setCropPos = setCropPos;
        this.p5getCropSize = getCropSize;
        this.p5setCropSize = setCropSize;
        this.p5RemoteDrawStart = RemoteDrawStart;
        this.p5RemoteDrawing = RemoteDrawing;
        this.p5RemoteDrawingEnd = RemoteDrawingEnd;
        this.p5updateRemoteCurve = updateRemoteCurve;
        this.p5CancelCurrentDraw = () => {
          RemoteDraw = null;
          p.redraw();
        }
        if (this.navParams.scrollHeight)
          setCropPos(0, -this.navParams.scrollHeight);
      }
      /** Viewport 행동을 위한 변수들 */
      let CamPosition = p.createVector();
      let CamScale = 1;
      /** 확대 중심 */
      let ScaleCenter = p.createVector(0, 0);
      /** 이미지 Crop 시 상대적 위치 기록 */
      let CropPosition = p.createVector();
      /** 붓 기록 이미지의 상대 위치 기록 */
      let BakedPosition = p.createVector();
      /** Crop 정보 편집시 사용됨 */
      let CropModePosition = p.createVector();
      let CropSize = p.createVector();
      // 여기부터는 3손가락 행동 애니메이션을 위한 추가 변수
      let PlayReinitViewport = false;
      let ReinitLerp = 0;
      let StartCamPos = p.createVector(0, 0);
      let StartCamScale = 0;
      let StartScaleCenter = p.createVector(0, 0);
      let getCropPos = () => {
        return CropPosition;
      }
      let getCropSize = () => {
        return CropSize;
      }
      let setCropPos = (x: number, y: number) => {
        CropPosition.x = x;
        CropPosition.y = y;
        ImageCanvas.translate(x, y);
        DrawBeforeCanvas.translate(x, y);
        p.redraw();
      }
      let setCropSize = (x: number, y: number) => {
        CropSize.x = x;
        CropSize.y = y;
        ImageCanvas.translate(x, y);
        DrawBeforeCanvas.translate(x, y);
        p.redraw();
      }
      let asSineGraph = (t: number) => {
        return p.sin(t * p.PI / 2);
      }
      p.draw = () => {
        // 뷰포트 초기화 애니메이션
        if (PlayReinitViewport) {
          ReinitLerp += .07;
          if (ReinitLerp >= 1) {
            PlayReinitViewport = false;
            ReinitLerp = 1;
            p.noLoop();
          }
          ScaleCenter.x = p.lerp(StartScaleCenter.x, p.width / 2, asSineGraph(ReinitLerp));
          ScaleCenter.y = p.lerp(StartScaleCenter.y, p.height / 2, asSineGraph(ReinitLerp));
          CamPosition.x = p.lerp(StartCamPos.x, 0, asSineGraph(ReinitLerp));
          CamPosition.y = p.lerp(StartCamPos.y, 0, asSineGraph(ReinitLerp));
          let HeightExceptMenu = targetDiv.clientHeight - this.BUTTON_HEIGHT * 2;
          let windowRatio = targetDiv.clientWidth / HeightExceptMenu;
          let canvasRatio = ActualCanvas.width / ActualCanvas.height;
          if (windowRatio < canvasRatio)
            CamScale = p.lerp(StartCamScale, targetDiv.clientWidth / ActualCanvas.width, asSineGraph(ReinitLerp));
          else CamScale = p.lerp(StartCamScale, HeightExceptMenu / ActualCanvas.height, asSineGraph(ReinitLerp));
          if (this.ToggleAutoResolution) {
            this.resolutionRatio = p.min(100, CamScale * 100);
            this.resolutionEffectedWidth = p.floor(ActualCanvas.width * this.resolutionRatio / 100);
            this.resolutionEffectedHeight = p.floor(ActualCanvas.height * this.resolutionRatio / 100);
          }
          p.pixelDensity(p.min(1, PIXEL_DENSITY * this.resolutionRatio / 100 / CamScale));
        }
        p.clear(255, 255, 255, 255);
        p.push();
        p.translate(ScaleCenter);
        p.scale(CamScale);
        p.translate(CamPosition);
        p.image(ImageCanvas, 0, 0);
        p.image(DrawBeforeCanvas, 0, 0);
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
          if (this.ReadyToShareAct && RemoteDraw
            && RemoteDraw['pos']
            && RemoteDraw['pos'].length) {
            p.push();
            p.translate(CropPosition);
            p.stroke(RemoteDraw['color']);
            p.strokeWeight(RemoteDraw['weight']);
            p.beginShape();
            for (let i = 0, j = RemoteDraw['pos'].length; i < j; i++)
              p.curveVertex(RemoteDraw['pos'][i].x - ActualCanvasSizeHalf.x, RemoteDraw['pos'][i].y - ActualCanvasSizeHalf.y);
            p.endShape();
            p.pop();
          }
        }
        p.pop();
      }
      this.p5DrawingStack = [];
      /** 모든 그리기 선 삭제하기 */
      let ClearCurrentDraw = () => {
        CurrentDraw = {};
        this.p5DrawingStack.length = 0;
        HistoryPointer = 0;
        updateActualCanvas();
        p.redraw();
      }
      this.p5ClearCurrentDraw = ClearCurrentDraw;
      /** 선을 어디까지 그리는지, 히스토리 행동용 */
      let HistoryPointer = 0;
      /** 전체 그리기, 동작 취소 등 전체 업데이트가 필요할 때 사용 */
      let updateActualCanvas = () => {
        ActualCanvas.clear(255, 255, 255, 255);
        // 모든 그리기 행동 시도
        for (let i = 0; i < HistoryPointer; i++)
          updateDrawingCurve(ActualCanvas, this.p5DrawingStack[i]);
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
      let updateRemoteCurve = (list: any[]) => {
        for (let i = 0, j = list.length; i < j; i++)
          updateDrawingCurve(ActualCanvas, list[i]);
        HistoryPointer = this.p5DrawingStack.length;
      }
      p.windowResized = () => {
        setTimeout(() => {
          this.p5SetCanvasViewportInit();
        }, 0);
      }
      let CurrentDraw = {};
      /** 원격 실시간 그리기 추적 */
      let RemoteDraw = {};
      let RemoteDrawStart = (info: any) => {
        RemoteDraw = info;
        p.redraw();
      }
      let RemoteDrawing = (pos: any) => {
        if (RemoteDraw && RemoteDraw['pos'])
          RemoteDraw['pos'].push(pos);
        p.redraw();
      }
      let RemoteDrawingEnd = (pos: any) => {
        RemoteDraw['pos'].push(pos);
        RemoteDraw['pos'].push(pos);
        this.p5DrawingStack.length = HistoryPointer;
        if (RemoteDraw) {
          this.p5DrawingStack.push(RemoteDraw);
          updateDrawingCurve(ActualCanvas, RemoteDraw);
        }
        HistoryPointer = this.p5DrawingStack.length;
        RemoteDraw = null;
        p.redraw();
      }
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
        if (ev.target != canvas.elt) {
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
            this.p5SetCanvasViewportInit();
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
        let color_hex = `#${p.hex(color[0], 2)}${p.hex(color[1], 2)}${p.hex(color[2], 2)}${p.hex(this.colorPickAlpha, 2)}`;
        CurrentDraw = {
          pos: [],
          color: color_hex,
          weight: strokeWeight * strokeRatio,
        };
        CurrentDraw['pos']?.push(_pos);
        CurrentDraw['pos']?.push(_pos);
        if (this.ReadyToShareAct)
          this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
            type: 'draw',
            act: 'start',
            data: CurrentDraw,
          }));
        p.redraw();
      }
      p.mouseDragged = (ev: any) => {
        if (!Drawable || isClickOnMenu) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            if (this.isCropMode) {
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
              if (this.ReadyToShareAct)
                this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
                  type: 'draw',
                  act: 'moved',
                  data: _pos,
                }));
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
        if (ev.target != canvas.elt) {
          isClickOnMenu = true;
          return;
        }
        PrepareZoomAct(MappingPosition());
        let delta = ev['deltaY'];
        if (delta < 0)
          CamScale *= 1.1;
        else CamScale *= .9;
        p.pixelDensity(p.min(1, PIXEL_DENSITY * this.resolutionRatio / 100 / CamScale));
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
                  CurrentDraw['pos']?.push(_pos);
                  CurrentDraw['pos']?.push(_pos);
                  if (this.ReadyToShareAct)
                    this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
                      type: 'draw',
                      act: 'end',
                      data: _pos,
                    }));
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
      p.touchStarted = (ev: any) => {
        if (!Drawable) return;
        isClickOnMenu = false;
        touches = ev['touches'];
        if (ev.target != canvas.elt) {
          isClickOnMenu = true;
          return;
        }
        isTouching = true;
        switch (touches.length) {
          case 1: // 그리기
            if (this.isCropMode) {
              CropModeStartAct(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - this.HeaderHeight);
            } else DrawStartAct(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - this.HeaderHeight);
            break;
          case 2: // 패닝, 스케일
            let One = p.createVector(touches[0].clientX, touches[0].clientY - this.HeaderHeight);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - this.HeaderHeight);
            TouchBetween = One.dist(Two);
            MovementStartPosition = One.copy().add(Two).div(2);
            TempStartCamPosition = CamPosition.copy();
            ScaleStartRatio = CamScale;
            CurrentDraw = null;
            if (this.ReadyToShareAct)
              this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
                type: 'draw',
                act: 'cancel',
              }));
            break;
          default: // 3개 또는 그 이상은 행동 초기화
            isTouching = false;
            this.p5SetCanvasViewportInit();
            break;
        }
      }
      p.touchMoved = (ev: any) => {
        if (!Drawable || !isTouching) return;
        touches = ev['touches'];
        switch (touches.length) {
          case 1: { // 그리기
            if (this.isCropMode && !isClickOnMenu) {
              let CurrentPosition = p.createVector(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - this.HeaderHeight);
              if (isCropSizing) {
                CropSize = CropStartSize.copy().add(CropStartScalePos.copy().sub(CurrentPosition).div(-CamScale));
              } else CropModePosition = CropStartPosition.copy().sub(CurrentPosition).div(-CamScale);
              p.redraw();
            } else {
              let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - this.HeaderHeight);
              pos.sub(CropPosition);
              pos.add(ActualCanvasSizeHalf);
              let _pos = { x: pos.x, y: pos.y };
              if (CurrentDraw && CurrentDraw['pos'])
                CurrentDraw['pos'].push(_pos);
              if (this.ReadyToShareAct)
                this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
                  type: 'draw',
                  act: 'moved',
                  data: _pos,
                }));
              p.redraw();
            }
          }
            break;
          case 2: { // 스케일과 패닝
            let One = p.createVector(touches[0].clientX, touches[0].clientY - this.HeaderHeight);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - this.HeaderHeight);
            let CenterPos = One.copy().add(Two).div(2);
            let dist = One.dist(Two);
            CamScale = dist / TouchBetween * ScaleStartRatio;
            CamPosition = TempStartCamPosition.copy().add(CenterPos.sub(MovementStartPosition).div(CamScale));
            p.pixelDensity(p.min(1, PIXEL_DENSITY * this.resolutionRatio / 100 / CamScale));
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
                let pos = MappingPosition(ev['changedTouches'][0].clientX, ev['changedTouches'][0].clientY - this.HeaderHeight);
                pos.sub(CropPosition);
                pos.add(ActualCanvasSizeHalf);
                let _pos = { x: pos.x, y: pos.y };
                CurrentDraw['pos']?.push(_pos);
                CurrentDraw['pos']?.push(_pos);
                if (this.ReadyToShareAct)
                  this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
                    type: 'draw',
                    act: 'end',
                    data: _pos,
                  }));
                ReleaseAllAct();
              }
            }
            break;
          case 1: // 패닝 종료
            if (!isTouching) return;
            PanningInit();
            TouchBetween = 0;
            CurrentDraw = null;
            break;
        }
        isClickOnMenu = false;
      }
      let PanningInit = () => {
        MovementStartPosition = p.createVector(touches[0].clientX, touches[0].clientY - this.HeaderHeight);
        TempStartCamPosition = CamPosition.copy();
      }
      /** 모든 입력을 제거했을 때 공통 행동 */
      let ReleaseAllAct = () => {
        this.p5DrawingStack.length = HistoryPointer;
        if (CurrentDraw) {
          this.p5DrawingStack.push(CurrentDraw);
          // 붓 기억 길이를 초과하면 배경에 포함시켜버림
          if (this.p5DrawingStack.length > MAX_HISTORY_LEN) {
            let oldStack = this.p5DrawingStack.shift();
            updateDrawingCurve(DrawBeforeCanvas, oldStack);
            let base64 = DrawBeforeCanvas.elt.toDataURL('image/png');
            p.loadImage(base64, v => {
              DrawBeforeBaked = v;
              DrawBeforeCanvas.redraw();
            });
            updateActualCanvas();
          } else updateDrawingCurve(ActualCanvas, CurrentDraw);
        }
        HistoryPointer = this.p5DrawingStack.length;
        MovementStartPosition = null;
        isClickOnMenu = false;
        CurrentDraw = null;
        p.redraw();
      }
    });
  }

  /** 상대방과 연결되어있는지 여부 */
  HasConnectedPeer = false;
  /** 서버 선택자의 값 */
  RemoteDrawSelected = 'local';
  /** 원격 추가 버튼 눌릴 때 */
  ClickRemoteAddButton() {
    if (this.isDrawServerCreated) return;
    if (this.IceWebRTCWsClient) {
      this.isDrawServerCreated = true;
      this.global.StoreShortCutAct('voiddraw-remote');
      this.p5SetDrawable(false);
      this.AddrQRShare.onDidDismiss().then(() => {
        this.p5SetDrawable(true);
        this.isDrawServerCreated = false;
        this.global.RestoreShortCutAct('voiddraw-remote');
        if (!this.HasConnectedPeer) this.p5SetDrawable(true);
      });
      this.AddrQRShare.present();
      return;
    }
    // 웹 페이지에서는 모바일로 연결할 수 있도록 인터페이스 준비
    this.ServerList = this.nakama.get_all_online_server();
    if (this.ServerList.length) {
      this.RemoteDrawSelected = this.ServerList[0];
      this.p5SetDrawable(false);
      this.RemoteDraw.open();
    } else {
      this.p5SetDrawable(false);
      this.RemoteBridgeServerSelected({ detail: { value: 'local' } });
    }
  }

  /** 상단 헤더의 크기 */
  HeaderHeight = 56;
  /** 집중 모드 토글 행동 */
  ToggleFocusMode() {
    this.global.ToggleFullScreen();
    if (this.global.ArcadeWithFullScreen) {
      this.HeaderHeight = 0;
    } else {
      this.HeaderHeight = 56;
    }
    this.p5voidDraw?.windowResized();
  }

  /** 상단 및 하단 메뉴 */
  p5MenuTable = [];
  BUTTON_HEIGHT = 56;
  ToggleFocusContextMenu() {
    this.BUTTON_HEIGHT = 0;
    this.ToggleFocusMode();
    for (let table of this.p5MenuTable)
      table.remove();
    this.p5MenuTable.length = 0;
    return false;
  }

  /** 중계서버 사용 가능한 서버 */
  ServerList = [];
  /** 로컬 웹소켓 서버 생성 여부 검토 */
  isDrawServerCreated = false;
  /** 취소할 수 있는 구성을 위해 기억함 */
  RemoteLoadingCtrl: HTMLIonLoadingElement;
  /** 서버 연결 보조용 웹소켓 삭제를 위해 기억함 */
  IceWebRTCWsClient: WebSocket;
  /** WebRTC 구성이 완료되었고 행동을 공유할 준비가 끝남 */
  ReadyToShareAct = false;
  /** 사용자가 입력한 사설 서버 주소를 기억함 */
  InputCustomAddress: string;
  /** 서버가 있는 경우 서버를 선택 */
  async RemoteBridgeServerSelected(ev: any) {
    if (this.isDrawServerCreated) return;
    let target = ev.detail.value;
    switch (target) {
      case 'local': // 웹이면 내부망을 가정하고 즉시 ip 주소 입력기를 준비함
        let is_ws_on = undefined;
        this.alertCtrl.create({
          header: this.lang.text['voidDraw']['LocalAddrInput'],
          inputs: [{
            type: 'text',
            placeholder: '(wss://)0.0.0.0(:0)',
          }, {
            type: 'text',
            placeholder: 'rtcport:username:password',
          }],
          buttons: [{
            text: this.lang.text['voidDraw']['Confirm'],
            handler: (ev: any) => {
              let sep = ev[1].split(':');
              this.Port = sep[0];
              this.username = sep[1];
              this.password = sep[2];
              if (ev[0]) {
                this.InputCustomAddress = ev[0];
                this.p5SetDrawable(false);
                is_ws_on = true;
                this.CreateOnMessageLink();
                this.CreateRemoteLocalClient(ev[0], ev[1]);
              } else this.p5toast.show({
                text: this.lang.text['voidDraw']['InputAddress'],
              });
            }
          }]
        }).then(v => {
          v.onWillDismiss().then(() => {
            this.p5SetDrawable(true);
          });
          v.onDidDismiss().then(() => {
            if (!is_ws_on && !this.WillLeaveHere)
              this.global.RestoreShortCutAct('voiddraw-remote-bridge');
          });
          this.global.StoreShortCutAct('voiddraw-remote-bridge');
          v.present();
        });
        break;
      default: // 서버 중계를 가정하고 selfmatch를 활용하여 정보 발송
        this.InputCustomAddress = `${target.info.useSSL ? 'wss' : 'ws'}://${target.info.address}`;
        this.p5SetDrawable(false);
        this.CreateOnMessageLink();
        this.CreateRemoteLocalClient(this.InputCustomAddress, ev[1], target.info);
        break;
    }
  }

  /** 원격 연결된 주소를 기억함 */
  TargetRemoteAddress: string;
  /** 빠른 진입시 사용한 포트 */
  Port: number;
  /** WebRTC 서버가 이미 존재하는지 여부 */
  AlreadyExistServer = false;
  /** 누구든 이 코드를 사용하면 지정 주소로 진입하여 공유 그림판을 사용할 수 있음 */
  async CreateRemoteLocalClient(_address: string, channel_id?: string, hasServerInfo?: ServerInfo) {
    const actId = `voiddraw_CreateRemoteLocalClient_${Date.now()}`;
    let split_fullAddress = _address.split('://');
    let address = split_fullAddress.pop().split(':');
    this.TargetRemoteAddress = address[0];
    await this.p5loading.update({
      id: actId,
      message: `${this.lang.text['InstantCall']['Connecting']}: ${address[0]}`,
      forceEnd: null,
    });
    let protocol = split_fullAddress.pop();
    if (protocol) {
      protocol += ':';
    } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'wss:' : 'ws:';
    if (!hasServerInfo)
      await this.nakama.SaveWebRTCServer({
        urls: [`stun:${address[0]}:${this.Port || (protocol == 'wss:' ? 5349 : 3478)}`,
        `turn:${address[0]}:${this.Port || (protocol == 'wss' ? 5349 : 3478)}`],
        username: this.username || 'username',
        credential: this.password || 'password',
      }).then(b => this.AlreadyExistServer = b);
    else this.AlreadyExistServer = true;
    this.IceWebRTCWsClient = new WebSocket(`${protocol}//${address[0]}:${address[1] || 12013}/`);
    this.AddShortCut();
    this.isDrawServerCreated = true;
    this.IceWebRTCWsClient.onopen = async () => {
      this.p5loading.update({
        id: actId,
        message: `${this.lang.text['voidDraw']['Connected']}: ${address[0]}`,
        progress: 1,
        forceEnd: 1000,
      });
      if (channel_id) { // 준비된 채널로 진입
        this.IceWebRTCWsClient.send(JSON.stringify({
          type: 'join',
          channel: channel_id,
        }));
        await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
        this.RemoteLoadingCtrl = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['WaitingConnection'] });
        this.RemoteLoadingCtrl.present();
        this.IceWebRTCWsClient.send(JSON.stringify({
          type: 'size_req',
          channel: channel_id,
        }));
      } else // 새 채널 생성하기
        this.IceWebRTCWsClient.send(JSON.stringify({
          type: 'init',
          max: 2,
        }));
    }
    /** 웹소켓 서버에서의 내 아이디 기록 */
    let uuid: string;
    this.IceWebRTCWsClient.onmessage = async (ev: any) => {
      let channel_id: string;
      try {
        let json = JSON.parse(ev['data']);
        /** 서버측에서 나의 uuid 검토하여 받기 */
        // 내가 보낸 하울링 메시지 무시
        if (uuid === undefined) {
          uuid = json['uid'];
        } else if (uuid == json['uid']) return;
        switch (json.type) {
          case 'join':
            this.HasConnectedPeer = true;
            this.p5SetDrawable(false);
            break;
          // 이미 연결된 사람이 있는 경우
          case 'block':
            console.error('이미 연결된 사용자 있음');
            this.IceWebRTCWsClient.close(1000, 'block');
            break;
          // 상대방 연결이 끊어지는게 확인되면 나도 연결 끊기
          case 'leave':
            this.HasConnectedPeer = false;
            this.p5SetDrawable(true);
            this.RemoteLoadingCtrl.dismiss();
            this.IceWebRTCWsClient.close(1000, 'leave_pair');
            break;
          // 채널 아이디 생성 후 수신
          case 'init_id':
            this.QRNavParams = {
              address: _address,
              channel: json.id,
              user_id: json.uid,
            };
            this.init_gen_qrcode();
            this.AddrQRShare.onDidDismiss().then(() => {
              this.isDrawServerCreated = false;
              this.global.RestoreShortCutAct('voiddraw-remote');
              if (!this.HasConnectedPeer) this.p5SetDrawable(true);
            });
            this.global.StoreShortCutAct('voiddraw-remote');
            this.p5SetDrawable(false);
            this.AddrQRShare.present();
            this.IceWebRTCWsClient.send(JSON.stringify({
              type: 'join',
              channel: json.id,
            }));
            channel_id = json.id;
            break;
          case 'init_req':
            this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Init'];
            this.webrtc.initialize('data', this.PageId)
              .then(async () => {
                this.webrtc.Peers[this.PageId].HangUpCallBack = () => {
                  this.IceWebRTCWsClient.close(1000, 'hangup_webrtc');
                }
                this.CreateOnMessageLink();
                this.CreateOnOpenAct();
                this.webrtc.CreateOffer(this.PageId);
                await new Promise((done) => setTimeout(done, this.global.WebsocketRetryTerm));
                this.IceWebRTCWsClient.send(JSON.stringify({
                  type: 'socket_react',
                  channel: channel_id,
                  act: 'WEBRTC_INIT_REQ_SIGNAL',
                }));
              });
            break;
          case 'size_req':
            this.AddrQRShare.dismiss();
            this.RemoteLoadingCtrl = await this.loadingCtrl.create({ message: this.lang.text['voidDraw']['WaitingConnection'] });
            this.RemoteLoadingCtrl.present();
            let crop_pos = this.p5getCropPos();
            this.IceWebRTCWsClient.send(JSON.stringify({
              type: 'size',
              width: this.p5ActualCanvas.width,
              height: this.p5ActualCanvas.height,
              cropX: crop_pos.x,
              cropY: crop_pos.y,
              channel: channel_id,
            }));
            break;
          case 'socket_react': // nakama.socket_react
            switch (json['act']) {
              case 'WEBRTC_REPLY_INIT_SIGNAL':
                this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Reply'];
                this.webrtc.WEBRTC_REPLY_INIT_SIGNAL(json['data_str'], {
                  client: this.IceWebRTCWsClient,
                  channel: channel_id,
                }, this.PageId);
                if (json['data_str'] == 'EOL') {
                  this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Offer'];
                  this.webrtc.CreateAnswer({
                    client: this.IceWebRTCWsClient,
                    channel: channel_id,
                  }, this.PageId);
                }
                this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Ice'];
                break;
              case 'WEBRTC_REPLY_INIT_SIGNAL_PART':
                this.webrtc.WEBRTC_REPLY_INIT_SIGNAL_PART({
                  client: this.IceWebRTCWsClient,
                  channel: channel_id,
                }, this.PageId);
                break;
              case 'WEBRTC_ICE_CANDIDATES':
                this.webrtc.WEBRTC_ICE_CANDIDATES(json['data_str'], {
                  client: this.IceWebRTCWsClient,
                  channel: channel_id,
                }, this.PageId);
                this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_datachannel'];
                this.IceWebRTCWsClient.send(JSON.stringify({
                  type: 'init_end',
                  channel: channel_id,
                }));
                break;
              case 'WEBRTC_INIT_REQ_SIGNAL':
                this.webrtc.WEBRTC_INIT_REQ_SIGNAL({
                  client: this.IceWebRTCWsClient,
                  channel: channel_id,
                }, this.PageId);
                break;
              case 'WEBRTC_RECEIVE_ANSWER':
                this.webrtc.WEBRTC_RECEIVE_ANSWER(json['data_str'], {
                  client: this.IceWebRTCWsClient,
                  channel: channel_id,
                }, this.PageId);
                break;
            }
            break;
          case 'size': // 상대방 캔버스 크기 정보를 기반으로 새 캔버스 생성
            this.create_new_canvas({
              width: json.width,
              height: json.height,
            });
            this.p5SetDrawable(false);
            this.p5setCropPos(json.cropX, json.cropY);
            this.p5voidDraw['redraw']();
            this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Init'];
            // 그림판이 준비되었다면 WebRTC 구성을 시도
            this.webrtc.initialize('data', this.PageId)
              .then(() => {
                this.webrtc.Peers[this.PageId].HangUpCallBack = () => {
                  if (this.IceWebRTCWsClient)
                    this.IceWebRTCWsClient.close(1000, 'hangup_callback');
                }
                this.CreateOnOpenAct();
                this.CreateOnMessageLink();
                this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_Offer'];
                this.webrtc.CreateOffer(this.PageId);
                this.IceWebRTCWsClient.send(JSON.stringify({
                  type: 'init_req',
                }));
              });
            break;
          case 'init_end':
            this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_datachannel'];
            break;
        }
      } catch (e) {
        console.log('원격 그림판 WebRTC 구성시 오류: ', e);
        this.IceWebRTCWsClient.close(1000, 'onmessage_error');
      }
    }
    this.IceWebRTCWsClient.onerror = (e) => {
      console.log('그림판 기능 공유 연결 오류: ', e);
      this.IceWebRTCWsClient.close(1000, 'onerror');
    }
    this.IceWebRTCWsClient.onclose = (ev: any) => {
      console.log('연결이 끊기는 이유: ', ev);
      this.p5toast.show({
        text: this.lang.text['TodoDetail']['Disconnected'],
      });
      if (this.RemoteLoadingCtrl)
        this.RemoteLoadingCtrl.dismiss();
      this.AddrQRShare.dismiss();
      this.isDrawServerCreated = false;
      this.p5SetDrawable(true);
      this.webrtc.close_webrtc(this.PageId);
      this.IceWebRTCWsClient.onopen = null;
      this.IceWebRTCWsClient.onclose = null;
      this.IceWebRTCWsClient.onmessage = null;
      this.IceWebRTCWsClient.onerror = null;
      this.IceWebRTCWsClient = null;
    }
  }

  /** WEBRTC 시작시 행동 등록 */
  CreateOnOpenAct(AlternativeAct = async () => { }) {
    this.webrtc.Peers[this.PageId].dataChannelOpenAct = async () => {
      this.ReadyToShareAct = true;
      this.p5ClearCurrentDraw();
      if (AlternativeAct) await AlternativeAct();
      this.RemoteLoadingCtrl.message = this.lang.text['voidDraw']['WebRTC_ShareBG'];
      // 그리기 선 전부 삭제하기
      if (this.navParams.path) { // 배경이미지 공유
        try {
          let file_ext = this.navParams.path.split('.').pop();
          let blob = await this.indexed.loadBlobFromUserPath(this.navParams.path, '');
          let sep = this.InputCustomAddress.split('://');
          let address = sep.pop();
          let protocol = sep.shift();
          if (protocol) {
            protocol = protocol == 'wss' ? 'https:' : 'http:';
          } else protocol = this.global.checkProtocolFromAddress(this.InputCustomAddress) ? 'https:' : 'http:';
          let uploaded_address = await this.global.upload_file_to_storage({
            blob: blob,
            size: blob.size,
            file_ext: file_ext,
            filename: `voidDrawRemoveImage.${file_ext}`,
          }, {
            user_id: `tmp_${this.QRNavParams.channel}_${this.QRNavParams.user_id}`,
          }, protocol, address, false, this.PageId, this.lang.text['ChatRoom']['voidDraw']);
          this.p5loading.remove(this.PageId);
          this.webrtc.Peers[this.PageId].dataChannel.send(JSON.stringify({
            type: 'background',
            data: uploaded_address,
          }));
        } catch (e) {
          this.p5toast.show({
            text: `${this.lang.text['voidDraw']['FailedGetBG']}: ${e}`,
          });
          console.log('배경 그림 공유하기 오류: ', e);
        }
      }
      this.RemoteLoadingCtrl.dismiss();
      this.p5SetDrawable(true);
    }
  }
  /** WebRTC 데이터 수신 행동 만들기 */
  CreateOnMessageLink() {
    // 메시지 받기 구성이 우선되므로 구성을 여기서 직접 새로 만들기
    if (!this.webrtc.Peers[this.PageId]) {
      this.webrtc.Peers[this.PageId] = {};
      this.webrtc.Peers[this.PageId].TypeIn = 'data';
    }
    this.webrtc.Peers[this.PageId].dataChannelOnMsgAct = (msg: any) => {
      let json = JSON.parse(msg);
      switch (json.type) {
        case 'drawline': // 그림판에 있던 선 동기화
          this.p5DrawingStack = json['data'];
          this.p5updateRemoteCurve(json['data']);
          this.p5voidDraw.redraw();
          break;
        case 'background': // 그림판에 있는 배경그림 동기화
          this.p5voidDraw.loadImage(json['data'], v => {
            this.p5BaseImage = v;
            this.p5ImageCanvas.image(this.p5BaseImage, 0, 0);
            this.p5ImageCanvas.redraw();
            this.p5SetCanvasViewportInit();
          }, e => {
            console.error('그림판 배경 이미지 불러오기 오류: ', e);
            this.p5ImageCanvas.redraw();
            this.p5SetCanvasViewportInit();
          });
          this.RemoteLoadingCtrl.dismiss();
          break;
        case 'draw':
          switch (json.act) {
            case 'start':
              this.p5RemoteDrawStart(json['data']);
              break;
            case 'moved':
              this.p5RemoteDrawing(json['data']);
              break;
            case 'cancel': // 두 손가락 탭시 그리던 선을 무시하고 스케일링처리하기
              this.p5CancelCurrentDraw();
              break;
            case 'crop': // 이미지 자르기 공유
              this.p5setCropPos(json.cropPX, json.cropPY);
              this.p5setCropSize(json.cropSX, json.cropSY);
              this.isCropMode = true;
              this.p5apply_crop(false);
              break;
            case 'end':
              this.p5RemoteDrawingEnd(json['data']);
              break;
          }
          break;
        case 'res_tog':
          this.ToggleAutoResolution = json['data'];
          this.UserToggleAutoResolution(false);
          break;
        case 'res_slider':
          this.resolutionRatio = json['data'];
          this.ResolutionSliderUpdate(false)
          break;
        case 'same':
          switch (json['act']) {
            case 'history_act':
              this.p5history_act(json['data'], true);
              break;
          }
          break;
      }
    }
    this.webrtc.Peers[this.PageId].dataChannelOnCloseAct = () => {
      this.CancelRemoteAct();
    }
  }

  @ViewChild('ChangeResolution') ChangeResolution: IonModal;
  /** 이건 그림판 해상도를 조정하기 위해 준비됩니다 */
  open_crop_tool_contextmenu: Function;
  ResolutionSliderUpdate: Function;
  /** 이미지 출력 배율 */
  resolutionRatio = 100;
  resolutionEffectedWidth = 0;
  resolutionEffectedHeight = 0;
  /** 화면에 맞는 해상도로 자동 조정하기 */
  ToggleAutoResolution = true;
  /** 사용자가 자동 해상도 조정을 토글한 경우 행동 */
  UserToggleAutoResolution: Function;

  /** 사용하기를 누른 경우 */
  dismiss_draw(force = false) {
    if (this.WillLeaveHere) return;
    if (this.isCropMode && !force)
      this.p5apply_crop();
    else {
      // 원격을 진행하려고 들어온 경우 클립보드에 복사하고 끝내기
      if (this.navParams.dismiss == 'voiddraw-remote') {
        this.p5save_image(true, true);
        this.navCtrl.pop();
        return;
      }
      this.p5loading.update({
        id: this.PageId,
      });
      this.p5save_image();
    }
  }

  /** 항목이 취소되었을 때 그리기 복구 */
  ionSelectCancel() {
    if (this.p5voidDraw && this.p5SetDrawable && !this.isDrawServerCreated)
      this.p5SetDrawable(true);
  }

  RemoveShortCut() {
    if (this.p5voidDraw && this.p5SetDrawable)
      this.p5SetDrawable(false);
    delete this.global.p5KeyShortCut['HistoryAct'];
    delete this.global.p5KeyShortCut['AddAct'];
    delete this.global.p5KeyShortCut['DeleteAct'];
    delete this.global.p5KeyShortCut['SKeyAct'];
    delete this.global.p5KeyShortCut['FKeyAct'];
    delete this.global.p5KeyShortCut['Escape'];
  }

  WillLeaveHere = false;
  ionViewWillLeave() {
    this.p5loading.update({
      id: this.PageId,
      forceEnd: 0,
    }, true);
    this.global.ToggleFullScreen(false);
    this.global.portalHint = true;
    if (this.p5SetDrawable) this.p5SetDrawable(false);
    this.WillLeaveHere = true;
    this.RemoveShortCut();
    this.global.RestoreShortCutAct('void-draw')
  }

  // 아래, LinkQRPage 병합
  @ViewChild('AddrQRShare') AddrQRShare: IonModal;
  QRCodeSRC: any;
  SelectedAddress: string;
  QRNavParams: any = {};
  username: string;
  password: string;

  async init_gen_qrcode() {
    let extract = this.QRNavParams.address;
    this.SelectedAddress = `${await this.global.GetHeaderAddress()}?voidDraw=${extract},${this.QRNavParams.channel},${this.Port || ''},${this.username || ''},${this.password || ''}`.replace(/ /g, '%20');
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.SelectedAddress);
  }

  /** 보여지는 QRCode 정보 복사 */
  copy_address(text: string) {
    this.global.WriteValueToClipboard('text/plain', text);
  }
}

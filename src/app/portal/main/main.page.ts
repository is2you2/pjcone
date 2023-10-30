// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdMobBannerSize } from '@capacitor-community/admob';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { WebrtcService } from 'src/app/webrtc.service';
import * as p5 from 'p5';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private _webrtc: WebrtcService,
  ) { }

  ngOnInit() {
    this.add_admob_banner();
  }

  async add_admob_banner() {
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      this.nakama.appMargin = size.height;
      const app: HTMLElement = document.querySelector('ion-router-outlet');

      if (this.nakama.appMargin === 0)
        app.style.marginBottom = '';
      else if (this.nakama.appMargin > 0)
        app.style.marginBottom = this.nakama.appMargin + 'px';
    });
    const options: BannerAdOptions = {
      adId: 'ca-app-pub-6577630868247944/4829889344',
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    };
    /** 광고 정보 불러오기 */
    try { // 파일이 있으면 보여주고, 없다면 보여주지 않음
      this.nakama.isBannerShowing = false;
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/admob.txt`);
      if (!res.ok) throw "준비된 광고가 없습니다";
      AdMob.showBanner(options).then(() => {
        this.nakama.isBannerShowing = true;
      });
    } catch (e) { // 로컬 정보 기반으로 광고
      console.log(e);
    }
  }

  async ionViewWillEnter() {
    if (!this.global.p5todo)
      this.CreateTodoManager();
    else this.global.p5todo['PlayCanvas']();
    this.indexed.GetFileListFromDB('acts_local', list => {
      list.forEach(path => this.indexed.removeFileFromUserPath(path, undefined, this.indexed.godotDB));
    }, this.indexed.godotDB);
  }

  CreateTodoManager() {
    // 해야할 일 관리자 생성 행동
    let todo_div = document.getElementById('todo');
    this.global.p5todo = new p5((p: p5) => {
      let Todos: { [id: string]: TodoElement } = {};
      let TodoKeys: string[] = [];
      let CamPosition = p.createVector(0, 0);
      let CamScale = 1;
      /** 확대 중심 */
      let ScaleCenter = p.createVector(0, 0);;
      let EllipseSize = 96;
      let TextSize = 20;
      let nakama = this.nakama;
      let indexed = this.indexed;
      /** 썸네일 이미지 마스크 */
      let ImageMask: p5.Image;
      /** 비활성시 인풋값 무시 */
      let BlockInput = false;
      p.setup = async () => {
        { // 마스크 이미지 생성
          ImageMask = p.createImage(128, 128);
          ImageMask.loadPixels();
          let ImageCenter = p.createVector(ImageMask.width / 2, ImageMask.height / 2);
          for (let y = 0, yl = ImageMask.height; y < yl; y++)
            for (let x = 0, xl = ImageMask.width; x < xl; x++) {
              let pixelPosition = p.createVector(x, y);
              let dist = ImageCenter.dist(pixelPosition);
              if (dist < EllipseSize / 2 - 1)
                ImageMask.set(x, y, p.color(255, 80));
            }
          ImageMask.updatePixels();
        }
        let canvas = p.createCanvas(todo_div.clientWidth, todo_div.clientHeight);
        canvas.parent(todo_div);
        p.smooth();
        p.noStroke();
        p.pixelDensity(1);
        p.ellipseMode(p.CENTER);
        p.rectMode(p.CENTER);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(TextSize);
        p.textLeading(TextSize * 1.6);
        p.textWrap(p.CHAR);
        p.imageMode(p.CENTER);
        ViewInit();
        // 캔버스 멈추기
        p['StopCanvas'] = () => {
          BlockInput = true;
          p.noLoop();
        }
        // 캔버스 계속 사용
        p['PlayCanvas'] = () => {
          BlockInput = false;
          p.loop();
        }
        // 할 일 추가시 행동
        p['add_todo'] = (data: string) => {
          let json = JSON.parse(data);
          if (json.done) { // 완료 행동
            for (let i = 0, j = TodoKeys.length; i < j; i++)
              if (Todos[TodoKeys[i]].json.id == json.id) {
                Todos[TodoKeys[i]].DoneAnim();
                break;
              }
          } else Todos[json.id] = new TodoElement(json);
          TodoKeys = Object.keys(Todos);
        }
        p['remove_todo'] = (data: string) => {
          let json = JSON.parse(data);
          for (let i = 0, j = TodoKeys.length; i < j; i++)
            if (Todos[TodoKeys[i]].json.id == json.id) {
              Todos[TodoKeys[i]].RemoveTodo();
              break;
            }
        }
        // 해야할 일 리스트 업데이트
        p['ListUpdate'] = async () => {
          Todos = {};
          TodoKeys.length = 0;
          let list = await this.indexed.GetFileListFromDB('todo/', undefined, this.indexed.godotDB);
          for (let i = 0, j = list.length; i < j; i++)
            if (list[i].indexOf('/info.todo') >= 0) {
              let data = await this.indexed.loadTextFromUserPath(list[i], undefined, this.indexed.godotDB);
              p['add_todo'](data);
            }
        }
        await p['ListUpdate']();
      }
      /** 카메라 초기화 (3손가락 행동) */
      let ViewInit = () => {
        ScaleCenter.x = p.width / 2;
        ScaleCenter.y = p.height / 2;
        CamPosition.x = 0;
        CamPosition.y = 0;
        CamScale = 1;
      }
      p.draw = () => {
        p.clear(255, 255, 255, 255);
        p.push();
        p.translate(ScaleCenter);
        p.scale(CamScale);
        p.translate(CamPosition);
        for (let i = 0, j = TodoKeys.length; i < j; i++)
          Todos[TodoKeys[i]].display();
        p.pop();
      }
      p.windowResized = () => {
        setTimeout(() => {
          let tmpWidthRatio = CamPosition.x / p.width;
          let tmpHeightRatio = CamPosition.y / p.height;
          p.resizeCanvas(todo_div.clientWidth, todo_div.clientHeight);
          // 상대적 중심 위치를 계산하여 카메라 설정을 조정
          ScaleCenter.x = p.width / 2;
          ScaleCenter.y = p.height / 2;
          CamPosition.x = tmpWidthRatio * p.width;
          CamPosition.y = tmpHeightRatio * p.height;
        }, 50);
      }
      let ProgressWeight = 8;
      /** 할 일 개체가 클릭 가능한 */
      let isClickable = true;
      /** 해야할 일 객체 */
      class TodoElement {
        constructor(data: any) {
          this.json = data;
          let OutPosition = p.max(p.width, p.height);
          let StartPosGen = p.createVector(OutPosition / (p.min(1, CamScale)), 0).setHeading(p.random(0, p.PI));
          this.position = StartPosGen;
          if (!this.json.custom_color) {
            switch (this.json.importance) {
              case '0': // 중요도 낮음
                this.defaultColor = p.color('#58a192');
                break;
              case '1': // 중요도 보통
                this.defaultColor = p.color('#ddbb41');
                break;
              case '2': // 중요도 높음
                this.defaultColor = p.color('#ff754e');
                break;
            }
          }
          indexed.loadBlobFromUserPath(`todo/${this.json.id}/thumbnail.png`, '')
            .then(blob => {
              let FileURL = URL.createObjectURL(blob);
              p.loadImage(FileURL, v => {
                this.ThumbnailImage = v;
                this.ThumbnailImage.mask(ImageMask);
                URL.revokeObjectURL(FileURL);
              });
            }).catch(_e => { });
        }
        ThumbnailImage: p5.Image;
        /** 할 일 정보 원본을 내장하고 있음 */
        json: any;
        /** 사용자 지정 색이 없을 경우 보여지는 색 */
        defaultColor: p5.Color;
        /** 개체 위치 중심점 */
        position: p5.Vector;
        /** 속도 - 매 프레임마다 위치에 영향을 줌 */
        Velocity = p.createVector(0, 0);
        /** 가속도 - 매 프레임마다 속도에 영향을 줌 */
        Accel = p.createVector(0, 0);
        /** 사용자가 끌기 중인지 여부 */
        isGrabbed = false;
        /** 실시간 보여주기 */
        display() {
          // 가장 배경에 있는 원
          p.push();
          if (!this.isGrabbed) {
            this.CalcPosition();
            this.OnCollider();
            // 최종적으로 위치를 업데이트 함
            this.position = this.position.add(this.Velocity);
          }
          p.translate(this.position);
          // 진행도 Lerp 생성
          let LerpProgress = p.map(
            Date.now(),
            this.json.create_at,
            this.json.limit,
            0, 1, true);
          p.fill((this.json.custom_color || this.defaultColor.toString('#rrggbb'))
            + p.hex(p.floor(p.lerp(34, 180, LerpProgress)), 2));
          p.ellipse(0, 0, EllipseSize, EllipseSize);
          // 썸네일 이미지 표기
          if (this.ThumbnailImage)
            p.image(this.ThumbnailImage, 0, 0);
          // 진행도 표기
          p.push();
          p.noFill();
          p.stroke((this.json.custom_color || this.defaultColor));
          p.strokeWeight(ProgressWeight);
          p.rotate(-p.PI / 2);
          let ProgressCircleSize = EllipseSize - ProgressWeight;
          p.arc(0, 0, ProgressCircleSize, ProgressCircleSize, 0, LerpProgress * p.TWO_PI);
          p.pop();
          // 타이틀 일부 표기
          let TextBox = EllipseSize * .9;
          p.fill(255);
          p.text(this.json.title, 0, 0, TextBox, TextBox);
          p.pop();
        }
        /** 시작시 적용되는 색상 */
        ColorStart: p5.Color;
        /** 기한시 적용되는 색상 */
        ColorEnd: p5.Color;
        VECTOR_ZERO = p.createVector(0, 0);
        /** 가속도에 의한 위치 변화 계산, 중심으로 중력처럼 영향받음 */
        private CalcPosition() {
          let dist = this.position.dist(this.VECTOR_ZERO);
          let distLimit = p.map(dist, 0, EllipseSize / 8, 0, 1, true);
          let CenterForceful = p.map(distLimit, EllipseSize / 4, 0, 1, .95, true);
          this.Accel.x = distLimit;
          this.Accel.y = 0;
          let AccHeadingRev = this.position.heading() - p.PI;
          this.Accel = this.Accel.setHeading(AccHeadingRev);
          this.Velocity.add(this.Accel).mult(CenterForceful);
        }
        /** 다른 할 일과 충돌하여 속도가 변경됨 */
        private OnCollider() {
          for (let i = 0, j = TodoKeys.length; i < j; i++) {
            if (Todos[TodoKeys[i]] != this) { // 이 개체가 아닐 때
              let Other = Todos[TodoKeys[i]];
              let dist = this.position.dist(Other.position);
              if (dist < EllipseSize) { // 충분히 근접했다면 충돌로 인지
                this.ReflectBounce(Other, dist);
                Other.ReflectBounce(this, dist);
              }
            }
          }
        }
        /** 다른 개체와 충돌하여 튕겨지는 로직 */
        ReflectBounce(Other: TodoElement, dist: number) {
          let calc = p5.Vector.sub(this.position, Other.position);
          this.Velocity.add(calc.mult(1 - dist / EllipseSize)).mult(.85);
        }
        DoneAnim() {
          console.log('완료 애니메이션 없음');
          this.RemoveTodo();
        }
        Clicked() {
          if (isClickable)
            nakama.open_add_todo_page(JSON.stringify(this.json));
        }
        MoveTodo() {

        }
        RemoveTodo() {
          for (let i = 0, j = TodoKeys.length; i < j; i++)
            if (TodoKeys[i] == this.json.id) {
              TodoKeys.splice(i, 1);
              break;
            }
          delete Todos[this.json.id];
        }
      }
      /** 모든 터치 또는 마우스 포인터의 현재 지점 */
      let touches: p5.Vector[] = [];
      /** 이동 연산용 시작점 */
      let MovementStartPosition: p5.Vector;
      /** 시작점 캐시 */
      let TempStartCamPosition: p5.Vector;
      p.mousePressed = (ev: any) => {
        if (BlockInput) return;
        isClickable = true;
        switch (ev['which']) {
          case 1: // 왼쪽
            TempStartCamPosition = CamPosition.copy();
            MovementStartPosition = p.createVector(p.mouseX, p.mouseY);
            touches[0] = p.createVector(p.mouseX, p.mouseY);
            break;
          case 2: // 가운데
            ViewInit();
            break;
        }
      }
      p.mouseDragged = (ev: any) => {
        if (BlockInput) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            touches[0] = p.createVector(p.mouseX, p.mouseY);
            CamPosition = TempStartCamPosition.copy().add(touches[0].sub(MovementStartPosition).div(CamScale));
            let dist = TempStartCamPosition.dist(CamPosition);
            if (dist > 15) isClickable = false;
            break;
        }
      }
      p.mouseReleased = (ev: any) => {
        if (BlockInput) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            touches.length = 0;
            MovementStartPosition = undefined;
            let dist = TempStartCamPosition.dist(CamPosition);
            if (dist < 15) { // 클릭 행동으로 간주
              let WorldPoint = MappingPosition();
              for (let i = 0, j = TodoKeys.length; i < j; i++) {
                let dist = Todos[TodoKeys[i]].position.dist(WorldPoint);
                if (dist < EllipseSize / 2) {
                  Todos[TodoKeys[i]].Clicked();
                  break;
                }
              }
            }
            break;
        }
      }
      /** 화면 상의 마우스 위치를 할 일 공간 내 위치로 변경 */
      let MappingPosition = () => {
        let mousePosition = p.createVector(p.mouseX, p.mouseY);
        mousePosition.sub(ScaleCenter);
        mousePosition.div(CamScale);
        mousePosition.sub(CamPosition);
        return mousePosition;
      }
      p.mouseWheel = (ev: any) => {
        if (BlockInput) return;
        let delta = ev['deltaY'];
        if (delta < 0)
          CamScale *= 1.1;
        else CamScale *= .9;
      }
      // p.touchStarted = (ev: any) => {
      // if (BlockInput) return;
      //   console.log('touchStarted: ', ev);
      // }
      // p.touchMoved = (ev: any) => {
      // if (BlockInput) return;
      //   console.log('touchMoved: ', ev);
      // }
      // p.touchEnded = (ev: any) => {
      // if (BlockInput) return;
      //   console.log('touchEnded: ', ev);
      // }
    });
  }

  ionViewDidEnter() {
    this.nakama.resumeBanner();
    this.try_add_shortcut();
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.nakama.open_add_todo_page('');
      }
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  ionViewWillLeave() {
    this.global.p5todo['StopCanvas']();
    delete this.global.p5key['KeyShortCut']['AddAct'];
  }
}

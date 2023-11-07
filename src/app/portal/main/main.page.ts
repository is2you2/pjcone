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

  isEmptyTodo = false;
  CreateTodoManager() {
    // 해야할 일 관리자 생성 행동
    let todo_div = document.getElementById('todo');
    this.global.p5todo = new p5((p: p5) => {
      let Todos: { [id: string]: TodoElement } = {};
      let TodoKeys: string[] = [];
      let DoneParticles: DoneBoomParticleAnim[] = [];
      let GrabbedElement: TodoElement;
      let VECTOR_ZERO = p.createVector(0, 0);
      let CamPosition = p.createVector(0, 0);
      let CamScale = 1;
      /** 확대 중심 */
      let ScaleCenter = p.createVector(0, 0);
      let TextSize = 20;
      let nakama = this.nakama;
      let indexed = this.indexed;
      /** 썸네일 이미지 마스크 */
      let ImageMask: p5.Image[] = [];
      /** 비활성시 인풋값 무시 */
      let BlockInput = false;
      p.setup = async () => {
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
          p.windowResized();
          p.loop();
        }
        // 할 일 추가시 행동
        p['add_todo'] = (data: string) => {
          let json = JSON.parse(data);
          if (json.done) { // 완료 행동
            for (let i = 0, j = TodoKeys.length; i < j; i++)
              if (Todos[TodoKeys[i]].json.id == json.id) {
                Todos[TodoKeys[i]].DoneAnim();
                return
              }
          } else Todos[json.id] = new TodoElement(json);
          p['count_todo']();
        }
        p['count_todo'] = () => {
          TodoKeys = Object.keys(Todos);
          this.isEmptyTodo = !Boolean(TodoKeys.length);
          if (!this.isEmptyTodo) {
            if (!Todos['AddButton']) {
              Todos['AddButton'] = new TodoElement('', true);
              TodoKeys = Object.keys(Todos);
            } else if (TodoKeys.length == 1) {
              Todos['AddButton'].DoneAnim();
            }
          }
        }
        p['remove_todo'] = (data: string) => {
          let json = JSON.parse(data);
          for (let i = 0, j = TodoKeys.length; i < j; i++)
            if (Todos[TodoKeys[i]].json.id == json.id) {
              Todos[TodoKeys[i]].RemoveTodo();
              break;
            }
          this.isEmptyTodo = !Boolean(Object.keys(TodoKeys).length);
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
          this.isEmptyTodo = !Boolean(Object.keys(TodoKeys).length);
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
        for (let i = DoneParticles.length - 1; i >= 0; i--) {
          DoneParticles[i].display();
          if (DoneParticles[i].lifeTime < 0)
            DoneParticles.splice(i, 1);
        }
        p.pop();
      }
      p.windowResized = () => {
        if (BlockInput) return;
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
      /** 할 일 개체가 클릭 가능한 */
      let isClickable = true;
      /** 해야할 일 객체 */
      class TodoElement {
        constructor(data: any, isAddButton = false) {
          this.json = data;
          let OutPosition = p.max(p.width, p.height);
          let StartPosGen = p.createVector(OutPosition / (p.min(1, CamScale)), 0).setHeading(p.random(0, p.PI));
          if (isAddButton) {
            this.isAddButton = isAddButton;
            // 추가 버튼 이미지 생성
            this.position = VECTOR_ZERO.copy();
            this.defaultColor = p.color('#bbb');
            this.json = { id: 'AddButton', written: 0, limit: 1, longSide: 53, shortSide: 11 }
            return;
          }
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
          let importance = Number(this.json['importance']);
          switch (importance) { // 중요도에 따라 크기 조정
            case 0:
              this.EllipseSize = 96;
              break;
            case 1:
              this.EllipseSize = 104;
              break;
            case 2:
              this.EllipseSize = 112;
              break;
          }
          { // 마스크 이미지 생성
            if (!ImageMask[importance]) {
              ImageMask[importance] = p.createImage(this.EllipseSize, this.EllipseSize);
              ImageMask[importance].loadPixels();
              let ImageCenter = p.createVector(ImageMask[importance].width / 2, ImageMask[importance].height / 2);
              for (let y = 0, yl = ImageMask[importance].height; y < yl; y++)
                for (let x = 0, xl = ImageMask[importance].width; x < xl; x++) {
                  let pixelPosition = p.createVector(x, y);
                  let dist = ImageCenter.dist(pixelPosition);
                  if (dist < this.EllipseSize / 2 - 1)
                    ImageMask[importance].set(x, y, p.color(255, 80));
                }
              ImageMask[importance].updatePixels();
            }
          }
          indexed.loadBlobFromUserPath(`todo/${this.json.id}/thumbnail.png`, '')
            .then(blob => {
              let FileURL = URL.createObjectURL(blob);
              p.loadImage(FileURL, v => {
                this.ThumbnailImage = v;
                this.ThumbnailImage.mask(ImageMask[importance]);
                URL.revokeObjectURL(FileURL);
              });
            }).catch(_e => { });
        }
        isAddButton = false;
        EllipseSize = 96;
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
        TextColor = p.color(255);
        ProgressWeight = 8;
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
            this.json.startFrom || this.json.written,
            this.json.limit,
            0, 1, true);
          if (LerpProgress == 0) LerpProgress = 1;
          p.fill((this.json.custom_color || this.defaultColor.toString('#rrggbb'))
            + p.hex(p.floor(p.lerp(34, 180, LerpProgress)), 2));
          p.ellipse(0, 0, this.EllipseSize, this.EllipseSize);
          // 썸네일 이미지 표기
          if (this.ThumbnailImage)
            p.image(this.ThumbnailImage, 0, 0, this.EllipseSize, this.EllipseSize);
          // 진행도 표기
          p.push();
          p.noFill();
          if (this.isAddButton) { // 추가 버튼은 진행도가 없고 + 가 보여짐
            p.push();
            p.noStroke();
            p.fill(255);
            p.rect(0, 0, this.json.shortSide, this.json.longSide);
            p.rect(0, 0, this.json.longSide, this.json.shortSide);
            p.pop();
          } else {
            p.stroke((this.json.custom_color || this.defaultColor));
            p.strokeWeight(this.ProgressWeight);
          }
          p.rotate(-p.PI / 2);
          let ProgressCircleSize = this.EllipseSize - this.ProgressWeight;
          p.arc(0, 0, ProgressCircleSize, ProgressCircleSize, 0, LerpProgress * p.TWO_PI);
          p.pop();
          // 타이틀 일부 표기
          let TextBox = this.EllipseSize * .9;
          p.fill(this.TextColor);
          p.text(this.json.title, 0, 0, TextBox, TextBox);
          p.pop();
        }
        /** 시작시 적용되는 색상 */
        ColorStart: p5.Color;
        /** 기한시 적용되는 색상 */
        ColorEnd: p5.Color;
        /** 가속도에 의한 위치 변화 계산, 중심으로 중력처럼 영향받음 */
        private CalcPosition() {
          let dist = this.position.dist(VECTOR_ZERO);
          let distLimit = p.map(dist, 0, this.EllipseSize / 8, 0, 1, true);
          let CenterForceful = p.map(distLimit, this.EllipseSize / 4, 0, 1, .95, true);
          this.Accel.x = distLimit;
          this.Accel.y = 0;
          let AccHeadingRev = this.position.heading() - p.PI;
          this.Accel = this.Accel.setHeading(AccHeadingRev);
          this.Velocity.add(this.Accel).mult(CenterForceful);
        }
        /** 다른 할 일과 충돌하여 속도가 변경됨 */
        private OnCollider() {
          for (let i = 0, j = TodoKeys.length; i < j; i++)
            if (Todos[TodoKeys[i]] != this) { // 이 개체가 아닐 때
              let Other = Todos[TodoKeys[i]];
              let dist = this.position.dist(Other.position);
              let limitDist = this.EllipseSize / 2 + Other.EllipseSize / 2;
              if (dist < limitDist) { // 충분히 근접했다면 충돌로 인지
                this.ReflectBounce(Other, dist / limitDist);
                Other.ReflectBounce(this, dist / limitDist);
              }
            }
        }
        /** 다른 개체와 충돌하여 튕겨지는 로직 */
        ReflectBounce(Other: TodoElement, dist: number) {
          let calc = p5.Vector.sub(this.position, Other.position);
          this.Velocity.add(calc.mult(1 - dist)).mult(.85);
        }
        async DoneAnim() {
          let LifeTime = 1;
          const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
          let sizeOrigin = this.EllipseSize;
          let ProgressLineWeightOrigin = this.ProgressWeight;
          await delay(500);
          this.Velocity = VECTOR_ZERO.copy();
          this.Accel = VECTOR_ZERO.copy();
          while (LifeTime > 0) {
            await delay(14);
            LifeTime -= .04;
            this.EllipseSize = sizeOrigin * LifeTime;
            this.ProgressWeight = ProgressLineWeightOrigin * LifeTime;
            if (LifeTime < .5)
              DoneParticles.push(new DoneBoomParticleAnim(this.position, this.json.custom_color || this.defaultColor));
            this.TextColor = p.color(255, 255 * LifeTime);
            if (this.isAddButton) {
              this.json.longSide *= LifeTime;
              this.json.shortSide *= LifeTime;
            }
          }
          this.RemoveTodo();
          p['count_todo']();
          for (let i = 0; i < 20; i++)
            DoneParticles.push(new DoneBoomParticleAnim(this.position, this.json.custom_color || this.defaultColor));
        }
        Clicked() {
          if (isClickable) {
            if (this.isAddButton)
              nakama.open_add_todo_page();
            else nakama.open_add_todo_page(JSON.stringify(this.json));
          }
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
      /** 할 일 완료 애니메이션 마무리 알갱이 행동 */
      class DoneBoomParticleAnim {
        constructor(pos: p5.Vector, targetColor: p5.Color) {
          this.pos = pos.copy();
          p.randomSeed(p.random(-255, 255));
          this.lifeTime = p.random(180, 255);
          this.vel = p.createVector(
            p.random(-75, 75),
            p.random(-40, -80),
          );
          this.acc = p.createVector(
            0,
            p.random(-1, -3),
          );
          p.push();
          p.colorMode(p.HSB);
          let hue = p.hue(targetColor);
          let sat = p.saturation(targetColor);
          let val = p.brightness(targetColor);
          this.color = p.color(
            p.random(hue - 20, hue + 20),
            p.random(sat - 20, sat + 20),
            p.random(val - 20, val + 20),
            this.lifeTime / 255
          );
          p.pop();
          this.RectSize = p.random(3, 4);
          this.rotate = p.random(-p.PI, p.PI);
        }
        pos: p5.Vector;
        /** 속도 */
        vel: p5.Vector;
        /** 가속도 */
        acc: p5.Vector;
        color: p5.Color;
        lifeTime: number;
        RectSize = 4;
        rotate = 0;
        display() {
          this.color.setAlpha(this.lifeTime / 255);
          p.fill(this.color);
          this.CalcPhysics();
          p.push();
          p.translate(this.pos);
          p.rotate(this.rotate);
          p.rect(0, 0, this.RectSize, this.RectSize);
          p.pop();
          this.lifeTime--;
        }
        CalcPhysics() {
          this.acc.y += .07;
          this.vel.add(this.acc);
          this.pos.add(this.vel.copy().div(100));
        }
      }
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
      p.mousePressed = (ev: any) => {
        if (BlockInput) return;
        isClickable = true;
        switch (ev['which']) {
          case 1: // 왼쪽
            MovementStartPosition = p.createVector(p.mouseX, p.mouseY);
            TempStartCamPosition = CamPosition.copy();
            MouseAct = p.createVector(p.mouseX, p.mouseY);
            for (let i = 0, j = TodoKeys.length; i < j; i++) {
              let dist = Todos[TodoKeys[i]].position.dist(MappingPosition());
              if (dist < Todos[TodoKeys[i]].EllipseSize / 2) {
                Todos[TodoKeys[i]].isGrabbed = true;
                GrabbedElement = Todos[TodoKeys[i]];
                MovementStartPosition = MappingPosition();
                break;
              }
            }
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
            MouseAct = p.createVector(p.mouseX, p.mouseY);
            let dist = 0;
            if (!GrabbedElement) {
              CamPosition = TempStartCamPosition.copy().add(MouseAct.sub(MovementStartPosition).div(CamScale));
              dist = TempStartCamPosition.dist(CamPosition);
            } else {
              GrabbedElement.position = MappingPosition();
              dist = MovementStartPosition.dist(MappingPosition());
            }
            if (dist > 15) isClickable = false;
            break;
        }
      }
      p.mouseReleased = (ev: any) => {
        if (BlockInput) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            MouseAct = undefined;
            ReleaseAllAct();
            break;
        }
      }
      /** 화면 상의 마우스 위치를 할 일 공간 내 위치로 변경 */
      let MappingPosition = (_x?: number, _y?: number) => {
        let mousePosition = p.createVector(_x || p.mouseX, _y || p.mouseY);
        mousePosition.sub(ScaleCenter);
        mousePosition.div(CamScale);
        mousePosition.sub(CamPosition);
        return mousePosition;
      }
      p.mouseWheel = (ev: any) => {
        if (BlockInput) return;
        PrepareZoomAct(MappingPosition());
        let delta = ev['deltaY'];
        if (delta < 0)
          CamScale *= 1.1;
        else CamScale *= .9;
      }
      /** 확대 중심점을 조정 */
      let PrepareZoomAct = (center: p5.Vector) => {
        ScaleCenter = p.createVector(p.mouseX, p.mouseY);
        CamPosition = center.mult(-1);
      }
      let touches = [];
      /** 터치 중인지 여부, 3손가락 터치시 행동 제약을 걸기 위해서 존재 */
      let isTouching = false;
      const HEADER_HEIGHT = 56;
      p.touchStarted = (ev: any) => {
        if (BlockInput) return;
        touches = ev['touches'];
        isTouching = true;
        switch (touches.length) {
          case 1: // 패닝
            PanningInit();
            break;
          case 2: // 스케일
            let One = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - HEADER_HEIGHT);
            TouchBetween = One.dist(Two);
            MovementStartPosition = One.copy().add(Two).div(2);
            TempStartCamPosition = CamPosition.copy();
            ScaleStartRatio = CamScale;
            if (GrabbedElement) {
              GrabbedElement.isGrabbed = false;
              GrabbedElement.Velocity = VECTOR_ZERO.copy();
              GrabbedElement.Accel = VECTOR_ZERO.copy();
              GrabbedElement = undefined;
            }
            break;
          default: // 3개 또는 그 이상은 행동 초기화
            isTouching = false;
            ViewInit();
            break;
        }
      }
      p.touchMoved = (ev: any) => {
        if (BlockInput) return;
        touches = ev['touches'];
        switch (touches.length) {
          case 1: { // 패닝
            if (!isTouching) return;
            let CurrentTouch = ev['changedTouches'][0];
            let CurrentPosition = p.createVector(CurrentTouch.clientX, CurrentTouch.clientY - HEADER_HEIGHT);
            let dist = 0;
            if (!GrabbedElement) {
              CamPosition = TempStartCamPosition.copy().add(CurrentPosition.sub(MovementStartPosition).div(CamScale));
              dist = TempStartCamPosition.dist(CamPosition);
            } else {
              GrabbedElement.position = MappingPosition();
              dist = MovementStartPosition.dist(MappingPosition(CurrentPosition.x, CurrentPosition.y));
            }
            if (dist > 15) isClickable = false;
          }
            break;
          case 2: { // 스케일과 패닝
            if (!isTouching) return;
            let One = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - HEADER_HEIGHT);
            let CenterPos = One.copy().add(Two).div(2);
            let dist = One.dist(Two);
            CamScale = dist / TouchBetween * ScaleStartRatio;
            CamPosition = TempStartCamPosition.copy().add(CenterPos.sub(MovementStartPosition).div(CamScale));
          }
            break;
        }
      }
      p.touchEnded = (ev: any) => {
        if (BlockInput) return;
        touches = ev['touches'];
        switch (touches.length) {
          case 0: // 행동 종료
            ReleaseAllAct();
            isTouching = false;
            break;
          case 1: // 패닝
            if (!isTouching) return;
            PanningInit();
            TouchBetween = 0;
            break;
        }
      }
      let PanningInit = () => {
        MovementStartPosition = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
        TempStartCamPosition = CamPosition.copy();
        for (let i = 0, j = TodoKeys.length; i < j; i++) {
          let dist = Todos[TodoKeys[i]].position.dist(MappingPosition(MovementStartPosition.x, MovementStartPosition.y));
          if (dist < Todos[TodoKeys[i]].EllipseSize / 2) {
            Todos[TodoKeys[i]].isGrabbed = true;
            GrabbedElement = Todos[TodoKeys[i]];
            break;
          }
        }
      }
      /** 모든 입력을 제거했을 때 공통 행동 */
      let ReleaseAllAct = () => {
        if (GrabbedElement) {
          let GrabbedDist = GrabbedElement.EllipseSize;
          GrabbedElement.isGrabbed = false;
          GrabbedElement.Velocity = VECTOR_ZERO.copy();
          GrabbedElement.Accel = VECTOR_ZERO.copy();
          GrabbedDist = GrabbedElement.position.dist(MovementStartPosition);
          GrabbedElement = undefined;
        }
        MovementStartPosition = undefined;
        let dist = TempStartCamPosition.dist(CamPosition);
        if (dist < 15) { // 클릭 행동으로 간주
          for (let i = 0, j = TodoKeys.length; i < j; i++) {
            let dist = Todos[TodoKeys[i]].position.dist(MappingPosition());
            if (dist < Todos[TodoKeys[i]].EllipseSize / 2) {
              Todos[TodoKeys[i]].Clicked();
              break;
            }
          }
        }
      }
    });
  }

  ionViewDidEnter() {
    this.nakama.resumeBanner();
    this.try_add_shortcut();
  }

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.nakama.open_add_todo_page();
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

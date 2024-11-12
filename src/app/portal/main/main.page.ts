import { Component, OnInit } from '@angular/core';
import { GlobalActService, isDarkMode } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { isPlatform } from 'src/app/app.component';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import * as p5 from 'p5';
import { AlertController, IonicSafeString } from '@ionic/angular';

/** 할 일 필터 카테고리 */
enum TodoFilterCategory {
  /** 필터 없음: 전부 보여주기 */
  None = 0,
  /** 중요도에 따라 필터링 */
  Importance = 1,
  /** 색상에 따라 필터링 */
  Color = 2,
  /** 기한에 따라 */
  Deadline = 3,
  /** 생성자에 따라 필터링 */
  Creator = 4,
}

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    public global: GlobalActService,
    public lang: LanguageSettingService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private alertCtrl: AlertController,
  ) { }

  /** 가운데 마우스를 눌러 뷰 초기화하기 함수 */
  ViewInitFunc: Function;
  ngOnInit() {
    this.global.PortalBottonTabAct.Todo = () => {
      if (this.ViewInitFunc) this.ViewInitFunc();
    }
  }

  toggle_session() {
    this.nakama.toggle_all_session();
    this.global.p5todo.redraw();
  }

  isPlayingCanvas = { loop: true };
  /** 캔버스 연산 멈추기 (인풋은 영향받지 않음) */
  toggleCanvasPlaying() {
    this.isPlayingCanvas.loop = !this.isPlayingCanvas.loop;
    if (this.isPlayingCanvas.loop)
      this.global.p5todo.loop();
    else this.global.p5todo.noLoop();
  }
  /** 화면에 보여지는 이름 정보 */
  TargetFilterDisplayName = 'FilterCat_0';
  /** 할 일 필터 카테고리 */
  TargetFilterName = 0;
  /** 할 일 필터 카테고리 일체  
   * AllCategories[TargetFilterName] = [ value, ... ]
   */
  AllCategories = {}
  /** 필터 종류 변경하기 */
  SwitchTargetFilter(force?: number) {
    this.TargetFilterName = force ?? ((this.TargetFilterName + 1) % 5);
    switch (this.TargetFilterName) {
      case TodoFilterCategory.None:
        this.TargetFilterDisplayName = 'FilterCat_0';
        break;
      case TodoFilterCategory.Importance:
        this.TargetFilterDisplayName = 'Importance';
        break;
      case TodoFilterCategory.Color:
        this.TargetFilterDisplayName = 'CustomColor';
        break;
      case TodoFilterCategory.Deadline:
        this.TargetFilterDisplayName = 'Deadline';
        break;
      case TodoFilterCategory.Creator:
        this.TargetFilterDisplayName = 'FilterByCreator';
        break;
    }
    this.CurrentFilterValue = null;
    if (this.global.p5FilteringTodos)
      this.global.p5FilteringTodos(TodoFilterCategory.None, this.TargetFilterDisplayName);
  }
  CurrentFilterValue = null;
  /** 해당 필터 카테고리의 값을 변경 */
  ChangeFilterValue(value: any) {
    if (this.CurrentFilterValue == value)
      this.CurrentFilterValue = null;
    else this.CurrentFilterValue = value;
    // 모든 할 일 개체를 돌아다니며 표현 여부 변경
    this.global.p5FilteringTodos();
  }
  /** 모든 할 일을 완료한 경우 */
  isEmptyTodo = false;
  CreateTodoManager() {
    setTimeout(() => {
      if (isPlatform != 'DesktopPWA')
        this.toggleCanvasPlaying();
    }, 8000);
    // 해야할 일 관리자 생성 행동
    let todo_div = document.getElementById('todo');
    if (this.global.p5todo) this.global.p5todo.remove();
    this.global.p5todo = new p5((p: p5) => {
      let StatusBar = this.statusBar;
      let Todos: { [id: string]: TodoElement } = {};
      let TodoKeys: string[] = [];
      let DoneTodo: TodoElement[] = [];
      let DoneParticles: DoneBoomParticleAnim[] = [];
      let GrabbedElement: TodoElement;
      /** 연산 간소화시 마지막으로 추가된 할 일 추적 */
      let AddedElement: TodoElement;
      let VECTOR_ZERO = p.createVector(0, 0);
      let GravityCenter = p.createVector(0, 0);
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
      let isPlayingCanvas = this.isPlayingCanvas;
      let CountTodo: Function;
      let ListUpdate: Function;
      p.setup = async () => {
        let canvas = p.createCanvas(todo_div.clientWidth, todo_div.clientHeight);
        canvas.parent(todo_div);
        canvas.id('p5todo');
        canvas.elt.oncontextmenu = async (ev: any) => {
          for (let i = 0, j = TodoKeys.length; i < j; i++) {
            if (Todos[TodoKeys[i]].json.id == 'AddButton') continue;
            let dist = Todos[TodoKeys[i]].position.dist(MappingPosition(ev.offsetX, ev.offsetY));
            if (dist < Todos[TodoKeys[i]].EllipseSize / 2) {
              let image_form = '';
              try {
                let thumbnail_path: string;
                try {
                  thumbnail_path = `todo/${Todos[TodoKeys[i]].json.id}_${Todos[TodoKeys[i]].json.remote.isOfficial}_${Todos[TodoKeys[i]].json.remote.target}/thumbnail.png`;
                } catch (e) {
                  thumbnail_path = `todo/${Todos[TodoKeys[i]].json.id}/thumbnail.png`;
                }
                let blob = await indexed.loadBlobFromUserPath(thumbnail_path, 'image/png');
                let FileURL = URL.createObjectURL(blob);
                image_form = `<div style="text-align: center"><img src="${FileURL}" alt="todo_image" style="border-radius: 2px"></div>`;
                setTimeout(() => {
                  URL.revokeObjectURL(FileURL);
                }, 100);
              } catch (e) { }
              let text_form = `<div>${Todos[TodoKeys[i]].json.description || ''}</div>`;
              let result_form = image_form + text_form;
              this.alertCtrl.create({
                header: Todos[TodoKeys[i]].json.title,
                message: new IonicSafeString(result_form),
                buttons: [{
                  text: this.lang.text['TodoDetail']['TodoComplete'],
                  handler: async () => {
                    try {
                      await nakama.doneTodo(Todos[TodoKeys[i]].json);
                    } catch (e) { }
                  }
                }, {
                  text: this.lang.text['TodoDetail']['remove'],
                  cssClass: 'redfont',
                  handler: async () => {
                    try {
                      await nakama.deleteTodoFromStorage(true, Todos[TodoKeys[i]].json);
                    } catch (e) { }
                  }
                }],
              }).then(v => {
                ReleaseGrabbedElement();
                v.onDidDismiss().then(() => {
                  BlockInput = false;
                });
                BlockInput = true;
                v.present()
              });
              break;
            }
          }
        }
        p.smooth();
        p.noStroke();
        p.pixelDensity(1);
        p.ellipseMode(p.CENTER);
        p.rectMode(p.CENTER);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(TextSize);
        p.textLeading(TextSize * 1.4);
        p.textWrap(p.CHAR);
        p.imageMode(p.CENTER);
        let InitScale = Number(localStorage.getItem('p5todoScale') || 1);
        ViewInit();
        this.ViewInitFunc = ViewReinit;
        CamScale = InitScale;
        localStorage.setItem('p5todoScale', `${CamScale}`);
        // 캔버스 멈추기
        this.global.p5todoStopCanvas = () => {
          BlockInput = true;
          if (!this.isPlayingCanvas.loop)
            p.noLoop();
        }
        // 캔버스 계속 사용
        this.global.p5todoPlayCanvas = () => {
          BlockInput = false;
          p.windowResized();
          if (this.isPlayingCanvas.loop)
            p.loop();
        }
        // 할 일 추가시 행동
        this.global.p5todoAddtodo = (data: string) => {
          let json = JSON.parse(data);
          let TmpId = json.id;
          if (json.remote)
            TmpId += `_${json.remote.isOfficial}_${json.remote.target}`;
          if (json.removed) return; // 삭제 예약된 할 일은 추가하지 않음
          if (json.done) { // 완료 행동
            for (let i = 0, j = TodoKeys.length; i < j; i++)
              if (TodoKeys[i] == TmpId) {
                Todos[TodoKeys[i]].makeDone();
                return;
              }
          } else {
            if (Todos[TmpId]) {
              Todos[TmpId].json = json;
              Todos[TmpId].initialize();
            } else Todos[TmpId] = new TodoElement(json);
          }
          if (!this.isPlayingCanvas.loop) {
            AddedElement = Todos[TmpId];
            p.loop();
          }
          CountTodo();
        }
        CountTodo = () => {
          TodoKeys = Object.keys(Todos);
          this.isEmptyTodo = !Boolean(TodoKeys.length);
          if (!this.isEmptyTodo) {
            if (!Todos['AddButton']) {
              Todos['AddButton'] = new TodoElement('', true);
              TodoKeys = Object.keys(Todos);
            } else if (TodoKeys.length == 1) {
              Todos['AddButton'].makeDone();
            }
          }
        }
        this.global.p5removeTodo = (data: string) => {
          let json = JSON.parse(data);
          let TmpId = json.id;
          if (json.remote)
            TmpId += `_${json.remote.isOfficial}_${json.remote.target}`;
          for (let i = 0, j = TodoKeys.length; i < j; i++)
            if (TodoKeys[i] == TmpId) {
              Todos[TodoKeys[i]].RemoveTodo();
              break;
            }
          this.isEmptyTodo = !Boolean(Object.keys(TodoKeys).length);
          CountTodo();
          p.redraw();
        }
        // 해야할 일 리스트 업데이트
        ListUpdate = async () => {
          Todos = {};
          TodoKeys.length = 0;
          let list = await this.indexed.GetFileListFromDB('todo/');
          for (let i = 0, j = list.length; i < j; i++)
            if (list[i].indexOf('/info.todo') >= 0) {
              let data = await this.indexed.loadTextFromUserPath(list[i]);
              this.global.p5todoAddtodo(data);
            }
          this.isEmptyTodo = !Boolean(Object.keys(TodoKeys).length);
        }
        ListUpdate();
        // 필터 카테고리 정보 생성하기
        this.SwitchTargetFilter(this.TargetFilterName);
        // 필터 종류에 따라 데이터를 수집하여 준비함
        this.AllCategories[TodoFilterCategory.None] = [];
        this.AllCategories[TodoFilterCategory.Importance] = [{
          name: 'Importance_0',
          color: '#58a19288',
          value: '0',
        }, {
          name: 'Importance_1',
          color: '#ddbb4188',
          value: '1',
        }, {
          name: 'Importance_2',
          color: '#b9543788',
          value: '2',
        }];
        this.AllCategories[TodoFilterCategory.Color] = [{
          name: 'ColorFilterRed',
          color: '#ff000088',
          value: [-30, 30],
        }, {
          name: 'ColorFilterYellow',
          color: '#ffff0088',
          value: [30, 90],
        }, {
          name: 'ColorFilterGreen',
          color: '#00ff0088',
          value: [90, 150],
        }, {
          name: 'ColorFilterCyan',
          color: '#00ffff88',
          value: [150, 210],
        }, {
          name: 'ColorFilterBlue',
          color: '#0000ff88',
          value: [210, 270],
        }, {
          name: 'ColorFilterMagenta',
          color: '#ff00ff88',
          value: [270, 330],
        }];
        this.AllCategories[TodoFilterCategory.Deadline] = [{
          name: 'TimeBefore',
          color: '#bbbbbb88',
          value: 'before',
        }, {
          name: 'TimeIn',
          color: '#00ff0088',
          value: 'ontime',
        }, {
          name: 'TimeOut',
          color: '#b9543788',
          value: 'after',
        }];
        this.AllCategories[TodoFilterCategory.Creator] = [{
          name: 'CreatorLocal',
          color: '#bbbbbb88',
          value: 'local',
        }, {
          name: 'CreatorMe',
          color: '#00ff0088',
          value: 'server',
        }, {
          name: 'Requested',
          color: '#6789ab88',
          value: 'worker',
        }, {
          name: 'CreatorOther',
          color: '#ba987688',
          value: 'other',
        }];
        this.global.p5FilteringTodos = FilteringTodos;
      }
      /** 선택된 카테고리 */
      let CategoryTarget: string;
      /** 할 일 객체를 순회하며 표시를 필터링함 */
      let FilteringTodos = (force?: any, category?: string) => {
        if (category) CategoryTarget = category;
        let ActWith = force ?? this.TargetFilterName;
        switch (ActWith) {
          case TodoFilterCategory.None:
            for (let i = 0, j = TodoKeys.length; i < j; i++)
              Todos[TodoKeys[i]].isHidden = false;
            break;
          case TodoFilterCategory.Importance:
            if (this.CurrentFilterValue)
              for (let i = 0, j = TodoKeys.length; i < j; i++)
                if (Todos[TodoKeys[i]].json.id == 'AddButton') {
                  Todos[TodoKeys[i]].isHidden = false;
                } else Todos[TodoKeys[i]].isHidden = Todos[TodoKeys[i]].json['importance'] != this.CurrentFilterValue;
            else FilteringTodos(TodoFilterCategory.None);
            break;
          case TodoFilterCategory.Color:
            for (let i = 0, j = TodoKeys.length; i < j; i++) {
              let color: p5.Color;
              p.push();
              p.colorMode(p.HSB);
              try { // 사용자 지정 색상이 있는지 테스트
                color = p.color(Todos[TodoKeys[i]].json['custom_color']);
              } catch (e) { }
              if (!color) {
                switch (Todos[TodoKeys[i]].json.importance) {
                  case '0': // 중요도 낮음
                    color = p.color('#58a192');
                    break;
                  case '1': // 중요도 보통
                    color = p.color('#ddbb41');
                    break;
                  case '2': // 중요도 높음
                    color = p.color('#b95437');
                    break;
                }
              }
              p.pop();
              if (this.CurrentFilterValue) {
                if (color) {
                  let minColor = (360 + this.CurrentFilterValue[0]) % 360;
                  let maxColor = (360 + this.CurrentFilterValue[1]) % 360;
                  let colorHue = p.hue(color);
                  if (minColor < maxColor) { // 일반적인 경우
                    let biggerThan = minColor < colorHue;
                    let lessThan = colorHue < maxColor;
                    Todos[TodoKeys[i]].isHidden = !(biggerThan && lessThan);
                  } else { // 자주~빨강 각도처리
                    let biggerThan = maxColor < colorHue;
                    let lessThan = colorHue < minColor;
                    Todos[TodoKeys[i]].isHidden = biggerThan && lessThan;
                  }
                }
              } else Todos[TodoKeys[i]].isHidden = false;
            }
            break;
          case TodoFilterCategory.Deadline: {
            if (this.CurrentFilterValue) {
              for (let i = 0, j = TodoKeys.length; i < j; i++) {
                if (Todos[TodoKeys[i]].json.id == 'AddButton') {
                  Todos[TodoKeys[i]].isHidden = false;
                } else switch (this.CurrentFilterValue) {
                  case 'before': // 기한 전
                    Todos[TodoKeys[i]].isHidden = !(Todos[TodoKeys[i]].json['startFrom'] && Todos[TodoKeys[i]].json['startFrom'] > Date.now());
                    break;
                  case 'ontime': // 기한 내
                    Todos[TodoKeys[i]].isHidden = !(((Todos[TodoKeys[i]].json['startFrom'] || 0) < Date.now()) && (Todos[TodoKeys[i]].json['limit'] || Todos[TodoKeys[i]].json['written']) > Date.now());
                    break;
                  case 'after': // 만료됨
                    Todos[TodoKeys[i]].isHidden = !(Todos[TodoKeys[i]].json['limit'] && Todos[TodoKeys[i]].json['limit'] <= Date.now());
                    break;
                }
              }
            } else FilteringTodos(TodoFilterCategory.None);
          }
            break;
          case TodoFilterCategory.Creator:
            if (this.CurrentFilterValue)
              for (let i = 0, j = TodoKeys.length; i < j; i++)
                if (Todos[TodoKeys[i]].json.id == 'AddButton') {
                  Todos[TodoKeys[i]].isHidden = false;
                } else switch (this.CurrentFilterValue) {
                  case 'local': // 내가 만든 할 일
                    Todos[TodoKeys[i]].isHidden = Todos[TodoKeys[i]].json['storeAt'] != this.CurrentFilterValue;
                    break;
                  case 'server': // 내가 만든 할 일
                    Todos[TodoKeys[i]].isHidden = Todos[TodoKeys[i]].json['remote'] === undefined;
                    break;
                  case 'worker': // 내가 다른 사람에게 요청함
                    Todos[TodoKeys[i]].isHidden = !(Todos[TodoKeys[i]].json['workers'] !== undefined && Todos[TodoKeys[i]].json['is_me']);
                    break;
                  case 'other': // 다른 사람이 나에게 요청함
                    Todos[TodoKeys[i]].isHidden = Todos[TodoKeys[i]].json['is_me'] || Todos[TodoKeys[i]].json['storeAt'] == 'local';
                    break;
                }
            else FilteringTodos(TodoFilterCategory.None);
            break;
        }
        p.redraw();
      }
      /** 카메라 초기화 */
      let ViewInit = () => {
        ScaleCenter.x = p.width / 2;
        ScaleCenter.y = p.height / 2;
        CamPosition.x = 0;
        CamPosition.y = 0;
        CamScale = 1;
        localStorage.setItem('p5todoScale', `${CamScale}`);
        if (!this.isPlayingCanvas.loop) p.redraw();
      }
      /** 카메라 초기화시 시작값 지정 */
      let ReinitStartFrom = {
        Act: false,
        lerp: 0,
        Scale: p.createVector(),
        CamPos: p.createVector(),
        CamScale: 0,
      }
      /** 카메라 초기화 (3손가락 행동 등에 의한 재지정) */
      let ViewReinit = () => {
        ReinitStartFrom.Act = true;
        ReinitStartFrom.Scale.x = ScaleCenter.x;
        ReinitStartFrom.Scale.y = ScaleCenter.y;
        ReinitStartFrom.CamPos.x = CamPosition.x;
        ReinitStartFrom.CamPos.y = CamPosition.y;
        ReinitStartFrom.CamScale = CamScale;
        if (!this.isPlayingCanvas.loop) p.loop();
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
        for (let i = DoneTodo.length - 1; i >= 0; i--)
          DoneTodo[i].DoneAnim();
        p.pop();
        // 실행중이라면 기기 가속도값을 반영
        if (this.isPlayingCanvas.loop) {
          GravityCenter.x = -p.accelerationX * 40;
          GravityCenter.y = p.accelerationY * 40;
        }
        // 카메라 초기화 애니메이션 지정
        if (ReinitStartFrom.Act) {
          ReinitStartFrom.lerp += .07;
          ScaleCenter.x = p.lerp(ReinitStartFrom.Scale.x, p.width / 2, asSineGraph(ReinitStartFrom.lerp));
          ScaleCenter.y = p.lerp(ReinitStartFrom.Scale.y, p.height / 2, asSineGraph(ReinitStartFrom.lerp));
          CamPosition.x = p.lerp(ReinitStartFrom.CamPos.x, 0, asSineGraph(ReinitStartFrom.lerp));
          CamPosition.y = p.lerp(ReinitStartFrom.CamPos.y, 0, asSineGraph(ReinitStartFrom.lerp));
          CamScale = p.lerp(ReinitStartFrom.CamScale, 1, asSineGraph(ReinitStartFrom.lerp));
          localStorage.setItem('p5todoScale', `${CamScale}`);
          if (ReinitStartFrom.lerp >= 1) {
            ReinitStartFrom.Act = false;
            ReinitStartFrom.lerp = 0;
            ScaleCenter.x = p.width / 2;
            ScaleCenter.y = p.height / 2;
            CamPosition.x = 0;
            CamPosition.y = 0;
            CamScale = 1;
            localStorage.setItem('p5todoScale', `${CamScale}`);
            if (!this.isPlayingCanvas.loop) p.noLoop();
          }
        }
      }
      let asSineGraph = (t: number) => {
        return p.sin(t * p.PI / 2);
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
          let OutPosition = p.max(p.width, p.height) || 1;
          let StartPosGen = p.createVector(OutPosition / (p.min(1, CamScale)), 0).setHeading(p.random(-p.PI, p.PI));
          if (isAddButton) {
            this.isAddButton = isAddButton;
            // 추가 버튼 이미지 생성
            this.position = VECTOR_ZERO.copy();
            this.defaultColor = p.color(isDarkMode ? '#bbb' : '#888');
            this.json = { id: 'AddButton', written: 0, limit: 1, longSide: 53, shortSide: 11 }
            return;
          }
          this.position = StartPosGen;
          this.initialize();
        }
        initialize() {
          if (!this.json.custom_color) {
            switch (this.json.importance) {
              case '0': // 중요도 낮음
                this.defaultColor = p.color('#58a192');
                break;
              case '1': // 중요도 보통
                this.defaultColor = p.color('#ddbb41');
                break;
              case '2': // 중요도 높음
                this.defaultColor = p.color('#b95437');
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
          let thumbnail_path: string;
          try {
            thumbnail_path = `todo/${this.json.id}_${this.json.remote.isOfficial}_${this.json.remote.target}/thumbnail.png`;
          } catch (e) {
            thumbnail_path = `todo/${this.json.id}/thumbnail.png`;
          }
          indexed.loadBlobFromUserPath(thumbnail_path, '')
            .then(blob => {
              let FileURL = URL.createObjectURL(blob);
              p.loadImage(FileURL, v => {
                this.ThumbnailImage = v;
                this.ThumbnailImage.mask(ImageMask[importance]);
                URL.revokeObjectURL(FileURL);
              });
            }).catch(_e => {
              this.ThumbnailImage = null;
            });
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
        TextColor = p.color(isDarkMode ? 255 : 0);
        ProgressWeight = 8;
        /** 진행도 */
        LerpProgress = 0;
        /** 필터에 의해 가려지는지 여부 */
        isHidden = false;
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
          this.LerpProgress = p.map(
            Date.now(),
            this.json.startFrom || this.json.written,
            this.json.limit,
            0, 1, true);
          if (this.isAddButton || (this.json.written > this.json.limit)) this.LerpProgress = 1;
          if (this.isHidden) {
            p.fill(128, 40);
          } else {
            if (CategoryTarget == 'FilterByCreator' && this.json.remote)
              p.fill((StatusBar.colors[StatusBar.groupServer[this.json.remote.isOfficial][this.json.remote.target] || 'offline'])
                + p.hex(p.floor(p.lerp(34, 96, this.LerpProgress)), 2));
            else p.fill((this.json.custom_color || this.defaultColor.toString('#rrggbb'))
              + p.hex(p.floor(p.lerp(34, 96, this.LerpProgress)), 2));
          }
          p.ellipse(0, 0, this.EllipseSize, this.EllipseSize);
          // 썸네일 이미지 표기
          if (!this.isHidden && this.ThumbnailImage)
            p.image(this.ThumbnailImage, 0, 0, this.EllipseSize, this.EllipseSize);
          // 진행도 표기
          p.push();
          if (!this.isHidden) {
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
            if (this.LerpProgress < 1)
              p.arc(0, 0, ProgressCircleSize, ProgressCircleSize, 0, this.LerpProgress * p.TWO_PI);
            else p.circle(0, 0, ProgressCircleSize);
          }
          p.pop();
          // 타이틀 일부 표기
          if (!this.isHidden) {
            let TextBox = this.EllipseSize * .9;
            this.TextColor = p.color(isDarkMode ? 255 : 0, (this.LerpProgress == 0 ? 128 : 255));
            p.fill(this.TextColor);
            p.text(this.json.title, 0, 0, TextBox, TextBox);
          }
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
          let AccHeadingRev = (this.position.copy().sub(GravityCenter)).heading() - p.PI;
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
                if (!isPlayingCanvas.loop)
                  if (AddedElement == this) {
                    AddedElement = null;
                    p.noLoop();
                  }
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
        LifeTime = 1;
        OriginalEllipseSize: number;
        OriginalProgWeight: number;
        /** 완료된 할 일로 처리 */
        async makeDone() {
          this.LifeTime = 1;
          await new Promise((done) => setTimeout(done, 500));
          this.Velocity = VECTOR_ZERO.copy();
          this.Accel = VECTOR_ZERO.copy();
          this.OriginalEllipseSize = this.EllipseSize;
          this.OriginalProgWeight = this.ProgressWeight;
          this.json['done'] = true;
          DoneTodo.push(this);
          if (!isPlayingCanvas.loop) p.loop();
        }

        async DoneAnim() {
          if (!isPlayingCanvas.loop) p.loop();
          this.LifeTime -= .04;
          this.EllipseSize = this.OriginalEllipseSize * this.LifeTime;
          this.ProgressWeight = this.OriginalProgWeight * this.LifeTime;
          if (this.LifeTime < .5)
            DoneParticles.push(new DoneBoomParticleAnim(this.position, this.json.custom_color || this.defaultColor));
          this.TextColor = p.color(isDarkMode ? 255 : 0, (this.LerpProgress == 0 ? 128 : 255) * this.LifeTime);
          if (this.isAddButton) {
            this.json.longSide *= this.LifeTime;
            this.json.shortSide *= this.LifeTime;
          }
          // 완전 삭제 후 파티클 생성
          if (this.LifeTime < 0) {
            if (!isPlayingCanvas.loop)
              setTimeout(() => p.noLoop(), 1000);
            this.RemoveTodo();
            CountTodo();
            for (let i = 0; i < 20; i++)
              DoneParticles.push(new DoneBoomParticleAnim(this.position, this.json.custom_color || this.defaultColor));
          }
        }
        Clicked() {
          if (isClickable && !BlockInput && !this.json['done']) {
            if (this.isAddButton)
              nakama.open_add_todo_page(undefined, 'portal/main/add-todo-menu');
            else nakama.open_add_todo_page(JSON.stringify(this.json), 'portal/main/add-todo-menu');
          }
        }
        RemoveTodo() {
          let TmpId = this.json.id;
          if (this.json.remote)
            TmpId += `_${this.json.remote.isOfficial}_${this.json.remote.target}`;
          for (let i = 0, j = TodoKeys.length; i < j; i++)
            if (TodoKeys[i] == TmpId) {
              TodoKeys.splice(i, 1);
              break;
            }
          for (let i = 0, j = DoneTodo.length; i < j; i++) {
            if (DoneTodo[i] = this) {
              DoneTodo.splice(i, 1);
              break;
            }
          }
          delete Todos[TmpId];
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
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
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
            ViewReinit();
            break;
        }
      }
      p.mouseDragged = (ev: any) => {
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
        if (!this.isPlayingCanvas.loop) p.redraw();
        switch (ev['which']) {
          case 1: // 왼쪽
            try {
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
            } catch (e) { }
            break;
        }
      }
      p.mouseReleased = (ev: any) => {
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
        switch (ev['which']) {
          case 1: // 왼쪽
            MouseAct = null;
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
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
        if (!this.isPlayingCanvas.loop) p.redraw();
        let delta = ev['deltaY'];
        if (delta < 0)
          CamScale *= 1.1;
        else CamScale *= .9;
        localStorage.setItem('p5todoScale', `${CamScale}`);
      }
      let touches = [];
      /** 터치 중인지 여부, 3손가락 터치시 행동 제약을 걸기 위해서 존재 */
      let isTouching = false;
      const HEADER_HEIGHT = 56;
      p.touchStarted = (ev: any) => {
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
        isClickable = true;
        touches = ev['touches'];
        isTouching = true;
        switch (touches.length) {
          case 1: // 패닝
            PanningInit();
            break;
          case 2: // 스케일
            let One = p.createVector(touches[0].clientX, touches[0].clientY - HEADER_HEIGHT);
            let Two = p.createVector(touches[1].clientX, touches[1].clientY - HEADER_HEIGHT);
            isClickable = false;
            TouchBetween = One.dist(Two);
            MovementStartPosition = One.copy().add(Two).div(2);
            TempStartCamPosition = CamPosition.copy();
            ScaleStartRatio = CamScale;
            if (GrabbedElement) {
              GrabbedElement.isGrabbed = false;
              GrabbedElement.Velocity = VECTOR_ZERO.copy();
              GrabbedElement.Accel = VECTOR_ZERO.copy();
              GrabbedElement = null;
            }
            break;
          default: // 3개 또는 그 이상은 행동 초기화
            isTouching = false;
            ViewReinit();
            break;
        }
      }
      p.touchMoved = (ev: any) => {
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
        if (!this.isPlayingCanvas.loop) p.redraw();
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
            localStorage.setItem('p5todoScale', `${CamScale}`);
            CamPosition = TempStartCamPosition.copy().add(CenterPos.sub(MovementStartPosition).div(CamScale));
          }
            break;
        }
        return false;
      }
      p.touchEnded = (ev: any) => {
        let exact_target = ev.target == document.getElementById('p5todo');
        if (BlockInput || !exact_target) return;
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
      /** 붙잡은 개체 놔주기 */
      let ReleaseGrabbedElement = () => {
        if (GrabbedElement) {
          GrabbedElement.isGrabbed = false;
          GrabbedElement.Velocity = VECTOR_ZERO.copy();
          GrabbedElement.Accel = VECTOR_ZERO.copy();
          GrabbedElement = null;
        }
      }
      /** 모든 입력을 제거했을 때 공통 행동 */
      let ReleaseAllAct = () => {
        ReleaseGrabbedElement();
        MovementStartPosition = null;
        try {
          let dist = TempStartCamPosition.dist(CamPosition);
          if (dist < 15) { // 클릭 행동으로 간주
            for (let i = 0, j = TodoKeys.length; i < j; i++) {
              let dist = Todos[TodoKeys[i]].position.dist(MappingPosition());
              if (dist < Todos[TodoKeys[i]].EllipseSize / 2) {
                Todos[TodoKeys[i]].Clicked();
                break;
              }
            }
          } // TempStartCamPosition가 준비되지 않은 경우가 있음
        } catch (e) { }
      }
    });
  }

  ionViewDidEnter() {
    let p5todo_canvas = document.getElementById('p5todo');
    if (!p5todo_canvas)
      this.CreateTodoManager();
    else this.global.p5todoPlayCanvas();
    this.try_add_shortcut();
  }

  try_add_shortcut() {
    if (this.global.p5KeyShortCut) {
      this.global.p5KeyShortCut['AddAct'] = () => {
        this.nakama.open_add_todo_page(undefined, 'portal/main/add-todo-menu');
      }
      this.global.p5KeyShortCut['Backquote'] = () => {
        this.SwitchTargetFilter();
      }
      this.global.p5KeyShortCut['Digit'] = (index: number) => {
        if (this.AllCategories[this.TargetFilterName].length > index)
          this.ChangeFilterValue(this.AllCategories[this.TargetFilterName][index].value);
      };
    }
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  ionViewWillLeave() {
    if (this.global.p5todoStopCanvas)
      this.global.p5todoStopCanvas();
    if (this.global.p5KeyShortCut) {
      delete this.global.p5KeyShortCut['AddAct'];
      delete this.global.p5KeyShortCut['Backquote'];
      delete this.global.p5KeyShortCut['Digit'];
    }
  }
}

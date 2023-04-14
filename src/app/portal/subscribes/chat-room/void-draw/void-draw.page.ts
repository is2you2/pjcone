import { Component, OnInit } from '@angular/core';
import { AlertController, LoadingController, ModalController } from '@ionic/angular';
import * as p5 from "p5";
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-void-draw',
  templateUrl: './void-draw.page.html',
  styleUrls: ['./void-draw.page.scss'],
})
export class VoidDrawPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.init_void_draw(432, 432);
  }

  translate = { x: 0, y: 0 };
  rotate = 0;
  /** 정비율 조정만 있을 뿐 */
  scale = 0;

  p5canvas: p5;
  /** 3단 레이어 구성: 배경, 그리기 기록, 현재 그리기 */
  init_void_draw(w: number, h: number) {
    if (w <= 0 || h <= 0) {
      this.p5toast.show({
        text: this.lang.text['voidDraw']['sideSIzeIssue'],
      });
      console.log('허용할 수 없는 이미지 크기: ', w, '/', h);
      return;
    }
    if (this.p5canvas) // 이미 존재한다면 삭제 후 다시 만들기
      this.p5canvas.remove();
    let targetDiv = document.getElementById('p5_void_draw');
    this.p5canvas = new p5((p: p5) => {
      let bg_color = 255;
      let canvas: p5.Renderer;
      /** 그려온 것들 */
      let drawing: p5.Graphics;
      /** 이번 차례에 그리는 것 */
      let current: p5.Graphics;
      p.setup = () => {
        canvas = p.createCanvas(w, h);
        canvas.parent(targetDiv);
        this.translate.x = (targetDiv.offsetWidth - w) / 2;
        this.translate.y = (targetDiv.offsetHeight - h) / 2;
        this.scale = 0;
        canvas.style('position', 'relative');
        update_transform();
        reset_canvas_animation(0, p.createVector(this.translate.x, this.translate.y), this.rotate, this.scale, calc_start_ratio());
        drawing = p.createGraphics(w, h);
        current = p.createGraphics(w, h);
        p.pixelDensity(1);
        drawing.pixelDensity(1);
        current.pixelDensity(1);
        current.strokeWeight(5);
        p.background(bg_color);
        p.image(drawing, 0, 0);
        p.image(current, 0, 0);
        p.noFill();
        drawing.noFill();
        current.noFill();
        drawing.clear(255, 255, 255, 255);
        current.clear(255, 255, 255, 255);
        drawing.noLoop();
        current.noLoop();
      }
      /** 시작할 때 조정할 배율 계산하기 */
      let calc_start_ratio = (): number => {
        let width_ratio = targetDiv.offsetWidth / w;
        let height_ratio = targetDiv.offsetHeight / h;
        return p.min(width_ratio, height_ratio);
      }
      let update_transform = () => {
        canvas.style('left', `${this.translate.x}px`);
        canvas.style('top', `${this.translate.y}px`);
        canvas.style('transform', `rotate(${this.rotate}deg)`);
        canvas.style('scale', `${this.scale}`);
      }
      /** 새로운 캔버스가 생길 때 생성 애니메이션 */
      let reset_canvas_animation = (lerp: number, start_pos: p5.Vector, start_rot: number, start_scale: number, target_scale: number) => {
        let frameRate = p.frameRate();
        if (frameRate) {
          lerp += .04 * 60 / frameRate;
          let ease = (lerp < 0.5 ? 2 * lerp * lerp : 1 - p.pow(-2 * lerp + 2, 2) / 2);
          this.translate.x = p.lerp(start_pos.x, (targetDiv.offsetWidth - w) / 2, ease);
          this.translate.y = p.lerp(start_pos.y, (targetDiv.offsetHeight - h) / 2, ease);
          this.rotate = p.lerp(start_rot, 0, ease);
          this.scale = p.lerp(start_scale, target_scale, ease);
        }
        setTimeout(() => {
          if (lerp < 1)
            reset_canvas_animation(lerp, start_pos, start_rot, start_scale, target_scale);
          else {
            this.scale = target_scale;
            p.noLoop();
          }
        }, 1000 / frameRate);
      }
      p.draw = () => {
        p.background(bg_color);
        p.image(drawing, 0, 0);
        p.image(current, 0, 0);
        update_transform();
      }
      let draw_line: p5.Vector[] = [];
      let StartMouseMiddle: p5.Vector;
      let AlreadyMoving = false;
      p.mousePressed = (ev) => {
        if (p.mouseButton == p.LEFT) {
          if (ev['target'] != canvas.elt) return;
          universal_pressed(p.mouseX, p.mouseY);
        }
        if (p.mouseButton == p.CENTER)
          StartMouseMiddle = p.createVector(p.mouseX, p.mouseY);
      }
      p.mouseDragged = (ev) => {
        if (ev['target'] != canvas.elt) return;
        if (p.mouseButton == p.LEFT)
          universal_dragged(p.mouseX, p.mouseY);
        if (p.mouseButton == p.CENTER) {
          let dist = StartMouseMiddle.dist(p.createVector(p.mouseX, p.mouseY));
          if (dist > 8 || AlreadyMoving) { // 아니라면 이동
            this.translate.x = this.translate.x - (StartMouseMiddle.x - p.mouseX);
            this.translate.y = this.translate.y - (StartMouseMiddle.y - p.mouseY);
            AlreadyMoving = true;
          }
        }
      }
      p.mouseReleased = (ev) => {
        if (p.mouseButton == p.LEFT) {
          if (ev['target'] != canvas.elt) return;
          universal_released(p.mouseX, p.mouseY);
        }
        if (p.mouseButton == p.CENTER) {
          let dist = StartMouseMiddle.dist(p.createVector(p.mouseX, p.mouseY));
          if (dist < 8 && !AlreadyMoving) {// 근거리 클릭은 원복
            p.loop();
            reset_canvas_animation(0, p.createVector(this.translate.x, this.translate.y), this.rotate, this.scale, calc_start_ratio());
          }
          AlreadyMoving = false;
        }
      }
      p.mouseWheel = (ev) => {
        if (ev['target'] != canvas.elt) return;
        if (ev['delta'] > 0) { // 아래 휠
          if (this.scale > .1)
            this.scale -= ev['delta'] / 1000;
        } else this.scale -= ev['delta'] / 1000;
      }
      p.touchStarted = (ev) => {
        if (ev['target'] != canvas.elt) return;
        if (p.touches[0])
          universal_pressed(p.touches[0]['x'], p.touches[0]['y']);
      }
      p.touchMoved = (ev) => {
        if (ev['target'] != canvas.elt) return;
        if (p.touches[0])
          universal_dragged(p.touches[0]['x'], p.touches[0]['y']);
      }
      p.touchEnded = (ev) => {
        if (ev['target'] != canvas.elt) return;
        if (p.touches[0])
          universal_released(p.touches[0]['x'], p.touches[0]['y']);
      }
      /** 엇나가는 그리기 보정 */
      let retargeting_position = (x: number, y: number): p5.Vector => {
        let result = p.createVector(x, y);
        if (this.scale != 1)
          result = result.div(this.scale);
        return result;
      }
      let universal_pressed = (x: number, y: number) => {
        draw_line.length = 0;
        for (let i = 0; i < 4; i++)
          draw_line.push(retargeting_position(x, y));
        draw_curve();
      }
      let universal_dragged = (x: number, y: number) => {
        if (draw_line.length != 0) {
          draw_line.shift();
          draw_line.push(retargeting_position(x, y));
          draw_curve();
        }
      }
      let universal_released = (x: number, y: number) => {
        universal_dragged(x, y);
        draw_line.length = 0;
        drawing.image(current, 0, 0);
        drawing.redraw();
        current.clear(255, 255, 255, 255);
      }
      /** 마지막 4점을 이용한 그림그리기 시도 */
      let draw_curve = () => {
        current.curve(
          draw_line[0].x, draw_line[0].y,
          draw_line[1].x, draw_line[1].y,
          draw_line[2].x, draw_line[2].y,
          draw_line[3].x, draw_line[3].y,
        );
        p.redraw();
        current.redraw();
      }
      p.windowResized = () => {
        p.background(bg_color);
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
      }, {
        name: 'image',
        label: 'image',
        type: 'checkbox',
      }],
      buttons: [{
        text: this.lang.text['voidDraw']['CreateNew'],
        handler: (v) => {
          console.log(v);
          this.init_void_draw(Number(v['width']) || DEFAULT_SIZE, Number(v['height']) || DEFAULT_SIZE);
        }
      }],
    }).then(v => v.present());
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    this.loadingCtrl.create({
      message: this.lang.text['voidDraw']['UseThisImage'],
    }).then(v => {
      v.present()
      this.p5canvas.saveFrames('voidDraw', 'png', 1, 1, (img) => {
        v.dismiss();
        let returnData = {
          name: `voidDraw_${this.p5canvas.year()}-${this.p5canvas.nf(this.p5canvas.month(), 2)}-${this.p5canvas.nf(this.p5canvas.day(), 2)}.png`,
          img: img[0]['imageData'],
        };
        this.modalCtrl.dismiss(returnData)
          .then(_v => { // onDidDismiss
            if (this.p5canvas)
              this.p5canvas.remove();
          });
      });
    });
  }

  ionViewDidLeave() {
    if (this.p5canvas)
      this.p5canvas.remove();
  }
}

import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as p5 from "p5";
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
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.init_void_draw();
  }

  p5canvas: p5;
  init_void_draw() {
    let targetDiv = document.getElementById('p5_void_draw');
    this.p5canvas = new p5((p: p5) => {
      const BACKGROUND_COLOR = 245;
      p.setup = () => {
        let canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        canvas.parent(targetDiv);
        p.background(BACKGROUND_COLOR);
      }
      let draw_line: p5.Vector[] = [];
      p.mousePressed = () => {
        universal_pressed(p.mouseX, p.mouseY);
      }
      p.mouseDragged = () => {
        universal_dragged(p.mouseX, p.mouseY);
      }
      p.mouseReleased = () => {
        universal_released(p.mouseX, p.mouseY);
      }
      p.touchStarted = () => {
        if (p.touches[0])
          universal_pressed(p.touches[0]['x'], p.touches[0]['y']);
      }
      p.touchMoved = () => {
        if (p.touches[0])
          universal_dragged(p.touches[0]['x'], p.touches[0]['y']);
      }
      p.touchEnded = () => {
        if (p.touches[0])
          universal_released(p.touches[0]['x'], p.touches[0]['y']);
      }
      let universal_pressed = (x: number, y: number) => {
        draw_line.length = 0;
        for (let i = 0; i < 4; i++)
          draw_line.push(p.createVector(x, y));
        draw_curve();
      }
      let universal_dragged = (x: number, y: number) => {
        draw_line.shift();
        draw_line.push(p.createVector(x, y));
        draw_curve();
      }
      let universal_released = (x: number, y: number) => {
        universal_dragged(x, y);
        draw_line.length = 0;
      }
      let universal_translate_change = () => {
        console.log('원본 대비 위치 이동');
      }
      let universal_scale_change = () => {
        console.log('원본 대비 스케일 조정처리');
      }
      let universal_reset_transform = (x: number, y: number) => {
        console.log('세번째 버튼으로 원상복구');
      }
      /** 마지막 4점을 이용한 그림그리기 시도 */
      let draw_curve = () => {
        console.log('마지막 순간의 속도는...: ', 255 / draw_line[2].dist(draw_line[3]));
        p.curve(
          draw_line[0].x, draw_line[0].y,
          draw_line[1].x, draw_line[1].y,
          draw_line[2].x, draw_line[2].y,
          draw_line[3].x, draw_line[3].y,
        );
      }
      p.windowResized = () => {
        p.resizeCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        p.background(BACKGROUND_COLOR);
      }
    });
  }

  /** 사용하기를 누른 경우 */
  dismiss_draw() {
    let returnData = {
      text: 'test_text',
    };
    this.modalCtrl.dismiss(returnData);
    this.p5canvas.remove();
  }
}

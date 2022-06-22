import { Component, Input, OnInit } from '@angular/core';
import * as p5 from "p5";

/** 고도 파일 리스트로 뽑은 json 파일 */
export interface FileList {
  /** 대상 폴더 위치 */
  root: string;
  /** 대상 폴더로부터 파일 이름 */
  files: string[];
}

@Component({
  selector: 'app-campaign-panel',
  templateUrl: './campaign-panel.component.html',
  styleUrls: ['./campaign-panel.component.scss'],
})
export class CampaignPanelComponent implements OnInit {

  constructor() { }

  ngOnInit() {
    this.draw_selector()
  }

  draw_selector() {
    let selector = (p: p5) => {
      let Buttons: ImageButton[] = [];
      p.setup = () => {
        const TARGET_DIV = document.getElementById('Campaigns');
        let canvas = p.createCanvas(TARGET_DIV.clientWidth, TARGET_DIV.clientHeight);
        canvas.parent(TARGET_DIV);
        Buttons.push(new ImageButton('Multi(R)'));
        Buttons.push(new ImageButton('Mixed(O)'));
        Buttons.push(new ImageButton('Beta'));
        p.imageMode(p.CENTER);
        p.noLoop();
        draw_background();
      }
      p.draw = () => {
        for (let i = 0, j = Buttons.length; i < j; i++) {
          Buttons[i].display(p.width / 2, p.height / 2);
        }
      }
      let draw_background = () => {
        p.clear(255, 255, 255, 255);
        p.background(80);
        p.redraw();
      }
      class ImageButton {
        /** 버튼 이미지 */
        pg: p5.Graphics;
        /** 선택된 배경 이미지 */
        img: p5.Image;
        info: FileList;
        /** 이미지 번호 */
        index: number;
        /**
         * 유동적 슬라이드식 이미지 버튼
         * @param _json_path json 리스트 경로
         */
        constructor(_title: string) {
          let client: WebSocket = new WebSocket('ws://localhost:12000');
          client.onopen = (ev) => {
            let json = {
              'act': 'sc1_custom',
              'req': _title,
              'type': 'one',
            }
            client.send(JSON.stringify(json));
          }
          client.onmessage = (ev) => {
            ev.data.text().then(v=>{
              console.log(v);
            });
            client.close(1000,'received');
          }
          this.pg = p.createGraphics(300, 200);
          this.pg.imageMode(p.CENTER);
          this.pg.noLoop();
        }
        /** 바깥에서 경로로 이미지 지정할 수 있도록 */
        loadImage(_path: string) {
          p.loadImage(_path, v => {
            this.img = v;
            this.pg.redraw();
            p.redraw();
          });
        }
        display(_x: number, _y: number) {
          if (this.img) {
            p.push();
            p.translate(_x, _y);
            this.pg.image(this.img, this.pg.width / 2, this.pg.height / 2);
            p.image(this.pg, 0, 0);
            p.pop();
          }
        }
        resize(_x: number, _y: number) {
          this.pg.resizeCanvas(_x, _y);
          this.pg.redraw();
        }
        OnClick() {

        }
      }
      p.windowResized = () => {
        const TARGET_DIV = document.getElementById('Campaigns');
        if (window.innerWidth < 768)
          p.resizeCanvas(window.innerWidth - 24, TARGET_DIV.clientHeight);
        else p.resizeCanvas(768 - 24, TARGET_DIV.clientHeight);

        draw_background();
      }
    }
    new p5(selector);
  }
}

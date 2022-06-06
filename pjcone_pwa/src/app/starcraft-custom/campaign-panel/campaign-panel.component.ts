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
      p.setup = () => {
        const TARGET_DIV = document.getElementById('Campaigns');
        let canvas = p.createCanvas(TARGET_DIV.clientWidth, TARGET_DIV.clientHeight);
        canvas.parent(TARGET_DIV);

        p.noLoop();
        draw_background();
      }
      p.draw = () => {

      }
      let draw_background = () => {
        p.background(200);
        p.redraw();
      }
      class ImageButton {
        /** 선택된 배경 이미지 */
        img: p5.Image;
        /**
         * 유동적 슬라이드식 이미지 버튼
         * @param _json_path json 리스트 경로
         */
        constructor(_json_path: string) {

        }
        display() {

        }
        OnClick() {

        }
      }
      p.windowResized = () => {
        const TARGET_DIV = document.getElementById('Campaigns');
        if (window.innerWidth < 768)
          p.resizeCanvas(window.innerWidth, TARGET_DIV.clientHeight);
        else p.resizeCanvas(768, TARGET_DIV.clientHeight);

        draw_background();
      }
    }
    new p5(selector);
  }
}

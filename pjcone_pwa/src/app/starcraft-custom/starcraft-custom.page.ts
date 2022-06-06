import { Component, OnInit } from '@angular/core';
import * as p5 from "p5";
import { CampaignData } from './campaign-panel/campaign-panel.component';

@Component({
  selector: 'app-starcraft-custom',
  templateUrl: './starcraft-custom.page.html',
  styleUrls: ['./starcraft-custom.page.scss'],
})
export class StarcraftCustomPage implements OnInit {

  /** 캠페인 관련 정보들 */
  infos: CampaignData[] = [];

  constructor() { }

  ngOnInit() {
    this.draw_selector();
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
      p.windowResized = () => {
        const TARGET_DIV = document.getElementById('Campaigns');
        if (window.innerWidth < 840)
          p.resizeCanvas(window.innerWidth, TARGET_DIV.clientHeight);
        else p.resizeCanvas(840, TARGET_DIV.clientHeight);

        draw_background();
      }
    }
    new p5(selector);
  }

}

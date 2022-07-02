import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT } from '../app.component';
import { RemoteControllerService, RemotePage } from '../remote-controller.service';
import * as p5 from "p5";

/** 동작에 따른 위치값 */
interface LerpInfo {
  min_pos: p5.Vector;
  max_pos: p5.Vector;
  start_pos: p5.Vector;
  end_pos: p5.Vector;
}

@Component({
  selector: 'app-starcraft-custom',
  templateUrl: './starcraft-custom.page.html',
  styleUrls: ['./starcraft-custom.page.scss'],
})
export class StarcraftCustomPage implements OnInit, RemotePage {
  constructor(
    private title: Title,
    private remote: RemoteControllerService,
    private nav: NavController,
  ) {
  }

  remote_act = {
    'youtube': () => this.link_youtube()
  };

  ngOnInit() {
    this.draw_p5();
  }

  ionViewDidEnter() {
    this.title.setTitle('스타크래프트 1: 캠페인식 컴까기');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/sc1-custom.png');
    this.remote.target = this;
  }

  link_youtube() {
    window.location.href = 'https://www.youtube.com/watch?v=Ieqh27v29xI';
  }

  draw_p5() {
    let sketch = (p: p5) => {
      /** 각 캠페인 HTML 버튼개체 */
      let campaign_eles: CampaignButton[] = [];
      /** 각 캠페인 목록 */
      const CAMPAIGNS: string[] = [
        'Multi(R)',
        // 'Mixed(O)',
        // 'Beta',
      ];
      /** 방명록 */
      let guestbook: p5.Element;
      /** 최상위 부모 div개체 */
      const tmp = document.getElementById('sc1_list');

      p.setup = () => {
        let ButtonPos: LerpInfo[] = [
          { // Multi
            min_pos: p.createVector(0, 0),
            max_pos: p.createVector(0, 0),
            start_pos: p.createVector(0, 0),
            end_pos: p.createVector(0, 0),
          },
          { // Mixed
            min_pos: p.createVector(0, 0),
            max_pos: p.createVector(0, 0),
            start_pos: p.createVector(0, 0),
            end_pos: p.createVector(0, 0),
          },
          { // Beta
            min_pos: p.createVector(0, 0),
            max_pos: p.createVector(0, 0),
            start_pos: p.createVector(0, 0),
            end_pos: p.createVector(0, 0),
          },
        ];

        for (let i = 0, j = CAMPAIGNS.length; i < j; i++)
          campaign_eles.push(new CampaignButton(CAMPAIGNS[i], ButtonPos[i]))
        guestbook = p.createDiv();
      }
      p.draw = () => {
        p.background(100);
      }
      let OutBoundAction = (target: string) => {
        this.go_to_detail(target);
      }
      class CampaignButton {
        /** 지금 주목받고 있는 버튼인지 */
        static isTitle: CampaignButton;
        /** width에 따른 lerp 변수 */
        static displayLerp: number;
        div: p5.Element;
        /** 대표 이미지 */
        img: p5.Element;
        /** 머릿글 */
        header: p5.Element;
        lerp_info: LerpInfo;
        /** 캠페인 버튼 개체
         * @param target 캠페인 이름
         * @param pos 상호작용시 양 끝 위치 (lerp용)
         */
        constructor(target: string, pos: LerpInfo) {
          this.lerp_info = pos;
          let json_path: string = `${SERVER_PATH_ROOT}assets/data/sc1_custom/${target}/list.json`;
          p.loadJSON(json_path, v => {
            let randomOne: number = p.floor(p.random(0, v.files.length - 1));
            let img_path = `${SERVER_PATH_ROOT}assets/data/sc1_custom/${target}/Screenshots/${v.files[randomOne]}`;
            console.log('img_path: ', img_path);
            this.div = p.createDiv();
            this.div.parent(tmp)
            this.div.style('border-radius: 16px; object-fit: cover; overflow: hidden;');
            this.div.position(0, 0, 'relative');
            this.div.size(360, 240);
            this.img = p.createImg(img_path, `CampaignImg_${target}`);
            this.img.id(`CampaignImg`);
            this.img.parent(this.div);
            this.img.style('width: auto; height: auto; min-width: 100%; min-height: 100%; display: inline-block; margin: 0 auto; vertical-align: middle;');
            // 클릭하여 주목받기 -> 주목받은 후 상세보기
            this.img.mouseClicked(_v => {
              if (CampaignButton.isTitle == this)
                OutBoundAction(target);
              else CampaignButton.isTitle = this;
            });
            this.header = p.createP(`<b>${target}</b>`);
            this.header.parent(this.div);
            this.header.style('position: absolute; top: 50%; left: 50%; font-size: 48px; margin: 0; transform: translate(-50%, -50%)');
          }, e => {
            console.error('json 불러오기 오류: ', e);
          });
        }
        display() {
        }
      }
    }
    new p5(sketch);
  }

  /** 캠페인 상세 페이지로 이동 */
  go_to_detail(target: string) {
    console.log('자세한: ', target);
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
  }

}

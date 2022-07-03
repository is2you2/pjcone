import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT } from '../app.component';
import { RemoteControllerService, RemotePage } from '../remote-controller.service';
import * as p5 from "p5";

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
      /** 방명록 */
      let guestbook: p5.Element;
      /** 최상위 부모 div개체 */
      const tmp = document.getElementById('sc1_list');
      /** div 정보 검토용 */
      let div_calc: p5.Element = p.createDiv();

      p.setup = () => {
        div_calc.position(0, 0, 'relative');
        div_calc.parent(tmp);

        /** 각 캠페인 목록 */
        const CAMPAIGNS: string[] = [
          'Multi(R)',
          'Mixed(O)',
          'Beta',
        ];
        const ButtonPos: p5.Vector[] = [
          p.createVector(-50, 20), // Multi
          p.createVector(-40, 160), // Mixed
          p.createVector(220, 40), // Beeta
        ];

        for (let i = 0, j = CAMPAIGNS.length; i < j; i++)
          campaign_eles.push(new CampaignButton(CAMPAIGNS[i], ButtonPos[i]))

        // campaign_eles.push(new CampaignButton('Guest', p.createVector(100, 100), true));
      }

      p.draw = () => {
        for (let i = 0, j = campaign_eles.length; i < j; i++)
          campaign_eles[i].display();
      }

      let OutBoundAction = (target: string) => {
        this.go_to_detail(target);
      }

      class CampaignButton {
        /** 지금 주목받고 있는 버튼인지 */
        static isTitle: CampaignButton;
        div: p5.Element;
        /** 대표 이미지 */
        img: p5.Element;
        /** 머릿글 */
        header: p5.Element;
        /** 선택 아닐 때 위치 */
        home_pos: p5.Vector;
        lerpSize = {
          notSel: p.createVector(280, 120),
          selected: p.createVector(480, 280),
        };
        /** 이 클래스 준비 여부 */
        isReady: boolean = false;
        /** 캠페인 버튼 개체
         * @param target 캠페인 이름
         * @param pos 상호작용시 양 끝 위치 (lerp용)
         */
        constructor(target: string, pos: p5.Vector, isGuest: boolean = false) {
          this.home_pos = pos;
          this.lastFontSize = this.fontSize.notSel;
          let json_path: string = `${SERVER_PATH_ROOT}assets/data/sc1_custom/${target}/list.json`;
          p.loadJSON(json_path, v => {
            let randomOne: number = p.floor(p.random(0, v.files.length - 1));
            let img_path = `${SERVER_PATH_ROOT}assets/data/sc1_custom/${target}/Screenshots/${v.files[randomOne]}`;
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
              campaign_eles.forEach(ele => {
                ele.lerp_set = true
              });
            });
            this.header = p.createP(`<b>${target}</b>`);
            this.header.parent(this.div);
            this.header.style('position: absolute; top: 50%; left: 50%; font-size: 48px; margin: 0; transform: translate(-50%, -50%); pointer-events: none');
            this.isReady = true;
          }, e => {
            console.error('json 불러오기 오류: ', e);
          });
        }
        display() {
          if (this.isReady) {
            this.lerpSelected();
          }
        }
        /** 선택 여부에 따라 변하는 수 */
        static selectedLerp: number = 0;
        currentPos: p5.Vector;
        currentSize: p5.Vector;
        /** setget 구성하기 귀찮아 */
        lerp_set: boolean = true;
        /** 선택된 위치는 고정되어야 함 */
        targetPos: p5.Vector;
        targetSize: p5.Vector;
        /** 마지막 지정 폰트 크기 기억 */
        lastFontSize: number;
        currentFontSize: number;
        targetFontSize: number;
        fontSize = {
          notSel: 24,
          selected: 40,
        };
        /** 선택여부에 따른 변화 */
        private lerpSelected() {
          if (this.lerp_set) { // 상호작용으로 상태 변경됨
            let c_pos = this.div.position(); // 현 위치
            let r_pos = div_calc.position(); // 화면대비 상대 위치
            this.currentPos = p.createVector(c_pos['x'], c_pos['y']);
            let c_size = this.div.size(); // 현 크기
            this.currentSize = p.createVector(c_size['width'], c_size['height']);
            this.currentFontSize = this.lastFontSize;
            if (CampaignButton.isTitle == this) { // 선택됨
              this.targetPos = p.createVector(0, 0).add(p.createVector(r_pos['x'], r_pos['y']));
              this.targetSize = this.lerpSize.selected;
              this.targetFontSize = this.fontSize.selected;
            } else { // 선택 아님
              this.targetPos = p.createVector(r_pos['x'], r_pos['y']).add(this.home_pos);
              this.targetSize = this.lerpSize.notSel;
              this.targetFontSize = this.fontSize.notSel;
            }
            CampaignButton.selectedLerp = 0;
            this.lastFontSize = this.targetFontSize;
            this.lerp_set = false;
          }
          let pos = this.currentPos.lerp(this.targetPos, CampaignButton.selectedLerp);
          this.div.position(pos.x, pos.y);
          let size = this.currentSize.lerp(this.targetSize, CampaignButton.selectedLerp);
          this.div.size(size.x, size.y);
          this.currentFontSize = p.lerp(this.currentFontSize, this.targetFontSize, CampaignButton.selectedLerp);
          this.header.style('font-size', `${this.currentFontSize}px`);
          CampaignButton.selectedLerp += .01;
          if (CampaignButton.selectedLerp > 1)
            CampaignButton.selectedLerp = 1;
        }
      }
      p.windowResized = () => {
        campaign_eles.forEach(ele => {
          ele.lerp_set = true;
        });
      }
    }
    new p5(sketch);
  }

  /** 캠페인 상세 페이지로 이동 */
  go_to_detail(target: string) {
    console.log('자세한 설명 페이지로 이동: ', target);
  }

  ionViewWillLeave() {
    this.title.setTitle('Project: Cone');
    const favicon = document.getElementById('favicon');
    favicon.setAttribute('href', 'assets/icon/favicon.png');
  }

}

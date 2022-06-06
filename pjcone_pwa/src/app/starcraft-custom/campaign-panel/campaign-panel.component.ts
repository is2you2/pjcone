import { Component, Input, OnInit } from '@angular/core';

/** 캠페인 정보 일람 */
export interface CampaignData {
  /** 보여지는 제목 */
  title: string,
  /** 캠페인 설명 */
  desc: string,
  /** 이미지 상대경로 */
  _rel_path: string,
}

@Component({
  selector: 'app-campaign-panel',
  templateUrl: './campaign-panel.component.html',
  styleUrls: ['./campaign-panel.component.scss'],
})
export class CampaignPanelComponent implements OnInit {

  @Input() data: CampaignData;

  constructor() { }

  ngOnInit() { }

}

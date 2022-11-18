import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-creator',
  templateUrl: './creator.page.html',
  styleUrls: ['./creator.page.scss'],
})
export class CreatorPage implements OnInit {

  constructor() { }

  /** 번역가 페이지 정보 */
  info = {
    /** 프로필 이미지 */
    img: undefined,
    /** 번역가 표시명 */
    name: '정보 준비중',
    /** 긴 글 */
    text: '기능 준비중',
  };

  ngOnInit() { }

}

import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-translator',
  templateUrl: './translator.page.html',
  styleUrls: ['./translator.page.scss'],
})
export class TranslatorPage implements OnInit {

  constructor() { }

  /** 번역가 페이지 정보 */
  info = {
    /** 프로필 이미지 */
    img: undefined,
    /** 번역가 표시명 */
    name: undefined,
    /** 긴 글 */
    text: undefined,
  };

  ngOnInit() { }

  /** 이 번역가의 정보로 친구추가하기 */
  add_translator() {
    console.warn('add_translator 번역가 친구 추가 기능 없음');
  }
}

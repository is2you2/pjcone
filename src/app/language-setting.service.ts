// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import * as p5 from "p5";

/** 언어 설정에 관하여 */
@Injectable({
  providedIn: 'root'
})
export class LanguageSettingService {

  /** 설정된 언어 */
  lang: string;
  /** 불러와진 모든 문자열  
   * 데이터 구성: { 페이지 구분: { 키워드: 문장 } }
   */
  text = {
    Portal: {},
    Main: {},
    Settings: {},
    Profile: {},
    Nakama: {
      UnexpectedLoginErr: 'Login Failed',
    },
    GlobalAct: {
      FailedToDownloadGodot: 'Failed to Download',
      OnlineMode: 'Online',
      OnlineMode_text: 'You are connected to the server',
      OfflineMode: 'Offline',
      OfflineMode_text: 'No server connected',
    },
    ChatRoom: {
      attachments: 'Attachments',
    },
    TodoDetail: {},
    Administrator: {
      AdminNotiTitle: 'Assistant server manager',
      CanUseAsAdmin: 'Use admin features',
    },
    QRElse: {},
    GroupDetail: {},
  };

  constructor() {
    this.lang = navigator.language.split('-')[0];
    let lang_override = localStorage.getItem('lang');
    if (lang_override)
      this.lang = lang_override;
    setTimeout(() => {
      this.load_selected_lang();
    }, 0);
  }

  /** 설정된 언어로 다시 불러오기 */
  load_selected_lang() {
    new p5((p: p5) => {
      p.setup = () => {
        p.loadTable(`assets/data/translate.csv`, 'csv', 'header',
          (v: p5.Table) => {
            // 지원하지 않는 언어라면 기본값으로 Fallback
            if (!v.columns.includes(this.lang))
              this.lang = 'en';
            localStorage.setItem('lang', this.lang);
            this.ASyncTranslation(v, 0, v.rows.length);
            p.remove();
          }, e => {
            console.error('내부 문서 읽기 실패: ', e);
            p.remove();
          });
      }
    });
  }
  /** nakama 스크립트 상호참조를 우회하여 번역처리 */
  Callback_nakama: Function;
  OnLoading = true;
  /** 순차적으로 번역처리하기 */
  ASyncTranslation(v: p5.Table, i: number, j: number, tmpTitle?: string) {
    if (i < j) {
      if (v.rows[i]['obj']['#'].charAt(0) == '#') {
        tmpTitle = v.rows[i]['obj']['#'].substring(3);
        if (!this.text[tmpTitle])
          this.text[tmpTitle] = {};
      } else this.text[tmpTitle][v.rows[i]['obj']['#']] = v.rows[i]['obj'][this.lang];
      setTimeout(() => {
        this.ASyncTranslation(v, i + 1, j, tmpTitle);
      }, 0);
    } else { // 전부 불러온 후
      this.OnLoading = false;
      this.Callback_nakama();
    }
  }
}
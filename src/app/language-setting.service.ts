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
    Front: {},
    Portal: {},
    Main: {},
    Arcade: {},
    Subscribes: {},
    ChatRoom: {},
    Profile: {},
    GroupServer: {},
    Settings: {},
    Community: {},
    MinimalChat: {},
    voidDraw: {},
    PostViewer: {},
    TodoDetail: {},
    InstantCall: {},
    ContentViewer: {},
  };
  /** 설정가능한 언어 보여주기  
   * setable = [{ value, display_name }, ...]
   */
  setable = [];

  constructor() {
    this.lang = navigator.language.split('-')[0];
    let lang_override = localStorage.getItem('lang');
    if (lang_override)
      this.lang = lang_override;
  }

  /** 설정된 언어로 다시 불러오기 */
  async load_selected_lang(OverrideURL = 'assets/data/translate.csv') {
    return await new Promise((done, err) => {
      new p5((p: p5) => {
        p.setup = () => {
          p.noCanvas();
          p.loadTable(OverrideURL, 'csv', 'header',
            (v: p5.Table) => {
              try {
                // 지원하지 않는 언어라면 기본값으로 Fallback
                let keys = Object.keys(v.rows[0]['obj']);
                this.setable.length = 0;
                for (let key of keys)
                  if (key != '#')
                    this.setable.push({
                      value: key,
                      display_name: v.rows[0]['obj'][key],
                    });
                if (!v.columns.includes(this.lang))
                  this.lang = this.setable[0].value;
                localStorage.setItem('lang', this.lang);
                let tmpTitle: string;
                for (let i = 0, j = v.rows.length; i < j; i++) {
                  if (v.rows[i]['obj']['#'].charAt(0) == '#') {
                    tmpTitle = v.rows[i]['obj']['#'].substring(3);
                    if (!this.text[tmpTitle])
                      this.text[tmpTitle] = {};
                  } else if (tmpTitle) this.text[tmpTitle][v.rows[i]['obj']['#']] = v.rows[i]['obj'][this.lang];
                }
                if (this.Callback_nakama) this.Callback_nakama();
                if (OverrideURL) URL.revokeObjectURL(OverrideURL);
                p.remove();
                done(undefined);
              } catch (e) {
                console.log('사용자 언어 불러오기 실패: ', e);
                if (OverrideURL) URL.revokeObjectURL(OverrideURL);
                p.remove();
                this.load_selected_lang();
                done(undefined);
              }
            }, e => {
              console.error('내부 문서 읽기 실패: ', e);
              if (OverrideURL) URL.revokeObjectURL(OverrideURL);
              p.remove();
              err(e);
            });
        }
      });
    });
  }
  /** nakama 스크립트 상호참조를 우회하여 번역처리 */
  Callback_nakama: Function;
}
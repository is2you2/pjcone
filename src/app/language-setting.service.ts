import { Injectable } from '@angular/core';

/** 언어 설정에 관하여 */
@Injectable({
  providedIn: 'root'
})
export class LanguageSettingService {

  /** 앱에 설정된 언어 */
  lang: string;

  constructor() {
    this.lang = navigator.language.split('-')[0];
    let lang_override = localStorage.getItem('lang');
    if (lang_override)
      this.lang = lang_override;
  }
}
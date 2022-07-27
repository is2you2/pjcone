import { Injectable } from '@angular/core';

/** godot 웹 결과물과 파일을 공유하기 위한 비기랄까 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {

  constructor() { }

  /** IndexedDB */
  private db: IDBDatabase;

  /** 이 동작은 반드시 고도엔진 웹 페이지가 우선 작업한 후에 동작해줘야한다. 우선권을 뺏어가면 안됨
   * localStorage: IndexedDB 키에서 고도가 미리 준비한 경우 'godot'를 값으로 지정한다
   */
  initialize() {
    let check = localStorage.getItem('IndexedDB');
    if (check == 'godot') {
      let req = indexedDB.open('/userfs', 21);
      req.onsuccess = (_ev) => {
        this.db = req.result;
      }
      req.onerror = (e) => {
        console.error('IndexedDB initialized failed: ', e);
      }
    } else {
      console.error('고도엔진이 먼저 동작해야합니다');
    }
  }

  /**
   * 문자열 공유용
   * @param text 문서에 포함될 텍스트
   * @param path 저장될 상대 경로(user://~)
   */
  saveTextFileToUserPath(text: string, path: string) {
    if (!this.db) {
      console.warn('IndexedDB 지정되지 않음');
      return;
    };
    let put = this.db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
      contents: new TextEncoder().encode(text),
      mode: 33206,
      timestamp: new Date(),
    }, `/userfs/${path}`);
    put.onsuccess = (ev) => {
      console.log('쓰기 성공: ', ev);
    }
    put.onerror = (e) => {
      console.error('IndexedDB saveFileToUserPath failed: ', e);
    }
  }

  /** 고도엔진에서 'user://~'에 해당하는 파일 불러오기
   * @param path 'user://~'에 들어가는 사용자 폴더 경로
   * @param act 불러오기 이후 행동. 인자 1개 필요 (load-return)
   */
  loadTextFromUserPath(path: string, act: Function = (r: string) => console.warn(`loadTextFromUserPath 불러오기 행동 없음: ${r}`)) {
    if (!this.db) {
      console.warn('IndexedDB 지정되지 않음');
      return;
    };
    let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
    data.onsuccess = (ev) => {
      act(new TextDecoder().decode(ev.target['result']['contents']));
    }
    data.onerror = (e) => {
      console.error('IndexedDB loadTextFromUserPath failed: ', e);
    }
  }
}

// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Injectable } from '@angular/core';
import { LanguageSettingService } from './language-setting.service';
import { P5ToastService } from './p5-toast.service';

/** godot 웹 결과물과 파일을 공유하기 위한 비기랄까 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {

  constructor(
    private p5toast: P5ToastService,
    private lang: LanguageSettingService,
  ) { }

  /** IndexedDB */
  db: IDBDatabase;

  /** 이 동작은 반드시 고도엔진 웹 페이지가 우선 작업한 후에 동작해줘야한다. 우선권을 뺏어가면 안됨
   * localStorage: IndexedDB 키에서 고도가 미리 준비한 경우 'godot'를 값으로 지정한다
   */
  initialize(_CallBack = () => { }) {
    if (this.db) return;
    if (window['godot'] == 'godot') {
      let req = indexedDB.open('/userfs', 21);
      req.onsuccess = (_ev) => {
        this.db = req.result;
        _CallBack();
      }
      req.onerror = (e) => {
        console.error('IndexedDB initialized failed: ', e);
        _CallBack();
      }
    } else {
      setTimeout(() => {
        this.initialize(_CallBack);
      }, 1000);
    }
  }

  /** 고도엔진 시스템 오류 방지를 위해 폴더구조 생성 */
  private createRecursiveDirectory(path: string) {
    let lastIndexOf = path.lastIndexOf('/');
    let dir = path.substring(0, lastIndexOf);
    if (!dir) return;
    this.checkIfFileExist(dir, b => {
      if (!b) {
        let put = this.db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
          timestamp: new Date(),
          mode: 16893,
        }, `/userfs/${dir}`);
        put.onsuccess = (ev) => {
          if (ev.type != 'success')
            console.error('저장 실패: ', path);
          this.createRecursiveDirectory(dir);
        }
        put.onerror = (e) => {
          console.error('IndexedDB createRecursiveDirectory failed: ', e);
        }
      }
    })
  }

  /**
   * 문자열 공유용
   * @param text 문서에 포함될 텍스트
   * @param path 저장될 상대 경로(user://~)
   */
  saveTextFileToUserPath(text: string, path: string, _CallBack = (_v: any) => { }): Promise<any> {
    if (!this.db) {
      setTimeout(() => {
        this.saveTextFileToUserPath(text, path, _CallBack)
      }, 1000);
      return;
    };
    this.createRecursiveDirectory(path);
    return new Promise((done, error) => {
      let put = this.db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: new TextEncoder().encode(text),
      }, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        _CallBack(ev);
        done(ev);
      }
      put.onerror = (e) => {
        error(e);
      }
    });
  }

  /**
   * 파일 공유용
   * @param base64 문서에 포함될 base64 텍스트
   * @param path 저장될 상대 경로(user://~)
   */
  saveBase64ToUserPath(base64: string, path: string, _CallBack = (_int8array: Int8Array) => { }): Promise<Int8Array> {
    if (!this.db) {
      setTimeout(() => {
        this.saveBase64ToUserPath(base64, path, _CallBack);
      }, 1000);
      return;
    };
    return new Promise((done, error) => {
      let byteStr = atob(base64.split(',')[1]);
      let arrayBuffer = new ArrayBuffer(byteStr.length);
      let int8Array = new Int8Array(arrayBuffer);
      for (let i = 0, j = byteStr.length; i < j; i++)
        int8Array[i] = byteStr.charCodeAt(i);
      this.createRecursiveDirectory(path);
      let put = this.db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: int8Array,
      }, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        _CallBack(int8Array);
        done(int8Array);
      }
      put.onerror = (e) => {
        error(e);
      }
    });
  }

  /**
   * 파일 공유용
   * @param blob 파일정보 | blob
   * @param path 저장될 상대 경로(user://~)
   */
  saveBlobToUserPath(blob: Blob, path: string, _CallBack = (_int8array: Int8Array) => { }): Promise<Int8Array> {
    if (!this.db) {
      setTimeout(() => {
        this.saveBlobToUserPath(blob, path, _CallBack);
      }, 1000);
      return;
    };
    return new Promise(async (done, error) => {
      let int8Array: Int8Array;
      try {
        let arrayBuffer = await blob.arrayBuffer();
        int8Array = new Int8Array(arrayBuffer);
      } catch (e) {
        error(e);
      }
      this.createRecursiveDirectory(path);
      let put = this.db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: int8Array,
      }, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        _CallBack(int8Array);
        done(int8Array);
      }
      put.onerror = (e) => {
        error(e);
      }
    });
  }

  /** 파일이 있는지 검토 */
  checkIfFileExist(path: string, _CallBack = (_b: boolean) => { }): Promise<boolean> {
    if (!this.db) {
      setTimeout(() => {
        this.checkIfFileExist(path, _CallBack);
      }, 1000);
      return;
    }
    return new Promise((done, error) => {
      let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').count(`/userfs/${path}`);
      data.onsuccess = (ev) => {
        let cursor = ev.target['result'];
        _CallBack(cursor);
        done(cursor);
      }
      data.onerror = (e) => {
        error(e);
      }
    });
  }

  /** 모든 파일 리스트로부터 대상 폴더와 겹치는 파일 리스트 추출하기 */
  GetFileListFromDB(path: string, _CallBack = (_list: string[]) => { }): Promise<string[]> {
    if (!this.db) {
      setTimeout(() => {
        this.GetFileListFromDB(path, _CallBack);
      }, 1000);
      return;
    };
    let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').getAllKeys();
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        const keys: string[] = ev.target['result'];
        for (let i = keys.length - 1; i >= 0; i--) {
          if (!keys[i].includes(path))
            keys.splice(i, 1);
          else keys[i] = keys[i].substring(8);
        }
        _CallBack(keys);
        done(keys);
      }
      data.onerror = (e) => {
        error(e);
      }
    });
  }

  /** 모든 파일 리스트로부터 대상 폴더와 겹치는 파일 리스트 추출하기 */
  GetFileInfoFromDB(path: string, _CallBack = (_list: any) => { }): Promise<any> {
    if (!this.db) {
      setTimeout(() => {
        this.GetFileInfoFromDB(path, _CallBack);
      }, 1000);
      return;
    };
    let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        const result = ev.target['result'];
        _CallBack(result);
        done(result);
      }
      data.onerror = (e) => {
        error(e);
      }
    });
  }

  /** 고도엔진에서 'user://~'에 해당하는 파일 불러오기
   * @param path 'user://~'에 들어가는 사용자 폴더 경로
   * @param act 불러오기 이후 행동. 인자 2개 필요 (load-return)
   */
  loadTextFromUserPath(path: string, _CallBack = (_e: boolean, _v: string) => { }): Promise<string> {
    if (!this.db) {
      setTimeout(() => {
        this.loadTextFromUserPath(path, _CallBack);
      }, 1000);
      return;
    };
    return new Promise((done) => {
      let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
      data.onsuccess = (ev) => {
        if (ev.target['result']) {
          let result = new TextDecoder().decode(ev.target['result']['contents']);
          _CallBack(true, result);
          done(result);
        } else {
          _CallBack(false, `No file: , ${path}`);
          done(undefined);
        }
      }
      data.onerror = (e) => {
        console.error('IndexedDB loadTextFromUserPath failed: ', e);
        done(undefined);
      }
    });
  }

  /** 고도엔진의 'user://~'에 해당하는 파일 Blob 상태로 받기
     * @param path 'user://~'에 들어가는 사용자 폴더 경로
     * @param _CallBack 받은 Blob 활용하기
     */
  loadBlobFromUserPath(path: string, mime: string, _CallBack = (_blob: Blob) => { }): Promise<Blob> {
    if (!this.db) {
      setTimeout(() => {
        this.loadBlobFromUserPath(path, mime, _CallBack);
      }, 1000);
      return;
    };
    let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        try {
          let blob = new Blob([ev.target['result']['contents']], { type: mime });
          _CallBack(blob);
          done(blob);
        } catch (e) {
          error(e);
        }
      }
      data.onerror = (e) => {
        error(e);
      }
    });
  }

  /** 고도엔진의 'user://~'에 해당하는 파일 다운받기
   * @param path 'user://~'에 들어가는 사용자 폴더 경로
   * @param filename 저장할 파일 이름
   */
  DownloadFileFromUserPath(path: string, mime: string, filename: string) {
    if (!this.db) {
      setTimeout(() => {
        this.DownloadFileFromUserPath(path, mime, filename);
      }, 1000);
      return;
    };
    let data = this.db.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
    data.onsuccess = (ev) => {
      try {
        let blob = new Blob([ev.target['result']['contents']], { type: mime });
        let url = URL.createObjectURL(blob);
        let link = document.createElement("a");
        link.download = filename;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        link.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.log('DownloadFileFromUserPath: ', e);
        this.p5toast.show({
          text: `${this.lang.text['IndexedDB']['FailedToDownloadFile']}: ${e}`,
        });
      }
    }
    data.onerror = (e) => {
      console.error('IndexedDB DownloadFileFromUserPath failed: ', e);
    }
  }

  removeFileFromUserPath(path: string, _CallBack = (_ev: any) => { }): Promise<any> {
    if (!this.db) {
      setTimeout(() => {
        this.removeFileFromUserPath(path, _CallBack);
      }, 1000);
      return;
    }
    let data = this.db.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').delete(`/userfs/${path}`);
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        _CallBack(ev);
        done(ev);
      }
      data.onerror = (e) => {
        error(e);
      }
    });
  }
}

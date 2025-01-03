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
  ionicDB: IDBDatabase;
  godotDB: IDBDatabase;

  initialize(_CallBack = () => { }) {
    if (this.ionicDB) {
      _CallBack();
      return;
    }
    let req = indexedDB.open('/ionicfs', 10);
    let removeSignals = () => {
      req.onsuccess = null;
      req.onupgradeneeded = null;
      req.onerror = null;
    }
    req.onsuccess = (e) => {
      let db = e.target['result'];
      db.close();
      let second_req = indexedDB.open('/ionicfs', 11);
      second_req.onsuccess = (e) => {
        this.ionicDB = e.target['result'];
        _CallBack();
        removeSignals();
      }
    }
    req.onupgradeneeded = (e) => {
      let database: IDBDatabase = e.target['result'];
      database.createObjectStore('FILE_DATA');
    };
    req.onerror = (_e) => {
      let req = indexedDB.open('/ionicfs', 11);
      req.onsuccess = (e) => {
        this.ionicDB = e.target['result'];
        _CallBack();
        removeSignals();
      }
    }
  }

  /** 이 동작은 반드시 고도엔진 웹 페이지가 우선 작업한 후에 동작해줘야한다. 우선권을 뺏어가면 안됨
   * localStorage: IndexedDB 키에서 고도가 미리 준비한 경우 'godot'를 값으로 지정한다
   */
  async GetGodotIndexedDB() {
    if (this.godotDB) return;
    return new Promise((done, error) => {
      let req = indexedDB.open('/userfs', 21);
      let removeSignals = () => {
        req.onsuccess = null;
        req.onerror = null;
      }
      req.onsuccess = (_ev) => {
        this.godotDB = req.result;
        removeSignals();
        done(undefined);
      }
      req.onerror = (e) => {
        console.error('IndexedDB initialized failed: ', e);
        removeSignals();
        error(e);
      }
    });
  }

  /** 고도엔진 시스템 오류 방지를 위해 폴더구조 생성 */
  private createRecursiveDirectory(path: string, targetDB = this.ionicDB) {
    let lastIndexOf = path.lastIndexOf('/');
    let dir = path.substring(0, lastIndexOf);
    if (!dir) return;
    this.checkIfFileExist(dir).then(_b => {
      let put = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 16893,
      }, `/userfs/${dir}`);
      let removeSignals = () => {
        put.onsuccess = null;
        put.onerror = null;
      }
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        this.createRecursiveDirectory(dir, targetDB);
        removeSignals();
      }
      put.onerror = (e) => {
        console.error('IndexedDB createRecursiveDirectory failed: ', e);
        removeSignals();
      }
    });
  }

  /** 인앱탐색기 편의기능 */
  createDirectory(path: string) {
    return new Promise((done, err) => {
      this.checkIfFileExist(path).then(_b => {
        let put = this.ionicDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
          timestamp: new Date(),
          mode: 16893,
        }, `/userfs/${path}`);
        let removeSignals = () => {
          put.onsuccess = null;
          put.onerror = null;
        }
        put.onsuccess = (ev) => {
          if (ev.type != 'success')
            console.error('저장 실패: ', path);
          removeSignals();
          done(undefined);
        }
        put.onerror = (e) => {
          console.error('IndexedDB createRecursiveDirectory failed: ', e);
          removeSignals();
          err(e);
        }
      });
    });
  }

  /**
   * 문자열 공유용
   * @param text 문서에 포함될 텍스트
   * @param path 저장될 상대 경로(user://~)
   */
  saveTextFileToUserPath(text: string, path: string, targetDB = this.ionicDB): Promise<any> {
    this.createRecursiveDirectory(path, targetDB);
    return new Promise((done, error) => {
      let put = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: new TextEncoder().encode(text),
      }, `/userfs/${path}`);
      let removeSignals = () => {
        put.onsuccess = null;
        put.onerror = null;
      }
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        removeSignals();
        done(ev);
      }
      put.onerror = (e) => {
        removeSignals();
        error(e);
      }
    });
  }

  /**
   * 파일 공유용
   * @param base64 문서에 포함될 base64 텍스트
   * @param path 저장될 상대 경로(user://~)
   */
  saveBase64ToUserPath(base64: string, path: string, targetDB = this.ionicDB): Promise<Int8Array> {
    return new Promise((done, error) => {
      let byteStr = atob(base64.split(',')[1]);
      let arrayBuffer = new ArrayBuffer(byteStr.length);
      let int8Array = new Int8Array(arrayBuffer);
      for (let i = 0, j = byteStr.length; i < j; i++)
        int8Array[i] = byteStr.charCodeAt(i);
      this.createRecursiveDirectory(path, targetDB);
      let put = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: int8Array,
      }, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        put.onsuccess = null;
        put.onerror = null;
        done(int8Array);
      }
      put.onerror = (e) => {
        put.onsuccess = null;
        put.onerror = null;
        error(e);
      }
    });
  }

  /**
   * 파일 공유용
   * @param Int8Array 바이트 배열
   * @param path 저장될 상대 경로(user://~)
   */
  saveInt8ArrayToUserPath(int8Array: Int8Array, path: string, targetDB = this.ionicDB): Promise<void> {
    return new Promise((done, error) => {
      this.createRecursiveDirectory(path, targetDB);
      let put = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: int8Array,
      }, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        put.onsuccess = null;
        put.onerror = null;
        done();
      }
      put.onerror = (e) => {
        put.onsuccess = null;
        put.onerror = null;
        error(e);
      }
    });
  }

  /**
   * 파일 공유용
   * @param blob 파일정보 | blob
   * @param path 저장될 상대 경로(user://~)
   */
  saveBlobToUserPath(blob: Blob, path: string, targetDB = this.ionicDB): Promise<Int8Array> {
    return new Promise(async (done, error) => {
      let int8Array: Int8Array;
      try {
        let arrayBuffer = await blob.arrayBuffer();
        int8Array = new Int8Array(arrayBuffer);
      } catch (e) {
        error(e);
      }
      this.createRecursiveDirectory(path, targetDB);
      let put = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put({
        timestamp: new Date(),
        mode: 33206,
        contents: int8Array,
      }, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        put.onsuccess = null;
        put.onerror = null;
        done(int8Array);
      }
      put.onerror = (e) => {
        put.onsuccess = null;
        put.onerror = null;
        error(e);
      }
    });
  }

  /**
   * 파일 정보로 저장하기
   * @param file GetFileInfoFromDB 로 받은 파일/폴더 정보
   * @param path 저장될 상대 경로(user://~)
   */
  saveFileToUserPath(file: any, path: string, targetDB = this.ionicDB): Promise<any> {
    this.createRecursiveDirectory(path, targetDB);
    return new Promise((done, error) => {
      let put = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').put(file, `/userfs/${path}`);
      put.onsuccess = (ev) => {
        if (ev.type != 'success')
          console.error('저장 실패: ', path);
        put.onsuccess = null;
        put.onerror = null;
        done(ev);
      }
      put.onerror = (e) => {
        put.onsuccess = null;
        put.onerror = null;
        error(e);
      }
    });
  }

  /** 파일이 있는지 검토 */
  checkIfFileExist(path: string, targetDB = this.ionicDB): Promise<boolean> {
    return new Promise((done, error) => {
      let data = targetDB.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').count(`/userfs/${path}`);
      data.onsuccess = (ev) => {
        let cursor = ev.target['result'];
        data.onsuccess = null;
        data.onerror = null;
        done(cursor);
      }
      data.onerror = (e) => {
        data.onsuccess = null;
        data.onerror = null;
        error(e);
      }
    });
  }

  /** 모든 파일 리스트로부터 대상 폴더와 겹치는 파일 리스트 추출하기 */
  GetFileListFromDB(path: string, targetDB = this.ionicDB): Promise<string[]> {
    let data = targetDB.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').getAllKeys();
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        const keys: string[] = ev.target['result'];
        for (let i = keys.length - 1; i >= 0; i--) {
          if (!keys[i].includes(path))
            keys.splice(i, 1);
          else keys[i] = keys[i].substring(8);
        }
        data.onsuccess = null;
        data.onerror = null;
        done(keys);
      }
      data.onerror = (e) => {
        data.onsuccess = null;
        data.onerror = null;
        error(e);
      }
    });
  }

  /** 경로 파일 정보 불러오기 */
  GetFileInfoFromDB(path: string, targetDB = this.ionicDB): Promise<any> {
    let data = targetDB.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        const result = ev.target['result'];
        data.onsuccess = null;
        data.onerror = null;
        done(result);
      }
      data.onerror = (e) => {
        data.onsuccess = null;
        data.onerror = null;
        error(e);
      }
    });
  }

  /** 고도엔진에서 'user://~'에 해당하는 파일 불러오기
   * @param path 'user://~'에 들어가는 사용자 폴더 경로
   * @param act 불러오기 이후 행동. 인자 2개 필요 (load-return)
   */
  loadTextFromUserPath(path: string, _CallBack = (_e: boolean, _v: string) => { }, targetDB = this.ionicDB): Promise<string> {
    return new Promise((done) => {
      let data = targetDB.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
      data.onsuccess = (ev) => {
        if (ev.target['result']) {
          let result = new TextDecoder().decode(ev.target['result']['contents']);
          data.onsuccess = null;
          data.onerror = null;
          _CallBack(true, result);
          done(result);
        } else {
          data.onsuccess = null;
          data.onerror = null;
          _CallBack(false, `No file: , ${path}`);
          done(undefined);
        }
      }
      data.onerror = (e) => {
        console.error('IndexedDB loadTextFromUserPath failed: ', e);
        data.onsuccess = null;
        data.onerror = null;
        done(undefined);
      }
    });
  }

  /** 고도엔진의 'user://~'에 해당하는 파일 Blob 상태로 받기
     * @param path 'user://~'에 들어가는 사용자 폴더 경로
     */
  loadBlobFromUserPath(path: string, mime: string, targetDB = this.ionicDB): Promise<Blob> {
    let data = targetDB.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        try {
          let blob = new Blob([ev.target['result']['contents']], { type: mime });
          data.onsuccess = null;
          data.onerror = null;
          done(blob);
        } catch (e) {
          data.onsuccess = null;
          data.onerror = null;
          error(e);
        }
      }
      data.onerror = (e) => {
        data.onsuccess = null;
        data.onerror = null;
        error(e);
      }
    });
  }

  /** 고도엔진의 'user://~'에 해당하는 파일 다운받기
   * @param path 'user://~'에 들어가는 사용자 폴더 경로
   * @param filename 저장할 파일 이름
   */
  DownloadFileFromUserPath(path: string, mime: string, filename: string, targetDB = this.ionicDB) {
    let data = targetDB.transaction('FILE_DATA', 'readonly').objectStore('FILE_DATA').get(`/userfs/${path}`);
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
        console.error('DownloadFileFromUserPath: ', e);
        this.p5toast.show({
          text: `${this.lang.text['IndexedDB']['FailedToDownloadFile']}: ${e}`,
        });
      }
      data.onsuccess = null;
      data.onerror = null;
    }
    data.onerror = (e) => {
      console.error('IndexedDB DownloadFileFromUserPath failed: ', e);
      data.onsuccess = null;
      data.onerror = null;
    }
  }

  removeFileFromUserPath(path: string, targetDB = this.ionicDB): Promise<any> {
    let data = targetDB.transaction('FILE_DATA', 'readwrite').objectStore('FILE_DATA').delete(`/userfs/${path}`);
    return new Promise((done, error) => {
      data.onsuccess = (ev) => {
        data.onsuccess = null;
        data.onerror = null;
        done(ev);
      }
      data.onerror = (e) => {
        data.onsuccess = null;
        data.onerror = null;
        error(e);
      }
    });
  }
}

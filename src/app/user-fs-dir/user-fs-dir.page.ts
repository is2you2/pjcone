import { Component, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AlertController, IonAccordionGroup, LoadingController, ModalController, NavController, NavParams } from '@ionic/angular';
import { isPlatform } from '../app.component';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';
import { LanguageSettingService } from '../language-setting.service';
import { P5ToastService } from '../p5-toast.service';
import { IonicViewerPage } from '../portal/subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { Filesystem } from '@capacitor/filesystem';
import { LocalNotiService } from '../local-noti.service';
import { NakamaService } from '../nakama.service';
import * as p5 from 'p5';
import { VoidDrawPage } from '../portal/subscribes/chat-room/void-draw/void-draw.page';

/** userfs 의 파일과 폴더 형식 */
interface FileDir {
  path?: string;
  timestamp?: number;
  mode?: number;
  /** 현재 경로와 대조하는 용도 */
  dir?: string;
  /** 경로를 제외한 보여지는 이름 */
  name?: string;
  /** 파일 확장자 구분용 */
  file_ext?: string;
  thumbnail?: any;
  /** 콘텐츠 뷰어 지원 여부 */
  viewer?: string;
  /** 대상 db */
  db?: any;
}

@Component({
  selector: 'app-user-fs-dir',
  templateUrl: './user-fs-dir.page.html',
  styleUrls: ['./user-fs-dir.page.scss'],
})
export class UserFsDirPage implements OnInit {

  /** 현재 디렉토리, 보여지는 파일 분류용 */
  CurrentDir: string;
  /** 디렉토리 폴더 리스트, 파일보다 우선 나열, 이름순 나열 */
  DirList: FileDir[] = [];
  /** 디렉토리 파일 리스트, 이름순 나열 */
  FileList: FileDir[] = [];
  cant_dedicated = false;

  @ViewChild('FileSel') FileSel: IonAccordionGroup;

  constructor(
    public modalCtrl: ModalController,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    private sanitizer: DomSanitizer,
    private navCtrl: NavController,
    private noti: LocalNotiService,
    private navParams: NavParams,
    private nakama: NakamaService,
  ) { }

  is_ready = false;
  /** 할 일 등에서 파일 선택을 위해 생성되었는지 */
  is_file_selector: boolean = false;
  /** 인앱 브라우저 내 썸네일 토글 */
  HideThumbnail = false;
  /** 모바일 웹에서는 폴더 수입 제한 */
  CanImportFolder = true;

  toggle_thumbnail() {
    this.HideThumbnail = !this.HideThumbnail;
    localStorage.setItem('user-fs-thumbnail', `${this.HideThumbnail ? '1' : '0'}`);
  }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.pushState(null, null, window.location.href);
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        this.BackButtonPressed = true;
        this.navCtrl.back();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    if (isPlatform == 'DesktopPWA')
      setTimeout(() => {
        this.CreateDrop();
      }, 100);
    this.CanImportFolder = isPlatform != 'MobilePWA';
  }

  initLoadingElement: HTMLIonLoadingElement;

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      if (this.is_ready) {
        if (this.CurrentDir == '') {
          this.navCtrl.pop();
        } else this.MoveToUpDir();
      } else {
        this.initLoadingElement.dismiss();
        this.is_ready = true;
      }
    }
  }

  p5canvas: p5;
  CreateDrop() {
    let parent = document.getElementById('p5Drop_userfs');
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
        canvas.parent(parent);
        p.pixelDensity(.1);
        canvas.drop((file: any) => {
          let _Millis = p.millis();
          if (LastDropAt < _Millis - 400) { // 새로운 파일로 인식
            isMultipleSend = false;
            Drops.length = 0;
            Drops.push(file);
          } else { // 여러 파일 입력으로 인식
            isMultipleSend = true;
            Drops.push(file);
          }
          LastDropAt = _Millis;
          clearTimeout(StartAct);
          StartAct = setTimeout(async () => {
            if (!isMultipleSend) {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
              loading.present();
              this.importSelected(file.file);
              loading.dismiss();
            } else { // 여러 파일 발송 여부 검토 후, 아니라고 하면 첫 파일만
              this.MultipleDrops(Drops);
            }
          }, 400);
        });
      }
      let StartAct: any;
      let isMultipleSend = false;
      let LastDropAt = 0;
      let Drops = [];
      p.mouseMoved = (ev: any) => {
        if (ev['dataTransfer']) {
          parent.style.pointerEvents = 'all';
          parent.style.backgroundColor = '#0008';
        } else {
          parent.style.pointerEvents = 'none';
          parent.style.backgroundColor = 'transparent';
        }
      }
    });
  }

  /** 폴더 만들기 */
  CreateNewFolder() {
    this.alertCtrl.create({
      header: this.lang.text['UserFsDir']['CreateFolder'],
      inputs: [{
        type: 'text',
        placeholder: this.lang.text['UserFsDir']['FolderName'],
      }],
      buttons: [{
        text: this.lang.text['UserFsDir']['Create'],
        handler: async (ev: any) => {
          if (ev[0]) {
            try {
              let targetPath = `${this.CurrentDir}/${ev[0]}`;
              await this.indexed.createDirectory(targetPath);
              let info = await this.indexed.GetFileInfoFromDB(targetPath);
              let _info: FileDir = {
                path: targetPath,
                mode: info['mode'],
                timestamp: info['timestamp'],
                db: this.indexed.ionicDB,
              };
              _info.name = ev[0];
              _info.dir = this.CurrentDir;
              this.DirList.push(_info);
            } catch (e) {
              console.error('폴더 생성 실패: ', e);
              this.p5toast.show({
                text: `${this.lang.text['UserFsDir']['FailedToCreateFolder']}: ${e}`,
              });
            }
          } else {
            this.p5toast.show({
              text: this.lang.text['UserFsDir']['NeedFolderName'],
            });
          }
        }
      }]
    }).then(v => {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.ionViewDidEnter();
      });
      v.present();
    });
  }

  /** 파일 추가하기 */
  SelectFiles() {
    document.getElementById('import_file').click();
  }

  async MultipleDrops(Drops: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
    loading.present();
    for (let i = 0, j = Drops.length; i < j; i++) {
      await this.importSelected(Drops[i].file);
    }
    loading.dismiss();
  }

  /** 파일 첨부하기 */
  async inputFileSelected(ev: any) {
    if (ev.target.files.length) {
      let is_multiple_files = ev.target.files.length != 1;
      if (is_multiple_files) {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['MultipleSave'] });
        loading.present();
        for (let i = 0, j = ev.target.files.length; i < j; i++) {
          if (this.StopIndexing) break;
          loading.message = `${this.lang.text['UserFsDir']['MultipleSave']}: ${j - i}`;
          await this.importSelected(ev.target.files[i]);
        }
        this.noti.ClearNoti(4);
        loading.dismiss();
      } else {
        let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
        loading.present();
        await this.importSelected(ev.target.files[0]);
        loading.dismiss();
      }
    }
  }

  async importSelected(file: any) {
    try {
      let targetPath = `${this.CurrentDir}/${file.name}`;
      await this.indexed.saveBlobToUserPath(file, targetPath);
      let info = await this.indexed.GetFileInfoFromDB(targetPath);
      let _info: FileDir = {
        path: targetPath,
        mode: info['mode'],
        timestamp: info['timestamp'],
        db: this.indexed.ionicDB,
      };
      _info.name = file.name;
      _info.dir = this.CurrentDir;
      _info.file_ext = _info.name.split('.').pop();
      this.global.set_viewer_category_from_ext(_info);
      if (_info.viewer == 'image')
        this.indexed.loadBlobFromUserPath(_info.path, '', blob => {
          let TmpURL = URL.createObjectURL(blob);
          _info.thumbnail = this.sanitizer.bypassSecurityTrustUrl(TmpURL);
        });
      try { // 사용자 이름 재지정
        let sep = _info.path.split('/');
        if (sep.length != 5 || sep[3] != 'groups') throw '그룹 이미지 파일이 아님';
        this.SetDisplayGroupImageName(_info, sep);
      } catch (error) { }
      // 같은 이름의 파일 덮어쓰기처리
      for (let i = 0, j = this.FileList.length; i < j; i++)
        if (this.FileList[i].path == targetPath) {
          this.FileList.splice(i, 1);
          break;
        }
      this.FileList.push(_info);
    } catch (e) {
      console.log('importSelected error: ', e);
    }
  }

  StopIndexing = false;

  ionViewWillEnter() {
    this.HideThumbnail = localStorage.getItem('user-fs-thumbnail') == '1';
    this.CurrentDir = '';
    this.is_file_selector = Boolean(this.navParams.data.modal);
    this.LoadAllIndexedFiles();
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
  }

  async dismiss_page(file?: FileDir) {
    if (this.is_file_selector) {
      let return_data = undefined;
      if (file) {
        return_data = await this.indexed.loadBlobFromUserPath(file.path, '');
        return_data['name'] = file.name;
        return_data['file_ext'] = file.file_ext;
      }
      this.modalCtrl.dismiss(return_data);
    }
  }

  /** 폴더를 선택했을 때 */
  async LoadAllIndexedFiles() {
    this.initLoadingElement = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    this.initLoadingElement.present();
    this.DirList.length = 0;
    this.FileList.length = 0;
    if (this.is_file_selector) {
      if (this.navParams.get('path')) { // 특정 경로 파일 보기
        let target_list = await this.indexed.GetFileListFromDB(this.navParams.get('path'));
        await this.ModulateIndexedFile(target_list);
      } else { // 인앱 파일 고르기
        let _ionic_list = await this.indexed.GetFileListFromDB('/files/');
        await this.ModulateIndexedFile(_ionic_list);
      }
    } else {
      let _ionic_list = await this.indexed.GetFileListFromDB('/')
      await this.ModulateIndexedFile(_ionic_list);
    }
    if (this.is_file_selector) {
      this.FileList.sort((a, b) => {
        if (a.timestamp < b.timestamp) return 1;
        if (a.timestamp > b.timestamp) return -1;
        return 0;
      });
    } else {
      this.FileList.sort((a, b) => {
        if (a.path > b.path) return 1;
        if (a.path < b.path) return -1;
        return 0;
      });
      this.DirList.sort((a, b) => {
        if (a.path > b.path) return 1;
        if (a.path < b.path) return -1;
        return 0;
      });
    }
    this.noti.ClearNoti(5);
    this.initLoadingElement.dismiss();
    this.is_ready = true;
  }

  async ModulateIndexedFile(_list: string[]) {
    for (let i = 0, j = _list.length; i < j; i++) {
      if (this.StopIndexing) return;
      let message = `${this.lang.text['UserFsDir']['LoadingExplorer']}: ${_list.length - i}`;
      this.initLoadingElement.message = message;
      await this.indexed.GetFileInfoFromDB(_list[i], (info) => {
        let _info: FileDir = {
          path: _list[i],
          mode: info['mode'],
          timestamp: info['timestamp'],
        };
        _info.name = _info.path.substring(_info.path.lastIndexOf('/') + 1);
        _info.dir = _list[i].substring(0, _list[i].lastIndexOf('/'));
        switch (_info.mode) {
          case 33206: // 파일인 경우
            _info.file_ext = _info.name.split('.').pop();
            this.global.set_viewer_category_from_ext(_info);
            if (_info.viewer == 'image')
              this.indexed.loadBlobFromUserPath(_info.path, '', blob => {
                let TmpURL = URL.createObjectURL(blob);
                _info.thumbnail = this.sanitizer.bypassSecurityTrustUrl(TmpURL);
              });
            try { // 사용자 이름 재지정
              let sep = _info.path.split('/');
              if (sep.length != 5 || sep[3] != 'groups') throw '그룹 이미지 파일이 아님';
              this.SetDisplayGroupImageName(_info, sep);
            } catch (error) { }
            this.FileList.push(_info);
            break;
          case 16893: // 폴더인 경우
            if (_info.path.indexOf('todo/') == 0)
              this.SetDisplayTodoName(_info);
            let SetRename = false; // 이름 재지정 여부 검토
            let sep = _info.path.split('/');
            try { // 채널 이름 재지정
              if (sep.length != 5 || sep[3] != 'channels') throw '채널 폴더가 아님';
              this.SetDisplayChannelName(_info, sep);
              SetRename = true;
            } catch (e) { }
            try { // 사용자 이름 재지정
              if (SetRename || sep.length != 5 || sep[3] != 'users') throw '사용자 폴더가 아님';
              this.SetDisplayUserName(_info, sep);
              SetRename = true;
            } catch (error) { }
            this.DirList.push(_info);
            break
          default: // 예외처리
            console.log('예상하지 못한 파일 모드: ', _info);
            break;
        }
      });
    }
    this.noti.ClearNoti(5);
  }

  // 아래 SetDisplay~Name 함수들은 사람이 읽기 좋은 파일 구조를 보여주기 위해 구성됨
  async SetDisplayTodoName(info: FileDir) {
    try {
      let open_file = await this.indexed.loadTextFromUserPath(`${info.path}/info.todo`);
      let json = JSON.parse(open_file);
      info.name = json['title'];
    } catch (e) {
      console.error('SetDisplayTodoName error: ', e);
    }
  }

  SetDisplayUserName(info: FileDir, sep: string[]) {
    try {
      info.name = this.nakama.users[sep[1]][sep[2]][sep[4]]['display_name'];
    } catch (e) { }
  }

  SetDisplayChannelName(info: FileDir, sep: string[]) {
    try {
      info.name = this.nakama.channels_orig[sep[1]][sep[2]][info.name]['title'];
    } catch (e) { }
  }

  SetDisplayGroupImageName(info: FileDir, sep: string[]) {
    try {
      info.name = `${this.nakama.groups[sep[1]][sep[2]][sep[4].split('.').shift()]['name']}.img`;
    } catch (e) {
      console.log('SetDisplayGroupImageName error: ', e);
    }
  }

  /** 폴더 윗 단계로 */
  MoveToUpDir() {
    this.CurrentDir = this.CurrentDir.substring(0, this.CurrentDir.lastIndexOf('/'));
    this.FileSel.value = undefined;
  }

  SelectFolder(info: FileDir) {
    this.CurrentDir = info.path;
    this.FileSel.value = undefined;
  }

  lock_modal_open = false;
  async OpenFile(info: FileDir) {
    if (this.lock_modal_open) return;
    this.lock_modal_open = true;
    if (!this.CheckIfAccessable(info.path)) return;
    let createRelevances = [];
    if (this.is_file_selector) {
      if (this.navParams.data['path'])
        for (let i = 0, j = this.FileList.length; i < j; i++)
          createRelevances.push({ content: this.FileList[i] });
    } else {
      for (let i = 0, j = this.FileList.length; i < j; i++)
        if (this.FileList[i]['dir'] == this.CurrentDir)
          createRelevances.push({ content: this.FileList[i] });
    } {
      let blob = await this.indexed.loadBlobFromUserPath(info.path, '');
      info['size'] = blob.size;
    }
    this.modalCtrl.create({
      component: IonicViewerPage,
      componentProps: {
        info: {
          content: info,
        },
        no_edit: true,
        path: info.path,
        relevance: createRelevances,
      },
      cssClass: 'fullscreen',
    }).then(v => {
      delete this.global.p5key['KeyShortCut']['Escape'];
      delete this.global.p5key['KeyShortCut']['Digit'];
      v.onDidDismiss().then(v => {
        this.lock_modal_open = false;
        if (v.data) { // 파일 편집하기를 누른 경우
          switch (v.data.type) {
            case 'image':
              this.modalCtrl.create({
                component: VoidDrawPage,
                componentProps: {
                  path: v.data.path,
                  width: v.data.width,
                  height: v.data.height,
                  text: v.data.text,
                  isDarkMode: v.data.isDarkMode,
                  scrollHeight: v.data.scrollHeight,
                },
                cssClass: 'fullscreen',
              }).then(v => {
                v.onWillDismiss().then(async v => {
                  if (v.data) {
                    let blob = this.global.Base64ToBlob(v.data['img'], 'image/png');
                    blob['name'] = v.data['name'];
                    await this.importSelected(blob);
                    v.data['loadingCtrl'].dismiss();
                  }
                  this.ionViewDidEnter();
                });
                v.present();
              });
              return;
            case 'text':
              this.importSelected(v.data['blob']);
              break;
          }
        } else {
          this.ionViewDidEnter();
        }
      });
      v.present()
    });
  }

  CheckIfAccessable(path: string) {
    switch (path) { // 비밀번호가 포함된 파일 열람 거부
      case 'servers/webrtc_server.json':
      case 'servers/self/profile.json':
        this.p5toast.show({
          text: this.lang.text['UserFsDir']['PrivateAccessDenied'],
        });
        return false;
    }
    return true;
  }

  DownloadFile(info: FileDir) {
    if (!this.CheckIfAccessable(info.path)) return;
    this.indexed.DownloadFileFromUserPath(info.path, '', info.name);
  }

  SelectImportFolder() {
      let input = document.getElementById('folder_sel_id');
      input.click();
  }
  async inputImageSelected(ev: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    loading.present();
    for (let i = 0, j = ev.target.files.length; i < j; i++) {
      if (this.StopIndexing) {
        loading.dismiss();
        return;
      }
      await this.indexed.saveBlobToUserPath(ev.target.files[i], ev.target.files[i].webkitRelativePath);
    }
    this.LoadAllIndexedFiles();
    loading.dismiss();
    this.p5toast.show({
      text: this.lang.text['UserFsDir']['NeedResetToApply'],
    });
  }

  RemoveDirectoryRecursive() {
    this.alertCtrl.create({
      header: this.CurrentDir.substring(this.CurrentDir.lastIndexOf('/') + 1) || this.lang.text['UserFsDir']['ResetDB'],
      message: this.lang.text['UserFsDir']['RemoveThisFolder'],
      buttons: [{
        text: this.lang.text['UserFsDir']['RemoveApply'],
        handler: async () => {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['DeleteFile'] });
          loading.present();
          let list = await this.indexed.GetFileListFromDB(this.CurrentDir);
          for (let i = 0, j = list.length; i < j; i++) {
            if (this.StopIndexing) {
              loading.dismiss();
              return;
            }
            loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`;
            await this.indexed.removeFileFromUserPath(list[i]);
          }
          for (let i = this.DirList.length - 1; i >= 0; i--)
            if (this.DirList[i].path.indexOf(this.CurrentDir) == 0)
              this.DirList.splice(i, 1);
          for (let i = this.FileList.length - 1; i >= 0; i--)
            if (this.FileList[i].path.indexOf(this.CurrentDir) == 0)
              this.FileList.splice(i, 1);
          this.MoveToUpDir();
          loading.dismiss();
          this.noti.ClearNoti(4);
        },
        cssClass: 'redfont',
      }],
    }).then(v => {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.ionViewDidEnter();
      });
      v.present();
    });
  }

  RemoveFile(info: FileDir, i: number) {
    this.alertCtrl.create({
      header: this.lang.text['UserFsDir']['DeleteFile'],
      message: this.lang.text['ChatRoom']['CannotUndone'],
      buttons: [{
        text: this.lang.text['UserFsDir']['DeleteAccept'],
        handler: () => {
          this.indexed.removeFileFromUserPath(info.path, () => {
            this.FileList.splice(i, 1);
          });
        },
        cssClass: 'redfont',
      }]
    }).then(v => {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.ionViewDidEnter();
      });
      v.present();
    });
  }

  ionViewDidLeave() {
    this.StopIndexing = true;
    this.FileList.forEach(file => {
      URL.revokeObjectURL(file.thumbnail);
    });
    setTimeout(() => {
      this.noti.ClearNoti(4);
      this.noti.ClearNoti(5);
    }, 1000);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    delete this.global.p5key['KeyShortCut']['Digit'];
  }
}

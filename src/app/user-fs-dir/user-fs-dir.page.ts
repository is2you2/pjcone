import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AlertController, IonAccordionGroup, LoadingController, NavController } from '@ionic/angular';
import { isPlatform } from '../app.component';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';
import { LanguageSettingService } from '../language-setting.service';
import { P5ToastService } from '../p5-toast.service';
import { LocalNotiService } from '../local-noti.service';
import { NakamaService } from '../nakama.service';
import * as p5 from 'p5';
import { ActivatedRoute, Router } from '@angular/router';

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
export class UserFsDirPage implements OnInit, OnDestroy {

  /** 현재 디렉토리, 보여지는 파일 분류용 */
  CurrentDir: string;
  /** 디렉토리 폴더 리스트, 파일보다 우선 나열, 이름순 나열 */
  DirList: FileDir[] = [];
  /** 디렉토리 파일 리스트, 이름순 나열 */
  FileList: FileDir[] = [];
  cant_dedicated = false;

  @ViewChild('FileSel') FileSel: IonAccordionGroup;

  constructor(
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    private sanitizer: DomSanitizer,
    private navCtrl: NavController,
    private noti: LocalNotiService,
    private nakama: NakamaService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }
  ngOnDestroy(): void {
    this.route.queryParams['unsubscribe']();
    if (this.global.PageDismissAct[this.navParams.dismiss])
      this.global.PageDismissAct[this.navParams.dismiss]({});
  }

  is_ready = false;
  /** 인앱 브라우저 내 썸네일 토글 */
  HideThumbnail = false;
  /** 모바일 웹에서는 폴더 수입 제한 */
  CanImportFolder = true;

  toggle_thumbnail() {
    this.HideThumbnail = !this.HideThumbnail;
    localStorage.setItem('user-fs-thumbnail', `${this.HideThumbnail ? '1' : '0'}`);
  }

  navParams: any;
  ngOnInit() {
    if (isPlatform == 'DesktopPWA')
      setTimeout(() => {
        this.CreateDrop();
      }, 100);
    this.CanImportFolder = isPlatform != 'MobilePWA';
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      this.navParams = navParams || {};
    });
  }

  initLoadingElement: HTMLIonLoadingElement;

  ionViewDidEnter() {
    this.global.p5KeyShortCut['Escape'] = () => {
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
              let targetPath = `${this.CurrentDir ? (this.CurrentDir + '/') : ''}${ev[0]}`;
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
      this.global.p5KeyShortCut['Escape'] = () => {
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
      let targetPath = `${this.CurrentDir ? (this.CurrentDir + '/') : ''}${file.name}`;
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
    if (this.lock_modal_open) {
      this.lock_modal_open = false;
      return;
    }
    this.HideThumbnail = localStorage.getItem('user-fs-thumbnail') == '1';
    this.CurrentDir = '';
    this.LoadAllIndexedFiles();
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
  }

  async dismiss_page(file?: FileDir) {
    if (this.navParams.selector) {
      let return_data = undefined;
      if (file) {
        return_data = await this.indexed.loadBlobFromUserPath(file.path, '');
        return_data['name'] = file.name;
        return_data['file_ext'] = file.file_ext;
      }
      if (this.global.PageDismissAct[this.navParams.dismiss])
        this.global.PageDismissAct[this.navParams.dismiss]();
      this.navCtrl.pop();
    }
  }

  /** 폴더를 선택했을 때 */
  async LoadAllIndexedFiles() {
    this.initLoadingElement = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    this.initLoadingElement.present();
    this.DirList.length = 0;
    this.FileList.length = 0;
    if (this.navParams.selector) {
      if (this.navParams.path) { // 특정 경로 파일 보기
        let target_list = await this.indexed.GetFileListFromDB(this.navParams.path);
        await this.ModulateIndexedFile(target_list);
      } else { // 인앱 파일 고르기
        let _ionic_list = await this.indexed.GetFileListFromDB('/files/');
        await this.ModulateIndexedFile(_ionic_list);
      }
    } else {
      let _ionic_list = await this.indexed.GetFileListFromDB('/')
      await this.ModulateIndexedFile(_ionic_list);
    }
    if (this.navParams.selector) {
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
            try { // 게시물 작성자 재지정
              if (SetRename || sep.length != 5 || sep[3] != 'posts') throw '게시물 작성자 폴더가 아님';
              this.SetDisplayPostWriterName(_info, sep);
              SetRename = true;
            } catch (error) { }
            try { // 게시물 이름 재지정
              if (SetRename || sep.length != 6 || sep[3] != 'posts') throw '게시물 폴더가 아님';
              this.SetDisplayPostName(_info, sep);
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
    } catch (e) { }
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
    } catch (e) { }
  }

  SetDisplayPostWriterName(info: FileDir, sep: string[]) {
    try {
      info.name = this.nakama.users[sep[1]][sep[2]][sep[4]]['display_name'];
    } catch (e) {
      if (this.nakama.servers[sep[1]][sep[2]].session.user_id == info.name)
        info.name = this.nakama.users.self['display_name']
    }
  }

  async SetDisplayPostName(info: FileDir, sep: string[]) {
    try {
      let open_file = await this.indexed.loadTextFromUserPath(`${info.path}/info.json`);
      let json = JSON.parse(open_file);
      info.name = json['title'];
    } catch (e) {
      console.log('SetDisplayPostName error: ', e);
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
    let createRelevances = [];
    if (this.navParams.selector) {
      if (this.navParams.path)
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
    this.global.PageDismissAct['userfs-viewer'] = (v: any) => {
      if (v.data) { // 파일 편집하기를 누른 경우
        switch (v.data.type) {
          case 'image':
            this.global.PageDismissAct['userfs-modify-image'] = async (v: any) => {
              if (v.data) {
                let blob = this.global.Base64ToBlob(v.data['img'], 'image/png');
                blob['name'] = v.data['name'];
                await this.importSelected(blob);
                v.data['loadingCtrl'].dismiss();
              }
              this.ionViewDidEnter();
              this.global.RestoreShortCutAct('userfs-modify-image');
              delete this.global.PageDismissAct['userfs-modify-image'];
            }
            this.global.StoreShortCutAct('userfs-modify-image');
            this.global.ActLikeModal('void-draw', {
              path: v.data.path,
              width: v.data.width,
              height: v.data.height,
              text: v.data.text,
              isDarkMode: v.data.isDarkMode,
              scrollHeight: v.data.scrollHeight,
              dismiss: 'userfs-modify-image',
            });
            return;
          case 'text':
            this.importSelected(v.data['blob']);
            break;
        }
      } else {
        this.ionViewDidEnter();
      }
      this.global.RestoreShortCutAct('userfs-viewer');
      delete this.global.PageDismissAct['userfs-viewer'];
    }
    this.global.StoreShortCutAct('userfs-viewer');
    this.global.ActLikeModal('ionic-viewer', {
      info: {
        content: info,
      },
      path: info.path,
      relevance: createRelevances,
    });
  }

  DownloadFile(info: FileDir) {
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

  /** 폴더 및 파일에 우클릭시 즉시 삭제 질의 절차 진행  
   * @param index 파일 삭제시 리스트에서도 삭제하기 위한 번호처리
   */
  DeleteShortcut(info: any, index?: number) {
    switch (info.mode) {
      case 16893: // 폴더 삭제 처리
        this.RemoveDirectoryRecursive(info.path);
        break;
      case 33206: // 파일 삭제처리
        this.RemoveFile(info, index);
        break;
      default:
        console.log('오류 검토용: ', info);
        break;
    }
    return false;
  }

  RemoveDirectoryRecursive(dir = this.CurrentDir) {
    this.alertCtrl.create({
      header: dir.substring(dir.lastIndexOf('/') + 1) || this.lang.text['UserFsDir']['ResetDB'],
      message: this.lang.text['UserFsDir']['RemoveThisFolder'],
      buttons: [{
        text: this.lang.text['UserFsDir']['RemoveApply'],
        handler: async () => {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['DeleteFile'] });
          loading.present();
          let list = await this.indexed.GetFileListFromDB(dir);
          for (let i = 0, j = list.length; i < j; i++) {
            if (this.StopIndexing) {
              loading.dismiss();
              return;
            }
            loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`;
            await this.indexed.removeFileFromUserPath(list[i]);
          }
          for (let i = this.DirList.length - 1; i >= 0; i--)
            if (this.DirList[i].path.indexOf(dir) == 0)
              this.DirList.splice(i, 1);
          for (let i = this.FileList.length - 1; i >= 0; i--)
            if (this.FileList[i].path.indexOf(dir) == 0)
              this.FileList.splice(i, 1);
          if (dir === this.CurrentDir) this.MoveToUpDir();
          loading.dismiss();
          this.noti.ClearNoti(4);
        },
        cssClass: 'redfont',
      }],
    }).then(v => {
      this.global.p5KeyShortCut['Escape'] = () => {
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
      header: info.name,
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
      this.global.p5KeyShortCut['Escape'] = () => {
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
    delete this.global.p5KeyShortCut['Escape'];
    delete this.global.p5KeyShortCut['Digit'];
  }
}

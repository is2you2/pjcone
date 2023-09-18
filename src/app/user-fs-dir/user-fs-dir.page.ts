import { Component, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AlertController, IonAccordionGroup, LoadingController, ModalController, NavController } from '@ionic/angular';
import { isPlatform } from '../app.component';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';
import { LanguageSettingService } from '../language-setting.service';
import { P5ToastService } from '../p5-toast.service';
import { IonicViewerPage } from '../portal/subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { File } from '@awesome-cordova-plugins/file/ngx';

/** userfs 의 파일과 폴더 형식 */
interface FileDir {
  path?: string;
  timestamp?: string;
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

  InAppBrowser = true;

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
    private file: File,
    private navCtrl: NavController,
  ) { }

  is_ready = false;

  ngOnInit() { }

  initLoadingElement: HTMLIonLoadingElement;

  EventListenerAct = (ev: any) => {
    ev.detail.register(110, (processNextHandler: any) => {
      if (this.is_ready) {
        if (this.CurrentDir == '') {
          processNextHandler();
        } else this.MoveToUpDir();
      } else {
        this.initLoadingElement.dismiss();
        if (this.modalCtrl['injector']['source'] != 'UserFsDirPageModule')
          this.modalCtrl.dismiss();
        else this.navCtrl.back();
      }
    });
  }

  ionViewWillEnter() {
    this.CurrentDir = '';
    this.LoadAllIndexedFiles();
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    document.addEventListener('ionBackButton', this.EventListenerAct);
  }

  /** 폴더를 선택했을 때 */
  async LoadAllIndexedFiles() {
    this.initLoadingElement = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    this.initLoadingElement.present();
    this.DirList.length = 0;
    this.FileList.length = 0;
    await this.indexed.GetFileListFromDB('/', async (_list) => {
      for (let i = 0, j = _list.length; i < j; i++) {
        await this.indexed.GetFileInfoFromDB(_list[i], (info) => {
          let _info: FileDir = {
            path: _list[i],
            mode: info['mode'],
            timestamp: new Date(info['timestamp']).toLocaleString(),
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
              this.FileList.push(_info);
              break;
            case 16893: // 폴더인 경우
              this.DirList.push(_info);
              break
            default: // 예외처리
              console.log('예상하지 못한 파일 모드: ', _info);
              break;
          }
        });
      }
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
      this.initLoadingElement.dismiss();
      this.is_ready = true;
    });
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

  OpenFile(info: FileDir) {
    switch (info.viewer) {
      case 'disabled':
        this.p5toast.show({
          text: this.lang.text['UserFsDir']['CannotOpenFile'],
        });
        break;
      default:
        document.removeEventListener('ionBackButton', this.EventListenerAct);
        this.modalCtrl.create({
          component: IonicViewerPage,
          componentProps: {
            info: {
              content: {
                filename: info.name,
                file_ext: info.file_ext,
                type: '',
                viewer: info.viewer,
                path: info.path,
              }
            },
            no_edit: true,
            path: info.path,
          },
        }).then(v => {
          v.onDidDismiss().then(_v => document.addEventListener('ionBackButton', this.EventListenerAct));
          v.present()
        });
        break;
    }
  }

  DownloadFile(info: FileDir) {
    this.indexed.DownloadFileFromUserPath(info.path, '', info.name);
  }

  ExportDirectoryRecursive() {
    this.alertCtrl.create({
      header: this.lang.text['UserFsDir']['ExportDirTitle'],
      message: this.lang.text['UserFsDir']['ExportDirMsg'],
      buttons: [{
        text: this.lang.text['UserFsDir']['ExportConfirm'],
        handler: async () => {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
          loading.present();
          this.indexed.GetFileListFromDB(this.CurrentDir, list => {
            list.forEach(async path => {
              let FileInfo = await this.indexed.GetFileInfoFromDB(path);
              let blob = await this.indexed.loadBlobFromUserPath(path, '');
              let last_sep = path.lastIndexOf('/');
              let only_path = path.substring(0, last_sep);
              let filename = path.substring(last_sep + 1);
              await this.CreateFolderRecursive(only_path);
              try {
                if (FileInfo.mode == 16893) throw '이거 폴더임';
                await this.file.writeFile(this.file.externalDataDirectory + only_path + '/', filename, blob, {
                  replace: true,
                });
              } catch (e) {
                console.error(path, ': 파일 저장 실패: ', e);
              }
            });
          });
          loading.dismiss();
        }
      }]
    }).then(v => v.present());
  }

  async CreateFolderRecursive(folder_path: string) {
    let sep = folder_path.lastIndexOf('/') + 1;
    let forward_folder = folder_path.substring(0, sep);
    let folder_name = folder_path.substring(sep);
    await this.file.createDir(this.file.externalDataDirectory + forward_folder, folder_name, true);
  }

  ExternalFolder = [];
  async BrowseExternalFiles() {
    this.ExternalFolder.length = 0;
    this.InAppBrowser = false;
    this.ExternalFolder = await this.file.listDir(this.file.externalApplicationStorageDirectory, 'files');
    this.ExternalFolder.sort();
    this.ExternalFolder.sort((a, _b) => {
      if (a.isDirectory) return -1;
      else return 1;
    });
  }

  async importFolderMiddleAct(entry: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    loading.present();
    await this.importThisFolder(entry);
    this.InAppBrowser = true;
    loading.dismiss();
  }

  /** 이 폴더와 파일 재귀 임포팅 */
  async importThisFolder(entry: any) {
    let path = entry.nativeURL.substring(0, entry.nativeURL.length - 1);
    let last_sep = path.lastIndexOf('/');
    let RecursiveEntry: any[] = await this.file.listDir(path.substring(0, last_sep) + '/', path.substring(last_sep + 1));
    for (let i = 0, j = RecursiveEntry.length; i < j; i++)
      if (RecursiveEntry[i].isDirectory)
        await this.importThisFolder(RecursiveEntry[i]);
      else {
        let target_path = RecursiveEntry[i].nativeURL.split('org.pjcone.portal/files/')[1];
        let target_sep = RecursiveEntry[i].nativeURL.lastIndexOf('/') + 1;
        let target_folder = RecursiveEntry[i].nativeURL.substring(0, target_sep);
        console.log(target_path);
        console.log(target_folder);
        console.log(RecursiveEntry[i].name);
        try {
          let readFile = await this.file.readAsDataURL(target_folder, RecursiveEntry[i].name);
          console.log('불러오기 성공: ', readFile);
        } catch (e) {
          console.log('불러오기 실패: ', e);
        }
      }
  }

  SelectImportFolder() {
    if (this.cant_dedicated) {
      let input = document.getElementById('folder_sel_id');
      input.click();
    } else {
      this.BrowseExternalFiles();
    }
  }
  async inputImageSelected(ev: any) {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    loading.present();
    for (let i = 0, j = ev.target.files.length; i < j; i++)
      await this.indexed.saveBlobToUserPath(ev.target.files[i], ev.target.files[i].webkitRelativePath);
    this.LoadAllIndexedFiles();
    loading.dismiss();
  }

  RemoveDirectoryRecursive() {
    this.alertCtrl.create({
      header: this.CurrentDir.substring(this.CurrentDir.lastIndexOf('/') + 1),
      message: this.lang.text['UserFsDir']['RemoveThisFolder'],
      buttons: [{
        text: this.lang.text['UserFsDir']['RemoveApply'],
        handler: () => {
          this.indexed.GetFileListFromDB(this.CurrentDir, (list) => {
            list.forEach(async path => await this.indexed.removeFileFromUserPath(path))
            for (let i = this.DirList.length - 1; i >= 0; i--)
              if (this.DirList[i].path.indexOf(this.CurrentDir) == 0)
                this.DirList.splice(i, 1);
            for (let i = this.FileList.length - 1; i >= 0; i--)
              if (this.FileList[i].path.indexOf(this.CurrentDir) == 0)
                this.FileList.splice(i, 1);
            this.MoveToUpDir();
          })
        }
      }],
    }).then(v => v.present());
  }

  RemoveFile(info: FileDir, i: number) {
    this.alertCtrl.create({
      header: this.lang.text['UserFsDir']['DeleteFile'],
      message: this.lang.text['UserFsDir']['CannotBeUndo'],
      buttons: [{
        text: this.lang.text['UserFsDir']['DeleteAccept'],
        handler: () => {
          this.indexed.removeFileFromUserPath(info.path, () => {
            this.FileList.splice(i, 1);
          });
        }
      }]
    }).then(v => v.present());
  }

  ionViewDidLeave() {
    this.FileList.forEach(file => {
      if (file.thumbnail)
        URL.revokeObjectURL(file.thumbnail);
    });
  }

  ionViewWillLeave() {
    document.removeEventListener('ionBackButton', this.EventListenerAct);
  }
}

import { Component, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AlertController, IonAccordionGroup, LoadingController, ModalController, NavParams } from '@ionic/angular';
import { isPlatform } from '../app.component';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';
import { LanguageSettingService } from '../language-setting.service';
import { P5ToastService } from '../p5-toast.service';
import { GodotViewerPage } from '../portal/subscribes/chat-room/godot-viewer/godot-viewer.page';
import { IonicViewerPage } from '../portal/subscribes/chat-room/ionic-viewer/ionic-viewer.page';

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
  /** 행동을 반환하기로 했습니까? */
  WillReturn: boolean;
  cant_dedicated = false;

  @ViewChild('FileSel') FileSel: IonAccordionGroup;

  constructor(
    public modalCtrl: ModalController,
    private indexed: IndexedDBService,
    private loadingCtrl: LoadingController,
    public lang: LanguageSettingService,
    private navParams: NavParams,
    private global: GlobalActService,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    private sanitizer: DomSanitizer,
  ) { }

  is_ready = false;

  ngOnInit() { }

  EventListenerAct = (ev: any) => {
    ev.detail.register(110, (processNextHandler: any) => {
      if (this.CurrentDir == '' && this.is_ready) {
        processNextHandler();
      } else this.MoveToUpDir();
    });
  }

  ionViewWillEnter() {
    let StartDir = this.navParams.get('path');
    this.CurrentDir = StartDir || '';
    this.LoadAllIndexedFiles();
    this.WillReturn = this.navParams.get('return') || false;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    document.addEventListener('ionBackButton', this.EventListenerAct);
  }

  /** 폴더를 선택했을 때 */
  async LoadAllIndexedFiles() {
    let loading = await this.loadingCtrl.create({ message: this.lang.text['UserFsDir']['LoadingExplorer'] });
    loading.present();
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
              _info.file_ext = _info.name.split('.')[1];
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
        if (a.path < b.path) return 1;
        if (a.path > b.path) return -1;
        return 0;
      });
      this.DirList.sort((a, b) => {
        if (a.path < b.path) return 1;
        if (a.path > b.path) return -1;
        return 0;
      });
      loading.dismiss();
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

  /** 이 파일을 사용하기 (경로 반환) */
  UseFile(info: FileDir) {
    this.modalCtrl.dismiss({ info: info });
  }

  OpenFile(info: FileDir) {
    switch (info.viewer) {
      case 'godot':
        document.removeEventListener('ionBackButton', this.EventListenerAct);
        this.modalCtrl.create({
          component: GodotViewerPage,
          componentProps: {
            info: {
              filename: info.name,
              file_ext: info.file_ext,
              type: '',
              viewer: info.viewer,
            },
            path: info.path,
          },
        }).then(v => {
          v.onDidDismiss().then(_v => document.addEventListener('ionBackButton', this.EventListenerAct));
          v.present()
        });
        break;
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
              filename: info.name,
              file_ext: info.file_ext,
              type: '',
              viewer: info.viewer,
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

  RemoveDirectoryRecursive() {
    this.alertCtrl.create({
      header: this.lang.text['UserFsDir']['RemoveFolder'],
      message: this.lang.text['UserFsDir']['RemoveThisFolder'],
      buttons: [{
        text: this.lang.text['UserFsDir']['RemoveApply'],
        handler: () => {
          this.indexed.GetFileListFromDB(this.CurrentDir, (list) => {
            list.forEach(path => this.indexed.removeFileFromUserPath(path))
            this.LoadAllIndexedFiles();
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

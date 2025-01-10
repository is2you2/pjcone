import { Component, OnInit, ViewChild } from '@angular/core';
import { AnimationController, NavController, iosTransitionAnimation } from '@ionic/angular';
import { IonModal } from '@ionic/angular/common';
import * as p5 from 'p5';
import { FileInfo, GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MiniranchatClientService } from 'src/app/miniranchat-client.service';
import { ArcadeForm, NakamaService } from 'src/app/nakama.service';
import { P5LoadingService } from 'src/app/p5-loading.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';

@Component({
  selector: 'app-arcade',
  templateUrl: './arcade.page.html',
  styleUrls: ['./arcade.page.scss'],
})
export class ArcadePage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public statusBar: StatusManageService,
    public nakama: NakamaService,
    private navCtrl: NavController,
    private client: MiniranchatClientService,
    public global: GlobalActService,
    private indexed: IndexedDBService,
    private animationCtrl: AnimationController,
    private p5toast: P5ToastService,
    private p5loading: P5LoadingService,
  ) { }

  ngOnInit() { }

  async ionViewWillEnter() {
    this.WillLeave = false;
    // 공식으로 제공하는 게임 리스트가 없으면 불러오기 시도하기
    if (!this.nakama.ArcadeListOfficial.length) {
      try {
        let res = await fetch('https://is2you2.github.io/pjcone_arcade.json');
        if (res.ok) {
          let json = await res.json();
          this.nakama.ArcadeListOfficial = json;
        } else throw res;
      } catch (e) {
        console.log('공식 아케이드 리스트 불러오기 실패: ', e);
      }
    }
  }

  ionViewDidEnter() {
    try {
      const officialFilter = document.getElementById('official_filter');
      if (!officialFilter.onfocus)
        officialFilter.onfocus = () => {
          this.global.BlockMainShortcut = true;
        }
      if (!officialFilter.onblur)
        officialFilter.onblur = () => {
          this.global.BlockMainShortcut = true;
        }
    } catch (e) { }
    try {
      const dedicatedFilter = document.getElementById('dedicated_filter');
      if (!dedicatedFilter.onfocus)
        dedicatedFilter.onfocus = () => {
          this.global.BlockMainShortcut = true;
        }
      if (!dedicatedFilter.onblur)
        dedicatedFilter.onblur = () => {
          this.global.BlockMainShortcut = true;
        }
    } catch (e) { }
  }

  WillLeave = false;
  /** 정확히 현재 페이지가 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (this.WillLeave) {
      await new Promise((done) => setTimeout(done, 0));
    }
  }

  ionViewWillLeave() {
    this.global.RestoreShortCutAct('arcade-fileviewer');
    this.global.ArcadeWithFullScreen = false;
    this.WillLeave = true;
  }

  /** 그림판 열기 행동 */
  QuickLinkAct() {
    this.global.PageDismissAct['voiddraw-remote'] = (_v: any) => {
      delete this.global.PageDismissAct['voiddraw-remote'];
    }
    this.global.ActLikeModal('portal/arcade/void-draw', {
      dismiss: 'voiddraw-remote',
    });
  }

  CheckIfDismissAct(ev: any) {
    switch (ev.target.id) {
      case 'arcade_detail':
        this.ArcadeDetail.dismiss();
        break;
      case 'inapp_qrscanner':
        this.InAppQRScanner.dismiss();
        break;
    }
  }

  @ViewChild('ArcadeDetail') ArcadeDetail: IonModal;

  /** pck 파일 업로드하기 */
  AddCustomGame() {
    document.getElementById('arcade_file_input').click();
  }
  inputFileSelected(ev: any) {
    try {
      let targetFile = ev.target.files[0];
      const FileEXT = targetFile.name.split('.').pop();
      switch (FileEXT) {
        // pck 파일을 고도엔진 뷰어에서 열기
        case 'pck':
          this.global.CreateArcadeFrame({
            blob: targetFile,
          });
          break;
        // html 파일을 iframe 에서 열기
        case 'html':
        // 파일 리스트 정보를 통해 추가 등록하기
        case 'json':
        // 나머지는 무시
        default:
          throw FileEXT;
      }
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['Arcade']['InputError']}: ${e}`,
      });
      console.log('아케이드 파일 입력 실패: ', e);
    }
    document.getElementById('arcade_file_input')['value'] = null;
  }

  /** 검색어를 입력함 */
  SearchTextInput(type: string, ev: any) {
    let target: ArcadeForm[] = [];
    switch (type) {
      case 'official':
        target = this.nakama.ArcadeListOfficial;
        break;
      case 'dedicated':
        target = this.nakama.ArcadeList;
        break;
    }
    for (let info of target) {
      let searchKeyword = info.name;
      for (let searchKey of (info.searchKey || []))
        searchKeyword += searchKey;
      const HasNoKeyFromName = searchKeyword.toLowerCase().indexOf(ev.target.value.toLowerCase()) < 0;
      info.hide = HasNoKeyFromName;
    }
  }

  /** 클립보드에 복사된 주소 URL을 다운받아서 열기 */
  AddCustomGameFromClipboard() {
    this.global.ArcadeObject.QRCode = this.ArcadeQRShare;
    this.global.OpenGodotFromURL();
    return false;
  }

  /** 파일을 선택해서 뷰어에 띄우기 */
  LoadFileFromLocal() {
    document.getElementById('arcade_file_load').click();
  }
  async LoadFileFromLocalAct(ev: any) {
    let StartFile: FileInfo;
    let AllFiles: any[] = [];
    try {
      for (let i = 0, j = ev.target.files.length; i < j; i++) {
        let fileInfo: FileInfo = {};
        fileInfo['filename'] = ev.target.files[i].name;
        fileInfo['file_ext'] = ev.target.files[i].name.split('.').pop() || ev.target.files[i].type || this.lang.text['ChatRoom']['unknown_ext'];
        fileInfo['size'] = ev.target.files[i].size;
        fileInfo['type'] = ev.target.files[i].type || ev.target.files[i].type_override;
        fileInfo.blob = ev.target.files[i];
        this.global.set_viewer_category_from_ext(fileInfo);
        fileInfo.path = `tmp_files/arcade/[${i}] ${ev.target.files[i].name}`;
        await this.indexed.saveBlobToUserPath(ev.target.files[i], fileInfo.path);
        if (!StartFile) StartFile = fileInfo;
        AllFiles.push({
          content: fileInfo,
        });
      }
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['Arcade']['InputError']}: ${e}`,
      });
      console.log('아케이드 파일 입력 실패: ', e);
    }
    this.global.PageDismissAct['arcade-fileviewer'] = (_v: any) => {
      this.global.RestoreShortCutAct('arcade-fileviewer');
      this.indexed.GetFileListFromDB('tmp_files/arcade/').then(list => {
        list.forEach(path => this.indexed.removeFileFromUserPath(path));
      });
      delete this.global.PageDismissAct['arcade-fileviewer'];
    }
    this.global.StoreShortCutAct('arcade-fileviewer');
    this.global.ActLikeModal('portal/arcade/ionic-viewer', {
      info: {
        content: StartFile,
      },
      relevance: AllFiles,
      noEdit: true,
      noTextEdit: true,
      quick: true,
      dismiss: 'arcade-fileviewer',
    });
    document.getElementById('arcade_file_load')['value'] = null;
  }
  /** 클립보드로부터 불러오기 */
  LoadFileFromClipboard() {
    let ClipboardAct = async () => {
      let clipboard = await this.global.GetValueFromClipboard();
      switch (clipboard.type) {
        case 'text/plain': {
          this.global.PageDismissAct['arcade-clipboard'] = (_v: any) => {
            this.global.RestoreShortCutAct('arcade-fileviewer');
            delete this.global.PageDismissAct['arcade-clipboard'];
          }
          let fileInfo: FileInfo = {};
          fileInfo.filename = clipboard.value.split('/').pop();
          fileInfo.file_ext = fileInfo.filename.split('.').pop();
          fileInfo.url = clipboard.value;
          fileInfo.path = `tmp_files/arcade/${fileInfo.filename}`;
          fileInfo.type = fileInfo.file_ext == 'html' ? 'text/html' : fileInfo.type;
          this.global.set_viewer_category_from_ext(fileInfo);
          this.global.StoreShortCutAct('arcade-fileviewer');
          this.global.ActLikeModal('portal/arcade/ionic-viewer', {
            info: {
              content: fileInfo,
            },
            relevance: [{
              content: fileInfo,
            }],
            noEdit: true,
            noTextEdit: true,
            quick: true,
            dismiss: 'arcade-clipboard',
          });
        }
          break;
        case 'image/png':
          this.LoadFileFromLocalAct({ target: { files: [clipboard.value] } });
          break;
        default:
          console.log('아케이드-클립보드로부터 파일 읽기 오류: ', clipboard.value);
          this.LoadFileFromLocal();
          break;
      }
    }
    ClipboardAct();
    return false;
  }

  /** 게임 정보 보기 */
  ShowGameInfo() {
    this.ArcadeDetail.onDidDismiss().then(() => {
      this.global.RestoreShortCutAct('arcade_detail');
    });
    this.global.StoreShortCutAct('arcade_detail');
    this.ArcadeDetail.present();
  }

  enterAnimation = (baseEl: HTMLElement) => {
    const root = baseEl.shadowRoot;

    const backdropAnimation = this.animationCtrl
      .create()
      .addElement(root.querySelector('ion-backdrop')!)
      .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

    const wrapperAnimation = this.animationCtrl
      .create()
      .addElement(root.querySelector('.modal-wrapper')!)
      .keyframes([
        { offset: 0, opacity: '0', transform: 'scale(0)' },
        { offset: 1, opacity: '1', transform: 'scale(1)' },
      ]);

    return this.animationCtrl
      .create()
      .addElement(baseEl)
      .easing('ease-out')
      .duration(250)
      .addAnimation([backdropAnimation, wrapperAnimation]);
  };

  leaveAnimation = (baseEl: HTMLElement) => {
    return this.enterAnimation(baseEl).direction('reverse');
  };

  /** 그림판 우클릭 행동, 첨부파일 우선 불러오기 행동하기 */
  QuickLinkContextmenu() {
    let Quicklink = async () => {
      let clipboard = await this.global.GetValueFromClipboard();
      switch (clipboard.type) {
        // 이미지인 경우 파일 뷰어로 열기
        case 'image/png':
          const file: File = clipboard.value;
          this.SelectVoidDrawBackgroundImage({ target: { files: [file] } });
          break;
        default:
          document.getElementById('arcade_voiddraw_img').click();
          break;
      }
    }
    Quicklink();
    return false;
  }

  /** 이미지를 불러온 후 즉시 그림판에 대입하기 */
  async SelectVoidDrawBackgroundImage(ev: any) {
    const file: File = ev.target.files[0];
    const TMP_PATH = `tmp_files/quick_act/${file.name}`;
    await this.indexed.saveBlobToUserPath(file, TMP_PATH);
    let blob = await this.indexed.loadBlobFromUserPath(TMP_PATH, file.type);
    const FileURL = URL.createObjectURL(blob);
    new p5((p: p5) => {
      p.setup = () => {
        document.getElementById('arcade_voiddraw_img')['value'] = '';
        p.noCanvas();
        p.loadImage(FileURL, v => {
          this.global.PageDismissAct['voiddraw-remote'] = (_v: any) => {
            delete this.global.PageDismissAct['voiddraw-remote'];
          }
          this.global.ActLikeModal('portal/arcade/void-draw', {
            path: TMP_PATH,
            width: v.width,
            height: v.height,
            type: file.type,
            dismiss: 'voiddraw-remote',
          });
          URL.revokeObjectURL(FileURL);
          p.remove();
        }, e => {
          console.log('빠른 편집기 이동 실패: ', e);
          URL.revokeObjectURL(FileURL);
          p.remove();
        });
      }
    });
  }

  /** 익명성 그룹 채널에 참가하기 */
  JoinSmallTalk() {
    if (this.statusBar.settings['dedicated_groupchat'] != 'online'
      && this.statusBar.settings['dedicated_groupchat'] != 'certified')
      this.statusBar.settings['dedicated_groupchat'] = 'pending';
    this.client.RejoinGroupChat();
  }

  /** 즉석 통화 페이지로 이동 */
  JoinInstantCall() {
    this.navCtrl.navigateForward('portal/arcade/instant-call', {
      animation: iosTransitionAnimation,
    });
  }

  @ViewChild('ArcadeQRShare') ArcadeQRShare: IonModal;

  QRCodeSRC: any;
  copy_address(target: string) {
    this.global.WriteValueToClipboard('text/plain', target);
  }

  @ViewChild('InAppQRScanner') InAppQRScanner: IonModal;
  QRScanResult: string;
  ChangeDeviceFunc: Function;
  /** QR스캐너 열기 */
  async OpenScanner() {
    const actId = `arcade_OpenScanner_${Date.now()}`;
    await this.p5loading.update({
      id: actId,
      message: this.lang.text['Arcade']['OpeningCamera'],
      forceEnd: null,
    });
    this.QRScanResult = null;
    this.global.StoreShortCutAct('qrcode-scanner');
    let zxing_scanner = await fetch('assets/p5js/zxing_scanner.js');
    let zxing_scannerBlob = await zxing_scanner.blob();
    let zxing_scannerURL = URL.createObjectURL(zxing_scannerBlob);
    let p5js = await fetch('assets/p5js/libraries/p5.min.js');
    let p5jsBlob = await p5js.blob();
    let p5jsURL = URL.createObjectURL(p5jsBlob);
    let zxing = await fetch('assets/p5js/libraries/zxing@0.21.3.min.js');
    let zxingBlob = await zxing.blob();
    let zxingURL = URL.createObjectURL(zxingBlob);
    let scanMain = await fetch('assets/p5js/zxing.html');
    let scanMainText = await scanMain.text();
    scanMainText = scanMainText.replace('<script language="javascript" type="text/javascript" src="libraries/p5.min.js"></script>',
      `<script language="javascript" type="text/javascript" src="${p5jsURL}"></script>`)
      .replace('<script language="javascript" type="text/javascript" src="libraries/zxing@0.21.3.min.js"></script>',
        `<script language="javascript" type="text/javascript" src="${zxingURL}"></script>`)
      .replace('<script language="javascript" type="text/javascript" src="zxing_scanner.js"></script>',
        `<script language="javascript" type="text/javascript" src="${zxing_scannerURL}"></script>`);
    let scanMainBlob = new Blob([scanMainText], { type: 'text/html' });
    let MainURL = URL.createObjectURL(scanMainBlob);
    this.InAppQRScanner.onDidDismiss().then(() => {
      URL.revokeObjectURL(MainURL);
      URL.revokeObjectURL(zxing_scannerURL);
      URL.revokeObjectURL(p5jsURL);
      URL.revokeObjectURL(zxingURL);
      this.ChangeDeviceFunc = null;
      this.global.RestoreShortCutAct('qrcode-scanner');
    });
    await this.InAppQRScanner.present();
    this.p5loading.update({
      id: actId,
      forceEnd: 350,
    });
    let iframe = document.getElementById('qr_scan_frame') as HTMLIFrameElement;
    iframe.src = MainURL;
    let contentWindow = iframe.contentWindow || iframe.contentDocument;
    setTimeout(() => {
      this.ChangeDeviceFunc = contentWindow['ChangeDevice'];
      contentWindow['load_failed'] = (e: any) => {
        this.p5toast.show({
          text: `${this.lang.text['Subscribes']['QRScanInitFailed']}: ${e}`,
        });
        this.InAppQRScanner.dismiss();
      }
      contentWindow['scan_result'] = async (result: any) => {
        try {
          this.QRScanResult = result.text;
          if (this.QRScanResult) {
            let result = await this.nakama.open_url_link(this.QRScanResult, false);
            if (result) this.InAppQRScanner.dismiss();
          }
        } catch (e) {
          console.log('QR스캔 실패: ', e);
        }
      }
    }, 1000);
  }

  /** QRCode 스캔 중 장치 변경하기 */
  ChangeScanDevice() {
    if (this.ChangeDeviceFunc) this.ChangeDeviceFunc();
  }

  /** 이 탭에서 빠른 진입 링크 열람하기 */
  OpenQuickLink() {
    const actId = `arcade_OpenQuickLink_${Date.now()}`;
    let contextAct = async () => {
      const from_clipboard = await this.global.GetValueFromClipboard(actId);
      switch (from_clipboard.type) {
        // 텍스트는 주소로 처리하기
        case 'text/plain':
          const address = from_clipboard.value;
          const custom_default = this.global.GetConnectedAddress();
          const header_address = await this.global.GetHeaderAddress();
          if (address.indexOf('https://is2you2.github.io/pjcone_pwa/?') == 0 || address.indexOf(`${custom_default}?`) == 0
            || address.indexOf(`${header_address}?`) == 0) {
            const init = this.global.CatchGETs(address) || {};
            try {
              const actJson = await this.nakama.AddressToQRCodeAct(init, true);
              await this.nakama.act_from_QRInfo(actJson, 'portal/arcade/');
            } catch (e) {
              console.log('open_url_link: ', e);
              this.p5toast.show({
                text: `${this.lang.text['AddGroup']['DiffFormat']}: ${e}`,
              });
            }
          } else {
            this.p5loading.update({
              id: actId,
              message: `${this.lang.text['AddGroup']['DiffFormat']}: ${address}`,
              progress: 0,
            });
          }
          break;
        // 이미지는 뷰어로 열기
        case 'image/png':
          this.LoadFileFromLocalAct({ target: { files: [from_clipboard.value] } });
          break;
        case 'error':
          this.p5toast.show({
            text: `${this.lang.text['GlobalAct']['FailedToReadClipboard']}: ${from_clipboard.value}`,
          });
          break;
      }
    }
    contextAct();
    return false;
  }
}

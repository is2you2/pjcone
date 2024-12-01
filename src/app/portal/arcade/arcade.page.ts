import { Component, OnInit, ViewChild } from '@angular/core';
import { AnimationController, NavController, iosTransitionAnimation } from '@ionic/angular';
import { IonModal } from '@ionic/angular/common';
import * as p5 from 'p5';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MiniranchatClientService } from 'src/app/miniranchat-client.service';
import { NakamaService } from 'src/app/nakama.service';
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
  ) { }

  ngOnInit() { }

  async ionViewWillEnter() {
    this.WillLeave = false;
  }

  WillLeave = false;
  /** 정확히 현재 페이지가 처리되어야하는 경우 사용 */
  async WaitingCurrent() {
    while (this.WillLeave) {
      await new Promise((done) => setTimeout(done, 0));
    }
  }

  ionViewWillLeave() {
    this.WillLeave = true;
  }

  /** 그림판 열기 행동 */
  async QuickLinkAct() {
    let clipboard = await this.global.GetValueFromClipboard();
    switch (clipboard.type) {
      // 이미지인 경우 파일 뷰어로 열기
      case 'image/png':
        const file: File = clipboard.value;
        this.SelectVoidDrawBackgroundImage({ target: { files: [file] } });
      default:
        this.global.PageDismissAct['voiddraw-remote'] = (_v: any) => {
          delete this.global.PageDismissAct['voiddraw-remote'];
        }
        this.global.ActLikeModal('portal/arcade/void-draw', {
          dismiss: 'voiddraw-remote',
        });
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

  /** 클립보드에 복사된 주소 URL을 다운받아서 열기 */
  AddCustomGameFromClipboard() {
    this.global.ArcadeObject.QRCode = this.ArcadeQRShare;
    this.global.OpenGodotFromURL();
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
    document.getElementById('arcade_voiddraw_img').click();
    return false;
  }

  /** 이미지를 불러온 후 즉시 그림판에 대입하기 */
  async SelectVoidDrawBackgroundImage(ev: any) {
    const file: File = ev.target.files[0];
    const TMP_PATH = `tmp_files/quick_act/${file.name}`;
    await this.indexed.saveBlobToUserPath(file, TMP_PATH);
    let blob = await this.indexed.loadBlobFromUserPath(TMP_PATH, file.type);
    let FileURL = URL.createObjectURL(blob);
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
}

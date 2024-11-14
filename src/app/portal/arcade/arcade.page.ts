import { Component, OnInit, ViewChild } from '@angular/core';
import { NavController, iosTransitionAnimation } from '@ionic/angular';
import { IonModal } from '@ionic/angular/common';
import * as p5 from 'p5';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { MiniranchatClientService } from 'src/app/miniranchat-client.service';
import { NakamaService } from 'src/app/nakama.service';
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
  ) { }

  /** 아케이드 정보 수집 */
  ArcadeList = [];

  ngOnInit() { }

  async ionViewWillEnter() {
    this.WillLeave = false;
    let servers = this.nakama.get_all_online_server();
    let TmpList = [];
    for (let i = 0, j = servers.length; i < j; i++) {
      try {
        let v = await servers[i].client.readStorageObjects(
          servers[i].session, {
          object_ids: [{
            collection: 'arcade',
            key: 'url',
          }]
        });
        if (v.objects.length) {
          let TargetURL = v.objects[0].value['data'];
          let res = await fetch(TargetURL);
          console.log('읽어보기 경과: ', res);
        }
      } catch (e) {
        console.log('리스트 불러오기 실패: ', e);
      }
    }
    this.ArcadeList = TmpList;
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

  /** 빠른 진입 링크 행동 즉시하기 */
  async QuickLinkAct() {
    let clipboard = await this.global.GetValueFromClipboard();
    switch (clipboard.type) {
      // 텍스트인 경우 새 그림판 생성하기
      case 'text/plain':
        this.global.PageDismissAct['voiddraw-remote'] = (v: any) => {
          delete this.global.PageDismissAct['voiddraw-remote'];
        }
        this.global.ActLikeModal('portal/arcade/void-draw', {
          dismiss: 'voiddraw-remote',
        });
        break;
      // 이미지인 경우 파일 뷰어로 열기
      case 'image/png':
        const file: File = clipboard.value;
        const TMP_PATH = `tmp_files/quick_act/${file.name}`;
        await this.indexed.saveBlobToUserPath(file, TMP_PATH);
        let blob = await this.indexed.loadBlobFromUserPath(TMP_PATH, file.type);
        let FileURL = URL.createObjectURL(blob);
        new p5((p: p5) => {
          p.setup = () => {
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
}

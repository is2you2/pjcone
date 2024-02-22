// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { ModalController, NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT, isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { AddGroupPage } from '../settings/add-group/add-group.page';
import { QRelsePage } from './qrelse/qrelse.page';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private nav: NavController,
    private indexed: IndexedDBService,
  ) { }

  ngOnInit() {
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
  }

  cant_dedicated = false;

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Backquote'] = () => {
        this.go_to_page('group-server');
      }
      this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
        if (this.nakama.channels.length > index)
          this.go_to_chatroom(this.nakama.channels[index]);
        else this.add_new_group();
      };
    }
    if (this.global.p5key && this.global.p5key['KeyShortCut']
      && !this.global.p5key['KeyShortCut']['AddAct'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.add_new_group();
      };
  }

  ionViewDidEnter() {
    this.nakama.subscribe_lock = true;
    this.nakama.resumeBanner();
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.try_add_shortcut();
  }

  go_to_page(_page: string) {
    this.nav.navigateForward(`settings/${_page}`);
    this.nakama.removeBanner();
  }

  EventListenerAct = (ev: any) => {
    ev.detail.register(110, (processNextHandler: any) => {
      processNextHandler();
      this.StopScan();
      document.removeEventListener('ionBackButton', this.EventListenerAct);
    });
  }

  StartScan = false;
  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  async scanQRCode() {
    let perm = await BarcodeScanner.checkPermission({ force: true });
    const complete = '온전한 동작 후 종료';
    document.addEventListener('ionBackButton', this.EventListenerAct);
    try {
      if (!perm.granted || this.StartScan) throw '시작 불가상태';
      this.StartScan = true;
      document.querySelector('body').classList.add('scanner-active');
      await BarcodeScanner.hideBackground();
      const result = await BarcodeScanner.startScan();
      if (result.hasContent) {
        try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다main
          if (result.content.trim().indexOf(`${SERVER_PATH_ROOT}pjcone_pwa/?`) != 0)
            throw '주소 시작이 다름';
          await this.nakama.AddressToQRCodeAct(this.global.CatchGETs(result.content.trim()));
        } catch (e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: result },
          }).then(v => v.present());
        }
      }
      throw complete;
    } catch (e) {
      if (e != complete)
        this.p5toast.show({
          text: this.lang.text['Subscribes']['CameraPermissionDenied'],
        });
      this.StopScan();
    }
    document.removeEventListener('ionBackButton', this.EventListenerAct);
  }

  StopScan() {
    this.StartScan = false;
    document.querySelector('body').classList.remove('scanner-active');
    BarcodeScanner.showBackground();
    BarcodeScanner.stopScan();
  }

  lock_chatroom = false;
  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    if (!this.lock_chatroom) {
      this.lock_chatroom = true;
      this.nakama.go_to_chatroom_without_admob_act(info);
      if (info['status'] != 'online' || info['status'] != 'pending')
        delete info['is_new'];
      this.lock_chatroom = false;
    }
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    let server_info = this.nakama.notifications_rearrange[i]['server'];
    let _is_official = server_info['isOfficial'];
    let _target = server_info['target'];
    this.nakama.check_notifications(this.nakama.notifications_rearrange[i], _is_official, _target);
  }

  /** 새 그룹 추가하기 */
  add_new_group() {
    this.modalCtrl.create({
      component: AddGroupPage,
    }).then(v => {
      let cache_func = this.global.p5key['KeyShortCut'];
      this.global.p5key['KeyShortCut'] = {};
      v.onDidDismiss().then(() => {
        this.global.p5key['KeyShortCut'] = cache_func;
        this.try_add_shortcut();
      });
      v.present();
    });
  }

  ionViewWillLeave() {
    this.nakama.subscribe_lock = false;
    delete this.global.p5key['KeyShortCut']['Backquote'];
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    this.StopScan();
  }
}

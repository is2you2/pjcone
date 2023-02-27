// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { ModalController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { ChatRoomPage } from './chat-room/chat-room.page';
import { QRelsePage } from './qrelse/qrelse.page';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private codescan: BarcodeScanner,
    private p5toast: P5ToastService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    public lang: LanguageSettingService,
  ) { }

  cant_scan = false;

  ngOnInit() {
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_scan = true;
  }

  ionViewDidEnter() {
    this.nakama.subscribe_lock = true;
    this.nakama.resumeBanner();
  }

  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
    }).then(v => {
      if (!v.cancelled) {
        try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다main
          this.nakama.act_from_QRInfo(v.text.trim());
        } catch (_e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
          console.error('scanQRCode_failed: ', _e);
          this.modalCtrl.create({
            component: QRelsePage,
            componentProps: { result: v },
          }).then(v => v.present());
        }
      }
    }).catch(_e => {
      console.error(_e);
      this.p5toast.show({
        text: this.lang.text['Subscribes']['CameraPermissionDenied'],
      });
    });
  }

  lock_chatroom = false;
  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    if (!this.lock_chatroom) {
      this.lock_chatroom = true;
      this.modalCtrl.create({
        component: ChatRoomPage,
        componentProps: {
          info: info,
        },
      }).then(v => {
        this.nakama.go_to_chatroom_without_admob_act(v);
        if (info['status'] == 'missing') { // 삭제된 서버인 경우 읽은척하기
          delete info['is_new'];
          this.nakama.rearrange_channels();
        }
        this.lock_chatroom = false;
      });
    }
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    let server_info = this.nakama.notifications_rearrange[i]['server'];
    let _is_official = server_info['isOfficial'];
    let _target = server_info['target'];
    this.nakama.check_notifications(this.nakama.notifications_rearrange[i], _is_official, _target);
  }

  ionViewWillLeave() {
    this.nakama.subscribe_lock = false;
  }
}

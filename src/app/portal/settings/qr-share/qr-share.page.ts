// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import * as p5 from "p5";
import { BarcodeScanner } from '@awesome-cordova-plugins/barcode-scanner/ngx';
import { MatchOpCode, NakamaService, ServerInfo } from 'src/app/nakama.service';
import { QRelsePage } from '../../subscribes/qrelse/qrelse.page';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-qr-share',
  templateUrl: './qr-share.page.html',
  styleUrls: ['./qr-share.page.scss'],
})
export class QrSharePage implements OnInit {

  constructor(
    private p5toast: P5ToastService,
    private navCtrl: NavController,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private codescan: BarcodeScanner,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
  ) { }

  HideSender = false;
  ShowQRInfo = false;
  QRCodeSRC: any;
  lines: string;
  /** 전송 예정인 키의 갯수 */
  ActKeyLength = 0;

  select_uuid = false;
  /** 등록된 그룹서버 리스트 받아오기 */
  servers: ServerInfo[] = [];
  selected_group_server: any = [];
  /** 등록된 그룹 리스트 받아오기 */
  group_list = [];
  selected_group: any = [];
  /** 사용자가 선택한 발신 데이터 */
  selected_data = {};

  ngOnInit() {
    this.read_info();
    // 브라우저 여부에 따라 송신 설정 토글
    let isBrowser = isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA';
    this.HideSender = !isBrowser;
    this.get_online_server_and_group();
    for (let i = 0, j = this.servers.length; i < j; i++) {
      let isOfficial = this.servers[i].isOfficial;
      let target = this.servers[i].target;
      // QRShare 매치에 진입
      this.nakama.servers[isOfficial][target].client.readStorageObjects(
        this.nakama.servers[isOfficial][target].session, {
        object_ids: [{
          collection: 'server_public',
          key: 'QRShare',
        }]
      }).then(async v => {
        let match = await this.nakama.servers[isOfficial][target].socket.joinMatch(v.objects[0].value['id']);
        this.servers[i].match = match;
      });
      this.nakama.on_socket_disconnected['qr-share'] = () => {
        this.get_online_server_and_group();
      };
      this.nakama.socket_reactive['qr-share'] = () => {
        this.go_back_script();
      }
    }
  }

  isExpanded = true;
  index = 0;
  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.isExpanded = false;
    let isOfficial = this.servers[i].isOfficial;
    let target = this.servers[i].target;
    this.QRCodeSRC = this.global.readasQRCodeFromId({
      type: 'QRShare',
      target: this.nakama.servers[isOfficial][target].session.username,
    });
  }

  get_online_server_and_group() {
    // 그룹 서버 정보 가져오기
    this.servers.length = 0;
    this.servers = this.nakama.get_all_server_info(true, true);
    // 상태가 missing 이 아닌 서버 내 그룹 정보 가져오기
    let isOfficial = Object.keys(this.nakama.groups);
    isOfficial.forEach(_is_official => {
      let Target = Object.keys(this.nakama.groups[_is_official]);
      Target.forEach(_target => {
        let GroupIds = Object.keys(this.nakama.groups[_is_official][_target]);
        GroupIds.forEach(_gid => {
          if (this.nakama.groups[_is_official][_target][_gid]['status'] == 'online' || this.nakama.groups[_is_official][_target][_gid]['status'] == 'pending') {
            this.group_list.push({
              id: _gid,
              name: this.nakama.groups[_is_official][_target][_gid]['name'],
              server_name: this.nakama.servers[_is_official][_target].info.name,
            });
          }
        });
      });
    });
    if (!this.servers.length) // 사용할 수 있는 그룹 서버가 없다면 돌아가기
      this.go_back_script();
    this.select_server(0);
  }

  read_info() {
    let show = (p: p5) => {
      p.setup = () => {
        p.loadStrings(`assets/data/infos/${this.lang.lang}/quick_datashare.txt`, v => {
          this.lines = v.join('\n');
          p.remove();
        }, e => {
          console.error('빠른 QR 정보 공유 설명서 파일 불러오기 실패: ', e);
          p.remove();
        });
      }
    }
    new p5(show);
  }

  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.codescan.scan({
      disableSuccessBeep: true,
      disableAnimations: true,
      resultDisplayDuration: 0,
    }).then(async v => {
      if (!v.cancelled) {
        let json = JSON.parse(v.text.trim())[0];
        switch (json['type']) {
          case 'QRShare': // 빠른 QR공유
            /** 선택된 모든 정보를 json[]로 구성 */
            let sendData = [];
            if (this.selected_data['group_server'])
              for (let i = 0, j = this.selected_data['group_server'].length; i < j; i++)
                sendData.push({
                  type: 'server',
                  value: {
                    name: encodeURIComponent(this.selected_data['group_server'][i].name),
                    address: encodeURIComponent(this.selected_data['group_server'][i].address),
                    port: this.selected_data['group_server'][i].port,
                    key: encodeURIComponent(this.selected_data['group_server'][i].key),
                    useSSL: this.selected_data['group_server'][i].useSSL,
                  },
                  target: json['target'],
                });
            if (this.selected_data['group'])
              for (let i = 0, j = this.selected_data['group'].length; i < j; i++)
                sendData.push({
                  type: 'group',
                  id: this.selected_data['group'][i].id,
                  name: encodeURIComponent(this.selected_data['group'][i].name),
                  target: json['target'],
                });
            let isOfficial = this.servers[this.index].isOfficial;
            let target = this.servers[this.index].target;
            await this.nakama.servers[isOfficial][target].socket.sendMatchState(
              this.servers[this.index].match.match_id, MatchOpCode.QR_SHARE, JSON.stringify(sendData))
              .then(() => this.go_back_script());
            break;
          default: // 빠른 QR공유용 구성이 아닐 때
            this.modalCtrl.create({
              component: QRelsePage,
              componentProps: { result: v },
            }).then(v => v.present());
            break;
        }
      }
    }).catch(_e => {
      console.error(_e);
      this.p5toast.show({
        text: this.lang.text['Subscribes']['CameraPermissionDenied'],
      });
    });
  }

  ShowExceptionInfoYet = true;
  /** 발신 예정인 그룹 서버 정보 */
  SelectGroupServer(_ev: any) {
    if (this.selected_group_server.length && typeof this.selected_group_server != 'string') {
      this.selected_data['group_server'] = this.selected_group_server;
      // 다른 정보들을 검토하여 동시 공유 방지
      let keys = Object.keys(this.selected_data);
      // 키값 삭제
      let isKeyRemoved = false;
      keys.forEach(key => {
        if (key != 'group_server' && key != 'uuid')
          isKeyRemoved = true;
      });
      if (this.ShowExceptionInfoYet && isKeyRemoved) {
        this.p5toast.show({
          text: this.lang.text['QuickQRShare']['groupserver_dataonly'],
        });
        this.ShowExceptionInfoYet = false;
      }
    } else delete this.selected_data['group_server'];
    this.ActKeyLength = Object.keys(this.selected_data).length;
  }

  /** 발신 예정인 그룹 정보 */
  SelectGroup(_ev: any) {
    if (this.selected_group.length && typeof this.selected_group != 'string') {
      this.selected_data['group'] = this.selected_group;
      this.remove_groupserver_info();
    } else delete this.selected_data['group'];
    this.ActKeyLength = Object.keys(this.selected_data).length;
  }

  /** 다른 정보를 수정할 때 그룹 서버 정보가 잘 동작하지 않을 수 있음 알림 */
  remove_groupserver_info() {
    if (this.ShowExceptionInfoYet && this.selected_data['group_server']) {
      this.p5toast.show({
        text: this.lang.text['QuickQRShare']['groupserver_dataonly'],
      });
      this.ShowExceptionInfoYet = false;
    }
  }

  ionViewWillLeave() {
    this.servers.forEach(server => {
      let isOfficial = server.isOfficial;
      let target = server.target;
      this.nakama.servers[isOfficial][target].socket.leaveMatch(server.match.match_id);
      delete server.match;
    });
    delete this.nakama.on_socket_disconnected['qr-share'];
    delete this.nakama.socket_reactive['qr-share'];
  }

  go_back_script() {
    if (this.modalCtrl['injector']['source'] != 'QrSharePageModule')
      this.modalCtrl.dismiss();
    else this.navCtrl.back();
  }

  go_back() {
    if (this.modalCtrl['injector']['source'] != 'QrSharePageModule')
      this.modalCtrl.dismiss();
  }
}

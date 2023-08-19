// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-qr-share',
  templateUrl: './qr-share.page.html',
  styleUrls: ['./qr-share.page.scss'],
})
export class QrSharePage implements OnInit {

  constructor(
    private navCtrl: NavController,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
  ) { }

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
    // 브라우저 여부에 따라 송신 설정 토글
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
    }
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
      this.go_back();
  }

  resultData = [];
  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  scanQRCode() {
    this.rearrange_data();
    this.modalCtrl.dismiss(this.resultData);
  }

  rearrange_data() {
    /** 선택된 모든 정보를 json[]로 구성 */
    this.resultData.length = 0;
    if (this.selected_data['group_server'])
      for (let i = 0, j = this.selected_data['group_server'].length; i < j; i++)
        this.resultData.push({
          type: 'server',
          value: {
            name: encodeURIComponent(this.selected_data['group_server'][i].name),
            address: encodeURIComponent(this.selected_data['group_server'][i].address),
            port: this.selected_data['group_server'][i].port,
            key: this.selected_data['group_server'][i].key ? encodeURIComponent(this.selected_data['group_server'][i].key) : undefined,
            useSSL: this.selected_data['group_server'][i].useSSL,
          },
        });
    if (this.selected_data['group'])
      for (let i = 0, j = this.selected_data['group'].length; i < j; i++)
        this.resultData.push({
          type: 'group',
          id: this.selected_data['group'][i].id,
          name: encodeURIComponent(this.selected_data['group'][i].name),
        });
    this.QRCodeSRC = this.global.readasQRCodeFromId(this.resultData);
  }

  /** 발신 예정인 그룹 서버 정보 */
  SelectGroupServer(_ev: any) {
    if (this.selected_group_server.length && typeof this.selected_group_server != 'string') {
      this.selected_data['group_server'] = this.selected_group_server;
    } else delete this.selected_data['group_server'];
    this.ActKeyLength = Object.keys(this.selected_data).length;
    this.rearrange_data();
  }

  /** 발신 예정인 그룹 정보 */
  SelectGroup(_ev: any) {
    if (this.selected_group.length && typeof this.selected_group != 'string') {
      this.selected_data['group'] = this.selected_group;
    } else delete this.selected_data['group'];
    this.ActKeyLength = Object.keys(this.selected_data).length;
    this.rearrange_data();
  }

  ionViewWillLeave() {
    this.servers.forEach(server => {
      let isOfficial = server.isOfficial;
      let target = server.target;
      this.nakama.servers[isOfficial][target].socket.leaveMatch(server.match.match_id);
      delete server.match;
    });
    delete this.nakama.on_socket_disconnected['qr-share'];
  }

  go_back() {
    if (this.modalCtrl['injector']['source'] != 'QrSharePageModule')
      this.modalCtrl.dismiss();
    else this.navCtrl.back();
  }
}

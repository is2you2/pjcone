// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { isPlatform } from 'src/app/app.component';
import clipboard from "clipboardy";
import { StatusManageService } from 'src/app/status-manage.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-add-group',
  templateUrl: './add-group.page.html',
  styleUrls: ['./add-group.page.scss'],
})
export class AddGroupPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
  ) { }

  QRCodeSRC: any;

  ngOnInit() {
    let tmp = JSON.parse(localStorage.getItem('add-group'));
    if (tmp)
      this.userInput = tmp;
    this.servers = this.nakama.get_all_server_info(true, true);
    this.userInput.server = this.servers[this.index];
  }

  /** 사용자가 작성한 그룹 정보 */
  userInput = {
    server: undefined,
    id: undefined,
    name: undefined,
    description: undefined,
    max_count: undefined,
    lang_tag: undefined,
    open: true,
    creator_id: undefined,
    img: undefined,
  }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  servers: ServerInfo[] = [];
  index = 0;
  isExpanded = true;

  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
  }

  /** 클립보드 사용가능 여부 */
  cant_use_clipboard = false;
  imageURL_disabled = false;
  imageURL_placeholder = this.lang.text['Profile']['pasteURI'];
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    if (isPlatform != 'DesktopPWA') return;
    this.imageURL_disabled = true;
    clipboard.read().then(v => {
      if (v.indexOf('http') == 0) {
        this.userInput.img = v;
        this.imageURL_placeholder = v;
      } else if (v.indexOf('data:image') == 0) {
        this.nakama.limit_image_size(v, (rv) => this.userInput.img = rv['canvas'].toDataURL());
      } else {
        this.p5toast.show({
          text: this.lang.text['Profile']['copyURIFirst'],
        });
      }
    });
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  /** 공개여부 토글 */
  isPublicToggle() {
    this.userInput.open = !this.userInput.open;
  }

  isSaveClicked = false;
  /** 정상처리되지 않았다면 작성 중 정보 임시 저장 */
  isSavedWell = false;
  save() {
    if (this.statusBar.groupServer[this.servers[this.index].isOfficial][this.servers[this.index].target] != 'online') {
      this.p5toast.show({
        text: this.lang.text['AddGroup']['cannot_use_selected_server'],
      });
      return;
    }
    let client = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].client;
    let session = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session;
    this.userInput['owner'] = session.user_id;
    this.userInput['status'] = 'online';

    this.isSaveClicked = true;
    this.userInput.lang_tag = this.userInput.lang_tag || this.lang.lang;
    this.userInput.max_count = this.userInput.max_count || 2;
    client.createGroup(session, {
      name: this.userInput.name,
      lang_tag: this.userInput.lang_tag,
      description: this.userInput.description,
      max_count: this.userInput.max_count,
      open: this.userInput.open,
    }).then(v => {
      this.userInput.id = v.id;
      this.userInput.creator_id = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session.user_id;
      this.QRCodeSRC = this.global.readasQRCodeFromId({
        type: 'group',
        id: this.userInput.id,
        title: this.userInput.name,
      });
      this.nakama.save_group_info(this.userInput, this.servers[this.index].isOfficial, this.servers[this.index].target);
      this.nakama.join_chat_with_modulation(v.id, 3, this.servers[this.index].isOfficial, this.servers[this.index].target, (_c) => {
        this.isSavedWell = true;
        localStorage.removeItem('add-group');
        this.p5toast.show({
          text: this.lang.text['AddGroup']['group_created'],
        });
        setTimeout(() => {
          this.modalCtrl.dismiss();
        }, 500);
      });
    }).catch(e => {
      console.error('그룹 생성 실패: ', e);
      switch (e.status) {
        case 400:
          setTimeout(() => {
            this.p5toast.show({
              text: this.lang.text['AddGroup']['NeedSetGroupName'],
            });
            this.isSaveClicked = false;
          }, 500);
          break;
        case 409:
          setTimeout(() => {
            this.p5toast.show({
              text: this.lang.text['AddGroup']['AlreadyExist'],
            });
            this.isSaveClicked = false;
          }, 500);
          break;
        default:
          setTimeout(() => {
            this.p5toast.show({
              text: `${this.lang.text['AddGroup']['UnexpectedErr']}: ${e}`,
            });
            this.isSaveClicked = false;
          }, 500);
          break;
      }
    });
  }

  ionViewWillLeave() {
    if (!this.isSavedWell) {
      localStorage.setItem('add-group', JSON.stringify(this.userInput));
    }
  }

  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickLinkInputFile() {
    document.getElementById('file_sel').click();
  }

  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => this.userInput.img = v['canvas'].toDataURL())
  }
}

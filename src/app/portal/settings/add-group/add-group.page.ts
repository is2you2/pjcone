// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit, ViewChild } from '@angular/core';
import { IonToggle, ModalController } from '@ionic/angular';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { isPlatform } from 'src/app/app.component';
import clipboard from "clipboardy";
import { StatusManageService } from 'src/app/status-manage.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { GlobalActService } from 'src/app/global-act.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';

@Component({
  selector: 'app-add-group',
  templateUrl: './add-group.page.html',
  styleUrls: ['./add-group.page.scss'],
})
export class AddGroupPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
  ) { }

  ngOnInit() {
    let tmp = JSON.parse(localStorage.getItem('add-group'));
    if (tmp)
      this.userInput = tmp;
    this.servers = this.nakama.get_all_server_info(true, true);
    this.userInput.server = this.servers[this.index];
    this.file_sel_id = `add_group_${new Date().getTime()}`;
  }

  /** 사용자가 작성한 그룹 정보 */
  userInput = {
    server: undefined,
    id: '',
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

  imageURL_disabled = false;
  imageURL_placeholder = this.lang.text['Profile']['pasteURI'];
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    this.imageURL_disabled = true;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA') {
      clipboard.read().then(v => {
        this.check_if_clipboard_available(v);
      });
    } else {
      this.mClipboard.paste().then(v => {
        this.check_if_clipboard_available(v);
      }, e => {
        console.log('클립보드 자료받기 오류: ', e);
      });
    }
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  check_if_clipboard_available(v: string) {
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
  }

  @ViewChild('AddGroupPublic') GroupIsPublic: IonToggle;
  /** 공개여부 토글 */
  isPublicToggle() {
    this.userInput.open = this.GroupIsPublic.checked;
  }

  isSaveClicked = false;
  /** 정상처리되지 않았다면 작성 중 정보 임시 저장 */
  isSavedWell = false;
  async save() {
    if (this.userInput.id) {
      let SuccJoinedChat = false;
      this.isSaveClicked = true;
      let target_server = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target];
      try {
        await target_server.client.joinGroup(target_server.session, this.userInput.id);
        await this.nakama.get_group_list_from_server(this.servers[this.index].isOfficial, this.servers[this.index].target);
        SuccJoinedChat = true;
      } catch (e) {
        try {
          await this.nakama.join_chat_with_modulation(this.userInput.id, 2, this.servers[this.index].isOfficial, this.servers[this.index].target);
          SuccJoinedChat = true;
        } catch (e) {
          this.p5toast.show({
            text: this.lang.text['AddGroup']['check_group_id'],
          });
          this.isSaveClicked = false;
        }
      }
      if (SuccJoinedChat) {
        this.isSavedWell = true;
        this.p5toast.show({
          text: this.lang.text['AddGroup']['join_group_succ'],
        });
        setTimeout(() => {
          this.modalCtrl.dismiss();
        }, 500);
      }
      return;
    }
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
    this.userInput.lang_tag = this.userInput.lang_tag || navigator.language.split('-')[0] || this.lang.lang;
    this.userInput.max_count = this.userInput.max_count || 2;
    client.createGroup(session, {
      name: this.userInput.name,
      lang_tag: this.userInput.lang_tag,
      description: this.userInput.description,
      max_count: this.userInput.max_count,
      open: this.userInput.open,
    }).then(async v => {
      this.userInput.id = v.id;
      this.userInput.creator_id = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session.user_id;
      this.nakama.save_group_info(this.userInput, this.servers[this.index].isOfficial, this.servers[this.index].target);
      try {
        await this.nakama.join_chat_with_modulation(v.id, 3, this.servers[this.index].isOfficial, this.servers[this.index].target);
        this.isSavedWell = true;
        this.p5toast.show({
          text: this.lang.text['AddGroup']['group_created'],
        });
      } catch (e) {
        console.error(e);
      }
      setTimeout(() => {
        this.modalCtrl.dismiss();
      }, 500);
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
    if (!this.isSavedWell)
      localStorage.setItem('add-group', JSON.stringify(this.userInput));
    else localStorage.removeItem('add-group');
  }

  file_sel_id = '';
  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickLinkInputFile() {
    document.getElementById(this.file_sel_id).click();
  }

  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => this.userInput.img = v['canvas'].toDataURL())
  }
}

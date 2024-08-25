import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonToggle, NavController } from '@ionic/angular';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { GlobalActService } from 'src/app/global-act.service';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IndexedDBService } from 'src/app/indexed-db.service';
import * as p5 from 'p5';

@Component({
  selector: 'app-add-group',
  templateUrl: './add-group.page.html',
  styleUrls: ['./add-group.page.scss'],
})
export class AddGroupPage implements OnInit, OnDestroy {

  constructor(
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
    private indexed: IndexedDBService,
    private navCtrl: NavController,
  ) { }

  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    try {
      window.history.replaceState(null, null, window.location.href);
      window.onpopstate = () => {
        if (this.BackButtonPressed) return;
        this.BackButtonPressed = true;
        this.navCtrl.pop();
      };
    } catch (e) {
      console.log('탐색 기록 변경시 오류 발생: ', e);
    }
  }
  ngOnInit() {
    this.InitBrowserBackButtonOverride();
    let tmp = JSON.parse(localStorage.getItem('add-group'));
    if (tmp)
      this.userInput = tmp;
    this.LoadListServer();
    if (this.servers.length > 1) this.index = 1;
    this.userInput.server = this.servers[this.index];
    this.file_sel_id = `add_group_${new Date().getTime()}`;
    this.nakama.StatusBarChangedCallback = () => {
      this.LoadListServer();
      this.index = 0;
    };
    this.CheckIfCopiedChannelID();
  }

  /** 진입시 채널 아이디를 복사해둔 상태라면 즉시 해당 아이디로 가입하기 시도 */
  async CheckIfCopiedChannelID() {
    let copied: string;
    try {
      let clipboard = await this.global.GetValueFromClipboard();
      switch (clipboard.type) {
        case 'text/plain':
          copied = clipboard.value;
          break;
      }
    } catch (e) {
      try {
        copied = await this.mClipboard.paste();
      } catch (e) {
        return;
      }
    }
    const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    let result = uuidPattern.test(copied);
    if (result) {
      this.userInput.id = copied;
      this.JoinWithSpecificId();
    }
  }

  /** 선택할 수 있는 서버 리스트 만들기 */
  LoadListServer() {
    this.servers = this.nakama.get_all_server_info(true, true);
    let local_info = {
      name: this.lang.text['AddGroup']['UseLocalStorage'],
      isOfficial: 'local',
      target: 'target',
      local: true,
    };
    this.servers.unshift(local_info);
  }

  ionViewWillEnter() {
    this.IsFocusOnThisPage = true;
    this.ChangeContentWithKeyInput();
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  IsFocusOnThisPage = true;
  p5canvas: p5;
  ChangeContentWithKeyInput() {
    let group_name = document.getElementById('group_name');
    let name_html = group_name.childNodes[1].childNodes[1].childNodes[1] as HTMLElement;
    setTimeout(() => {
      name_html.focus();
    }, 200);
    this.p5canvas = new p5((p: p5) => {
      p.keyPressed = async (ev) => {
        if (this.IsFocusOnThisPage)
          switch (ev['key']) {
            case 'Enter':
              if (document.activeElement.id != 'group_desc')
                this.save();
              break;
          }
      }
    });
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
    if (this.servers[i]['local'])
      this.userInput.id = '';
    this.isExpanded = false;
  }

  async check_if_clipboard_available(v: string) {
    try {
      if (v.indexOf('http') == 0) {
        await new Promise((done, err) => {
          let img = document.createElement('img');
          img.src = v;
          img.onload = () => {
            this.userInput.img = v;
            done(undefined);
          }
          img.onerror = () => {
            img.remove();
            err();
          }
        });
      } else throw 'URL 주소가 아님';
    } catch (e) {
      try {
        if (v.indexOf('data:image') == 0) {
          this.nakama.limit_image_size(v, (rv) => this.userInput.img = rv['canvas'].toDataURL());
        } else throw 'DataURL 주소가 아님';
      } catch (e) {
        throw '사용불가 이미지';
      }
    }
  }

  @ViewChild('AddGroupPublic') GroupIsPublic: IonToggle;
  /** 공개여부 토글 */
  isPublicToggle() {
    this.userInput.open = this.GroupIsPublic.checked;
  }

  isSaveClicked = false;
  async save() {
    if (this.isSaveClicked) return;
    this.isSaveClicked = true;
    // 로컬에 채널 양식으로 기록 남기기
    if (this.servers[this.index]['local']) {
      this.SaveLocalAct();
      return;
    }
    if (this.userInput.id) {
      await this.JoinWithSpecificId();
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

    this.userInput.lang_tag = this.userInput.lang_tag || navigator.language.split('-')[0] || this.lang.lang;
    this.userInput.max_count = this.userInput.max_count || 1;
    try {
      let v = await client.createGroup(session, {
        name: this.userInput.name,
        lang_tag: this.userInput.lang_tag,
        description: this.userInput.description,
        max_count: this.userInput.max_count,
        open: this.userInput.open,
      });
      this.userInput.id = v.id;
      this.userInput.creator_id = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session.user_id;
      this.nakama.save_group_info(this.userInput, this.servers[this.index].isOfficial, this.servers[this.index].target);
      try {
        await this.nakama.join_chat_with_modulation(v.id, 3, this.servers[this.index].isOfficial, this.servers[this.index].target);
        this.p5toast.show({
          text: this.lang.text['AddGroup']['group_created'],
        });
      } catch (e) {
        console.error(e);
      }
      let self = await this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].client.getAccount(
        this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session);
      let user_metadata = JSON.parse(self.user.metadata);
      if (user_metadata['is_manager']) {
        user_metadata['is_manager'].push(v.id);
      } else user_metadata['is_manager'] = [v.id];
      try {
        await this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].client.rpc(
          this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session,
          'update_user_metadata_fn', {
          user_id: this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session.user_id,
          metadata: user_metadata,
        });
      } catch (e) {
        console.log('그룹 생성자를 매니저로 승격 오류: ', e);
      }
      setTimeout(() => {
        this.navCtrl.pop();
      }, 500);
    } catch (e) {
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
    }
  }

  /** 로컬 채널 생성 */
  SaveLocalAct() {
    if (!this.nakama.channels_orig['local']) this.nakama.channels_orig['local'] = {};
    if (!this.nakama.channels_orig['local']['target']) this.nakama.channels_orig['local']['target'] = {};
    // 아이디 중복 검토
    if (this.nakama.channels_orig['local']['target'][this.userInput.name]) {
      this.p5toast.show({
        text: this.lang.text['AddGroup']['AlreadyExist'],
      });
      this.isSaveClicked = false;
      return;
    }
    let generated_id = this.CreateRandomLocalId();
    this.nakama.channels_orig['local']['target'][generated_id] = {
      id: generated_id,
      local: true,
      title: this.userInput.name,
      redirect: {
        type: 0,
      },
      status: 'online',
      HideAutoThumbnail: false,
      info: {
        ...this.userInput,
        status: 'online',
      }
    };
    if (this.userInput.img)
      this.indexed.saveTextFileToUserPath(this.userInput.img, `servers/local/target/groups/${generated_id}.img`);
    this.nakama.rearrange_channels();
    setTimeout(() => {
      this.navCtrl.pop();
    }, 500);
  }

  /** 로컬 채널 아이디 생성기 */
  CreateRandomLocalId(): string {
    let result = '';
    const ID_GEN_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0, j = 16; i < j; i++) {
      let randomAt = Math.floor(Math.random() * ID_GEN_CHAR.length);
      result += ID_GEN_CHAR.charAt(randomAt);
    }
    if (!this.nakama.channels_orig['local']['target'][result])
      return result;
    else return this.CreateRandomLocalId();
  }

  /** ID로 채널 진입하기 */
  async JoinWithSpecificId() {
    let SuccJoinedChat = false;
    let target_server = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target];
    try { // 그룹 채널로 시도
      await target_server.client.joinGroup(target_server.session, this.userInput.id);
      this.nakama.get_group_list_from_server(this.servers[this.index].isOfficial, this.servers[this.index].target);
      SuccJoinedChat = true;
    } catch (e) {
      try { // 1:1 채널로 재시도
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
      this.p5toast.show({
        text: this.lang.text['AddGroup']['join_group_succ'],
      });
      setTimeout(() => {
        this.navCtrl.pop();
      }, 500);
    }
  }

  ionViewWillLeave() {
    this.IsFocusOnThisPage = false;
    delete this.global.p5key['KeyShortCut']['Escape'];
  }

  ngOnDestroy(): void {
    if (this.p5canvas) this.p5canvas.remove();
    delete this.nakama.StatusBarChangedCallback;
  }

  file_sel_id = '';
  /** ionic 버튼을 눌러 input-file 동작 */
  async buttonClickLinkInputFile() {
    if (this.userInput.img) this.userInput.img = undefined;
    else try {
      let clipboard = await this.global.GetValueFromClipboard();
      switch (clipboard.type) {
        case 'text/plain':
          await this.check_if_clipboard_available(clipboard.value);
          break;
        case 'image/png':
          this.inputImageSelected({ target: { files: [clipboard.value] } })
          return;
      }
    } catch (e) {
      try {
        let v = await this.mClipboard.paste();
        await this.check_if_clipboard_available(v);
      } catch (e) {
        document.getElementById(this.file_sel_id).click();
      }
    }
  }

  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => this.userInput.img = v['canvas'].toDataURL())
    let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
    input.value = '';
  }
}

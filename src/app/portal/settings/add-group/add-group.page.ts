import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonToggle, NavController } from '@ionic/angular';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import * as p5 from 'p5';
import { isPlatform } from 'src/app/app.component';

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
    public global: GlobalActService,
    private indexed: IndexedDBService,
    private navCtrl: NavController,
  ) { }

  ngOnInit() {
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
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  ionViewDidEnter() {
    this.CreateDrop();
  }

  p5drop: p5;
  CreateDrop() {
    let parent = document.getElementById('p5Drop_add_group');
    if (!this.p5drop)
      this.p5drop = new p5((p: p5) => {
        p.setup = () => {
          let canvas = p.createCanvas(parent.clientWidth, parent.clientHeight);
          canvas.parent(parent);
          p.pixelDensity(.1);
          canvas.drop(async (file: any) => {
            this.inputImageSelected({ target: { files: [file.file] } });
          });
        }
        p.mouseMoved = (ev: any) => {
          if (ev['dataTransfer']) {
            parent.style.pointerEvents = 'all';
            parent.style.backgroundColor = '#0008';
          } else {
            parent.style.pointerEvents = 'none';
            parent.style.backgroundColor = 'transparent';
          }
        }
      });
  }

  /** 생성하려는 그룹의 이름 */
  GroupNameInput: HTMLInputElement;
  IsFocusOnThisPage = true;
  p5canvas: p5;
  /** 제목 입력칸에 포커스중인지 검토 */
  CheckIfTitleFocus = false;
  ChangeContentWithKeyInput() {
    let group_name = document.getElementById('group_name');
    this.GroupNameInput = group_name.childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    if (!this.GroupNameInput.onfocus)
      this.GroupNameInput.onfocus = () => {
        this.CheckIfTitleFocus = true;
      }
    if (!this.GroupNameInput.onblur)
      this.GroupNameInput.onblur = () => {
        this.CheckIfTitleFocus = false;
      }
    setTimeout(() => {
      if (isPlatform == 'DesktopPWA')
        this.GroupNameInput.focus();
    }, 200);
    this.p5canvas = new p5((p: p5) => {
      p.keyPressed = async (ev) => {
        if (this.IsFocusOnThisPage)
          switch (ev['key']) {
            case 'Enter':
              if (document.activeElement == this.GroupNameInput)
                setTimeout(() => {
                  try {
                    document.getElementById('group_desc').focus();
                  } catch (e) { }
                }, 0);
              if (!ev['ctrlKey'] && this.servers[this.index]['local'])
                this.userInput.volatile = !this.userInput.volatile;
              if (ev['ctrlKey'])
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
    volatile: true,
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
    this.FocusOnChannelTitle();
  }

  FocusOnChannelTitle() {
    if (isPlatform == 'DesktopPWA' && this.GroupNameInput) {
      if (!this.GroupNameInput.value)
        this.GroupNameInput.focus();
    }
  }

  async check_if_clipboard_available(v: string) {
    try {
      if (v.indexOf('http') == 0) {
        await new Promise((done, err) => {
          let img = document.createElement('img');
          img.src = v;
          img.onload = () => {
            this.userInput.img = v;
            img.onload = null;
            img.onerror = null;
            done(undefined);
          }
          img.onerror = () => {
            img.onload = null;
            img.onerror = null;
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
        await this.nakama.join_chat_with_modulation(v.id, 3, this.servers[this.index].isOfficial, this.servers[this.index].target, true);
        this.p5toast.show({
          text: this.lang.text['AddGroup']['group_created'],
        });
      } catch (e) {
        console.error(e);
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
    let generated_id = this.CreateRandomLocalId();
    this.nakama.channels_orig['local']['target'][generated_id] = {
      id: generated_id,
      local: true,
      title: this.userInput.name,
      redirect: {
        type: 0,
      },
      volatile: this.userInput.volatile,
      status: 'certified',
      info: {
        ...this.userInput,
        status: 'certified',
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
    if (this.userInput.volatile) result = 'tmp_files_' + result;
    if (!this.nakama.channels_orig['local']['target'][result])
      return result;
    else return this.CreateRandomLocalId();
  }

  ionViewWillLeave() {
    this.IsFocusOnThisPage = false;
    this.GroupNameInput.onfocus = null;
    this.GroupNameInput.onblur = null;
    delete this.global.p5KeyShortCut['Escape'];
  }

  ngOnDestroy() {
    if (this.p5canvas) this.p5canvas.remove();
    if (this.p5drop) this.p5drop.remove();
    delete this.nakama.StatusBarChangedCallback;
  }

  file_sel_id = '';
  /** ionic 버튼을 눌러 input-file 동작 */
  async buttonClickLinkInputFile() {
    if (this.userInput.img) this.userInput.img = undefined;
    else document.getElementById(this.file_sel_id).click();
  }

  AddChannelImageContextMenu() {
    let ContextAct = async () => {
      let clipboard = await this.global.GetValueFromClipboard();
      switch (clipboard.type) {
        case 'text/plain':
          await this.check_if_clipboard_available(clipboard.value);
          break;
        case 'image/png':
          this.inputImageSelected({ target: { files: [clipboard.value] } })
          return;
      }
    }
    ContextAct();
    return false;
  }

  /** 파일 선택시 로컬에서 반영 */
  async inputImageSelected(ev: any) {
    let base64 = await this.global.GetBase64ThroughFileReader(ev.target.files[0]);
    this.nakama.limit_image_size(base64, (v) => this.userInput.img = v['canvas'].toDataURL())
    let input = document.getElementById(this.file_sel_id) as HTMLInputElement;
    input.value = '';
  }
}

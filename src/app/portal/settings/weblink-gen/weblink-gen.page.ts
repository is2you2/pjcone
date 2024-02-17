import { Component, OnInit } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { NavController } from '@ionic/angular';
import clipboard from 'clipboardy';
import { SERVER_PATH_ROOT, isNativefier } from 'src/app/app.component';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-weblink-gen',
  templateUrl: './weblink-gen.page.html',
  styleUrls: ['./weblink-gen.page.scss'],
})
export class WeblinkGenPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private mClipboard: Clipboard,
    private nakama: NakamaService,
    private indexed: IndexedDBService,
    private p5toast: P5ToastService,
    private global: GlobalActService,
    private navCtrl: NavController,
  ) { }

  userInput = {
    root: undefined,
    open_subscribes: false,
    use_tmp_user: false,
    tmp_user: {
      email: undefined,
      password: undefined,
      pass_placeholder: undefined,
      display_name: undefined,
    },
    servers: [] as ServerInfo[],
    groups: [],
    group_dedi: undefined,
    open_prv_channel: '',
    open_channel: false,
  }

  servers: ServerInfo[] = [];
  groups = [];
  rtcServer = [];

  isSSLConnect = false;

  ngOnInit() {
    this.isSSLConnect = (window.location.protocol == 'https:') && !isNativefier;
    this.servers = this.nakama.get_all_server_info();
    this.groups = this.nakama.rearrange_group_list();
    this.indexed.loadTextFromUserPath('servers/webrtc_server.json', (e, v) => {
      if (e && v) this.rtcServer = JSON.parse(v);
    });
    for (let i = this.groups.length - 1; i >= 0; i--)
      if (this.groups[i]['status'] == 'missing')
        this.groups.splice(i, 1);
  }

  ionViewDidEnter() {
    this.global.p5key['KeyShortCut']['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  SelectGroupServer(ev: any) {
    this.userInput.servers = ev.detail.value;
    this.information_changed();
  }

  SelectGroupChannel(ev: any) {
    this.userInput.groups = ev.detail.value;
    this.information_changed();
  }

  baseURLChanged(ev: any) {
    if (!ev.detail.value) {
      this.userInput.root = undefined;
    }
    this.information_changed();
  }

  result_address = `${SERVER_PATH_ROOT}pjcone_pwa/`;
  information_changed() {
    this.result_address = this.userInput.root || `${SERVER_PATH_ROOT}pjcone_pwa/`;
    let count = 0;
    for (let i = 0, j = this.userInput.servers.length; i < j; i++) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'server=';
      this.result_address += `${this.userInput.servers[i].name || ''},${this.userInput.servers[i].address || ''},${this.userInput.servers[i].useSSL || ''},${this.userInput.servers[i].port || 7350},${this.userInput.servers[i].key || ''}`;
      count++;
    }
    for (let i = 0, j = this.userInput.groups.length; i < j; i++) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'group=';
      this.result_address += `${this.userInput.groups[i]['name']},${this.userInput.groups[i]['id']}`;
      count++;
    }
    if (this.userInput.open_subscribes) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_subscribes=true';
      count++;
    }
    if (this.userInput.use_tmp_user) {
      const availableStrings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const StringLen = availableStrings.length;
      let randomLength = 8 + Math.floor(Math.random() * 8);
      this.userInput.tmp_user.pass_placeholder = '';
      if (!this.userInput.tmp_user.password)
        for (let i = 0; i < randomLength; i++)
          this.userInput.tmp_user.pass_placeholder += availableStrings.charAt(Math.floor(Math.random() * StringLen));
      this.result_address += count ? '&' : '?';
      this.result_address += `tmp_user=${this.userInput.tmp_user.email || 'test@example.com'},${this.userInput.tmp_user.password || this.userInput.tmp_user.pass_placeholder || ''},${this.userInput.tmp_user.display_name || ''}`;
      count++;
    }
    if (this.userInput.open_prv_channel) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_prv_channel=';
      this.result_address += `${this.userInput.open_prv_channel},${this.servers[0].isOfficial},${this.userInput.servers[0].target}`;
      count++;
    }
    if (this.userInput.open_channel) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_channel=';
      this.result_address += `${this.userInput.groups[0]['id']},${this.userInput.groups[0]['server']['isOfficial']},${this.userInput.groups[0]['server']['target']}`;
      count++;
    }
  }

  /** 임시 사용자 토글시 정보 삭제 동작을 포함 */
  toggle_tmp_user() {
    this.userInput.use_tmp_user = !this.userInput.use_tmp_user;
    if (!this.userInput.use_tmp_user) {
      this.userInput.tmp_user.display_name = undefined;
      this.userInput.tmp_user.email = undefined;
      this.userInput.tmp_user.password = undefined;
      this.userInput.tmp_user.pass_placeholder = undefined;
    }
    this.information_changed();
  }

  copy_result_address() {
    this.mClipboard.copy(this.result_address)
      .catch(_e => clipboard.write(this.result_address));
  }

  async paste_user_id() {
    if (this.userInput.open_prv_channel)
      this.userInput.open_prv_channel = '';
    else await this.mClipboard.paste()
      .then(v => this.userInput.open_prv_channel = v)
      .catch(async _e => this.userInput.open_prv_channel = await clipboard.read());
    this.information_changed();
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
  }
}

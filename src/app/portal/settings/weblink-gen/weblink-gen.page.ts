import { Component, OnInit } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
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
    private global: GlobalActService,
    private navCtrl: NavController,
    private p5toast: P5ToastService,
  ) { }

  userInput = {
    root: undefined,
    servers: [] as ServerInfo[],
    groups: [],
    group_dedi: undefined,
    open_prv_channel: '',
    open_channel: false,
    rtcserver: [],
  }

  servers: ServerInfo[] = [];
  groups = [];
  rtcServer = [];


  BackButtonPressed = false;
  InitBrowserBackButtonOverride() {
    window.history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
      if (this.BackButtonPressed) return;
      this.BackButtonPressed = true;
      this.navCtrl.back();
    };
  }

  targetBaseURL: string;
  ngOnInit() {
    if (location.host.indexOf('localhost') == 0)
      this.targetBaseURL = `${SERVER_PATH_ROOT}godotchat_pwa/`;
    else this.targetBaseURL = `${location.protocol}//${location.host}${window['sub_path']}`
    this.result_address = this.targetBaseURL;
    this.update_qrcode();
    this.InitBrowserBackButtonOverride();
    this.servers = this.nakama.get_all_server_info();
    this.groups = this.nakama.rearrange_group_list(false);
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
    this.userInput.servers = ev.detail.value || [];
    this.information_changed();
  }

  SelectGroupChannel(ev: any) {
    this.userInput.groups = ev.detail.value || [];
    this.information_changed();
  }

  SelectRTCServer(ev: any) {
    this.userInput.rtcserver = ev.detail.value || [];
    this.information_changed();
  }

  baseURLChanged(ev: any) {
    if (!ev.detail.value) {
      this.userInput.root = undefined;
    }
    this.information_changed();
  }

  QRCodeSRC: any;
  result_address: string;
  information_changed() {
    this.result_address = this.userInput.root || this.targetBaseURL;
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
    for (let i = 0, j = this.userInput.rtcserver.length; i < j; i++) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'rtcserver=';
      this.result_address += `[${this.userInput.rtcserver[i].urls}],${this.userInput.rtcserver[i].username},${this.userInput.rtcserver[i].credential}`;
      count++;
    }
    if (this.userInput.open_prv_channel) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_prv_channel=';
      try {
        this.result_address += `${this.userInput.open_prv_channel},${this.servers[0].isOfficial},${this.userInput.servers[0].target}`;
      } catch (e) {
        this.result_address += `${this.userInput.open_prv_channel},,`;
      }
      count++;
    }
    if (this.userInput.open_channel) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_channel=';
      this.result_address += `${this.userInput.groups[0]['id']},${this.userInput.groups[0]['server']['isOfficial']},${this.userInput.groups[0]['server']['target']}`;
      count++;
    }
    this.update_qrcode();
  }

  update_qrcode(_ev?: any) {
    this.QRCodeSRC = this.global.readasQRCodeFromString(this.result_address);
  }

  copy_result_address() {
    this.mClipboard.copy(this.result_address)
      .catch(_e => {
        this.global.WriteValueToClipboard('text/plain', this.result_address);
      });
  }

  async paste_user_id() {
    if (this.userInput.open_prv_channel)
      this.userInput.open_prv_channel = '';
    else await this.mClipboard.paste()
      .then(v => this.userInput.open_prv_channel = v)
      .catch(async _e => {
        try {
          let clipboard = await this.global.GetValueFromClipboard();
          switch (clipboard.type) {
            case 'text/plain':
              this.userInput.open_prv_channel = clipboard.value;
              break;
          }
        } catch (e) { }
      });
    this.information_changed();
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
  }
}

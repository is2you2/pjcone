import { Component, OnInit } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from 'clipboardy';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';

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
  ) { }

  userInput = {
    root: undefined,
    open_profile: false,
    open_subscribes: false,
    use_tmp_user: false,
    tmp_user: {
      email: undefined,
      password: undefined,
      display_name: undefined,
    },
    servers: [] as ServerInfo[],
    groups: [],
    group_dedi: undefined,
  }

  servers: ServerInfo[] = [];
  groups = [];

  isSSLConnect = false;

  ngOnInit() {
    this.isSSLConnect = window.location.protocol == 'https:';
    this.servers = this.nakama.get_all_server_info();
    this.groups = this.nakama.rearrange_group_list();
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

  result_address = 'https://is2you2.github.io/pjcone_pwa/';
  information_changed() {
    this.result_address = this.userInput.root || 'https://is2you2.github.io/pjcone_pwa/';
    let count = 0;
    for (let i = 0, j = this.userInput.servers.length; i < j; i++) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'server=';
      this.result_address += `${this.userInput.servers[i].name || ''},${this.userInput.servers[i].address || ''},${this.userInput.servers[i].useSSL || ''},${this.userInput.servers[i].port || 7350},${this.userInput.servers[i].key || ''}`;
      count++;
    }
    if (this.userInput.open_profile) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_profile=true';
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
      this.result_address += count ? '&' : '?';
      this.result_address += `tmp_user=${this.userInput.tmp_user.email || ''},${this.userInput.tmp_user.password || ''},${this.userInput.tmp_user.display_name || ''}`;
      count++;
    }
  }

  copy_result_address() {
    this.mClipboard.copy(this.result_address)
      .catch(_e => clipboard.write(this.result_address));
  }

}

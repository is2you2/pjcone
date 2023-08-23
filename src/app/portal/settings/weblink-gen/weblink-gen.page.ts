import { Component, OnInit } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import clipboard from 'clipboardy';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-weblink-gen',
  templateUrl: './weblink-gen.page.html',
  styleUrls: ['./weblink-gen.page.scss'],
})
export class WeblinkGenPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private mClipboard: Clipboard,
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
    servers: [],
    groups: [],
    group_dedi: undefined,
  }

  isSSLConnect = false;

  ngOnInit() {
    this.isSSLConnect = window.location.protocol == 'https:';
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
    if (this.userInput.open_profile) {
      this.result_address += count ? '&' : '?';
      this.result_address += 'open_profile=true';
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

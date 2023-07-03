import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-admin-tools',
  templateUrl: './admin-tools.page.html',
  styleUrls: ['./admin-tools.page.scss'],
})
export class AdminToolsPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    private nakama: NakamaService,
    private p5toast: P5ToastService,
  ) { }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  servers: ServerInfo[] = [];
  index = 0;
  isExpanded = true;

  select_server(i: number) {
    this.index = i;
    this.isExpanded = false;
  }

  /** 전체 발송 알림 */
  notification = {
    uri: '',
    msg: '',
  }

  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true, true);
    for (let i = this.servers.length - 1; i >= 0; i--) {
      if (!this.servers[i].is_admin)
        this.servers.splice(i, 1);
    }
  }

  is_sending = false;
  /** 모든 접속자에게 알림 메시지 발송 */
  async send_noti_to_server() {
    if (!this.notification.msg && !this.notification.uri) {
      this.p5toast.show({
        text: this.lang.text['AdminTools']['NoNotiMsg'],
      });
      return;
    }
    this.is_sending = true;
    let _is_official = this.servers[this.index].isOfficial;
    let _target = this.servers[this.index].target;

    this.notification.msg = encodeURIComponent(this.notification.msg);
    this.notification.uri = encodeURIComponent(this.notification.uri);

    try {
      await this.nakama.servers[_is_official][_target].client.rpc(
        this.nakama.servers[_is_official][_target].session,
        'send_noti_all_fn', this.notification);
    } catch (e) {
    }
    this.notification.msg = '';
    this.notification.uri = '';
    this.is_sending = false;
  }

}

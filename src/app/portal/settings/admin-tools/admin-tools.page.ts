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

  servers: ServerInfo[] = [];
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

  /** 모든 접속자에게 알림 메시지 발송 */
  send_noti_to_server(index: number) {
    if (!this.notification.msg) {
      this.p5toast.show({
        text: this.lang.text['AdminTools']['NoNotiMsg'],
      });
      return;
    }
    let _is_official = this.servers[index].isOfficial;
    let _target = this.servers[index].target;

    this.servers[_is_official][_target].client.rpc(
      this.servers[_is_official][_target].session,
      'send_noti_all_fn', { msg: 'test_msg' });
  }

}

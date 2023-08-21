import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonAccordionGroup } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';

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
    private alertCtrl: AlertController,
    public statusBar: StatusManageService,
  ) { }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  servers: ServerInfo[] = [];
  index = 0;
  isExpanded = true;

  select_server(i: number) {
    this.index = i;
    this.isExpanded = false;
    this.refresh_all_user();
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
    this.refresh_all_user();
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

  all_users = [];
  current_user_page = 1;
  all_user_page = 1;
  /** 한번에 보여지는 사용자 수 */
  LIST_PAGE_SIZE = 5;
  current_size: number[] = [];

  @ViewChild('UserSel') UserSel: IonAccordionGroup;

  refresh_all_user() {
    this.all_users.length = 0;
    this.current_size.length = 0;
    let _is_official = this.servers[this.index].isOfficial;
    let _target = this.servers[this.index].target;
    this.nakama.servers[_is_official][_target].client.rpc(
      this.nakama.servers[_is_official][_target].session,
      'query_all_users', {}).then(v => {
        this.all_users = v.payload as any;
        for (let i = 0, j = this.all_users.length; i < j; i++) {
          this.nakama.save_other_user(this.all_users[i], _is_official, _target);
          this.all_users[i] = this.nakama.load_other_user(this.all_users[i].user_id || this.all_users[i].id, _is_official, _target);
        }
        this.all_user_page = Math.ceil(this.all_users.length / this.LIST_PAGE_SIZE);
        this.current_user_page = 0;
        this.change_user_list_page(1);
      }).catch(e => {
        console.error('사용자 리스트 돌려받기 오류: ', e);
      });
  }

  change_user_list_page(forward: number) {
    switch (forward) {
      case 1: // 다음 페이지
        if (this.current_user_page < this.all_user_page) {
          this.current_user_page += 1;
          if (this.current_user_page == this.all_user_page)
            this.current_size = Array((this.all_users.length % this.LIST_PAGE_SIZE) == 0 ?
              this.LIST_PAGE_SIZE : (this.all_users.length % this.LIST_PAGE_SIZE));
          else this.current_size = Array(this.LIST_PAGE_SIZE);
          for (let i = 0, j = this.current_size.length; i < j; i++)
            this.current_size[i] = (this.current_user_page - 1) * this.LIST_PAGE_SIZE + i;
        }
        break;
      case -1: // 이전 페이지
        if (this.current_user_page - 1 > 0) {
          this.current_user_page -= 1;
          this.current_size = Array(this.LIST_PAGE_SIZE);
          for (let i = 0, j = this.current_size.length; i < j; i++)
            this.current_size[i] = (this.current_user_page - 1) * this.LIST_PAGE_SIZE + i;
        }
        break;
    }
    this.UserSel.value = undefined;
  }

  start_private_chat(user: any) {
    let _is_official = this.servers[this.index].isOfficial;
    let _target = this.servers[this.index].target;
    this.nakama.join_chat_with_modulation(user.user_id || user.id, 2, _is_official, _target, (c) => {
      if (c) this.nakama.go_to_chatroom_without_admob_act(c);
    }, true);
  }

  remove_user(user: any) {
    let _is_official = this.servers[this.index].isOfficial;
    let _target = this.servers[this.index].target;
    this.alertCtrl.create({
      header: user.display_name,
      message: this.lang.text['AdminTools']['ForceLeave'],
      buttons: [{
        text: this.lang.text['AdminTools']['ApplyLeave'],
        cssClass: 'danger',
        handler: async () => {
          try {
            await this.nakama.servers[_is_official][_target].client.rpc(
              this.nakama.servers[_is_official][_target].session,
              'remove_account_fn', { user_id: user.user_id || user.id });
            this.p5toast.show({
              text: `${this.lang.text['AdminTools']['UserLeaved']}: ${user.display_name}`,
            })
            this.refresh_all_user();
          } catch (e) {
            this.p5toast.show({
              text: `${this.lang.text['AdminTools']['UserLeavedFailed']}: ${e.statusText}`,
            })
          }

        }
      }]
    }).then(v => v.present());
  }
}

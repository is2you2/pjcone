import { Component, OnInit, ViewChild } from '@angular/core';
import { AlertController, IonAccordionGroup, LoadingController, NavController } from '@ionic/angular';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { GlobalActService } from 'src/app/global-act.service';


@Component({
  selector: 'app-admin-tools',
  templateUrl: './admin-tools.page.html',
  styleUrls: ['./admin-tools.page.scss'],
})
export class AdminToolsPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public nakama: NakamaService,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
    public global: GlobalActService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
  ) { }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  servers: ServerInfo[] = [];
  isOfficial: string;
  target: string;

  index = 0;
  isExpanded = true;

  select_server(i: number) {
    this.index = i;
    this.isOfficial = this.servers[i].isOfficial;
    this.target = this.servers[i].target;
    this.isExpanded = false;
    this.GetRegisteredArcadeURL();
    this.refresh_all_user();
    this.refresh_all_groups();
  }

  /** 전체 발송 알림 */
  notification = {
    uri: '',
    msg: '',
    noti_id: 1,
    persistent: false,
  }

  /** 서버에서 관리하는 아케이드 리스트 주소 */
  ArcadeListURL = '';

  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true, true);
    for (let i = this.servers.length - 1; i >= 0; i--) {
      if (!this.servers[i].is_admin)
        this.servers.splice(i, 1);
    }
    this.select_server(0);
  }

  ionViewDidEnter() {
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  /** 서버에 등록된 아케이드 URL 주소 받아오기 */
  GetRegisteredArcadeURL() {
    this.nakama.servers[this.isOfficial][this.target].client.readStorageObjects(
      this.nakama.servers[this.isOfficial][this.target].session, {
      object_ids: [{
        collection: 'arcade',
        key: 'url',
      }]
    }).then(v => {
      if (v.objects.length) this.ArcadeListURL = v.objects[0].value['data'];
      else this.ArcadeListURL = '';
    });
  }

  /** 아케이드 주소 설정하기 */
  async SetArcadeURL() {
    try {
      await this.nakama.servers[this.isOfficial][this.target].client.rpc(
        this.nakama.servers[this.isOfficial][this.target].session, 'set_arcade_url_fn',
        { data: this.ArcadeListURL });
      this.p5toast.show({
        text: this.lang.text['AdminTools']['SuccSetArcadeURL'],
      });
    } catch (e) {
      this.p5toast.show({
        text: `${this.lang.text['AdminTools']['FailedSetArcadeURL']}: ${e}`,
      });
    }
    this.global.open_link(this.ArcadeListURL);
  }

  is_sending = false;
  /** 모든 접속자에게 알림 메시지 발송 */
  send_noti_to_server() {
    if (!this.notification.msg && !this.notification.uri) {
      this.p5toast.show({
        text: this.lang.text['AdminTools']['NoNotiMsg'],
      });
      return;
    }
    this.is_sending = true;

    this.notification.msg = encodeURIComponent(this.notification.msg);
    this.notification.uri = encodeURIComponent(this.notification.uri);

    this.nakama.servers[this.isOfficial][this.target].client.rpc(
      this.nakama.servers[this.isOfficial][this.target].session,
      'send_noti_all_fn', this.notification)
      .then(_v => {
        this.notification.msg = '';
        this.notification.uri = '';
        this.is_sending = false;
      }).catch(e => {
        console.log('send_noti_to_server: ', e);
        this.p5toast.show({
          text: `${this.lang.text['AdminTools']['SendFailed']}: ${e}`,
        })
        this.is_sending = false;
      });
  }

  all_users = [];
  CurrentOnlineUser = 0;
  AllUserCount = 0;
  current_user_page = 1;
  all_user_page = 1;
  current_user_size: number[] = [];

  all_groups = [];
  AllGroupCount = 0;
  current_group_page = 1;
  all_group_page = 1;
  current_group_size: number[] = [];
  /** 한번에 보여지는 정보 수 */
  LIST_PAGE_SIZE = 5;

  @ViewChild('UserSel') UserSel: IonAccordionGroup;
  @ViewChild('GroupSel') GroupSel: IonAccordionGroup;

  refresh_all_user() {
    this.CurrentOnlineUser = 0;
    this.AllUserCount = 0;
    this.all_users.length = 0;
    this.current_user_size.length = 0;
    this.nakama.servers[this.isOfficial][this.target].client.rpc(
      this.nakama.servers[this.isOfficial][this.target].session,
      'query_all_users', {}).then(v => {
        this.all_users = v.payload as any;
        for (let i = 0, j = this.all_users.length; i < j; i++) {
          this.nakama.save_other_user(this.all_users[i], this.isOfficial, this.target);
          let user_id = this.all_users[i].id || this.all_users[i].user_id;
          this.nakama.load_other_user(user_id, this.isOfficial, this.target, user => {
            this.all_users[i] = { ...this.all_users[i], ...user };
            let original_time = new Date(this.all_users[i].create_time).getTime() - new Date().getTimezoneOffset() * 60 * 1000;
            this.all_users[i]['display_created'] = new Date(original_time).toISOString().split('.')[0];
            this.all_users[i]['is_me'] = user_id == this.nakama.servers[this.isOfficial][this.target].session.user_id;
          }, true);
          if (this.all_users[i]['online']) this.CurrentOnlineUser++;
        }
        this.AllUserCount = this.all_users.length;
        this.all_user_page = Math.ceil(this.all_users.length / this.LIST_PAGE_SIZE);
        this.current_user_page = 0;
        this.change_user_list_page(1);
      }).catch(e => {
        console.error('사용자 리스트 돌려받기 오류: ', e);
      });
  }

  refresh_all_groups() {
    this.AllGroupCount = 0;
    this.all_groups.length = 0;
    this.current_group_size.length = 0;
    this.nakama.servers[this.isOfficial][this.target].client.rpc(
      this.nakama.servers[this.isOfficial][this.target].session,
      'query_all_groups', {}).then(v => {
        this.all_groups = v.payload as any;
        for (let i = 0, j = this.all_groups.length; i < j; i++) {
          for (let k = 0, l = this.all_groups[i]['users'].length; k < l; k++) {
            if (this.all_groups[i]['users'][k].user.user_id == this.nakama.servers[this.isOfficial][this.target].session.user_id) {
              this.all_groups[i]['users'][k]['is_me'] = true;
              this.all_groups[i]['users'][k].user = this.nakama.users.self;
            } else this.all_groups[i]['users'][k].user = this.nakama.load_other_user(this.all_groups[i]['users'][k].user.user_id, this.isOfficial, this.target);
          }
          this.indexed.loadTextFromUserPath(`servers/${this.isOfficial}/${this.target}/groups/${this.all_groups[i].id}.img`, (e, v) => {
            if (e && v) this.all_groups[i].img = v;
          });
        }
        this.AllGroupCount = this.all_groups.length || 0;
        this.all_group_page = Math.ceil(this.all_groups.length / this.LIST_PAGE_SIZE) || 0;
        this.current_group_page = 0;
        this.change_group_list_page(1);
      }).catch(e => {
        console.error('그룹 리스트 돌려받기 오류: ', e);
      });
  }

  /** 해당 uid 를 페이지에서 찾기 */
  find_current_user_id(user_id: string) {
    for (let i = 0, j = this.all_users.length; i < j; i++)
      if (this.all_users[i].id == user_id) {
        this.current_user_page = Math.floor(i / 5);
        this.change_user_list_page(1);
        break;
      }
    this.UserSel.value = user_id;
  }

  /** 그룹 강제 해산 */
  force_breakup_group(group: any) {
    this.alertCtrl.create({
      header: group.name,
      message: this.lang.text['AdminTools']['ForceBreakUp'],
      buttons: [{
        text: this.lang.text['GroupDetail']['BreakupGroup'],
        cssClass: 'redfont',
        handler: () => {
          this.ForceBreakupGroupAct(group);
        }
      }]
    }).then(v => {
      this.global.p5KeyShortCut['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.global.p5KeyShortCut['Escape'] = () => {
          this.navCtrl.pop();
        }
      });
      v.present();
    });
  }

  async ForceBreakupGroupAct(group: any) {
    this.nakama.servers[this.isOfficial][this.target].client.rpc(
      this.nakama.servers[this.isOfficial][this.target].session,
      'force_remove_group', { group_id: group.id })
      .then(_v => {
        this.p5toast.show({
          text: `${this.lang.text['AdminTools']['ForceBreaked']}: ${group.name}`,
        })
        this.refresh_all_user();
        this.refresh_all_groups();
      }).catch(e => {
        console.log('force_breakup_group: ', e);
        this.p5toast.show({
          text: `${this.lang.text['AdminTools']['ForceBreakedFailed']}: ${e.statusText}`,
        });
      });
    this.nakama.remove_channel_files(this.isOfficial, this.target, this.nakama.groups[this.isOfficial][this.target][group.id]['channel_id']);
    let server_info = this.nakama.servers[this.isOfficial][this.target].info;
    try { // FFS 파일 중 내 계정으로 올린 파일들 일괄 삭제 요청
      let fallback = localStorage.getItem('fallback_fs');
      if (!fallback) throw '사용자 지정 서버 없음';
      let split_fullAddress = fallback.split('://');
      let address = split_fullAddress.pop().split(':');
      let protocol = split_fullAddress.pop();
      if (protocol) {
        protocol += ':';
      } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
      let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
      // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
      this.global.remove_files_from_storage_with_key(target_address, group.id, {});
    } catch (e) { }
    try { // cdn 파일들 일괄 삭제처리
      let target_address = `${server_info.useSSL ? 'https' : 'http'}://${server_info.address}`;
      this.global.remove_files_from_storage_with_key(target_address, group.id, { cdn_port: server_info.cdn_port, apache_port: server_info.apache_port });
    } catch (e) {
      console.log('파일 일괄 삭제 요청 실패: ', e);
    }
  }

  change_user_list_page(forward: number) {
    switch (forward) {
      case 1: // 다음 페이지
        if (this.current_user_page < this.all_user_page) {
          this.current_user_page += 1;
          if (this.current_user_page == this.all_user_page)
            this.current_user_size = Array((this.all_users.length % this.LIST_PAGE_SIZE) == 0 ?
              this.LIST_PAGE_SIZE : (this.all_users.length % this.LIST_PAGE_SIZE));
          else this.current_user_size = Array(this.LIST_PAGE_SIZE);
          for (let i = 0, j = this.current_user_size.length; i < j; i++)
            this.current_user_size[i] = (this.current_user_page - 1) * this.LIST_PAGE_SIZE + i;
        }
        break;
      case -1: // 이전 페이지
        if (this.current_user_page - 1 > 0) {
          this.current_user_page -= 1;
          this.current_user_size = Array(this.LIST_PAGE_SIZE);
          for (let i = 0, j = this.current_user_size.length; i < j; i++)
            this.current_user_size[i] = (this.current_user_page - 1) * this.LIST_PAGE_SIZE + i;
        }
        break;
    }
    this.UserSel.value = undefined;
  }

  change_group_list_page(forward: number) {
    switch (forward) {
      case 1: // 다음 페이지
        if (this.current_group_page < this.all_group_page) {
          this.current_group_page += 1;
          if (this.current_group_page == this.all_group_page)
            this.current_group_size = Array((this.all_groups.length % this.LIST_PAGE_SIZE) == 0 ?
              this.LIST_PAGE_SIZE : (this.all_groups.length % this.LIST_PAGE_SIZE));
          else this.current_group_size = Array(this.LIST_PAGE_SIZE);
          for (let i = 0, j = this.current_group_size.length; i < j; i++)
            this.current_group_size[i] = (this.current_group_page - 1) * this.LIST_PAGE_SIZE + i;
        }
        break;
      case -1: // 이전 페이지
        if (this.current_group_page - 1 > 0) {
          this.current_group_page -= 1;
          this.current_group_size = Array(this.LIST_PAGE_SIZE);
          for (let i = 0, j = this.current_group_size.length; i < j; i++)
            this.current_group_size[i] = (this.current_group_page - 1) * this.LIST_PAGE_SIZE + i;
        }
        break;
    }
    this.GroupSel.value = undefined;
  }

  async start_private_chat(user: any) {
    let c = await this.nakama.join_chat_with_modulation(user.user_id || user.id, 2, this.isOfficial, this.target, true);
    this.nakama.go_to_chatroom(c);
  }

  copy_id(id: string) {
    this.global.WriteValueToClipboard('text/plain', id);
  }

  remove_user(user: any) {
    let usernameInfo = user.display_name || this.lang.text['Profile']['noname_user'];
    try {
      if (this.nakama.usernameOverride[this.isOfficial][this.target][user.id])
        usernameInfo += ` (${this.nakama.usernameOverride[this.isOfficial][this.target][user.id]})`;
    } catch (e) { }
    this.alertCtrl.create({
      header: usernameInfo,
      message: this.lang.text['AdminTools']['ForceLeave'],
      buttons: [{
        text: this.lang.text['AdminTools']['ApplyLeave'],
        cssClass: 'redfont',
        handler: async () => {
          let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
          loading.present();
          await this.RemoveUser(user);
          loading.dismiss();
        }
      }]
    }).then(v => {
      this.global.p5KeyShortCut['Escape'] = () => {
        v.dismiss();
      }
      v.onDidDismiss().then(() => {
        this.global.p5KeyShortCut['Escape'] = () => {
          this.navCtrl.pop();
        }
      });
      v.present();
    });
  }

  async RemoveUser(user: any) {
    try {
      let server_info = this.nakama.servers[this.isOfficial][this.target].info;
      let target_address = `${server_info.useSSL ? 'https' : 'http'}://${server_info.address}`;
      await this.nakama.servers[this.isOfficial][this.target].client.rpc(
        this.nakama.servers[this.isOfficial][this.target].session,
        'remove_account_fn', { user_id: user.user_id || user.id });
      try { // FFS 파일 중 내 계정으로 올린 파일들 일괄 삭제 요청
        let fallback = localStorage.getItem('fallback_fs');
        if (!fallback) throw '사용자 지정 서버 없음';
        let split_fullAddress = fallback.split('://');
        let address = split_fullAddress.pop().split(':');
        let protocol = split_fullAddress.pop();
        if (protocol) {
          protocol += ':';
        } else protocol = this.global.checkProtocolFromAddress(address[0]) ? 'https:' : 'http:';
        let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
        // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
        this.global.remove_files_from_storage_with_key(target_address, user.user_id, {});
      } catch (e) { }
      try { // cdn 파일들 일괄 삭제처리
        this.global.remove_files_from_storage_with_key(target_address, user.user_id, { cdn_port: server_info.cdn_port, apache_port: server_info.apache_port });
      } catch (e) {
        console.log('파일 일괄 삭제 요청 실패: ', e);
      }
      this.p5toast.show({
        text: `${this.lang.text['AdminTools']['UserLeaved']}: ${user.display_name || this.lang.text['Profile']['noname_user']}`,
      })
      this.refresh_all_user();
      this.refresh_all_groups();
    } catch (e) {
      console.log('remove_user: ', e);
      this.p5toast.show({
        text: `${this.lang.text['AdminTools']['UserLeavedFailed']}: ${e.statusText}`,
      })
    }
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Escape'];
  }
}

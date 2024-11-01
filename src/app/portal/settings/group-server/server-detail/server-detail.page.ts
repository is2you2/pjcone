import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonToggle, NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { SERVER_PATH_ROOT } from 'src/app/app.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-server-detail',
  templateUrl: './server-detail.page.html',
  styleUrls: ['./server-detail.page.scss'],
})
export class ServerDetailPage implements OnInit, OnDestroy {

  constructor(
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private global: GlobalActService,
    private route: ActivatedRoute,
    private router: Router,
    private navCtrl: NavController,
  ) { }
  ngOnDestroy(): void {
    this.route.queryParams['unsubscribe']();
    if (this.global.PageDismissAct['quick-server-detail']) this.global.PageDismissAct['quick-server-detail']();
  }

  dedicated_info: ServerInfo = {};
  QRCodeSRC: any;
  FilteredInfo: ServerInfo = {};

  ngOnInit() {
    this.route.queryParams.subscribe(_p => {
      const navParams = this.router.getCurrentNavigation().extras.state;
      this.dedicated_info = navParams.data;
      this.FilteredInfo = {
        name: this.dedicated_info.name,
        address: this.dedicated_info.address,
        port: this.dedicated_info.port,
        key: this.dedicated_info.key,
        useSSL: this.dedicated_info.useSSL,
      };
      if (this.dedicated_info.address == '192.168.0.1')
        delete this.FilteredInfo.address;
      if (this.dedicated_info.key == 'defaultkey')
        delete this.FilteredInfo.key;
      if (this.dedicated_info.port == 7350)
        delete this.FilteredInfo.port;
      if (!this.dedicated_info.useSSL)
        delete this.FilteredInfo.useSSL;
      this.GenerateQRCode();
    });
  }

  GenerateQRCode() {
    this.QRCodeSRC = this.global.readasQRCodeFromString(
      `${SERVER_PATH_ROOT}pjcone_pwa/?server=${this.FilteredInfo.name || ''},${this.FilteredInfo.address || ''},${this.FilteredInfo.useSSL ? 'true' : ''},${this.FilteredInfo.port || ''},${this.FilteredInfo.key || ''}`.replace(' ', '%20'));
  }

  /** 사설서버 SSL 체크용 페이지 열람 */
  open_custom_check() {
    let address = (this.dedicated_info.useSSL ? 'https://' : 'http://') + this.dedicated_info.address;
    this.global.open_custom_site(address);
  }

  /** WebRTC 서버 정보 손상시 복구용 */
  async reGenerateWebRTCInfo() {
    await this.nakama.AutoGenWebRTCInfo(this.dedicated_info);
    this.p5toast.show({
      text: this.lang.text['ServerDetail']['RegenWebRTCDone'],
    });
  }

  index = 0;

  @ViewChild('ServerDetailuseSSL') ServerDetailuseSSL: IonToggle;

  ionViewDidEnter() {
    this.ServerDetailuseSSL.checked = this.dedicated_info.useSSL;
    this.global.p5KeyShortCut['Escape'] = () => {
      this.navCtrl.pop();
    }
  }

  /** 시작 진입 주소 생성 */
  copy_startup_address() {
    let startup_address =
      `${SERVER_PATH_ROOT}pjcone_pwa/?server=${this.FilteredInfo.name || ''},${this.FilteredInfo.address || ''},${this.FilteredInfo.useSSL ? 'true' : ''},${this.FilteredInfo.port || ''},${this.FilteredInfo.key || ''}`;
    this.global.WriteValueToClipboard('text/plain', startup_address.replace(' ', '%20'));
  }

  async apply_changed_info() {
    // 빈 이름 거르기
    if (!this.FilteredInfo.name) {
      this.p5toast.show({
        text: this.lang.text['GroupServer']['NeedSetDIsplayName'],
      });
      return;
    }

    this.dedicated_info.name = this.FilteredInfo.name;
    this.dedicated_info.target = this.FilteredInfo.target || this.FilteredInfo.name;
    // 기능 추가전 임시처리
    this.dedicated_info.address = this.FilteredInfo.address || '192.168.0.1';
    this.dedicated_info.port = this.FilteredInfo.port || 7350;
    this.dedicated_info.useSSL = this.ServerDetailuseSSL.checked || false;
    this.dedicated_info.isOfficial = this.FilteredInfo.isOfficial || 'unofficial';
    this.dedicated_info.key = this.FilteredInfo.key || 'defaultkey';

    let line = new Date().getTime().toString();
    line += `,${this.dedicated_info.isOfficial}`;
    line += `,${this.dedicated_info.name}`;
    line += `,${this.dedicated_info.target}`;
    line += `,${this.dedicated_info.address}`;
    line += `,${this.dedicated_info.port}`;
    line += `,${this.dedicated_info.useSSL}`;
    let v = await this.indexed.loadTextFromUserPath('servers/list_detail.csv');
    let list: string[] = [];
    if (v) list = v.split('\n');
    for (let i = 0, j = list.length; i < j; i++) {
      let sep = list[i].split(',');
      if (sep[3] == this.dedicated_info.target) {
        list.splice(i, 1);
        break;
      }
    }
    list.push(line);
    await this.indexed.saveTextFileToUserPath(list.join('\n'), 'servers/list_detail.csv');
    this.nakama.init_server(this.dedicated_info);
    this.nakama.servers[this.dedicated_info.isOfficial][this.dedicated_info.target].info = { ...this.dedicated_info };
    try {
      this.nakama.servers[this.dedicated_info.isOfficial][this.dedicated_info.target].socket.disconnect(true);
    } catch (e) { }
    if (this.global.PageDismissAct['quick-server-detail']) this.global.PageDismissAct['quick-server-detail']();
    this.navCtrl.pop();
  }

  ionViewWillLeave() {
    delete this.global.p5KeyShortCut['Escape'];
  }
}

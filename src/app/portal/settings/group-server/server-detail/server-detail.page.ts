import { Component, OnInit, ViewChild } from '@angular/core';
import { Clipboard } from '@awesome-cordova-plugins/clipboard/ngx';
import { IonToggle, ModalController, NavParams } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import clipboard from "clipboardy";
import { SERVER_PATH_ROOT, isPlatform } from 'src/app/app.component';

@Component({
  selector: 'app-server-detail',
  templateUrl: './server-detail.page.html',
  styleUrls: ['./server-detail.page.scss'],
})
export class ServerDetailPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParams: NavParams,
    public lang: LanguageSettingService,
    private p5toast: P5ToastService,
    private statusBar: StatusManageService,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private global: GlobalActService,
    private mClipboard: Clipboard,
  ) { }

  dedicated_info: ServerInfo;
  /** 타겟이 이미 존재한다면 타겟 수정 불가 */
  isTargetAlreadyExist = true;
  QRCodeSRC: any;

  ngOnInit() {
    this.dedicated_info = this.navParams.get('data');
    let filtered = {
      name: this.dedicated_info.name,
      address: this.dedicated_info.address,
      port: this.dedicated_info.port,
      key: this.dedicated_info.key,
      useSSL: this.dedicated_info.useSSL,
    };
    if (this.dedicated_info.address == '192.168.0.1')
      delete filtered.address;
    if (this.dedicated_info.key == 'defaultkey')
      delete filtered.key;
    if (this.dedicated_info.port == 7350)
      delete filtered.port;
    if (!this.dedicated_info.useSSL)
      delete filtered.useSSL;
    this.QRCodeSRC = this.global.readasQRCodeFromString(
      `${SERVER_PATH_ROOT}pjcone_pwa/?server=${filtered.name || ''},${filtered.address || ''},${filtered.useSSL ? 'true' : ''},${filtered.port || 7350},${filtered.key || ''}`);
    // 이미 target값이 등록되었는지 검토
    this.isTargetAlreadyExist = Boolean(this.statusBar.groupServer['unofficial'][this.dedicated_info.target]);
  }

  index = 0;

  @ViewChild('ServerDetailuseSSL') ServerDetailuseSSL: IonToggle;

  ionViewDidEnter() {
    this.ServerDetailuseSSL.checked = this.dedicated_info.useSSL;
  }

  /** 시작 진입 주소 생성 */
  copy_startup_address() {
    let startup_address =
      `https://is2you2.github.io/pjcone_pwa/?server=${this.dedicated_info['name'] || ''},${this.dedicated_info['address'] || ''},${this.dedicated_info.useSSL || ''},${this.dedicated_info.port || ''},${this.dedicated_info.key || ''}&open_profile=true`;
    this.mClipboard.copy(startup_address)
      .catch(_e => {
        clipboard.write(startup_address).then(() => {
          if (isPlatform == 'DesktopPWA')
            this.p5toast.show({
              text: `${this.lang.text['GlobalAct']['PCClipboard']}: ${startup_address}`,
            });
        }).catch(_e => { });
      });
  }

  async apply_changed_info() {
    // 빈 이름 거르기
    if (!this.dedicated_info.name) {
      this.p5toast.show({
        text: this.lang.text['GroupServer']['NeedSetDIsplayName'],
      });
      return;
    }

    this.dedicated_info.target = this.dedicated_info.target || this.dedicated_info.name;
    // 기능 추가전 임시처리
    this.dedicated_info.address = this.dedicated_info.address || '192.168.0.1';
    this.dedicated_info.port = this.dedicated_info.port || 7350;
    this.dedicated_info.useSSL = this.ServerDetailuseSSL.checked || false;
    this.dedicated_info.isOfficial = this.dedicated_info.isOfficial || 'unofficial';
    this.dedicated_info.key = this.dedicated_info.key || 'defaultkey';

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
    if (this.isTargetAlreadyExist) // 정보 수정으로 동작
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
    this.modalCtrl.dismiss();
  }
}

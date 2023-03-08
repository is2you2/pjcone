import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';

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
    this.QRCodeSRC = this.global.readasQRCodeFromId({
      type: 'server',
      value: filtered,
    });
    // 이미 target값이 등록되었는지 검토
    this.isTargetAlreadyExist = Boolean(this.statusBar.groupServer['unofficial'][this.dedicated_info.target]);
  }

  apply_changed_info() {
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
    this.dedicated_info.useSSL = this.dedicated_info.useSSL || false;
    this.dedicated_info.isOfficial = this.dedicated_info.isOfficial || 'unofficial';
    this.dedicated_info.key = this.dedicated_info.key || 'defaultkey';

    let line = new Date().getTime().toString();
    line += `,${this.dedicated_info.isOfficial}`;
    line += `,${this.dedicated_info.name}`;
    line += `,${this.dedicated_info.target}`;
    line += `,${this.dedicated_info.address}`;
    line += `,${this.dedicated_info.port}`;
    line += `,${this.dedicated_info.useSSL}`;
    this.indexed.loadTextFromUserPath('servers/list_detail.csv', (e, v) => {
      let list: string[] = [];
      if (e && v) list = v.split('\n');
      if (this.isTargetAlreadyExist) // 정보 수정으로 동작
        for (let i = 0, j = list.length; i < j; i++) {
          let sep = list[i].split(',');
          if (sep[3] == this.dedicated_info.target) {
            list.splice(i, 1);
            break;
          }
        }
      list.push(line);
      this.indexed.saveTextFileToUserPath(list.join('\n'), 'servers/list_detail.csv', (_v) => {
        this.nakama.init_server(this.dedicated_info);
        this.nakama.servers[this.dedicated_info.isOfficial][this.dedicated_info.target].info = { ...this.dedicated_info };
      });
      this.statusBar.groupServer[this.dedicated_info.isOfficial][this.dedicated_info.target] = 'offline';
      this.indexed.saveTextFileToUserPath(JSON.stringify(this.statusBar.groupServer), 'servers/list.json');
      this.modalCtrl.dismiss();
    });
  }

}

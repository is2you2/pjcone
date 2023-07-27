import { Component, OnDestroy, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { StatusManageService } from 'src/app/status-manage.service';

interface Logs {
  text: string;
  time: string;
  color?: string;
}

@Component({
  selector: 'app-wsclient',
  templateUrl: './wsclient.page.html',
  styleUrls: ['./wsclient.page.scss'],
})
export class WsclientPage implements OnInit, OnDestroy {

  client: WebSocket;
  address: string;
  status = 'offline';
  send_msg: string;

  logs: Logs[] = [];

  constructor(
    public lang: LanguageSettingService,
    public statusBar: StatusManageService,
  ) { }

  ngOnInit() { }

  connect_to_server() {
    switch (this.status) {
      case 'offline': // 연결하기
        if (this.client) this.client.close();
        this.status = 'pending'
        this.client = new WebSocket(`ws://${this.address}`);
        this.client.onopen = () => {
          this.status = 'online';
          this.logs.push({
            text: `${this.lang.text['WSClient']['Connected']}: ws://${this.address}`,
            time: this.createTimestamp(),
            color: '#34aa43',
          });
        }
        this.client.onmessage = async (ev: any) => {
          try {
            let received_test: string;
            if (typeof ev.data == 'string')
              received_test = ev.data;
            else received_test = await ev.data.text();
            this.logs.push({
              text: `${this.lang.text['WSClient']['Received']}: ${received_test}`,
              time: this.createTimestamp(),
            });
          } catch (e) {
            this.logs.push({
              text: `${this.lang.text['WSClient']['RecvError']}: ${e}`,
              time: this.createTimestamp(),
              color: this.statusBar.colors['missing'],
            });
          }
        }
        this.client.onerror = (e) => {
          console.log(e);
          this.logs.push({
            text: `${this.lang.text['WSClient']['SocketError']}: ${e}`,
            time: this.createTimestamp(),
            color: this.statusBar.colors['missing'],
          });
        }
        this.client.onclose = () => {
          this.logs.push({
            text: this.lang.text['WSClient']['button_missing'],
            time: this.createTimestamp(),
            color: this.statusBar.colors['missing'],
          });
          this.status = 'missing';
          setTimeout(() => {
            this.status = 'offline'
          }, 500);
        }
        break;
      default: // 연결 끊기
        this.client.close();
        break;
    }
  }

  send() {
    this.client.send(this.send_msg);
    this.send_msg = '';
  }

  createTimestamp(): string {
    let time = new Date();
    return `[${('0' + time.getHours()).slice(-2)
      }:${('0' + time.getMinutes()).slice(-2)
      }:${('0' + time.getSeconds()).slice(-2)
      }]`;
  }

  ngOnDestroy(): void {
    if (this.client) this.client.close();
  }
}

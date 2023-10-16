import { Component, OnDestroy, OnInit } from '@angular/core';
import { isNativefier } from 'src/app/app.component';
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

  placeholder_address = 'ws://127.0.0.1:0000';

  logs: Logs[] = [];
  logsDiv: HTMLElement;

  constructor(
    public lang: LanguageSettingService,
    public statusBar: StatusManageService,
  ) { }

  ngOnInit() {
    this.logsDiv = document.getElementById('logs');
    let is_ssl = (window.location.protocol == 'https:') && !isNativefier;
    if (is_ssl) this.placeholder_address = 'wss://127.0.0.1:0000';
  }

  scroll_down() {
    setTimeout(() => {
      let scrollHeight = this.logsDiv.scrollHeight;
      this.logsDiv.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }, 0);
  }

  connect_to_server() {
    switch (this.status) {
      case 'offline': // 연결하기
        if (this.client) this.client.close();
        this.status = 'pending'
        this.client = new WebSocket(this.address || this.placeholder_address);
        this.client.onopen = () => {
          this.status = 'online';
          this.logs.push({
            text: `${this.lang.text['WSClient']['Connected']}: ${this.address || this.placeholder_address}`,
            time: this.createTimestamp(),
            color: '#34aa43',
          });
          this.scroll_down();
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
            this.scroll_down();
          } catch (e) {
            console.log('connect_to_server: ', e);
            this.logs.push({
              text: `${this.lang.text['WSClient']['RecvError']}: ${e}`,
              time: this.createTimestamp(),
              color: this.statusBar.colors['missing'],
            });
            this.scroll_down();
          }
        }
        this.client.onerror = (e) => {
          console.log(e);
          this.logs.push({
            text: `${this.lang.text['WSClient']['SocketError']}: ${e['message'] || e}`,
            time: this.createTimestamp(),
            color: this.statusBar.colors['missing'],
          });
          this.scroll_down();
        }
        this.client.onclose = () => {
          this.logs.push({
            text: this.lang.text['WSClient']['button_missing'],
            time: this.createTimestamp(),
            color: this.statusBar.colors['missing'],
          });
          this.scroll_down();
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

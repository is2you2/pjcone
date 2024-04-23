import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-post-viewer',
  templateUrl: './post-viewer.page.html',
  styleUrls: ['./post-viewer.page.scss'],
})
export class PostViewerPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParam: NavParams,
    public lang: LanguageSettingService,
    private indexed: IndexedDBService,
  ) { }

  PostInfo: any;
  FileURLs = [];
  ngOnInit() {
    this.PostInfo = this.navParam.get('data');
    if (this.PostInfo['mainImage']) {
      let FileURL = URL.createObjectURL(this.PostInfo['mainImage']['blob']);
      this.PostInfo['mainImage']['MainThumbnail'] = FileURL;
      this.FileURLs.push(FileURL);
    }
    this.create_content();
  }

  p5canvas: p5;
  create_content() {
    console.log(this.PostInfo);
    let contentDiv = document.getElementById('PostContent');
    this.p5canvas = new p5((p: p5) => {
      p.setup = async () => {
        p.noCanvas();
        // 제목
        let title = p.createDiv(this.PostInfo['title']);
        title.style('font-size', '32px');
        title.style('font-weight', 'bold');
        title.parent(contentDiv);
        // 작성일
        let datetime = p.createDiv();
        datetime.style('padding-bottom', '16px');
        datetime.style('color', '#888');
        datetime.parent(contentDiv);
        let create_time = p.createDiv(`${this.lang.text['PostViewer']['CreateTime']}: ${new Date(this.PostInfo['create_time']).toLocaleString()}`);
        create_time.parent(datetime);
        if (this.PostInfo['create_time'] != this.PostInfo['modify_time']) {
          let modify_time = p.createDiv(`${this.lang.text['PostViewer']['ModifyTime']}: ${new Date(this.PostInfo['modify_time']).toLocaleString()}`);
          modify_time.parent(datetime);
        }
        // 내용
        if (this.PostInfo['content']) {
          let content: string[] = this.PostInfo['content'].split('\n');
          for (let i = 0, j = content.length; i < j; i++) {
            // 첨부파일인지 체크
            let is_attach = false;
            let content_len = content[i].length - 1;
            let index = 0;
            try {
              index = Number(content[i].substring(1, content_len));
              is_attach = content[i].charAt(0) == '[' && content[i].charAt(content_len) == ']' && !isNaN(index);
            } catch (e) { }
            if (is_attach) {
              switch (this.PostInfo['attachments'][index]['viewer']) {
                case 'image':
                  if (this.PostInfo['attachments'][index]['url']) {
                    let img = p.createImg(this.PostInfo['attachments'][index]['url'], `${index}`);
                    img.parent(contentDiv);
                  } else {
                    try {
                      let blob = await this.indexed.loadBlobFromUserPath(this.PostInfo['attachments'][index]['path'], this.PostInfo['attachments'][index]['type']);
                      let FileURL = URL.createObjectURL(blob);
                      this.FileURLs.push(FileURL);
                      let img = p.createImg(FileURL, `${index}`);
                      img.parent(contentDiv);
                    } catch (e) {
                      console.log('게시물 첨부파일 불러오기 오류: ', e);
                    }
                  }
                  break;
                default:
                  console.log('준비되지 않은 파일 뷰어');
                  break;
              }
            } else { // 일반 문자열
              let line = p.createDiv(content[i] + '&nbsp');
              line.parent(contentDiv);
            }
          }
        }
      }
    });
  }

  ionViewDidLeave() {
    if (this.p5canvas)
      this.p5canvas.remove();
    for (let i = 0, j = this.FileURLs.length; i < j; i++)
      URL.revokeObjectURL(this.FileURLs[i]);
  }
}

import { Injectable } from '@angular/core';

/** 리스트 판넬에 표시되는 상태들 */
interface PanelStatus {
  [id: string]: 'offline' | 'missing' | 'pending' | 'online' | 'certified';
}

/** status-bar를 가진 모든 개체의 상태를 검토하여 이곳에 기록해둠 */
@Injectable({
  providedIn: 'root'
})
export class StatusManageService {

  /** 각 상황별 색상 기억  
   * ```javascript
   * colors[PanelStatus.value] => return '#000000'; // hex색상값 반환
   * ```
   */
  colors = {
    offline: '#888',
    missing: '#880000',
    pending: '#dddd0c',
    online: '#4ff14f',
    certified: '#00ffff',
  }
  /** 채팅방 리스트별 연결 상태
   * { id: PanelStatus }
   */
  chatroom: PanelStatus = {};
  /** 관리중인 프로젝트 */
  project: PanelStatus = {};
  /** 업무 리스트 */
  task: PanelStatus = {};
  /** 설정에 들어있는 램프판넬 */
  settings: PanelStatus = {
    /** 그룹 서버 */
    groupServer: 'offline',
    /** 커뮤니티 서버 */
    communityServer: 'offline',
    /** 사설서버 전반적 동향 */
    dedicatedServer: 'offline',
  };
  /** 설정-사설서버 관리 목록 */
  dedicated: PanelStatus = {
    groupchat: 'offline',
  };
  /** 설정에서 관리되는 그룹들 */
  groups: PanelStatus = {};

  constructor() { }
}

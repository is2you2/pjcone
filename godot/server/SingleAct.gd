## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node
# 웹 소켓으로 DB 운용

# 사용자가 반드시 연결 시도하는 사용자 카운터 서버
var server:= WebSocketServer.new()
const PORT:= 12000
const HEADER:= 'Counter'

# 사용자 pid로 접속 카운트
var users:= []

# 오늘 서버에 몇명이 다녀갔어
var counter:= {
	# 현재 접속중인 인원
	'current': 0,
	# 중복여부 무관한 접속 누적
	'stack': 0,
	# 최대 동접 인원
	'maximum': 0,
}

# 관리자 아이디를 파일에서 관리
var admin_file:String

func _ready():
	server.connect("data_received", self, '_received')
	server.connect('client_connected', self, '_connected')
	server.connect('client_disconnected', self, '_disconnected')
	server.connect('client_close_request', self, '_disconnected')
	if Root.private:
		server.private_key = Root.private
	if Root.public:
		server.ssl_certificate = Root.public
	var err:= server.listen(PORT)
	if err != OK:
		Root.logging(HEADER, str('init error: ', err), Root.LOG_ERR)
	else:
		Root.logging(HEADER, str('Opened: ', PORT))
	Root.rich_node = $m/vbox/c/m/log
	Root.rich_node.bbcode_text = Root.rich_log
	admin_file = Root.html_path + 'admin.txt'
	var file:= File.new()
	if file.open(admin_file, File.READ) == OK:
		$m/vbox/AdminInfo/TargetUUID.text = file.get_as_text()
	file.close()

# esc를 눌러 끄기
func _input(event):
	if event.is_action_pressed("ui_cancel"):
		get_tree().quit()

# 관리와 관련된 알림을 받을 관리자 계정 pid
var administrator_pid:int
# 연결과 관련된 행동 쓰레드 충돌 방지용
var linked_mutex:= Mutex.new()
# 사이트에 연결 확인됨
func _connected(id:int, _proto:= 'EMPTY'):
	linked_mutex.lock()
	users.push_back(str(id))
	counter.current = users.size()
	counter.stack += 1;
	if counter.maximum < counter.current:
		counter.maximum = counter.current
	linked_mutex.unlock()
	$m/vbox/hbox/Current/Current2.text = str(counter['current'], '명');
	$m/vbox/hbox/Total/Total2.text = str(counter['maximum'], '명');
	$m/vbox/hbox/Stack/Stack2.text = str(counter['stack'], '명');
	Root.logging(HEADER, str('Connected: ', counter))

# 사이트로부터 연결 끊어짐
func _disconnected(id:int, _was_clean = null, _reason:= 'EMPTY'):
	linked_mutex.lock()
	users.erase(str(id))
	counter.current = users.size()
	linked_mutex.unlock()
	if id == administrator_pid:
		administrator_pid == 0
	# 일반 종료가 아닐 때 로그 남김
	if _was_clean is int and _was_clean != 1001:
		Root.logging(HEADER, str('Disconnected: ', counter, ' code: ', _was_clean, ' / ', _reason), '8bb')
	elif _was_clean is bool: # 상시 로그
		Root.logging(HEADER, str('Disconnected: ', counter, ' was_clean: ', _was_clean))
	$m/vbox/hbox/Current/Current2.text = str(counter['current'], '명');
	$m/vbox/hbox/Total/Total2.text = str(counter['maximum'], '명');
	$m/vbox/hbox/Stack/Stack2.text = str(counter['stack'], '명');

# 자료를 받아서 행동 코드별로 자식 노드에게 일처리 넘김
func _received(id:int, _try_left:= 5):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			match(json):
				{ 'act': 'global_noti', 'text': var _noti, .. }: # 커뮤니티 서버를 통한 알림 전파
					if id == administrator_pid:
						$m/vbox/SendAllNoti/AllNotiText.text = _noti
						$m/vbox/SendAllNotiImg/AllNotiURL.text = json['img']
						_on_Button_pressed()
					return
				{ 'act': 'is_admin', 'uuid': var uuid }:
					var is_admin = uuid == $m/vbox/AdminInfo/TargetUUID.text
					if is_admin:
						administrator_pid = id
					if is_admin and administrator_pid:
						var result = {
							'act': 'admin_noti',
							'text': '관리자 기능을 사용합니다',
						}
						send_to(administrator_pid, JSON.print(result).to_utf8())
					return
				_: # 준비되지 않은 행동
					Root.logging(HEADER, str('UnExpected Act: ', data), Root.LOG_ERR)
		else: # 형식 오류
			Root.logging(HEADER, str('UnExpected form: ', data), Root.LOG_ERR)
	else: # 패킷 오류
		Root.logging(HEADER, str('packet error: ', err), Root.LOG_ERR)
		if _try_left > 0:
			Root.logging(HEADER, str('receive packet error with _try_left: ', _try_left))
			yield(get_tree(), 'idle_frame')
			_received(id, _try_left - 1)
		else:
			Root.logging(HEADER, str('receive packet error and try left out.'), Root.LOG_ERR)
			server.disconnect_peer(id, 1011, 'MainServer packet receive try left out.')


# 특정 사용자에게 보내기
func send_to(id:int, msg:PoolByteArray, _try_left:= 5):
	var err:= server.get_peer(id).put_packet(msg)
	if err != OK:
		if _try_left > 0:
			Root.logging(HEADER, str('send packet error with _try_left: ', _try_left))
			yield(get_tree(), 'idle_frame')
			send_to(id, msg, _try_left - 1)
		else:
			Root.logging(HEADER, str('send packet error and try left out.'), Root.LOG_ERR)
			server.disconnect_peer(id, 1011, 'MainServer packet send try left out.')


# 해당 사용자를 제외하고 발송
func send_except(id:int, msg:PoolByteArray):
	for user in $UserManager.users:
		if user != id:
			send_to(user, msg)


# 모든 연결된 사용자에게 메시지 보내기
func send_to_all(msg:PoolByteArray):
	for user in $UserManager.users:
		send_to(user, msg)


func _process(_delta):
	server.poll()


func _exit_tree():
	server.stop()

func _on_Button_pressed():
	if not $m/vbox/SendAllNoti/AllNotiText.text: return
	for user in users:
		var result = {
			'act': 'all_noti',
			'text': $m/vbox/SendAllNoti/AllNotiText.text,
			'img': $m/vbox/SendAllNotiImg/AllNotiURL.text,
		}
		send_to(int(user), JSON.print(result).to_utf8())
	$m/vbox/SendAllNoti/AllNotiText.text = ''
	$m/vbox/SendAllNotiImg/AllNotiURL.text = ''

# 관리자 아이디를 파일로 관리
func _on_TargetUUID_text_changed(new_text):
	var file:= File.new()
	if file.open(admin_file, File.WRITE) == OK:
		file.store_string(new_text)
	file.close()

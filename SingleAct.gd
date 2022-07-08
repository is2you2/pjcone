extends Node
# 웹 소켓으로 DB 운용

# 사용자가 반드시 연결 시도하는 사용자 카운터 서버
var server:= WebSocketServer.new()
const PORT:= 12000
# 데이터베이스 폴더 경로 with '/'
var root_path:String
# 웹 페이지 경로 with '/'
var html_path:String
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

func _init():
	if OS.is_debug_build():
		root_path = 'res://gd_database/'
		html_path = 'res://pjcone_pwa/src/'
		var file:= File.new() # 테스트 중인 경우 이 폴더를 프로젝트로부터 무시합니다
		if file.open(root_path + '.gdignore', File.WRITE):
			file.store_string('gdignore')
		file.flush()
		file.close()
	else: # 서버 실행파일이 위치한 경로로부터
		root_path = OS.get_executable_path() + '/gd_database/'
		html_path = OS.get_executable_path() + '/'
	# 폴더가 준비되어있지 않으면 생성하기
	var dir:= Directory.new()
	if not dir.dir_exists(root_path):
		dir.make_dir_recursive(root_path)


func _ready():
	server.connect("data_received", self, '_received')
	server.connect('client_connected', self, '_connected')
	server.connect('client_disconnected', self, '_disconnected')
	server.connect('client_close_request', self, '_disconnected')
	var err:= server.listen(PORT)
	if err != OK:
		Root.logging(HEADER, str('init error: ', err), Root.LOG_ERR)
	else:
		Root.logging(HEADER, str('Opened: ', PORT))

# esc를 눌러 끄기
func _input(event):
	if event.is_action_pressed("ui_cancel"):
		get_tree().quit()

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
	Root.logging(HEADER, str('Connected: ', counter))

# 사이트로부터 연결 끊어짐
func _disconnected(id:int, _was_clean = null, _reason:= 'EMPTY'):
	linked_mutex.lock()
	users.erase(str(id))
	counter.current = users.size()
	linked_mutex.unlock()
	# 일반 종료가 아닐 때 로그 남김
	if _was_clean is int and _was_clean != 1001:
		Root.logging(HEADER, str('Disconnected: ', counter, ' was_clean: ', _was_clean))
	else: # 상시 로그
		Root.logging(HEADER, str('Disconnected: ', counter, ' code: ', _was_clean, ' / ', _reason))

# 자료를 받아서 행동 코드별로 자식 노드에게 일처리 넘김
func _received(id:int, _try_left:= 5):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			match(json):
				{ 'act': 'sc1_custom', .. }: # SC1_custom 폴더 리스트 새로고침
					$SC_custom_manager.refresh_list()
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

extends Node
# 웹 소켓으로 DB 운용

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
	admin_file = Root.html_path + 'admin.txt'
	var file:= File.new()
	if file.open(admin_file, File.READ) == OK:
		$m/vbox/AdminInfo/TargetUUID.text = file.get_as_text().trim_suffix('\n')
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
	display_counter_value()
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
	display_counter_value()


# 자료를 받아서 화면에 게시
func display_counter_value():
	$m/vbox/GridContainer/Current_0/Current_0.text = str(counter['current']);
	$m/vbox/GridContainer/Maximum_0/Maximum_0.text = str(counter['maximum']);
	$m/vbox/GridContainer/Stack_0/Stack_0.text = str(counter['stack']);

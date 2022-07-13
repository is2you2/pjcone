extends Node
# MiniRanchat 서버 병합


var server:= WebSocketServer.new()
const HEADER:= 'MiniRanchat'
const PORT:= 12011


var thread:= Thread.new()
# 접속자 리스트
var pid_list:= []
# 짝지어진 사람들(쌍방 관리)
var matched:= {}
# 대화를 대기중인 사람들
var waiting:= []


func _init():
	server.connect("client_connected",self,"_connected")
	server.connect("client_disconnected",self,"_disconnected")
	server.connect("client_close_request",self,"_disconnected")
	server.connect("data_received",self,"_received")

func _input(event):
	if event.is_action_pressed("ui_cancel"):
		get_tree().quit()

func _ready():
	set_process(false)
	var err:= server.listen(PORT)
	if err == OK:
		Root.logging(HEADER, str('Listening: %d' % PORT), 'afa')
		var ter:= thread.start(self, '_polling')
		if ter != OK:
			Root.logging(HEADER, str('Thread Polling 실패'), Root.LOG_ERR)
			set_process(true)
		matching_system()
	else: # 여는 것 조차 실패
		Root.logging(HEADER, str('failed: ', err), Root.LOG_ERR)


# 오늘 서버에 몇명이 다녀갔어
var counter:= {
	# 현재 접속중인 인원
	'current': 0,
	# 중복여부 무관한 접속 누적
	'stack': 0,
	# 최대 동접 인원
	'maximum': 0,
	# 매칭 시킨 사람 수
	'matched': 0,
}
var mutex:= Mutex.new()

func _connected(id:int, _proto:='EMPTY_PROTO'):
	mutex.lock()
	pid_list.push_back(id)
	waiting.push_back(id)
	counter.current = pid_list.size()
	counter.stack += 1;
	if counter.maximum < counter.current:
		counter.maximum = counter.current
	Root.logging(HEADER, str('Conntected: %s' % counter))
	var _count:= str('Current:%d' % counter.current).to_utf8()
	for user in pid_list:
		send_to(user, _count)
	mutex.unlock()

func _disconnected(id:int, _was_clean = null, _reason:= 'EMPTY_REASON'):
	mutex.lock()
	pid_list.erase(id)
	if matched.has(id):
		var _partner:int = matched[id]
		matched.erase(_partner)
		send_to(_partner, 'PARTNER_OUT'.to_utf8())
	matched.erase(id)
	waiting.erase(id)
	counter.current = pid_list.size()
	var _count:= str('Current:%d' % counter.current).to_utf8()
	for user in pid_list:
		send_to(user, _count)
	mutex.unlock()
	# 일반 종료가 아닐 때 로그 남김
	if _was_clean is int and _was_clean != 1001:
		Root.logging(HEADER, str('Disconnected: ', counter, ' code: ', _was_clean, ' / ', _reason), '8bb')
	elif _was_clean is bool: # 상시 로그
		Root.logging(HEADER, str('Disconnected: ', counter, ' was_clean: ', _was_clean))

func _received(id:int, _try_left:= 5):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id). get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			send_to(id, raw_data)
			send_to(matched[id], raw_data)
		else:
			match(data):
				'REQ_REGROUPING':
					if matched.has(id):
						var _partner:int = matched[id]
						matched.erase(_partner)
						send_to(_partner, 'PARTNER_OUT'.to_utf8())
					matched.erase(id)
					if not waiting.has(id):
						waiting.push_back(id)
	else:
		if _try_left > 0:
			yield(get_tree().create_timer(1), "timeout")
			_received(id, _try_left - 1)
		else:
			server.disconnect_peer(id, 1011, 'Send try left out')

func send_to(id:int, msg:PoolByteArray, _try_left:= 5):
	var packet:= server.get_peer(id).put_packet(msg)
	if packet != OK:
		if _try_left > 0:
			yield(get_tree().create_timer(1), "timeout")
			send_to(id, msg, _try_left - 1)
		else:
			server.disconnect_peer(id, 1011, 'Send try left out')

func _polling():
	if server.is_listening():
		server.poll()
		yield(get_tree(), "physics_frame")
		_polling()

func _process(_delta):
	server.poll()

# 지정된 시간에 한번씩 모인 사람들을 랜덤으로 엮음
func matching_system():
	var _size:= waiting.size()
	if _size > 1: # 짝 찾기가 수월하다면
		randomize()
		waiting.shuffle()
		var sep_waiting:= []
		for i in range(_size / 2):
			sep_waiting.push_back(waiting.pop_front())
		var sep_size:= sep_waiting.size()
		for i in range(sep_size):
			var _parter1:int = waiting.pop_front()
			var _parter2:int = sep_waiting.pop_front()
			matched[_parter1] = _parter2
			matched[_parter2] = _parter1
			send_to(_parter1, 'GOT_MATCHED'.to_utf8())
			send_to(_parter2, 'GOT_MATCHED'.to_utf8())
			counter.matched += 1
	yield(get_tree().create_timer(5), "timeout")
	var for_idle:= str('LONG_TIME_NO_SEE:%d' % counter.current).to_utf8()
	for pid in waiting:
		send_to(pid, for_idle)
	matching_system()

func _exit_tree():
	server.stop()
	thread.wait_to_finish()
	Root.logging(HEADER, str('exit_tree'), Root.LOG_ERR)
